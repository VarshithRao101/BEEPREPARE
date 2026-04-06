const { Schema, model } = require('mongoose');

const streakSchema = new Schema({
  userId:          { type: String, required: true, unique: true },
  currentStreak:   { type: Number, default: 0 },
  bestStreak:      { type: Number, default: 0 },
  lastActiveDate:  { type: String, default: null },
  totalActiveDays: { type: Number, default: 0 },
  weeklyActivity:  { type: [Boolean], default: [false,false,false,false,false,false,false] }
}, { timestamps: true });

streakSchema.index({ userId: 1 }, { unique: true });

module.exports = model('Streak', streakSchema);
