// DEPRECATED - Chat history removed to save
// MongoDB storage. File kept for reference only.
// Not used anywhere in the app.
const { Schema, model } = require('mongoose');

const aiChatSchema = new Schema({
  userId:   { type: String, required: true },
  userRole: { type: String, enum: ['teacher','student'] },
  title:    { type: String },
  messages: [{
    role:      { type: String, enum: ['user','model'] },
    content:   { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  messageCount:  { type: Number, default: 0 },
  lastMessageAt: { type: Date, default: null }
}, { timestamps: true });

aiChatSchema.index({ userId: 1, lastMessageAt: -1 });

module.exports = model('AiChat', aiChatSchema);
