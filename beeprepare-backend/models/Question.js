/**
 * Question Model — lives on Cluster 1 (Questions-only DB)
 *
 * Hierarchy: teacherId → class → subject → questionType
 *
 * The bankId field is kept as a reference so that the Bank document
 * on Cluster 2 can still be used to look up metadata (subject, class,
 * chapters) — it is NOT a mongoose cross-DB populate, it is used
 * manually via Bank.findById() on the main connection when needed.
 */
const { Schema } = require('mongoose');
const { getQuestionsConn } = require('../config/db');

const questionSchema = new Schema({
  // ── Hierarchy fields (Requested: user > class > subject > questionType) ──
  teacherId:    { type: String, required: true, index: true },
  class:        { type: String, required: true, index: true },   
  subject:      { type: String, required: true, index: true },   
  questionType: { type: String, required: true, enum: ['MCQ', 'Very Short', 'Short', 'Long', 'Essay', 'True or False', 'Fill in the Blanks', 'Simple Matching', 'Matrix Matching', 'Reading Passage', 'Case Study', 'Data Interpretation'], index: true },

  // ── Question Content ────────────────────────────────────────────────────
  questionText:  { type: String, required: true, minlength: 10, maxlength: 5000 },
  imageUrl:      { type: String }, // For diagram uploads
  imagePublicId: { type: String }, // For Cloudinary persistent storage
  marks:         { type: Number, required: true },
  difficulty:    { type: String, required: true, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
  mcqOptions: {
    A: { type: String },
    B: { type: String },
    C: { type: String },
    D: { type: String }
  },
  correctOption: { type: String, enum: ['A', 'B', 'C', 'D'] },
  isImportant:   { type: Boolean, required: true, default: false },
  tags:          [{ type: String, enum: ['Important', 'Repeated', 'Exam Focus', 'Formula', 'Conceptual', 'Formula Based'] }],

  // ── New Question Types Fields ──────────────────────────────────────────
  pairs:         [{ left: String, right: String }], // For Simple Matching
  rows:          [String], // For Matrix Matching
  columns:       [String], // For Matrix Matching
  subQuestions:  [{ 
    questionText: String,
    marks: Number
  }], // For Reading Passage, Case Study, Data Interpretation


  // Metadata & Cross-refs ───────────────────────────────────────────────
  chapterId:     { type: String }, 
  chapterName:   { type: String }, 
  bankId:        { type: String }, // Cross-ref to Bank on Main DB
  createdBy:     { type: String, required: true },

  // Matrix Engine Fields ──────────────────────────────────────────────────
  metaTags: {
    type: [String],
    enum: ['important', 'repeated', 'formula', 'conceptual', 'pyqs', 'tricky', 'standard'],
    default: []
  },
  subtopicBitmask: {
    type: Number,   // stored as regular Number, BigInt conversion in bridge
    default: 0
  },
  chapterIndex: {
    type: Number,   // numeric index for fast WASM lookup
    default: 0
  },
  numericId: {
    type: Number,
    index: true,
    unique: true,
    sparse: true
  },
  examFrequency: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  importance: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  lastUsed: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// ── Auto-assign numericId for Matrix Engine ───────────────────────────────
questionSchema.pre('save', async function(next) {
  if (this.isNew && !this.numericId) {
    try {
      const lastQ = await this.constructor.findOne({}, { numericId: 1 }).sort({ numericId: -1 });
      this.numericId = (lastQ && lastQ.numericId) ? lastQ.numericId + 1 : 1;
    } catch (err) {
      console.warn('[Question Model] Failed to auto-assign numericId:', err.message);
    }
  }
  next();
});

// ── Compound indexes for all common query patterns ──────────────────────────
questionSchema.index({ metaTags: 1 });
questionSchema.index({ chapterIndex: 1 });
questionSchema.index({ metaTags: 1, difficulty: 1 });
questionSchema.index({ teacherId: 1, class: 1, subject: 1, questionType: 1 });
questionSchema.index({ bankId: 1, questionType: 1, isImportant: 1 });
questionSchema.index({ bankId: 1, chapterId: 1, questionType: 1, isImportant: 1 });
questionSchema.index({ bankId: 1 });
questionSchema.index({ createdBy: 1 });

// ── Register on Questions connection (lazy — after connectDB()) ─────────────
let _Question = null;

const getQuestion = () => {
  if (!_Question) {
    _Question = getQuestionsConn().model('Question', questionSchema);
  }
  return _Question;
};

// Proxy so existing `require('../models/Question')` still works as a Model
module.exports = new Proxy(function() {}, {
  get(_, prop) {
    return getQuestion()[prop];
  },
  construct(_, args) {
    return new (getQuestion())(...args);
  }
});

// Also export the getter directly for explicit use
module.exports.getQuestion = getQuestion;
