const { Schema } = require('mongoose');
const { getMainConn } = require('../config/db');

const leaderboardSnapshotSchema = new Schema({
    type: { 
        type: String, 
        enum: ['daily', 'monthly', 'yearly'], 
        required: true 
    },
    rankings: [{
        rank: Number,
        userId: String,
        displayName: String,
        photoUrl: String,
        exp: Number,
        streak: Number,
        className: String,
        testsCompleted: Number
    }],
    lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for quick retrieval of the latest snapshot of each type
leaderboardSnapshotSchema.index({ type: 1, lastUpdated: -1 });

let _LeaderboardSnapshot = null;
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    if (!_LeaderboardSnapshot) _LeaderboardSnapshot = getMainConn().model('LeaderboardSnapshot', leaderboardSnapshotSchema);
    return _LeaderboardSnapshot[prop];
  },
  construct(_, args) {
    if (!_LeaderboardSnapshot) _LeaderboardSnapshot = getMainConn().model('LeaderboardSnapshot', leaderboardSnapshotSchema);
    return new _LeaderboardSnapshot(...args);
  }
});
