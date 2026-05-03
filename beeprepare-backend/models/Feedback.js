const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const feedbackSchema = new Schema({
  userId:        { type: String, required: true },
  context:       { type: String, enum: ['Teacher','Student'] },
  feedbackType:  { type: String, enum: ['bug','feature','rating','content'] },
  message:       { type: String },
  rating:        { type: Number, min: 0, max: 5 },
  attachmentUrl: { type: String, default: null },
  status:        { type: String, enum: ['pending_review','reviewed'], default: 'pending_review' }
}, { timestamps: true });

feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ createdAt: -1 });

let _Feedback = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Feedback) _Feedback = getMainConn().model('Feedback', feedbackSchema);
    return _Feedback[prop];
  },
  construct(_, args) {
    if (!_Feedback) _Feedback = getMainConn().model('Feedback', feedbackSchema);
    return new _Feedback(...args);
  }
});
