const mongoose = require("mongoose");

const TeamAnswers = new mongoose.Schema(
    {
        _id: Number,
        correct: Boolean,
        checked: Boolean,
        roundanswers: [String]
    }
);

const teamSchema = new mongoose.Schema(
    {
        _id: String,
        approved: Boolean,
        rp: Number,
        qp: [Number],
        answers: [TeamAnswers]
    }
);

module.exports = teamSchema;
