const { Schema, model } = require('mongoose');

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

module.exports = model('AccessRequest', accessRequestSchema);
