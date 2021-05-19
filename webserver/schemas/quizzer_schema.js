const mongoose = require("mongoose");

// Custom Schemas
const Team = require("./teams_schema");
const Round = require("./round_schema");

const quizzerSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        quizmaster: {
            type: String,
            required: true
        },
        teams: [Team],
        rounds: [Round]
    }
)

// Function-syntax needs to be used to pass this from the quizzerSchema
quizzerSchema.statics.createQuizzer = function(id, qmName) {
    let newQuizzer = new this(
        {
            _id: id,
            quizmaster: qmName
        }
    );
    newQuizzer.save();
}

quizzerSchema.statics.applyTeam = async function(quizID, teamName) {
    // Checks if teamname is already in use
    const checkIfAvailable = await this.model("Quizzer").find({_id: quizID, "teams._id" : teamName });
    if(Object.keys(checkIfAvailable).length > 0) {
        return {res: false, customErr: "Teamname already in use"};
    }

    // If not in use execute the following code
    await this.model("Quizzer").findByIdAndUpdate(quizID, {$push: 
        {
            teams: 
            {
                _id: teamName,
                approved: false,
                rp: 0
            }
        }
    });
}

quizzerSchema.statics.findTeamById = async function(quizID, teamName) {
    const result = await this.model("Quizzer").find({_id: quizID, "teams._id": teamName}, {_id: 0, __v: 0, rounds: 0});
    const filteredResult = result[0].teams.filter(team => team._id === teamName);
    return filteredResult;
}

module.exports = mongoose.model("Quizzer", quizzerSchema);