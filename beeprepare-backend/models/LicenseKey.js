const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const licenseKeySchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['activation', 'redeem'],
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: String,
    default: null
  },
  usedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

licenseKeySchema.index(
  { key: 1 }, { unique: true });
licenseKeySchema.index({ isUsed: 1 });
licenseKeySchema.index({ type: 1 });
licenseKeySchema.index({ type: 1, isUsed: 1 });

let _LicenseKey = null;
const modelProxy = new Proxy(function() {}, {
  get(_, prop) {
    if (!_LicenseKey) _LicenseKey = getMainConn().model('LicenseKey', licenseKeySchema);
    return _LicenseKey[prop];
  },
  construct(_, args) {
    if (!_LicenseKey) _LicenseKey = getMainConn().model('LicenseKey', licenseKeySchema);
    return new _LicenseKey(...args);
  }
});

module.exports = modelProxy;
