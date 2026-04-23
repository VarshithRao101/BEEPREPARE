/**
 * Bank Model — lives on Cluster 2 (Main DB via mainConn)
 */
const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const bankSchema = new Schema({
  teacherId:   { type: String, required: true },
  teacherName: { type: String, required: true },
  subject:     { type: String, required: true },
  class:       { type: String, required: true },
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

let _Bank = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Bank) _Bank = getMainConn().model('Bank', bankSchema);
    return _Bank[prop];
  },
  construct(_, args) {
    if (!_Bank) _Bank = getMainConn().model('Bank', bankSchema);
    return new _Bank(...args);
  }
});

module.exports.getBank = () => {
  if (!_Bank) _Bank = getMainConn().model('Bank', bankSchema);
  return _Bank;
};
