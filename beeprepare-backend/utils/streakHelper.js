const Streak = require('../models/Streak');

/**
 * Normalizes a date to midnight for calendar-day comparison
 */
const normalizeDate = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * syncStreak: Checks if the streak has expired and resets it to 0 if necessary.
 * This should be called whenever streak data is fetched.
 */
const syncStreak = async (userId) => {
  try {
    const streak = await Streak.findOne({ userId });
    if (!streak || !streak.lastActiveDate) return streak;

    const today = normalizeDate(new Date());
    const lastActive = normalizeDate(streak.lastActiveDate);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // If last active was BEFORE yesterday, and NOT today, reset streak to 0
    if (lastActive.getTime() < yesterday.getTime() && lastActive.getTime() !== today.getTime()) {
      if (streak.currentStreak !== 0) {
        streak.currentStreak = 0;
        await streak.save();
      }
    }

    return streak;
  } catch (err) {
    console.error('syncStreak error:', err.message);
    return null;
  }
};

/**
 * updateStreak: Records activity and increments/starts the streak.
 */
const updateStreak = async (userId) => {
  try {
    const today = normalizeDate(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let streak = await Streak.findOne({ userId });

    if (!streak) {
      // First time — create fresh streak starting at 1
      streak = await Streak.create({
        userId,
        currentStreak: 1,
        bestStreak: 1,
        lastActiveDate: today.toISOString(),
        totalActiveDays: 1,
        weeklyActivity: [false, false, false, false, false, false, false]
      });
      
      const dayIndex = (today.getDay() + 6) % 7;
      streak.weeklyActivity[dayIndex] = true;
      await streak.save();
      return streak;
    }

    const lastActive = normalizeDate(streak.lastActiveDate);

    const todayTime = today.getTime();
    const lastTime = lastActive.getTime();
    const yesterdayTime = yesterday.getTime();

    if (lastTime === todayTime) {
      // Already active today - just return
      return streak;
    }

    if (lastTime === yesterdayTime) {
      // Consecutive day - increment
      streak.currentStreak += 1;
    } else {
      // Broken streak - start fresh at 1
      streak.currentStreak = 1;
    }

    streak.bestStreak = Math.max(streak.bestStreak, streak.currentStreak);
    streak.totalActiveDays += 1;
    streak.lastActiveDate = today.toISOString();
    
    const dayIndex = (today.getDay() + 6) % 7;
    streak.weeklyActivity[dayIndex] = true;

    // Optional: Reset weekly activity if it's Monday? 
    // Usually we'd want to see the last 7 days or the current week.
    // For now, let's just save.

    await streak.save();
    return streak;

  } catch (err) {
    console.error('updateStreak error:', err.message);
    return null;
  }
};

module.exports = {
  updateStreak,
  syncStreak
};

