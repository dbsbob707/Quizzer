const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
    {
        question: String,
        answer: String,
        category: String
    }
);

module.exports = questionSchema;
