const Streak = require('../models/Streak');

const updateStreak = async (userId) => {
  const today = new Date().toISOString().split('T')[0];
  let streak = await Streak.findOne({ userId });

  if (!streak) {
    streak = await Streak.create({
      userId,
      currentStreak: 1,
      bestStreak: 1,
      lastActiveDate: today,
      totalActiveDays: 1
    });
    return streak;
  }

  // Already active today? return current
  if (streak.lastActiveDate === today) return streak;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (streak.lastActiveDate === yesterday) {
    // Chain continued
    streak.currentStreak += 1;
    if (streak.currentStreak > streak.bestStreak) {
      streak.bestStreak = streak.currentStreak;
    }
  } else {
    // Chain broken - Reset to 1 (starting fresh today)
    streak.currentStreak = 1;
  }

  streak.lastActiveDate = today;
  streak.totalActiveDays += 1;
  await streak.save();
  return streak;
};

module.exports = updateStreak;
