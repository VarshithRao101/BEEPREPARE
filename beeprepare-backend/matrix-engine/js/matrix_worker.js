const { parentPort } = require('worker_threads');
const { initEngine, loadQuestions, generatePaper } = require('./matrix_bridge');

let engineReady = false;

// Handle messages from the parent (main) thread
parentPort.on('message', async (msg) => {
  const { type, payload, requestId } = msg;

  try {
    if (type === 'BOOT') {
      console.log('[Matrix Worker] Initializing WebAssembly engine...');
      const ready = await initEngine();
      engineReady = ready;
      parentPort.postMessage({ type: 'BOOT_DONE', success: ready, requestId });
    } 
    
    else if (type === 'LOAD_QUESTIONS') {
      if (!engineReady) {
        throw new Error('WASM Engine not initialized or ready');
      }
      console.log(`[Matrix Worker] Loading ${payload.questions.length} questions into WebAssembly heap...`);
      const loadedCount = await loadQuestions(payload.questions);
      parentPort.postMessage({ type: 'LOAD_DONE', success: true, count: loadedCount, requestId });
    } 
    
    else if (type === 'GENERATE_PAPER') {
      if (!engineReady) {
        throw new Error('WASM Engine not initialized or ready');
      }
      
      const result = await generatePaper(payload.options);
      parentPort.postMessage({ type: 'GENERATED_DONE', success: true, result, requestId });
    }
  } catch (err) {
    console.error(`[Matrix Worker] Error during command '${type}':`, err.message);
    parentPort.postMessage({ type: 'ERROR', error: err.message, requestId });
  }
});
