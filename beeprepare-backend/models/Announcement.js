const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const announcementSchema = new Schema({
  text:      { type: String, required: true },
  target:    { type: String, enum: ['all', 'teacher', 'student'], default: 'all' },
  isActive:  { type: Boolean, default: true },
  createdBy: { type: String },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

let _Announcement = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Announcement) _Announcement = getMainConn().model('Announcement', announcementSchema);
    return _Announcement[prop];
  },
  construct(_, args) {
    if (!_Announcement) _Announcement = getMainConn().model('Announcement', announcementSchema);
    return new _Announcement(...args);
  }
});
