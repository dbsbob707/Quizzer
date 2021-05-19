// Modules
const express = require("express");

// Custom Modules
const questionsHandler = require("./../questions_handler");
const ws = require("./../websocket_handler");

// Router for the /quizzers/:quizID/questions routes
const questionsRouter = express.Router({
    // MergeParams is set to true, 
    // because this way the quizID query param will be passed to this router
    mergeParams: true
});

questionsRouter.route("/categories")
    .get(async (req, res, next) => {
        try {
            const questionsLoc = `quizzer_questions/quizzers_data/${req.quizID}_questions.json`;
            let categories = await questionsHandler.retrieveCategoriesFromFile(questionsLoc)

            // Notify Scoreboard and Teams the application part is done
            ws.notifySingleClient(req.quizID, ws.APPTYPES.SB, ws.MESSAGETYPES.SB_APPLICATION_DONE);
            ws.notifyTeams(req.quizID, ws.MESSAGETYPES.TM_APPLICATION_DONE);

            res.status(200).json(categories);
        } catch(err) {
            next(err);
        }
    }
);

questionsRouter.route("/")
    .get(async (req, res, next) => {
        try{
            const questionsLoc = `quizzer_questions/quizzers_data/${req.quizID}_questions.json`; 
            const selectedCategories = req.query.categories;
            const questions = await questionsHandler.retrieveQuestions(questionsLoc, selectedCategories);
            res.status(200).json(JSON.stringify(questions));
        } catch(err) {
            next(err);
        }
    }
);

module.exports = questionsRouter;