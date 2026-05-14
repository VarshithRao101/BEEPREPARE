const User = require('../models/User');
const Streak = require('../models/Streak');
const TestSession = require('../models/TestSession');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const Bank = require('../models/Bank');

/**
 * ADVANCED DSA: Min-Heap Implementation for Top-K Selection
 * Used to efficiently find the Top K students from a large dataset.
 * Complexity: O(N log K)
 */
class MinHeap {
    constructor(k) {
        this.k = k;
        this.heap = [];
    }
    push(node) {
        if (this.heap.length < this.k) {
            this.heap.push(node);
            this.bubbleUp(this.heap.length - 1);
        } else if (node.exp > this.heap[0].exp) {
            this.heap[0] = node;
            this.bubbleDown(0);
        }
    }
    bubbleUp(index) {
        while (index > 0) {
            let parent = Math.floor((index - 1) / 2);
            if (this.heap[parent].exp <= this.heap[index].exp) break;
            [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
            index = parent;
        }
    }
    bubbleDown(index) {
        while (true) {
            let left = 2 * index + 1;
            let right = 2 * index + 2;
            let smallest = index;
            if (left < this.heap.length && this.heap[left].exp < this.heap[smallest].exp) smallest = left;
            if (right < this.heap.length && this.heap[right].exp < this.heap[smallest].exp) smallest = right;
            if (smallest === index) break;
            [this.heap[smallest], this.heap[index]] = [this.heap[index], this.heap[smallest]];
            index = smallest;
        }
    }
    getSorted() {
        return this.heap.sort((a, b) => b.exp - a.exp);
    }
}

/**
 * GENERATE SNAPSHOT (Internal/Admin Trigger)
 * Runs once every 24 hours to "freeze" rankings.
 */
exports.generateSnapshots = async (req, res) => {
    try {
        const types = ['daily', 'monthly', 'yearly'];
        
        for (const type of types) {
            const students = await User.find({ role: 'student' }).select('googleUid displayName photoUrl class exp dailyExp monthlyExp yearlyExp');
            const heap = new MinHeap(100); // Keep top 100

            for (const s of students) {
                const streak = await Streak.findOne({ userId: s.googleUid });
                const tests = await TestSession.countDocuments({ studentId: s.googleUid, status: 'completed' });
                
                let currentExp = s.exp;
                if (type === 'daily') currentExp = s.dailyExp;
                if (type === 'monthly') currentExp = s.monthlyExp;
                if (type === 'yearly') currentExp = s.yearlyExp;

                heap.push({
                    userId: s.googleUid,
                    displayName: s.displayName,
                    photoUrl: s.photoUrl,
                    className: s.class,
                    exp: currentExp,
                    streak: streak ? streak.currentStreak : 0,
                    testsCompleted: tests
                });
            }

            const rankings = heap.getSorted().map((item, index) => ({
                ...item,
                rank: index + 1
            }));

            await LeaderboardSnapshot.create({
                type,
                rankings,
                lastUpdated: new Date()
            });

            // RESET LOGIC: Clear time-based EXP after snapshotting
            const now = new Date();
            const updateObj = {};
            if (type === 'daily') updateObj.dailyExp = 0;
            if (type === 'monthly' && now.getDate() === 1) updateObj.monthlyExp = 0;
            if (type === 'yearly' && now.getMonth() === 0 && now.getDate() === 1) updateObj.yearlyExp = 0;

            if (Object.keys(updateObj).length > 0) {
                await User.updateMany({ role: 'student' }, { $set: updateObj });
            }
        }

        if (res) res.json({ success: true, message: 'Snapshots generated successfully' });
    } catch (error) {
        console.error('Snapshot Generation Error:', error);
        if (res) res.status(500).json({ success: false, message: 'Generation failed' });
    }
};

/**
 * GET GLOBAL LEADERBOARD (Student POV)
 */
exports.getGlobalLeaderboard = async (req, res) => {
    try {
        const { type = 'daily' } = req.query;
        const snapshot = await LeaderboardSnapshot.findOne({ type }).sort({ lastUpdated: -1 });
        
        if (!snapshot) {
            return res.status(200).json({ success: true, rankings: [], message: 'No snapshot available yet' });
        }

        const rankings = snapshot.rankings.map(r => ({
            rank: r.rank,
            userId: r.userId,
            displayName: r.displayName || r.name || 'Anonymous Student',
            photoUrl: r.photoUrl || r.photo || '../../assets/images/default-avatar.png',
            className: r.className || r.class || 'N/A',
            exp: r.exp || 0,
            streak: r.streak || 0,
            testsCompleted: r.testsCompleted || 0
        }));

        res.json({
            success: true,
            type: snapshot.type,
            lastUpdated: snapshot.lastUpdated,
            rankings
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Fetch failed' });
    }
};

/**
 * GET TEACHER LEADERBOARD (Teacher POV)
 * Filters global rankings to only show students linked to this teacher's banks.
 */
exports.getTeacherLeaderboard = async (req, res) => {
    try {
        const teacherId = req.user.googleUid;
        const { type = 'daily', bankId } = req.query;

        // ══════════════════════════════════════════════════════════════════════════════
        // CASE 1: BANK-SPECIFIC LEADERBOARD (Direct Query for accuracy)
        // ══════════════════════════════════════════════════════════════════════════════
        if (bankId && bankId !== 'all') {
            const bank = await Bank.findOne({ _id: bankId, teacherId }).select('approvedStudents').lean();
            if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });

            const students = await User.find({ 
                googleUid: { $in: bank.approvedStudents || [] },
                role: 'student'
            }).select('googleUid displayName photoUrl class exp dailyExp monthlyExp yearlyExp').lean();

            const studentUids = students.map(s => s.googleUid);
            
            // Bulk fetch streaks and test counts for performance
            const [streaks, tests] = await Promise.all([
                Streak.find({ userId: { $in: studentUids } }).select('userId currentStreak').lean(),
                TestSession.aggregate([
                    { $match: { studentId: { $in: studentUids }, status: 'completed' } },
                    { $group: { _id: '$studentId', count: { $sum: 1 } } }
                ])
            ]);

            const streakMap = Object.fromEntries(streaks.map(s => [s.userId, s.currentStreak]));
            const testMap = Object.fromEntries(tests.map(t => [t._id, t.count]));

            const rankings = students.map(s => {
                let currentExp = s.exp || 0;
                if (type === 'daily') currentExp = s.dailyExp || 0;
                if (type === 'monthly') currentExp = s.monthlyExp || 0;
                if (type === 'yearly') currentExp = s.yearlyExp || 0;

                return {
                    userId: s.googleUid,
                    displayName: s.displayName,
                    photoUrl: s.photoUrl,
                    className: s.class,
                    exp: currentExp,
                    streak: streakMap[s.googleUid] || 0,
                    testsCompleted: testMap[s.googleUid] || 0
                };
            });

            // Sort by EXP descending
            rankings.sort((a, b) => b.exp - a.exp);
            const finalRankings = rankings.map((r, index) => ({ ...r, rank: index + 1 }));

            return res.json({
                success: true,
                rankings: finalRankings,
                lastUpdated: new Date()
            });
        }

        // ══════════════════════════════════════════════════════════════════════════════
        // CASE 2: GLOBAL TEACHER LEADERBOARD (Uses Snapshot)
        // ══════════════════════════════════════════════════════════════════════════════
        const snapshot = await LeaderboardSnapshot.findOne({ type }).sort({ lastUpdated: -1 });
        if (!snapshot) return res.json({ success: true, rankings: [] });

        const linkedUsers = await User.find({ 
            'activeBanks.teacherId': teacherId 
        }).select('googleUid');
        const linkedIds = new Set(linkedUsers.map(u => u.googleUid));

        const filteredRankings = snapshot.rankings
            .filter(r => linkedIds.has(r.userId))
            .map((r, index) => ({
                rank: index + 1,
                userId: r.userId,
                displayName: r.displayName || r.name || 'Anonymous Student',
                photoUrl: r.photoUrl || r.photo || '../../assets/images/default-avatar.png',
                className: r.className || r.class || 'N/A',
                exp: r.exp || 0,
                streak: r.streak || 0,
                testsCompleted: r.testsCompleted || 0
            }));

        res.json({
            success: true,
            rankings: filteredRankings,
            lastUpdated: snapshot.lastUpdated
        });
    } catch (error) {
        console.error('getTeacherLeaderboard error:', error);
        res.status(500).json({ success: false, message: 'Teacher leaderboard fetch failed' });
    }
};

/**
 * ADMIN: MODIFY STUDENT STATS
 */
exports.adminModifyStats = async (req, res) => {
    try {
        const { userId, exp, dailyExp, monthlyExp, yearlyExp } = req.body;
        
        const updateData = {};
        if (exp !== undefined) updateData.exp = exp;
        if (dailyExp !== undefined) updateData.dailyExp = dailyExp;
        if (monthlyExp !== undefined) updateData.monthlyExp = monthlyExp;
        if (yearlyExp !== undefined) updateData.yearlyExp = yearlyExp;

        await User.findOneAndUpdate({ googleUid: userId }, updateData);
        
        res.json({ success: true, message: 'User stats updated. Changes will reflect in the next 24h snapshot.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Update failed' });
    }
};
