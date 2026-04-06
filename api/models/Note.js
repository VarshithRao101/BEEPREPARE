const { Schema, model } = require('mongoose');

const noteSchema = new Schema({
  teacherId:   { type: String, required: true },
  bankId:      { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  subject:     { type: String, required: true },
  chapterId:   { type: String, required: true },
  chapterName: { type: String, required: true },
  noteType:    { type: String, required: true, enum: ['complete', 'short'] },
  fileName:    { type: String },
  fileUrl:     { type: String },
  fileType:    { type: String, enum: ['pdf', 'image'] },
  fileSize:    { type: Number },
  tags:        [{ type: String }]
}, { timestamps: true });

noteSchema.index({ bankId: 1, chapterId: 1, noteType: 1 }, { unique: true });
noteSchema.index({ teacherId: 1 });

module.exports = model('Note', noteSchema);
