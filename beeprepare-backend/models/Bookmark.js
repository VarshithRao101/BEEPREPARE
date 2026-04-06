const { Schema, model } = require('mongoose');

const bookmarkSchema = new Schema({
  studentId:    { type: String, required: true },
  questionId:   { type: Schema.Types.ObjectId, ref: 'Question', required: true },
  questionText: { type: String },
  subject:      { type: String },
  chapterName:  { type: String }
}, { timestamps: true });

bookmarkSchema.index({ studentId: 1, questionId: 1 }, { unique: true });

module.exports = model('Bookmark', bookmarkSchema);
