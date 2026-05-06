const path = require('path');
const fs   = require('fs');

let Module = null;

async function initEngine() {
  const wasmPath = path.join(__dirname, '../build/matrix_engine.js');
  if (!fs.existsSync(wasmPath)) {
      console.warn('[Matrix Engine] build/matrix_engine.js not found. Run build.sh first.');
      return false;
  }
  
  try {
      const MatrixEngine = require(wasmPath);
      
      // If it's a factory function (modularized)
      if (typeof MatrixEngine === 'function') {
          Module = await MatrixEngine();
          console.log('[Matrix Engine] WASM factory loaded');
          return true;
      } 
      
      // If it's the Module object (standard)
      Module = MatrixEngine;
      return new Promise((resolve) => {
          if (Module.calledRun || Module._engine_load) {
              console.log('[Matrix Engine] WASM already ready');
              resolve(true);
          } else {
              Module.onRuntimeInitialized = () => {
                  console.log('[Matrix Engine] WASM runtime initialized');
                  resolve(true);
              };
              // Safety timeout
              setTimeout(() => {
                if (Module._engine_load) resolve(true);
                else {
                    console.warn('[Matrix Engine] Init timeout - check WASM integrity');
                    resolve(false);
                }
              }, 10000);
          }
      });
  } catch (err) {
      console.error('[Matrix Engine] Failed to require or init WASM glue:', err.message);
      return false;
  }
}

async function loadQuestions(questions) {
  if (!Module) throw new Error('Engine not initialized');
  const n = questions.length;

  const alloc = (TypedArray, n) => {
    const bytes = new TypedArray(n);
    const ptr   = Module._malloc(bytes.byteLength);
    return { ptr, bytes, view: new TypedArray(Module.HEAPU8.buffer, ptr, n) };
  };

  const ids      = alloc(Uint32Array, n);
  const marks    = alloc(Uint8Array,  n);
  const diff     = alloc(Uint8Array,  n);
  const imp      = alloc(Uint8Array,  n);
  const freq     = alloc(Uint8Array,  n);
  const ts       = alloc(Uint32Array, n);
  const subs     = alloc(BigUint64Array, n);
  const mtags    = alloc(Uint8Array,  n);
  const chaps    = alloc(Uint8Array,  n);
  const qtypes   = alloc(Uint8Array,  n);

  const TAG_MAP = {
    important: 0, repeated: 1, formula: 2,
    conceptual: 3, pyqs: 4, tricky: 5, standard: 6
  };

  const TYPE_MAP = {
    'MCQ': 0, 'Very Short': 1, 'Short': 2, 'Long': 3, 'Essay': 4,
    'True or False': 5, 'Fill in the Blanks': 6, 'Simple Matching': 7,
    'Matrix Matching': 8, 'Reading Passage': 9, 'Case Study': 10,
    'Data Interpretation': 11
  };

  questions.forEach((q, i) => {
    ids.view[i]   = q.numericId || (i + 1);
    marks.view[i] = 1; // Force 1 mark to allow arbitrary selection (overridden in controller)
    const d = (q.difficulty || '').toLowerCase();
    diff.view[i]  = d === 'easy' ? 1 : d === 'medium' ? 2 : 3;
    imp.view[i]   = q.importance || 5;
    freq.view[i]  = q.examFrequency || 5;
    ts.view[i]    = q.lastUsed ? Math.floor(new Date(q.lastUsed)/1000) : 0;
    subs.view[i]  = BigInt(q.subtopicBitmask || 0);
    
    let tagBits = 0;
    const combinedTags = [...(q.metaTags || []), ...(q.tags || [])];
    if (q.isImportant) combinedTags.push('important');
    
    combinedTags.forEach(t => {
      const idx = TAG_MAP[t.toLowerCase()];
      if (idx !== undefined) tagBits |= (1 << idx);
    });
    mtags.view[i] = tagBits;
    chaps.view[i] = q.chapterIndex || 0;
    qtypes.view[i] = TYPE_MAP[q.questionType] ?? 2; // Default to Short if unknown
  });

  const now = Math.floor(Date.now() / 1000);
  const loaded = Module._engine_load(
    ids.ptr, marks.ptr, diff.ptr, imp.ptr, freq.ptr,
    ts.ptr, subs.ptr, mtags.ptr, chaps.ptr, qtypes.ptr, n, now
  );

  [ids,marks,diff,imp,freq,ts,subs,mtags,chaps,qtypes].forEach(a => Module._free(a.ptr));
  return loaded;
}

