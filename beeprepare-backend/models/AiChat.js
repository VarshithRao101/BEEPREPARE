const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const aiChatSchema = new Schema({
  userId:   { type: String, required: true },
  userRole: { type: String, enum: ['teacher','student'] },
  title:    { type: String, default: 'New Study Session' },
  messages: [{
    role:      { type: String, enum: ['user','model'] },
    content:   { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  messageCount:  { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

aiChatSchema.index({ userId: 1, lastMessageAt: -1 });

let _AiChat = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_AiChat) _AiChat = getMainConn().model('AiChat', aiChatSchema);
    return _AiChat[prop];
  },
  construct(_, args) {
    if (!_AiChat) _AiChat = getMainConn().model('AiChat', aiChatSchema);
    return new _AiChat(...args);
  }
});
