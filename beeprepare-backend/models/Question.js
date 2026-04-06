const { Schema, model } = require('mongoose');

const questionSchema = new Schema({
  questionText:  { type: String, required: true, minlength: 10, maxlength: 2000 },
  questionType:  { type: String, required: true, enum: ['MCQ','Very Short','Short','Long','Essay'] },
  marks:         { type: Number, required: true }, // Relaxed enum for flexibility
  difficulty:    { type: String, required: true, enum: ['Easy','Medium','Hard'], default: 'Easy' },
  mcqOptions: {
    A: { type: String }, B: { type: String },
    C: { type: String }, D: { type: String }
  },
  correctOption: { type: String, enum: ['A','B','C','D'] },
  isImportant:   { type: Boolean, required: true, default: false },
  tags:          [{ type: String, enum: ['Important','Repeated','Exam Focus','Formula Based'] }],
  chapterId:     { type: String, required: true },
  createdBy:     { type: String, required: true },
  bankId:        { type: Schema.Types.ObjectId, ref: 'Bank', required: true }
}, { timestamps: true });

questionSchema.index({ bankId: 1, chapterId: 1, questionType: 1, isImportant: 1 });
questionSchema.index({ bankId: 1, chapterId: 1 });
questionSchema.index({ createdBy: 1 });

module.exports = model('Question', questionSchema);
