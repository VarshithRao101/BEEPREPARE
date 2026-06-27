const { connectDB, getQuestionsConn } = require('../config/db');
const { getPresets } = require('../matrix-engine/js/matrix_bridge');
const { generatePaperJS } = require('../utils/matrixJS');
const { Worker } = require('worker_threads');
const path = require('path');

let workerInstance = null;
const activeRequests = new Map();
let requestIdCounter = 0;

let engineReady = false;
let questionsLoadedCount = 0;

/**
 * Worker Manager Layer
 * Handles spawning, communication matching, error reporting, and crash recovery.
 */
const initWorker = () => {
    if (workerInstance) return;

    const workerPath = path.join(__dirname, '../matrix-engine/js/matrix_worker.js');
    console.log('[Matrix Engine] Spawning persistent background worker thread...');
    workerInstance = new Worker(workerPath);

    // Coordinate replies using requestId
    workerInstance.on('message', (msg) => {
        const { type, success, count, result, error, requestId } = msg;
        const pendingPromise = activeRequests.get(requestId);

        if (pendingPromise) {
            activeRequests.delete(requestId);
            if (type === 'ERROR' || !success) {
                pendingPromise.reject(new Error(error || 'Worker operation failed'));
            } else {
                pendingPromise.resolve({ count, result });
            }
        }
    });

    workerInstance.on('error', (err) => {
        console.error('[Matrix Worker] Fatal Exception inside worker thread:', err);
        // Reject all outstanding requests in queue
        for (const [requestId, pending] of activeRequests.entries()) {
            pending.reject(err);
            activeRequests.delete(requestId);
        }
        workerInstance = null;
        engineReady = false;
    });

    workerInstance.on('exit', (code) => {
        console.log(`[Matrix Worker] Process exited with code ${code}`);
        workerInstance = null;
        engineReady = false;
        
        // Auto-restart worker on unexpected crash
        if (code !== 0) {
            console.log('[Matrix Worker] Rebooting engine worker after crash...');
            bootMatrixEngine().catch(err => console.error('[Matrix Engine] Crash boot failed:', err.message));
        }
    });
};

const sendToWorker = (type, payload) => {
    return new Promise((resolve, reject) => {
        try {
            initWorker();
            const requestId = requestIdCounter++;
            activeRequests.set(requestId, { resolve, reject });
            workerInstance.postMessage({ type, payload, requestId });
        } catch (err) {
            reject(err);
        }
    });
};

const syncQuestions = async () => {
    try {
        const Question = require('../models/Question');
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

                // 2. Sync numericId
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
        
        // 1. Spin up worker and compile WASM runtime
        await sendToWorker('BOOT');

        // 2. Wait for questions database connection to be initialized
        let Question;
        let retries = 0;
        while (retries < 10) {
            try {
                await connectDB();
                Question = require('../models/Question');
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

        // 3. Align question bank indexes
        await syncQuestions(); 

        // 4. Retrieve all questions
        const questions = await Question.find({}).lean();
        
        // 5. Transfer questions to Worker memory heap
        const response = await sendToWorker('LOAD_QUESTIONS', { questions });
        questionsLoadedCount = response.count;
        engineReady = true;
        console.log(`[Matrix Engine] Ready. ${questionsLoadedCount} questions loaded into WASM heap inside worker.`);
    } catch (err) {
        console.error('[Matrix Engine] Boot sequence failed:', err.message);
        engineReady = false;
    }
};

const generatePaperCtrl = async (req, res) => {
  try {
    await connectDB();
    
    let result;
    if (engineReady) {
      // Execute the backtracking optimization search in the background thread
      const response = await sendToWorker('GENERATE_PAPER', { options: req.body });
      result = response.result;
    } else {
      console.log('[Matrix Engine] WASM offline, using JS Fallback on main thread');
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
       const Question = require('../models/Question');
       fullQuestions = await Question.find({ numericId: { $in: result.questionIds } }).lean();
    }

    // Mark questions as lastUsed (fire and forget)
    const Question = require('../models/Question');
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
        
        // Terminate existing worker cleanly to reclaim native heap memory
        if (workerInstance) {
            console.log('[Matrix Engine] Reclaiming memory. Terminating active worker...');
            await workerInstance.terminate();
            workerInstance = null;
        }

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
