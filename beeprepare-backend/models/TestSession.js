/**
 * TestSession Model — lives on Cluster 1 (Main DB via mainConn)
 * Note: questionId references are stored as Strings (cross-DB safe)
 */
const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const testSessionSchema = new Schema({
  studentId:  { type: String, required: true },
  bankId:     { type: Schema.Types.ObjectId, required: true },
  teacherId:  { type: String },
  subject:    { type: String },
  class:      { type: String },
  questions: [{
    questionId:   { type: String }, // String (not ObjectId ref) — cross-DB safe
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
  status:       { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  answers: [{
    questionId:    { type: String }, // String — cross-DB safe
    studentAnswer: String,
    isCorrect:     { type: Boolean, default: null }
  }],
  score:        { type: Number, default: null },
  scorePercent: { type: Number, default: null },
  startedAt:    { type: Date, default: Date.now },
  completedAt:  { type: Date, default: null }
}, { timestamps: true });

testSessionSchema.index({ studentId: 1, status: 1, createdAt: -1 });

let _TestSession = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_TestSession) _TestSession = getMainConn().model('TestSession', testSessionSchema);
    return _TestSession[prop];
  },
  construct(_, args) {
    if (!_TestSession) _TestSession = getMainConn().model('TestSession', testSessionSchema);
    return new _TestSession(...args);
  }
});
