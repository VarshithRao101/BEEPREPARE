const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const bookmarkSchema = new Schema({
  studentId:    { type: String, required: true },
  questionId:   { type: String, required: true }, // String (cross-DB safe — questions on Cluster 2)
  questionText: { type: String },
  subject:      { type: String },
  chapterName:  { type: String }
}, { timestamps: true });

bookmarkSchema.index({ studentId: 1, questionId: 1 }, { unique: true });

let _Bookmark = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Bookmark) _Bookmark = getMainConn().model('Bookmark', bookmarkSchema);
    return _Bookmark[prop];
  },
  construct(_, args) {
    if (!_Bookmark) _Bookmark = getMainConn().model('Bookmark', bookmarkSchema);
    return new _Bookmark(...args);
  }
});
