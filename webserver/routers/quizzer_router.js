// Modules
const express = require("express");
const quizCodeGenerator = require("generate-sms-verification-code");

// Custom Modules
const questionsHandler = require("./../questions_handler");
const questionsRouter = require("./questions_router");
const teamsRouter = require("./teams_router");
const roundsRouter = require("./rounds_router");
const ws = require("./../websocket_handler");
const apiErr = require("./../api_error");
const quizzerModel = require("./../schemas/quizzer_schema");

/** 
 * Function which finds a unique 6-letter code
 * quizCodeGenerator --> Generates the code
 * Afterwards checks in MongoDB if there is a quiz with the generated code
 * If so -> Repeat, If not -> return code
*/

let generatorAmount = 6;
generateNonExistingCode = async () => {
    let flip = false;
    let code;
    let retries = 0;
    while(!flip){
        if (retries > 50) {
            // This will increase the amount of possibilities to generate a larger code
            generatorAmount++;
        }
        code = quizCodeGenerator(generatorAmount, Number);
        const result = await quizzerModel.findById(code);
        if(!result) {
            flip = true;
        }
        retries++;
    }
    return code;
}

const quizzerRouter = express.Router();

// Middleware to check if game is available in MongoDB and Add quizID in req
quizzerRouter.use("/:quizID", async(req, res, next) => {
    try {
        req.quizID = req.params.quizID;
        const quizInfo = await quizzerModel.findById(req.quizID);
        if(!quizInfo) {
            throw new apiErr("[/quizzers/:quizID - GET] - Quiz information couldn't be found in the DB");
        } else {
            next();
        }
    } catch(err) {
        next(err);
    }
});

//  Define others routers
quizzerRouter.use("/:quizID/teams", teamsRouter);
quizzerRouter.use("/:quizID/questions", questionsRouter);
quizzerRouter.use("/:quizID/rounds", roundsRouter);

quizzerRouter.route("/")
    .post(async (req, res, next) => {
        try {
            // Checks if quizmasterName is supplied in the POST-request
            // If not, throw custom APIError
            if(!req.body.quizmasterName || !req.body.questionLanguage) {
                throw new apiErr("[/quizzers/ - POST] - quizmasterName or questionLanguage was not defined");
            }
            // Creates a new Quizzer and returns a generatedQuizID
            const code = await generateNonExistingCode();
            await quizzerModel.createQuizzer(code, `${req.body.quizmasterName}`);

            // Create file for the questions from a quizzer depending on the given language
            let quizzerQuestionsLoc;
            if(req.body.questionLanguage === "ENG") {
                quizzerQuestionsLoc = "quizzer_questions/Questions.json";
            } else { // Default
                quizzerQuestionsLoc = "quizzer_questions/Vragen.json";
            }
            const destinationLocQuestions = `quizzer_questions/quizzers_data/${code}_questions.json`;
            await questionsHandler.copyQuestionsToUniqueFile(quizzerQuestionsLoc, destinationLocQuestions);
            res.status(200).json(JSON.stringify({quizID: code}));
        } catch(err) {
            next(err);
        }
    }
);

quizzerRouter.route("/:quizID")
    .get(async (req, res, next) => {
        try {
            const quizInformation = await quizzerModel.findById(req.quizID, {_id: 0, __v: 0});
            res.status(200).json(JSON.stringify(quizInformation));
        } catch (err) {
            next(err);
        }
    }
);

quizzerRouter.route("/:quizID/end_quizzer")
    .patch(async (req, res, next) => {
        ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_END_QUIZZER);
        ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_END_QUIZZER);
        ws.closeConnectionClientsFromQuizzer(req.quizID);
        res.status(200).send("OK");
    }
);

module.exports = quizzerRouter;