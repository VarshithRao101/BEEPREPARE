const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const activityLogSchema = new Schema({
  userId:      { type: String, required: true },
  type:        { type: String, enum: ['question_added','paper_generated','student_approved','doubt_received','test_completed','note_uploaded','bank_joined','doubt_replied','chapter_deleted','bank_deleted','bank_created', 'key_activated', 'payment_submitted', 'user_blocked', 'user_deleted'] },
  ip:          { type: String },
  title:       { type: String },
  description: { type: String },
  color:       { type: String, default: '#FFD700' }
}, { timestamps: true });

activityLogSchema.index({ userId: 1, createdAt: -1 });

let _ActivityLog = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_ActivityLog) _ActivityLog = getMainConn().model('ActivityLog', activityLogSchema);
    return _ActivityLog[prop];
  },
  construct(_, args) {
    if (!_ActivityLog) _ActivityLog = getMainConn().model('ActivityLog', activityLogSchema);
    return new _ActivityLog(...args);
  }
});
