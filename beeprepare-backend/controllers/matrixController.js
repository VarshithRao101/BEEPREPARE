const { getQuestionsConn } = require('../config/db');
const { 
  initEngine, 
  loadQuestions, 
  generatePaper,
  getPresets 
} = require('../matrix-engine/js/matrix_bridge');

let engineReady = false;
let questionsLoadedCount = 0;

const bootMatrixEngine = async () => {
    try {
        console.log('[Matrix Engine] Initializing boot sequence...');
        const ready = await initEngine();
        if (!ready) return;

        const Question = getQuestionsConn().model('Question');
        const questions = await Question.find({}).lean();
        
        questionsLoadedCount = await loadQuestions(questions);
        engineReady = true;
        console.log(`[Matrix Engine] Ready. ${questionsLoadedCount} questions loaded into WASM heap.`);
    } catch (err) {
        console.error('[Matrix Engine] Boot failed:', err.message);
    }
};

const generatePaperCtrl = async (req, res) => {
    if (!engineReady) return res.status(503).json({ success: false, message: 'Engine offline' });

    try {
        const result = await generatePaper(req.body);
        
        // Fetch full docs
        const Question = getQuestionsConn().model('Question');
        const questions = await Question.find({ numericId: { $in: result.questionIds } }).lean();

        // Update lastUsed
        await Question.updateMany(
            { numericId: { $in: result.questionIds } },
            { $set: { lastUsed: new Date() } }
        );

        res.json({
            success: true,
            data: {
                questions,
                report: result.report,
                satisfaction: result.tagSatisfaction,
                totalMarks: result.totalMarksAchieved,
                engineSuccess: result.success
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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
    engineReady = false;
    await bootMatrixEngine();
    res.json({ success: true, data: { questionsLoaded: questionsLoadedCount } });
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
