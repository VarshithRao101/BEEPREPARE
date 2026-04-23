const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const messageSchema = new Schema({
  senderId: { type: String, required: true },
  senderName: { type: String },
  senderRole: {
    type: String,
    enum: ['teacher', 'student']
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const joinRequestSchema = new Schema({
  userId: { type: String, required: true },
  displayName: { type: String },
  role: { type: String },
  beeId: { type: String },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  }
});

const studyCircleSchema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 50
  },
  subject: { type: String },
  circleCode: {
    type: String,
    unique: true
  },
  createdBy: {
    type: String,
    required: true
  },
  members: [{
    userId: String,
    displayName: String,
    role: String,
    joinedAt: { 
      type: Date,
      default: Date.now 
    }
  }],
  joinRequests: [joinRequestSchema],
  pendingCount: { type: Number, default: 0 },
  messages: [messageSchema],
  maxMembers: {
    type: Number,
    default: 30
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rules: {
    type: String,
    default: 'Welcome to the Circle! Please maintain professional behavior and avoid explicit content.'
  }
}, { timestamps: true });

studyCircleSchema.index(
  { circleCode: 1 }, { unique: true });
studyCircleSchema.index(
  { 'members.userId': 1 });

let _StudyCircle = null;
const modelProxy = new Proxy(function() {}, {
  get(_, prop) {
    if (!_StudyCircle) _StudyCircle = getMainConn().model('StudyCircle', studyCircleSchema);
    return _StudyCircle[prop];
  },
  construct(_, args) {
    if (!_StudyCircle) _StudyCircle = getMainConn().model('StudyCircle', studyCircleSchema);
    return new _StudyCircle(...args);
  }
});

module.exports = modelProxy;
