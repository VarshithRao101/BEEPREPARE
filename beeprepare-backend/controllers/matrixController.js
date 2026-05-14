const { getQuestionsConn } = require('../config/db');
const { 
  initEngine, 
  loadQuestions, 
  generatePaper,
  getPresets,
  isReady: isEngineReady
} = require('../matrix-engine/js/matrix_bridge');
const { generatePaperJS } = require('../utils/matrixJS');

let engineReady = false;
let questionsLoadedCount = 0;

const syncQuestions = async () => {
    try {
        const Question = getQuestionsConn().model('Question');
        const Bank = require('../models/Bank');
        const banks = await Bank.find({}).lean();
        
        let totalUpdated = 0;
        for (const bank of banks) {
            const questions = await Question.find({ bankId: String(bank._id) });
            for (const q of questions) {
                let updated = false;
                
                // 1. Sync chapterIndex
                if (q.chapterId) {
                    const idx = bank.chapters.findIndex(c => c.chapterId === q.chapterId);
                    if (idx !== -1 && q.chapterIndex !== idx) {
                        q.chapterIndex = idx;
                        updated = true;
                    }
                }

                // 2. Sync numericId (pre-save hook will handle new ones, but for existing:)
                if (!q.numericId) {
                    const lastQ = await Question.findOne({}, { numericId: 1 }).sort({ numericId: -1 });
                    q.numericId = (lastQ && lastQ.numericId) ? lastQ.numericId + 1 : 1;
                    updated = true;
                }

                if (updated) {
                    await q.save();
                    totalUpdated++;
                }
            }
        }
        console.log(`[Matrix Engine] Synchronization complete. ${totalUpdated} questions updated with metadata.`);
        return totalUpdated;
    } catch (err) {
        console.error('[Matrix Engine] Sync failed:', err.message);
        throw err;
    }
};

const bootMatrixEngine = async () => {
    try {
        console.log('[Matrix Engine] Initializing boot sequence...');
        const ready = await initEngine();
        if (!ready) return;

        // Wait for questionsConn to be available (async from db.js)
        let Question;
        let retries = 0;
        while (retries < 10) {
            try {
                Question = getQuestionsConn().model('Question');
                if (Question) break;
            } catch (e) {
                retries++;
                console.log(`[Matrix Engine] Waiting for Questions DB... (Attempt ${retries}/10)`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (!Question) {
            console.error('[Matrix Engine] Questions DB connection timed out. Engine offline.');
            return;
        }

        // ── SYNC LAYER ──
        // Ensures chapterIndex and numericId are aligned before loading into WASM heap
        await syncQuestions(); 

        const questions = await Question.find({}).lean();
        
        questionsLoadedCount = await loadQuestions(questions);
        engineReady = true;
        console.log(`[Matrix Engine] Ready. ${questionsLoadedCount} questions loaded into WASM heap.`);
    } catch (err) {
        console.error('[Matrix Engine] Boot failed:', err.message);
    }
};

const generatePaperCtrl = async (req, res) => {
  try {
    await connectDB();
    
    let result;
    if (isEngineReady()) {
      result = await generatePaper(req.body);
    } else {
      console.log('[Matrix Engine] WASM offline, using JS Fallback');
      result = await generatePaperJS(req.body);
    }

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error || 'Paper generation failed.',
        error: { code: 'GENERATION_FAILED' }
      });
    }

    // Fetch full docs if not already provided by JS fallback
    let fullQuestions = result.questions;
    if (!fullQuestions) {
       const Question = getQuestionsConn().model('Question');
       fullQuestions = await Question.find({ numericId: { $in: result.questionIds } }).lean();
    }

    // Mark questions as lastUsed (fire and forget)
    const Question = getQuestionsConn().model('Question');
    Question.updateMany(
      { _id: { $in: fullQuestions.map(q => q._id) } },
      { $set: { lastUsed: new Date() } }
    ).catch(err => console.error('lastUsed update failed:', err.message));

    res.json({
      success: true,
      data: {
        questions: fullQuestions,
        report: result.report,
        satisfaction: result.tagSatisfaction,
        totalMarks: result.totalMarksAchieved || fullQuestions.reduce((s, q) => s + (q.marks || 1), 0),
        engineSuccess: result.success
      }
    });

    // Award EXP if student
    if (req.user && req.user.role === 'student') {
        const { awardExp } = require('../utils/expService');
        awardExp(req.user.googleUid, 'PAPER_GENERATED');
    }
  } catch (err) {
    console.error('[PAPER GENERATION ERROR]', err);
    res.status(500).json({ success: false, message: 'Paper generation failed: ' + err.message });
  }
};

const validateDistribution = (req, res) => {
    const { distribution } = req.body;
    if (!distribution || !Array.isArray(distribution)) {
        return res.json({ valid: false, errors: ['Invalid distribution format'] });
    }
    const sum = distribution.reduce((a, b) => a + (b.pct || 0), 0);
    const errors = [];
    if (sum !== 100) errors.push(`Percentages must sum to 100, got ${sum}`);
    
    const validTags = ['important', 'repeated', 'formula', 'conceptual', 'pyqs', 'tricky', 'standard'];
    distribution.forEach(d => {
        if (!validTags.includes(d.tag.toLowerCase())) errors.push(`Invalid tag: ${d.tag}`);
    });

    res.json({ valid: errors.length === 0, errors, totalPct: sum });
};

const getPresetsCtrl = (req, res) => {
    res.json({ success: true, data: getPresets() });
};

const reloadEngine = async (req, res) => {
    try {
        engineReady = false;
        const syncCount = await syncQuestions();
        await bootMatrixEngine();
        res.json({ success: true, data: { questionsLoaded: questionsLoadedCount, syncCount } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Reload failed: ' + err.message });
    }
};

const getStatus = (req, res) => {
    res.json({ 
        success: true, 
        data: { 
            status: engineReady ? 'operational' : 'offline', 
            questions: questionsLoadedCount 
        } 
    });
};

module.exports = { 
    bootMatrixEngine, 
    generatePaperCtrl, 
    getPresets: getPresetsCtrl, 
    reloadEngine, 
    getStatus, 
    validateDistribution 
};
