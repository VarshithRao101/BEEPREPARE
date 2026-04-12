const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  googleUid:          { type: String, required: true, unique: true },
  email:              { type: String, required: true, unique: true },
  displayName:        { type: String, required: true },
  photoUrl:           { type: String, default: null },
  phone:              { type: String, default: null },
  role:               { type: String, enum: ['teacher', 'student'], default: null },
  isActivated:        { type: Boolean, default: false },
  licenseKey:         { type: String, default: null },
  licenseActivatedAt: { type: Date, default: null },
  licenseExpiresAt:   { type: Date, default: null },
  planType:           { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  subjectLimit:       { type: Number, default: 2 },
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
  aiMessagesResetAt: { type: Date, default: null }
}, { timestamps: true });

userSchema.index({ role: 1 });

module.exports = model('User', userSchema);
