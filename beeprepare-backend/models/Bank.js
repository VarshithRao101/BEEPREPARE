const { Schema, model } = require('mongoose');

const bankSchema = new Schema({
  teacherId:   { type: String, required: true },
  teacherName: { type: String, required: true },
  subject:     { type: String, required: true }, // Removed strict enum for expansion
  class:       { type: String, required: true }, // Removed strict enum for expansion
  chapters: [{
    chapterId:     { type: String, required: true },
    chapterName:   { type: String, required: true },
    order:         { type: Number, required: true },
    questionCount: { type: Number, default: 0 }
  }],
  bankCode:         { type: String, required: true, unique: true },
  approvedStudents: [{ type: String }],
  totalQuestions:   { type: Number, default: 0 },
  notesCount:       { type: Number, default: 0 },
  isActive:         { type: Boolean, default: true }
}, { timestamps: true });

bankSchema.index({ teacherId: 1 });
bankSchema.index({ teacherId: 1, subject: 1, class: 1 }, { unique: true });
bankSchema.index({ approvedStudents: 1 });

module.exports = model('Bank', bankSchema);
