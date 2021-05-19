const mongoose = require("mongoose");

// Custom Schemes
const Question = require("./question_schema");

const roundSchema = new mongoose.Schema(
    {
        _id: Number,
        selectedCategories: [String],
        questions: [Question]
    }
);

module.exports = roundSchema;
