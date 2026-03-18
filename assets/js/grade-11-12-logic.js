/**
 * Grade 11 & 12 Specialized Logic
 * Handles Question Banks, Verification Layer, Gamification, and Rewards.
 */

const Grade1112System = {
    // --- Data Storage Keys ---
    KEYS: {
        QUESTIONS: 'beeprepare_1112_questions',
        PENDING: 'beeprepare_1112_pending',
        STUDENT_STATS: 'beeprepare_1112_student_stats',
        TEACHER_STATS: 'beeprepare_1112_teacher_stats',
        TRANSACTIONS: 'beeprepare_1112_transactions',
        RESOURCES: 'beeprepare_1112_resources',
        RES_PENDING: 'beeprepare_1112_res_pending'
    },

    // --- Core Data Access ---
    getData(key) {
        return JSON.parse(localStorage.getItem(key) || '[]');
    },

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    getStats(role) {
        const key = role === 'student' ? this.KEYS.STUDENT_STATS : this.KEYS.TEACHER_STATS;
        let stats = JSON.parse(localStorage.getItem(key));
        if (!stats) {
            stats = role === 'student'
                ? { coins: 0, streak: 0, solved: 0, lastActive: null }
                : { coins: 0, approved: 0, reviewed: 0, flashcards: 0 };
            this.saveData(key, stats);
        }
        return stats;
    },

    updateCoins(role, amount, reason) {
        const stats = this.getStats(role);
        stats.coins += amount;
        this.saveData(role === 'student' ? this.KEYS.STUDENT_STATS : this.KEYS.TEACHER_STATS, stats);

        // Log transaction
        const logs = this.getData(this.KEYS.TRANSACTIONS);
        logs.unshift({
            role,
            amount,
            reason,
            balance: stats.coins,
            timestamp: new Date().toISOString()
        });
        this.saveData(this.KEYS.TRANSACTIONS, logs);

        return stats.coins;
    },

    redeemCoins(role, amount, reason) {
        const stats = this.getStats(role);
        if (stats.coins < amount) return false;

        stats.coins -= amount;
        this.saveData(role === 'student' ? this.KEYS.STUDENT_STATS : this.KEYS.TEACHER_STATS, stats);

        // Log transaction
        const logs = this.getData(this.KEYS.TRANSACTIONS);
        logs.unshift({
            role,
            amount: -amount,
            reason: reason || 'Redemption',
            balance: stats.coins,
            timestamp: new Date().toISOString()
        });
        this.saveData(this.KEYS.TRANSACTIONS, logs);
        return true;
    },

    // --- Question Bank Management (Teacher POV) ---
    addQuestionToQueue(questionData) {
        // questionData: { subject, chapter, text, options: [], correctIndex, author }
        const pending = this.getData(this.KEYS.PENDING);
        const newQ = {
            ...questionData,
            id: 'q_' + Date.now(),
            status: 'pending',
            timestamp: new Date().toISOString(),
            approvals: [] // List of teacher IDs who approved
        };
        pending.push(newQ);
        this.saveData(this.KEYS.PENDING, pending);

        // Reward for adding (Teacher)
        this.updateCoins('teacher', 10, 'Added Question to Queue');
    },

    approveQuestion(questionId, reviewerId, difficulty = 'Medium') {
        const pending = this.getData(this.KEYS.PENDING);
        const qIndex = pending.findIndex(q => q.id === questionId);

        if (qIndex === -1) return false;

        const question = pending[qIndex];

        // Add approval
        if (!question.approvals.includes(reviewerId)) {
            question.approvals.push(reviewerId);
        }

        // Move to Bank
        const bank = this.getData(this.KEYS.QUESTIONS);
        const approvedQ = {
            ...question,
            status: 'active',
            difficulty: difficulty // Set by committee/reviewer
        };
        bank.push(approvedQ);
        this.saveData(this.KEYS.QUESTIONS, bank);

        // Remove from pending
        pending.splice(qIndex, 1);
        this.saveData(this.KEYS.PENDING, pending);

        // Reward Reviewer
        this.updateCoins('teacher', 10, 'Reviewed & Approved Question');

        // Reward Author (Delayed Reward)
        // In a real app we'd look up the author user. Here we just log it or simulate.
        return true;
    },

    // --- Resource Management (Teacher POV) ---
    addResourceToQueue(resData) {
        // resData: { type, subject, title, content (obj), author }
        const pending = this.getData(this.KEYS.RES_PENDING);
        const newRes = {
            ...resData,
            id: 'res_' + Date.now(),
            status: 'pending',
            timestamp: new Date().toISOString()
        };
        pending.push(newRes);
        this.saveData(this.KEYS.RES_PENDING, pending);

        // Reward based on type logic handled in UI or here?
        // User said: flash cards 10, short notes 20.
        const amount = resData.type === 'Flashcard' ? 10 : 20;
        this.updateCoins('teacher', amount, `Added ${resData.type} to Queue`);
    },

    approveResource(resId, reviewerId) {
        const pending = this.getData(this.KEYS.RES_PENDING);
        const idx = pending.findIndex(r => r.id === resId);
        if (idx === -1) return false;

        const res = pending[idx];
        const bank = this.getData(this.KEYS.RESOURCES);

        bank.push({ ...res, status: 'active' });
        this.saveData(this.KEYS.RESOURCES, bank);

        pending.splice(idx, 1);
        this.saveData(this.KEYS.RES_PENDING, pending);

        this.updateCoins('teacher', 10, 'Reviewed Resource');
        return true;
    },

    getResources(type, subject) {
        const all = this.getData(this.KEYS.RESOURCES);
        return all.filter(r => r.type === type && (!subject || r.subject === subject));
    },

    // --- Student Practice ---
    getPracticeQuestions(subject, chapter, difficulty, count = 10) {
        const bank = this.getData(this.KEYS.QUESTIONS);
        // Filter by subject/chapter
        let relevant = bank.filter(q => q.subject === subject);
        if (chapter) relevant = relevant.filter(q => q.chapter === chapter);
        if (difficulty && difficulty !== 'Any') relevant = relevant.filter(q => q.difficulty === difficulty);

        // Randomize
        return relevant.sort(() => 0.5 - Math.random()).slice(0, count);
    },

    submitTestScore(score, total) {
        const percentage = (score / total) * 100;
        if (percentage >= 80) {
            this.updateCoins('student', 10, `Scored ${Math.round(percentage)}% in Test`);
            return 10;
        }
        return 0;
    },

    // --- Leaderboard ---
    getLeaderboard() {
        const myStats = this.getStats('student');
        // Mock competitive data
        const mockUsers = [
            { name: 'Rahul K.', coins: Math.max(1250, myStats.coins + 200) },
            { name: 'Snapdragon', coins: Math.max(1100, myStats.coins + 50) },
            { name: 'Priya M.', coins: Math.max(900, myStats.coins - 100) },
            { name: 'Amit S.', coins: 850 },
            { name: 'You', coins: myStats.coins, isMe: true }
        ];

        return mockUsers.sort((a, b) => b.coins - a.coins);
    },

    // --- Initialization (Seed Data) ---
    init() {
        if (this.getData(this.KEYS.QUESTIONS).length === 0) {
            // Seed some dummy data
            const dummy = [];
            const subjects = ['Physics', 'Chemistry', 'Maths'];
            for (let i = 0; i < 50; i++) {
                const sub = subjects[Math.floor(Math.random() * subjects.length)];
                dummy.push({
                    id: 'seed_' + i,
                    subject: sub,
                    chapter: 'Chapter ' + (Math.floor(Math.random() * 5) + 1),
                    text: `Sample Question ${i + 1} for ${sub}?`,
                    options: ['Option A', 'Option B', 'Option C', 'Option D'],
                    correctIndex: 0,
                    difficulty: Math.random() > 0.5 ? 'Medium' : 'Hard',
                    status: 'active'
                });
            }
            this.saveData(this.KEYS.QUESTIONS, dummy);
        }
    }
};

// Auto-init on load
Grade1112System.init();
