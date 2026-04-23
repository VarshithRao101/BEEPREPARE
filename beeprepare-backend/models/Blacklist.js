const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const blacklistSchema = new Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  reason:    { type: String, default: 'Administrative Block' },
  blockedBy: { type: String, required: true },
  blockedAt: { type: Date, default: Date.now },
  isActive:  { type: Boolean, default: true },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

let _Blacklist = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Blacklist) _Blacklist = getMainConn().model('Blacklist', blacklistSchema);
    return _Blacklist[prop];
  },
  construct(_, args) {
    if (!_Blacklist) _Blacklist = getMainConn().model('Blacklist', blacklistSchema);
    return new _Blacklist(...args);
  }
});
