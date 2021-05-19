// Modules
const express = require("express");

// Custom Modules
const apiErr = require("./../api_error");
const quizzerModel = require("./../schemas/quizzer_schema");
const ws = require("./../websocket_handler");

const teamsRouter = express.Router({
    // MergeParams is set to true, 
    // because this way the quizID query param will be passed to this router
    mergeParams: true
});

// Get information from all the teams
teamsRouter.route("/")
    .get(async (req, res, next) => {
        try {
            const teamsInfo = await quizzerModel.findById(req.quizID, {_id: 0, quizmaster:0, rounds: 0, __v: 0});
            res.status(200).json(JSON.stringify(teamsInfo));
        } catch (err) {
            next(err);
        }
    }
);

// Add a team to the quizzer
teamsRouter.route("/")
    .post(async (req, res, next) => {
        try {
            if(!req.body.teamName) {
                throw new apiErr("[/quizzers/:quizID/teams - POST] - teamName was not defined");
            }
            const result = await quizzerModel.applyTeam(req.quizID, req.body.teamName);
            if(result) {
                // If customError is returned from applyteam, send 409. Which means teamname is already used in quiz.
                if(result.customErr) {
                    res.status(409).send(`${result.customErr}`);
                }
            } else {
                // Notifies the QuizMaster a team has applied
                ws.notifySingleClient(req.quizID, ws.APPTYPES.QM, ws.MESSAGETYPES.QM_TEAM_APPLICATION);
                res.status(200).send("OK");
            }
        } catch (err) {
            next(err)
        }
    }
);

