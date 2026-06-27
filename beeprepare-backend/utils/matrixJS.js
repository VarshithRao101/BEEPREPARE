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

  // STAGE 1 — Compute priority score
  const now = Date.now() / 1000;
  allQuestions.forEach(q => {
    const daysSince = q.lastUsed 
      ? (now - new Date(q.lastUsed).getTime()/1000) / 86400 
      : 999;
    const recencyBonus = daysSince > 30 ? 15 : daysSince * 0.5;
    const diff = (q.difficulty || 'easy').toLowerCase();
    q._priority = (q.importance || 5) * 10
                + (q.examFrequency || 5) * 5
                + recencyBonus
                - (diff === 'hard' ? 3 : diff === 'medium' ? 2 : 1) * 2;
  });

  allQuestions.sort((a, b) => b._priority - a._priority);

  // STAGE 2 — Tag Quotas
  let dist = tagDistribution;
  if (!dist || dist.length === 0) {
    dist = [{ tag: 'important', pct: 40 }, { tag: 'standard', pct: 60 }];
  }

  const pctSum = dist.reduce((s, d) => s + d.pct, 0);
  if (pctSum !== 100) {
    dist = dist.map(d => ({ ...d, pct: Math.round(d.pct * 100 / pctSum) }));
  }

  const quotas = dist.map(d => ({
    tag: d.tag,
    quota: Math.max(1, Math.floor(totalQuestions * d.pct / 100))
  }));

  const quotaSum = quotas.reduce((s, q) => s + q.quota, 0);
  if (quotaSum < totalQuestions) {
    quotas[0].quota += (totalQuestions - quotaSum);
  }

  // STAGE 3 — Selection
  const selected = [];
  const usedIds = new Set();
  let coveredBits = BigInt(0);

  for (const slot of quotas) {
    const tagPool = allQuestions.filter(q => 
      !usedIds.has(String(q._id)) &&
      (q.metaTags || []).includes(slot.tag)
    );

    let filled = 0;
    const overflow = [];

    for (const q of tagPool) {
      if (filled >= slot.quota) break;
      const qBits = BigInt(q.subtopicBitmask || 0);
      if (qBits !== BigInt(0) && (coveredBits & qBits) !== BigInt(0)) {
        overflow.push(q);
        continue;
      }
      selected.push(q);
      usedIds.add(String(q._id));
      coveredBits |= qBits;
      filled++;
    }

    for (const q of overflow) {
      if (filled >= slot.quota) break;
      if (usedIds.has(String(q._id))) continue;
      selected.push(q);
      usedIds.add(String(q._id));
      filled++;
    }

    if (filled < slot.quota) {
      for (const q of allQuestions) {
        if (filled >= slot.quota) break;
        if (usedIds.has(String(q._id))) continue;
        selected.push(q);
        usedIds.add(String(q._id));
        filled++;
      }
    }
  }

  // STAGE 4 — Difficulty Split
  const easyTarget   = Math.round(selected.length * easyPct   / 100);
  const mediumTarget = Math.round(selected.length * mediumPct / 100);

  const easyQs   = selected.filter(q => (q.difficulty || '').toLowerCase() === 'easy');
  const mediumQs = selected.filter(q => (q.difficulty || '').toLowerCase() === 'medium');
  const hardQs   = selected.filter(q => (q.difficulty || '').toLowerCase() === 'hard');

  const finalPool = [
    ...easyQs.slice(0, easyTarget),
    ...mediumQs.slice(0, mediumTarget),
    ...hardQs.slice(0, selected.length - easyTarget - mediumTarget)
  ];

  // Pad if needed
  if (finalPool.length < totalQuestions) {
    const usedFinalIds = new Set(finalPool.map(q => String(q._id)));
    for (const q of selected) {
      if (finalPool.length >= totalQuestions) break;
      if (!usedFinalIds.has(String(q._id))) finalPool.push(q);
    }
  }

  // Fisher-Yates
  for (let i = finalPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [finalPool[i], finalPool[j]] = [finalPool[j], finalPool[i]];
  }

  const tagSatisfaction = {};
  dist.forEach(d => {
    const needed = Math.floor(totalQuestions * d.pct / 100);
    const got = finalPool.filter(q => (q.metaTags || []).includes(d.tag)).length;
    tagSatisfaction[d.tag] = needed > 0 ? Math.round(got * 100 / needed) : 100;
  });

  return {
    success: true,
    questionIds: finalPool.map(q => q.numericId),
    questions: finalPool,
    totalMarksAchieved: finalPool.reduce((s, q) => s + (q.marks || 1), 0),
    tagSatisfaction,
    report: `Generated ${finalPool.length} questions | JS Fallback`
  };
}

module.exports = { generatePaperJS };
