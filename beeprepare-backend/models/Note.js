/**
 * Note Model — lives on Cluster 2 (Main DB via mainConn)
 */
const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const noteSchema = new Schema({
  teacherId:   { type: String, required: true },
  bankId:      { type: Schema.Types.ObjectId, required: true },
  subject:     { type: String, required: true },
  chapterId:   { type: String, required: true },
  chapterName: { type: String, required: true },
  noteType:    { type: String, required: true, enum: ['complete', 'short', 'flash'] },
  fileName:      { type: String },
  fileUrl:       { type: String },
  public_id:     { type: String, required: true },
  resource_type: { type: String, default: 'raw' },
  format:        { type: String, default: 'pdf' },
  fileType:      { type: String, enum: ['pdf', 'image'] },
  fileSize:      { type: Number },
  tags:          [{ type: String }]
}, { timestamps: true });

noteSchema.index({ bankId: 1, chapterId: 1, noteType: 1 }, { unique: true });
noteSchema.index({ teacherId: 1 });

let _Note = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Note) _Note = getMainConn().model('Note', noteSchema);
    return _Note[prop];
  },
  construct(_, args) {
    if (!_Note) _Note = getMainConn().model('Note', noteSchema);
    return new _Note(...args);
  }
});

module.exports.getNote = () => {
  if (!_Note) _Note = getMainConn().model('Note', noteSchema);
  return _Note;
};
