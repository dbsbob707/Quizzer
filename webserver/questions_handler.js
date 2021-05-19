const filesystem = require("fs");

const loadQuestionsFile = async fileLocation => {
    let contents = await filesystem.promises.readFile(fileLocation, "utf8");
    return contents;
};

const writeQuestionsFile = async (fileLocation, data) => {
    await filesystem.promises.writeFile(fileLocation, data);
}

const retrieveCategories = questions => {
    try {
        let categories = questions.map(question => question.category);

        // Filters unique categories
        return categories.sort().filter((item, pos, ary) => {
            return !pos || item != ary[pos - 1];
        });
    } catch (err) {
        console.error(`Error while mapping categories: ${err}`);
    }
};

const copyQuestionsToUniqueFile = async (srcLocation, destinationLocation) => {
    try {
        await filesystem.promises.copyFile(srcLocation, destinationLocation, filesystem.constants.COPYFILE_EXCL);
    } catch (err) {
        throw new Error(`Error while copying filecontents: ${err}`);
    }
};

const retrieveCategoriesFromFile = async fileLocation => {
    try {
        let fileContents = await loadQuestionsFile(fileLocation);
        let questionsArray = await JSON.parse(fileContents);
        return retrieveCategories(questionsArray);
    } catch(err) {
        throw new Error(`Error while retrieving categories from file: ${err}`);
    }
}

const retrieveQuestions = async (fileLocation, categories) => {
    try {
        // Retrieves Questions from file and parses to JSON
        const fileContents = await loadQuestionsFile(fileLocation);
        const questionsArray = await JSON.parse(fileContents);

        // Filters Questions based on specified categories
        let filteredQuestions = questionsArray.filter(question => categories.includes(question.category));
        
        // Create an Object for each category
        let questionsForCategory = {};
        let finalQuestions = {};
        // Fill Questions per category and remove question with category from filteredquestions
        // Add questions to questions per cat object
        categories.forEach(cat => {
            questionsForCategory[cat] = filteredQuestions.filter(question => question.category === cat);
            finalQuestions[cat] = [];
            filteredQuestions = filteredQuestions.filter(question => question.category !== cat);
        });

        // Pick random 2 random questions per category and put them in the finalQuestions-obj
        for(const category in questionsForCategory) {
            let randomIndexes = [];
            for(let i = 0; i < 2; i++) {
                let randomRoll = Math.floor(Math.random() * questionsForCategory[category].length);
                // Reroll if index is already in array. This prevents double questions from being included in the QM_APP
                while(randomIndexes.includes(randomRoll)) {
                    randomRoll = Math.floor(Math.random() * questionsForCategory[category].length);
                }
                randomIndexes.push(randomRoll);
            }
            randomIndexes.forEach(index => finalQuestions[category].push(questionsForCategory[category][index]));
        }
        return finalQuestions;
    } catch (err) {
        throw new Error(`Error while retrieving questions: ${err}`);
    }
}

const removeQuestion = async (fileLocation, specifiedQuestion) => {
    try {
        // Retrieves Questions from file and parses to JSON
        const fileContents = await loadQuestionsFile(fileLocation);
        let questionsArray = await JSON.parse(fileContents);

        // Get the index of the question in the questionsArray
        let questionIndex = questionsArray.map(question => question.question).indexOf(specifiedQuestion);

        while(questionIndex !== -1){
            questionsArray.splice(questionIndex, 1);
            questionIndex = questionsArray.map(question => question.question).indexOf(specifiedQuestion);
        }
        const jsonQuestionArray = await JSON.stringify(questionsArray);
        await writeQuestionsFile(fileLocation, jsonQuestionArray);
    } catch(err) {
        throw new Error(`Error while deleting question from file: ${err}`);
    }
};

module.exports = {copyQuestionsToUniqueFile, retrieveCategoriesFromFile, retrieveQuestions, removeQuestion};