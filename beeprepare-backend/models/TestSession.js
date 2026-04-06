const { Schema, model } = require('mongoose');

const testSessionSchema = new Schema({
  studentId:  { type: String, required: true },
  bankId:     { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  teacherId:  { type: String },
  subject:    { type: String },
  class:      { type: String },
  questions: [{
    questionId:   { type: Schema.Types.ObjectId, ref: 'Question' },
    questionText: String,
    questionType: String,
    marks:        Number,
    mcqOptions:   { A: String, B: String, C: String, D: String },
    correctOption: String
  }],
  blueprint: {
    mcq: Number, veryShort: Number,
    short: Number, long: Number, essay: Number
  },
  totalMarks:   { type: Number },
  status:       { type: String, enum: ['in_progress','completed'], default: 'in_progress' },
  answers: [{
    questionId:    { type: Schema.Types.ObjectId },
    studentAnswer: String,
    isCorrect:     { type: Boolean, default: null }
  }],
  score:        { type: Number, default: null },
  scorePercent: { type: Number, default: null },
  startedAt:    { type: Date, default: Date.now },
  completedAt:  { type: Date, default: null }
}, { timestamps: true });

testSessionSchema.index({ studentId: 1, status: 1, createdAt: -1 });

module.exports = model('TestSession', testSessionSchema);
