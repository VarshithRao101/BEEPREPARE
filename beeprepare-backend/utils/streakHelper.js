const Streak = require('../models/Streak');

/**
 * RULE 1: User activity recorded for TODAY
 * RULE 2: Next day activity -> streak increments (1 -> 2)
 * RULE 3: Miss a day -> streak resets to 0, then start fresh at 1
 * RULE 4: Based on calendar date (00:00:00) NOT 24hr rolling window
 */
const updateStreak = async (userId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let streak = await Streak.findOne({ userId });

    if (!streak) {
      // First time — create fresh streak
      streak = await Streak.create({
        userId,
        currentStreak: 1,
        bestStreak: 1,
        lastActiveDate: today.toISOString(),
        totalActiveDays: 1,
        weeklyActivity: [false, false, false, false, false, false, false]
      });
      
      // Update weekly activity (Monday-based indexing: 0=Mon, ... 6=Sun)
      const dayIndex = (today.getDay() + 6) % 7;
      streak.weeklyActivity[dayIndex] = true;
      await streak.save();
      return streak;
    }

    // Parse last active date and normalize to midnight
    const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
    if (lastActive) lastActive.setHours(0, 0, 0, 0);

    const todayTime = today.getTime();
    const lastTime = lastActive ? lastActive.getTime() : 0;
    const yesterdayTime = yesterday.getTime();

    if (lastTime === todayTime) {
      // RULE: Already active today - no change to count
      return streak;
    }

    if (lastTime === yesterdayTime) {
      // RULE 2: Consecutive day - increment
      streak.currentStreak += 1;
      streak.bestStreak = Math.max(streak.bestStreak, streak.currentStreak);
    } else {
      // RULE 3: Missed day(s) - reset to 0 then start at 1
      streak.currentStreak = 1;
    }

    streak.totalActiveDays += 1;
    streak.lastActiveDate = today.toISOString();
    
    // Update weekly activity
    const dayIndex = (today.getDay() + 6) % 7;
    streak.weeklyActivity[dayIndex] = true;

    // Reset weekly activity if it's a new week (Monday)
    // Actually, usually weeklyActivity is just for the current visual week.
    // We'll keep it simple for now as the user didn't specify reset logic for this.

    await streak.save();
    return streak;

  } catch (err) {
    console.error('updateStreak error:', err.message);
    return null;
  }
};

module.exports = updateStreak;

