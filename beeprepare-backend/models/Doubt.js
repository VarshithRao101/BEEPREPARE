const { Schema, model } = require('mongoose');

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
  bankId:          { type: Schema.Types.ObjectId, ref: 'Bank' },
  subject:         { type: String },
  status:          { type: String, enum: ['pending','replied','resolved'], default: 'pending' },
  unreadByTeacher: { type: Boolean, default: true },
  unreadByStudent: { type: Boolean, default: false },
  messages:        [messageSchema],
  lastReplyAt:     { type: Date, default: null }
}, { timestamps: true });

doubtSchema.index({ teacherId: 1, unreadByTeacher: 1, createdAt: -1 });
doubtSchema.index({ studentId: 1, createdAt: -1 });

module.exports = model('Doubt', doubtSchema);
