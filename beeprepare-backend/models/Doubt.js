const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const messageSchema = new Schema({
  messageId:  { type: String, required: true },
  senderRole: { type: String, enum: ['student','teacher'], required: true },
  content:    { type: String, required: true },
  imageUrl:   { type: String, default: null },
  timestamp:  { type: Date, default: Date.now }
});

const doubtSchema = new Schema({
  studentId:       { type: String, required: true },
  studentName:     { type: String },
  teacherId:       { type: String, required: true },
  bankId:          { type: Schema.Types.ObjectId },
  subject:         { type: String },
  status:          { type: String, enum: ['pending','replied','resolved'], default: 'pending' },
  unreadByTeacher: { type: Boolean, default: true },
  unreadByStudent: { type: Boolean, default: false },
  messages:        [messageSchema],
  lastReplyAt:     { type: Date, default: null }
}, { timestamps: true });

doubtSchema.index({ teacherId: 1, unreadByTeacher: 1, createdAt: -1 });
doubtSchema.index({ studentId: 1, createdAt: -1 });

let _Doubt = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Doubt) _Doubt = getMainConn().model('Doubt', doubtSchema);
    return _Doubt[prop];
  },
  construct(_, args) {
    if (!_Doubt) _Doubt = getMainConn().model('Doubt', doubtSchema);
    return new _Doubt(...args);
  }
});
