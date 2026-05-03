const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const paymentRequestSchema = new Schema({
  authEmail:    { type: String, required: true },
  email:        { type: String, required: true },
  phone:        { type: String, default: null },
  utrNumber:    { type: String, required: true },
  paymentType:  { type: String, enum: ['activation', 'extra_slot'], required: true },
  amount:       { type: Number, required: true },
  status:       { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
  assignedKey:  { type: String, default: null },
  reviewedBy:   { type: String, default: null },
  reviewedAt:   { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  ipAddress:    { type: String },
  userAgent:    { type: String },
  expiresAt:    { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
}, { timestamps: true });

paymentRequestSchema.index({ utrNumber: 1 }, { unique: true });
paymentRequestSchema.index({ status: 1 });
paymentRequestSchema.index({ email: 1 });
paymentRequestSchema.index({ createdAt: -1 });
paymentRequestSchema.index({ status: 1, createdAt: -1 });
paymentRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } });

let _PaymentRequest = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_PaymentRequest) _PaymentRequest = getMainConn().model('PaymentRequest', paymentRequestSchema);
    return _PaymentRequest[prop];
  },
  construct(_, args) {
    if (!_PaymentRequest) _PaymentRequest = getMainConn().model('PaymentRequest', paymentRequestSchema);
    return new _PaymentRequest(...args);
  }
});
