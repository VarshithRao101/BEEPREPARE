const { Schema, model } = require('mongoose');

const feedbackSchema = new Schema({
  userId:        { type: String, required: true },
  context:       { type: String, enum: ['Teacher','Student'] },
  feedbackType:  { type: String, enum: ['bug','feature','rating','content'] },
  message:       { type: String },
  rating:        { type: Number, min: 0, max: 5 },
  attachmentUrl: { type: String, default: null },
  status:        { type: String, enum: ['pending_review','reviewed'], default: 'pending_review' }
}, { timestamps: true });

module.exports = model('Feedback', feedbackSchema);
