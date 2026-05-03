const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const adminSessionSchema = new Schema({
  adminId:   { type: String, required: true },
  token:     { type: String, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false }
}, { timestamps: true });

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
adminSessionSchema.index({ token: 1 });
adminSessionSchema.index({ adminId: 1 });

let _AdminSession = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_AdminSession) _AdminSession = getMainConn().model('AdminSession', adminSessionSchema);
    return _AdminSession[prop];
  },
  construct(_, args) {
    if (!_AdminSession) _AdminSession = getMainConn().model('AdminSession', adminSessionSchema);
    return new _AdminSession(...args);
  }
});
