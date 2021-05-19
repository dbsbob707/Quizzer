// Modules
const express = require("express");
const mongoose = require("mongoose");

// Custom Modules
const apiErr = require("../api_error");
const quizzerSchema = require("../schemas/quizzer_schema");
const ws = require("./../websocket_handler");
const questionsHandler = require("./../questions_handler");

// Router for the /quizzers/:quizID/rounds and /quizzers/:quizID/rounds/:roundID/questions
const roundsRouter = express.Router({
    // MergeParams is set to true, 
    // because this way the quizID query param will be passed to this router
    mergeParams: true
});

roundsRouter.route("/")
    .get(async (req, res, next) => {
        try {
            const findRes = await quizzerSchema.findOne(
                {_id: req.quizID},
                {_id: 0, teams: 0, __v: 0}
            );
            res.status(200).json(JSON.stringify(findRes));
        } catch (err) {
            next(err);
        }
    }
);

roundsRouter.route("/")
    .post(async (req, res, next) => {
        try {
            const selectedCategories = [...req.body.categories];

            const updateRes = await quizzerSchema.updateOne(
                {_id: req.quizID},
                {$push: {rounds: { _id: req.body.roundNumber, selectedCategories: selectedCategories, questions: [] }}},
            );
            
            // Push roundanswers into answers and push qp into teams
            await quizzerSchema.updateMany(
                {_id: req.quizID},
                {
                    $push: {
                        "teams.$[].answers": {_id: req.body.roundNumber, roundsanswers: [], checked: false, correct: false},
                        "teams.$[].qp": 0
                    }
                }
            );

            if(updateRes.ok !== 1) {
                throw new Error("[/quizzers/:quizID/rounds - POST] - No document was added");
            }

            // Notify Scoreboard and Teams a round has started
            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_ROUND_STARTED);
            ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_ROUND_STARTED);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

roundsRouter.route("/next_question")
    .patch(async (req, res, next) => {
        ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_NEXT_QUESTION);
        ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_NEXT_QUESTION);
        res.status(200).send("OK");
    }
);

roundsRouter.route("/next_round")
    .patch(async (req, res, next) => {
        ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_NEXT_ROUND);
        ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_NEXT_ROUND);
        res.status(200).send("OK");
    }
);

// Custom Middleware to check if information about a certain round is available or not in the DB
// If not throw apiErr
roundsRouter.use("/:roundNumber", async (req, res, next) => {
    try {
        req.roundNumber = req.params.roundNumber;
        const findRes = await quizzerSchema.findOne(
            {_id: req.quizID, "rounds._id": req.roundNumber}
        );
        if(!findRes) {
            throw new apiErr("[/quizzers/:quizID/rounds GET] - Couldn't retrieve information from specified Round in specified Quizzer.");
        } else {
            next();
        }
    } catch(err) {
        next(err);
    }
})

roundsRouter.route("/:roundNumber")
    .get(async (req, res, next) => {
        try {
            const findRes = await quizzerSchema.findOne(
                {_id: req.quizID, "rounds._id": req.roundNumber},
                {_id: 0, teams: 0, __v: 0}
            );
            res.status(200).json(JSON.stringify(findRes));
        } catch (err) {
            next(err);
        }
    }
);

roundsRouter.route("/:roundNumber/questions")
    .get(async (req, res, next) => {
        try {
            const findRes = await quizzerSchema.findOne(
                {_id: req.quizID, "rounds._id": req.roundNumber},
                {_id: 0, teams: 0, __v: 0}
            );
            // ParsedRoundNumber - 1 gives the index in the rounds array
            const parsedRoundNumber = parseInt(req.roundNumber);
            const questionsResponseJSON = JSON.stringify(findRes.rounds[parsedRoundNumber].questions);
            res.status(200).json(questionsResponseJSON);
        } catch (err) {
            next(err);
        }
    }
);

roundsRouter.route("/:roundNumber/questions")
    .post(async (req, res, next) => {
        try {
            const questionInformation = {...req.body};

            const updateRes = await quizzerSchema.updateOne(
                {_id: req.quizID, "rounds._id": req.roundNumber},
                {$push: {"rounds.$.questions": {$each: [questionInformation]}}}
            );

            if(updateRes.ok !== 1) {
                throw new Error("[/quizzers/:quizID/rounds/:roundNumber/questions - POST] - No question was added");
            }

            // Remove added question from current available questions
            const questionsLoc = `quizzer_questions/quizzers_data/${req.quizID}_questions.json`;
            await questionsHandler.removeQuestion(questionsLoc, questionInformation.question);

            // Notify the ScoreBoard and the teams
            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_QUESTION_STARTED);
            ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_QUESTION_STARTED);

            res.status(200).send("OK");
        } catch (err) {
            next(err);   
        }
    }
);

roundsRouter.route("/:roundNumber/questions/:questionID")
    .get(async (req, res, next) => {
        try {
            const findResult = await quizzerSchema.aggregate(
                [
                    { 
                        "$match" : { 
                            "_id" : `${req.quizID}`
                        }
                    }, 
                    { 
                        "$unwind" : { 
                            "path" : "$rounds"
                        }
                    }, 
                    { 
                        "$match" : { 
                            "rounds._id" : Number(req.roundNumber)
                        }
                    }, 
                    { 
                        "$replaceRoot" : { 
                            "newRoot" : "$rounds"
                        }
                    }, 
                    { 
                        "$unwind" : { 
                            "path" : "$questions"
                        }
                    }, 
                    { 
                        "$match" : { 
                            "questions._id" : mongoose.Types.ObjectId(req.params.questionID)
                        }
                    }, 
                    { 
                        "$project" : { 
                            "_id" : 0.0, 
                            "questions._id" : 1.0, 
                            "questions.question" : 1.0, 
                            "questions.answer" : 1.0, 
                            "questions.category" : 1.0
                        }
                    }
                ],
            );
            
            // No result was found
            if(findResult.length === 0) {
                throw new apiErr("[/quizzers/:quizID/rounds/:roundNumber/questions/:questionID GET] - Couldn't retrieve information about specified question.");
            } else {
                res.status(200).json(findResult[0].questions);
            }
        } catch (err) {
            next(err);
        }
    }
);

module.exports = roundsRouter;