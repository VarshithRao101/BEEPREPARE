/**
 * User Model — lives on Cluster 2 (Main DB via mainConn)
 */
const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const userSchema = new Schema({
  googleUid:          { type: String, required: true, unique: true },
  email:              { type: String, required: true, unique: true },
  displayName:        { type: String, required: true },
  photoUrl:           { type: String, default: null },
  nameChanged:        { type: Boolean, default: false },
  beeId: {
    type: String,
    unique: true,
    sparse: true
  },
  phone:              { type: String, default: null },
  role:               { type: String, enum: ['teacher', 'student'], default: null },
  isActivated:        { type: Boolean, default: false },
  licenseKey:         { type: String, default: null },
  licenseActivatedAt: { type: Date, default: null },
  licenseExpiresAt:   { type: Date, default: null },
  planType:           { type: String, enum: ['free', 'active'], default: 'free' },
  subjectLimit:       { type: Number, default: 1 },
  redeemCodes:        [{ type: String }],
  lastLoginAt:        { type: Date, default: null },
  // Teacher fields
  subjects:           [{ type: String }],
  classes:            [{ type: String }],
  chapters:           { type: Object, default: {} },
  totalQuestions:     { type: Number, default: 0 },
  activeStudents:     { type: Number, default: 0 },
  // Student fields
  class:              { type: String, default: null },
  activeBanks: [{
    bankId:      { type: Schema.Types.ObjectId, ref: 'Bank' },
    subject:     String,
    teacherId:   String,
    activatedAt: Date
  }],
  aiMessagesToday:   { type: Number, default: 0 },
  aiMessagesResetAt: { type: Date, default: null },
  isBlocked:     { type: Boolean, default: false },
  blockedAt:     { type: Date, default: null },
  blockedReason: { type: String, default: null }
}, { timestamps: true });

userSchema.index({ role: 1 });

let _User = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_User) _User = getMainConn().model('User', userSchema);
    return _User[prop];
  },
  construct(_, args) {
    if (!_User) _User = getMainConn().model('User', userSchema);
    return new _User(...args);
  }
});

module.exports.getUser = () => {
  if (!_User) _User = getMainConn().model('User', userSchema);
  return _User;
};
