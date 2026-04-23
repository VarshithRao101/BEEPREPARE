/**
 * Streak Model — lives on Cluster 1 (Main DB via mainConn)
 */
const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const streakSchema = new Schema({
  userId:          { type: String, required: true, unique: true },
  currentStreak:   { type: Number, default: 0 },
  bestStreak:      { type: Number, default: 0 },
  lastActiveDate:  { type: String, default: null },
  totalActiveDays: { type: Number, default: 0 },
  weeklyActivity:  { type: [Boolean], default: [false,false,false,false,false,false,false] }
}, { timestamps: true });

let _Streak = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_Streak) _Streak = getMainConn().model('Streak', streakSchema);
    return _Streak[prop];
  },
  construct(_, args) {
    if (!_Streak) _Streak = getMainConn().model('Streak', streakSchema);
    return new _Streak(...args);
  }
});