const TAG_PRESETS = {
  'important_100':           [{ tag: 'important', pct: 100 }],
  'important_70_repeated_30':[{ tag: 'important', pct: 70 }, { tag: 'repeated', pct: 30 }],
  'important_70_formula_30': [{ tag: 'important', pct: 70 }, { tag: 'formula',  pct: 30 }],
  'important_70_conceptual_30':[{ tag:'important',pct:70},{tag:'conceptual',pct:30}],
  'important_70_pyqs_30':    [{ tag: 'important', pct: 70 }, { tag: 'pyqs',     pct: 30 }],
  'important_50_repeated_50':[{ tag: 'important', pct: 50 }, { tag: 'repeated', pct: 50 }],
  'repeated_60_formula_40':  [{ tag: 'repeated',  pct: 60 }, { tag: 'formula',  pct: 40 }],
  'pyqs_70_standard_30':     [{ tag: 'pyqs',      pct: 70 }, { tag: 'standard', pct: 30 }],
  'formula_60_conceptual_40':[{ tag: 'formula',   pct: 60 }, { tag: 'conceptual',pct:40}],
  'important_50_repeated_30_formula_20':[
    {tag:'important',pct:50},{tag:'repeated',pct:30},{tag:'formula',pct:20}],
  'important_40_pyqs_40_tricky_20':[
    {tag:'important',pct:40},{tag:'pyqs',pct:40},{tag:'tricky',pct:20}],
  'important_40_repeated_30_formula_20_conceptual_10':[
    {tag:'important',pct:40},{tag:'repeated',pct:30},
    {tag:'formula',pct:20},{tag:'conceptual',pct:10}],
  'important_30_repeated_25_formula_20_conceptual_15_tricky_10':[
    {tag:'important',pct:30},{tag:'repeated',pct:25},{tag:'formula',pct:20},
    {tag:'conceptual',pct:15},{tag:'tricky',pct:10}],
  'all_seven':[
    {tag:'important',pct:25},{tag:'repeated',pct:20},{tag:'formula',pct:15},
    {tag:'conceptual',pct:15},{tag:'pyqs',pct:10},{tag:'tricky',pct:10},
    {tag:'standard',pct:5}],
};

const TAG_IDX = { important:0,repeated:1,formula:2,conceptual:3,pyqs:4,tricky:5,standard:6 };

async function generatePaper(options) {
  if (!Module) throw new Error('Engine not initialized');

  const {
    totalQuestions = 30,
    totalMarks     = 100,
    easyPct        = 30,
    mediumPct      = 50,
    hardPct        = 20,
    tagDistribution,
    presetName,
    typeFilter     = -1,
    chapterIndices = [],
    seed = Math.floor(Math.random() * 0xFFFFFFFF)
  } = options;

  const dist = presetName ? TAG_PRESETS[presetName] : tagDistribution;
  if (!dist || dist.length === 0) throw new Error('No tag distribution provided');
  
  const sum = dist.reduce((a, b) => a + b.pct, 0);
  if (sum !== 100) throw new Error(`Tag percentages must sum to 100, got ${sum}`);

  const tagCount   = dist.length;
  const tagTypesPtr = Module._malloc(tagCount);
  const tagPctsPtr  = Module._malloc(tagCount);
  const tagTypesView = new Uint8Array(Module.HEAPU8.buffer, tagTypesPtr, tagCount);
  const tagPctsView  = new Uint8Array(Module.HEAPU8.buffer, tagPctsPtr,  tagCount);
  dist.forEach((d, i) => {
    tagTypesView[i] = TAG_IDX[d.tag.toLowerCase()];
    tagPctsView[i]  = d.pct;
  });

  const chapCount = chapterIndices.length;
  const chapPtr   = Module._malloc(chapCount);
  new Uint8Array(Module.HEAPU8.buffer, chapPtr, chapCount).set(chapterIndices);

  const resultPtr = Module._malloc(4096); 
  Module.ccall('engine_generate_into_ptr',
    null,
    ['number','number','number','number','number',
     'number','number','number','number','number','number','number','number'],
    [totalQuestions, totalMarks, easyPct, mediumPct, hardPct,
     tagTypesPtr, tagPctsPtr, tagCount,
     chapPtr, chapCount, typeFilter, seed, resultPtr]
  );

  const view    = new DataView(Module.HEAPU8.buffer, resultPtr);
  const count   = view.getUint32(0, true);
  const qIds    = [];
  for (let i = 0; i < count; i++) {
    qIds.push(view.getUint32(4 + i * 4, true));
  }
  const totalMarksAchieved = view.getUint8(4 + count * 4);
  const success            = view.getUint8(4 + count * 4 + 1);

  const tagSat = {};
  Object.keys(TAG_IDX).forEach((tag, i) => {
    tagSat[tag] = view.getUint8(4 + count * 4 + 2 + i);
  });

  const reportOffset = 4 + count * 4 + 2 + 7;
  let report = '';
  for (let i = 0; i < 512; i++) {
    const ch = view.getUint8(reportOffset + i);
    if (ch === 0) break;
    report += String.fromCharCode(ch);
  }

  [tagTypesPtr, tagPctsPtr, chapPtr, resultPtr].forEach(p => Module._free(p));

  return { questionIds: qIds, totalMarksAchieved, success: !!success, tagSatisfaction: tagSat, report };
}

function getPresets() {
  return Object.keys(TAG_PRESETS).map(key => ({
    id: key,
    label: key.replace(/_/g, ' ').replace(/(\d+)/g, ' $1%').trim(),
    slots: TAG_PRESETS[key]
  }));
}

module.exports = { initEngine, loadQuestions, generatePaper, getPresets };