teamsRouter.route("/qp")
    .put(async(req, res, next) =>{
        try {
            req.body.forEach(async team => {
                // Remove last given answer from array
                const deleteLastScore = await quizzerModel.updateOne(
                    {_id: req.quizID},
                    {
                        $pop: {
                            "teams.$[teamID].qp": 1
                        },
                    },
                    {
                        arrayFilters: [
                            {"teamID._id": team.teamName}
                        ]
                    }
                );

                // Add new score into round array
                const addNewScore = await quizzerModel.updateOne(
                    {_id: req.quizID},
                    {
                        $push: {
                            "teams.$[teamID].qp": team.qp
                        },
                    },
                    {
                        arrayFilters: [
                            {"teamID._id": team.teamName}
                        ]
                    }
                )
            });
            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_QUESTION_ENDED);
            ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_QUESTION_ENDED);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

teamsRouter.route("/rp")
    .put(async(req, res, next) =>{
        try {
            req.body.teams.forEach(async team => {

                // Update roundscore
                const addNewScore = await quizzerModel.updateOne(
                    {_id: req.quizID},
                    {
                        $set: {
                            "teams.$[teamID].rp": team.rp
                        },
                    },
                    {
                        arrayFilters: [
                            {"teamID._id": team.teamName}
                        ]
                    }
                )
            });

            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_ROUND_ENDED);
            ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_ROUND_ENDED);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

// Middleware to check if teamID is valid and has a match
// Add teamID to request
teamsRouter.use("/:teamID", async (req, res, next) => {
    try {
        req.teamID = req.params.teamID;
        const result = await quizzerModel.findTeamById(req.quizID, req.teamID);
        if(Object.keys(result).length < 1) {
            throw new apiErr("[/quizzers/:quizID/teams/:teamID ] - Team information couldn't be found in relation to the current Quiz in DB");
        }
        next();
    } catch (err) {
        next(err);
    }
});

// Get information from a team
teamsRouter.route("/:teamID")
    .get(async (req, res, next) => {
        try {
            const result = await quizzerModel.findTeamById(req.quizID, req.teamID);
            // Result is Object with teamInformation on index 0
            res.status(200).json(JSON.stringify(result[0]));
        } catch (err) {
            next(err);
        }
    }
);

// Approve a team for the quizzer
teamsRouter.route("/:teamID")
    .put(async (req, res, next) => {
        try {
            const updateRes = await quizzerModel.updateOne(
                {_id: req.quizID, "teams._id": req.teamID},
                {$set: {"teams.$.approved": true}},
                (err) => {
                    return err;
                }
            );
            // If doc wasn't modified
            if(updateRes.ok !== 1) {
                throw new Error("[/quizzers/:quizID/teams/:teamID - PUT] - No document was modified");
            }
            
            // Notify Scoreboard that a team has been approved
            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_APPLICATION_ACCEPTED);
            // Notify a team that it has been approved
            ws.notifySingleClient(req.quizID, ws.APPTYPES.TM, ws.MESSAGETYPES.TM_APPLICATION_ACCEPTED, req.teamID);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

// Delete a team from the quizzer
teamsRouter.route("/:teamID")
    .delete(async (req, res, next) => {
        try {
            const deleteRes = await quizzerModel.updateOne(
                {_id: req.quizID},
                {$pull: {teams: { _id: req.teamID}}},
                (err) => {
                    return err;
                }
            );
            // If doc wasn't modified
            if(deleteRes.ok !== 1) {
                throw new Error("[/quizzers/:quizID/teams/:teamID - PUT] - No document was modified");
            }
            // Notify a team that it has been removed from the Quizzer
            ws.notifySingleClient(req.quizID, ws.APPTYPES.TM, ws.MESSAGETYPES.TM_APPLICATION_REJECTED, req.teamID);
            ws.closeTeamConnection(req.quizID, req.teamID);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

// Route to post an answer to a round
teamsRouter.route("/:teamID/answers")
    .post(async (req, res, next) => {
        try {
            const roundNumber = req.body.roundNumber;
            
            if(!req.body.answer) {
                throw new apiErr("[/quizzers/:quizID/teams/:teamID/answers - POST] - Answer was not provided in Request Body");
            }

            // Set checked if empty answer
            let checked = false;
            if(req.body.answer === "-") {
                checked = true;
            }

            // Adds an answer to a certain roundanswers collection for a specified team in a specified quiz
            const updateAnswersRes = await quizzerModel.updateOne(
                {_id: req.quizID},
                {
                    $push: {
                        "teams.$[teamID].answers.$[roundNumber].roundanswers": req.body.answer
                    },
                    $set: {
                        "teams.$[teamID].answers.$[roundNumber].checked": checked,
                        "teams.$[teamID].answers.$[roundNumber].correct": false
                    }
                },
                {
                    arrayFilters: [
                        {"teamID._id": req.teamID},
                        {"roundNumber._id": roundNumber}
                    ]
                }
            );

            if(updateAnswersRes.ok !== 1) {
                throw new Error("[/quizzers/:quizID/teams/:teamID - PUT] - No document was modified");
            }
            // Notify quizMaster a team has submitted an answer
            ws.notifySingleClient(req.quizID, ws.APPTYPES.QM, ws.MESSAGETYPES.QM_ANSWER_SUBMITTED);
            // Notify scoreboard an answers has been submitted by a team, resulting in a refresh
            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_ANSWER_SUBMITTED);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

teamsRouter.route("/:teamID/answers/state").
    put(async (req, res, next) => {
        try {
            const roundNumber = req.body.roundNumber;
            const checked = req.body.checked;
            const correct = req.body.correct;

            const updateAnswerState = await quizzerModel.updateOne(
                {_id: req.quizID},
                {
                    $set: {
                        "teams.$[teamID].answers.$[roundNumber].checked": checked,
                        "teams.$[teamID].answers.$[roundNumber].correct": correct
                    }
                },
                {
                    arrayFilters: [
                        {"teamID._id": req.teamID},
                        {"roundNumber._id": roundNumber}
                    ]
                }
            );

            if(updateAnswerState.ok !== 1) {
                throw new Error("[/quizzers/:quizID/teams/:teamID/answers/state - PUT] - No document was modified");
            }
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

// Route to be able to update a given answer from a team
teamsRouter.route("/:teamID/answers")
    .put( async (req, res, next) => {
        try {
            const roundNumber = req.body.roundNumber;
            const answer = req.body.answer;

            // Remove last given answer from array
            const popAnswer = await quizzerModel.updateOne(
                {_id: req.quizID},
                {
                    $pop: {
                        "teams.$[teamID].answers.$[roundNumber].roundanswers": 1
                    },
                },
                {
                    arrayFilters: [
                        {"teamID._id": req.teamID},
                        {"roundNumber._id": roundNumber}
                    ]
                }
            );

            // Push new answer into array
            const updateAnswer = await quizzerModel.updateOne(
                {_id: req.quizID},
                {
                    $push: {
                        "teams.$[teamID].answers.$[roundNumber].roundanswers": answer
                    },
                    $set: {
                        "teams.$[teamID].answers.$[roundNumber].checked": false,
                        "teams.$[teamID].answers.$[roundNumber].correct": false
                    }
                },
                {
                    arrayFilters: [
                        {"teamID._id": req.teamID},
                        {"roundNumber._id": roundNumber}
                    ]
                }
            );   

            if(updateAnswer.ok !== 1) {
                throw new Error("[/quizzers/:quizID/teams/:teamID - PUT] - No document was modified");
            }
            // Notify quizMaster a team has submitted an answer
            ws.notifySingleClient(req.quizID, ws.APPTYPES.QM, ws.MESSAGETYPES.QM_ANSWER_SUBMITTED);
            res.status(200).send("OK");
        } catch (err) {
            next(err);
        }
    }
);

module.exports = teamsRouter;