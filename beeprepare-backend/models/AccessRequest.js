const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const accessRequestSchema = new Schema({
  studentId:     { type: String, required: true },
  studentName:   { type: String },
  bankId:        { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
  teacherId:     { type: String, required: true },
  status:        { type: String, enum: ['pending','approved','active','rejected','locked'], default: 'pending' },
  otpHash:       { type: String, default: null },
  otpExpiresAt:  { type: Date, default: null },
  otpAttempts:   { type: Number, default: 0 },
  otpVerifiedAt: { type: Date, default: null },
  requestedAt:   { type: Date, default: Date.now },
  approvedAt:    { type: Date, default: null },
  rejectedAt:    { type: Date, default: null }
}, { timestamps: true });

accessRequestSchema.index({ bankId: 1, studentId: 1 }, { unique: true });
accessRequestSchema.index({ teacherId: 1, status: 1 });

let _AccessRequest = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_AccessRequest) _AccessRequest = getMainConn().model('AccessRequest', accessRequestSchema);
    return _AccessRequest[prop];
  },
  construct(_, args) {
    if (!_AccessRequest) _AccessRequest = getMainConn().model('AccessRequest', accessRequestSchema);
    return new _AccessRequest(...args);
  }
});
