const { Schema, model } = require('mongoose');

const activityLogSchema = new Schema({
  userId:      { type: String, required: true },
  type:        { type: String, enum: ['question_added','paper_generated','student_approved','doubt_received','test_completed','note_uploaded','bank_joined','doubt_replied'] },
  title:       { type: String },
  description: { type: String },
  color:       { type: String, default: '#FFD700' }
}, { timestamps: true });

activityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = model('ActivityLog', activityLogSchema);
