const { getQuestionsConn, connectDB } = require('../config/db');

/**
 * Pure JavaScript fallback for the Matrix Engine generation logic.
 * Designed to work in serverless environments where WASM might fail.
 */
async function generatePaperJS(options) {
  const {
    totalQuestions = 30,
    totalMarks,
    easyPct = 30,
    mediumPct = 50, 
    hardPct = 20,
    tagDistribution,
    chapterIds,
    chapterIndices, // For legacy support
    subjectId,
    bankId,
    typeFilter, // numeric type from TYPE_MAP
    marks, // Filter by exact marks requested
    excludeIds = [], // Exclude these question IDs to avoid repeats
    bank // already fetched bank object (optional)
  } = options;

  const Question = require('../models/Question');
  const Bank = require('../models/Bank');

  let activeBank = bank;
  if (!activeBank && bankId) {
    activeBank = await Bank.findById(bankId).lean();
  }

  // Build filter query
  const filter = {};
  if (bankId) {
    const mongoose = require('mongoose');
    // Resilient lookup: handle both stored String and ObjectId formats
    filter.$or = [
      { bankId: String(bankId) },
      { bankId: mongoose.Types.ObjectId.isValid(bankId) ? new mongoose.Types.ObjectId(bankId) : null }
    ].filter(c => c.bankId !== null);
  }
  if (subjectId)  filter.subjectId  = subjectId;
  
  if (chapterIds?.length) {
    filter.chapterId = { $in: chapterIds };
  } else if (chapterIndices?.length && activeBank) {
    const cIds = chapterIndices.map(idx => activeBank.chapters[idx]?.chapterId).filter(Boolean);
    if (cIds.length) filter.chapterId = { $in: cIds };
  }

  const TYPE_MAP_REV = {
    0: 'MCQ', 1: 'Very Short', 2: 'Short', 3: 'Long', 4: 'Essay',
    5: 'True or False', 6: 'Fill in the Blanks', 7: 'Simple Matching',
    8: 'Matrix Matching', 9: 'Reading Passage', 10: 'Case Study',
    11: 'Data Interpretation'
  };

  if (typeFilter !== undefined && typeFilter !== -1) {
    if (typeof typeFilter === 'number') {
      filter.questionType = TYPE_MAP_REV[typeFilter];
    } else {
      filter.questionType = typeFilter;
    }
  }

  if (marks !== undefined && marks !== null) {
    filter.marks = marks;
  }

  if (excludeIds && excludeIds.length > 0) {
    const mongoose = require('mongoose');
    filter._id = {
      $nin: excludeIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id)
    };
  }

  // Fetch all candidate questions
  console.log(`[Matrix Engine JS] Searching for: bankId=${bankId}, type=${filter.questionType}, chapters=${JSON.stringify(filter.chapterId || 'all')}`);
  
  const allQuestions = await Question.find(filter)
    .select('_id numericId marks difficulty importance examFrequency lastUsed metaTags chapterId subtopicBitmask questionText questionType mcqOptions imageUrl pairs rows columns subQuestions')
    .lean();

  console.log(`[Matrix Engine JS] Found ${allQuestions?.length || 0} candidate questions.`);

  if (!allQuestions || allQuestions.length === 0) {
    return { questionIds: [], success: false, error: 'NO_QUESTIONS' };
  }

  // Shuffle allQuestions using Fisher-Yates algorithm
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  const finalPool = allQuestions.slice(0, totalQuestions);

  return {
    success: true,
    questionIds: finalPool.map(q => q.numericId),
    questions: finalPool,
    totalMarksAchieved: finalPool.reduce((s, q) => s + (q.marks || 1), 0),
    tagSatisfaction: {},
    report: `Generated ${finalPool.length} questions | Random Selection`
  };
}

module.exports = { generatePaperJS };
