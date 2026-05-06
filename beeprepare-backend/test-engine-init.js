const { initEngine, loadQuestions } = require('./matrix-engine/js/matrix_bridge');
const path = require('path');

async function test() {
    console.log('Testing Engine Init...');
    const start = Date.now();
    try {
        const ready = await initEngine();
        console.log(`Engine Ready: ${ready} in ${Date.now() - start}ms`);
        if (ready) {
            const qCount = await loadQuestions([{ numericId: 1, questionType: 'MCQ', marks: 1, difficulty: 'easy' }]);
            console.log(`Loaded ${qCount} questions`);
        }
    } catch (err) {
        console.error('Engine Test Failed:', err);
    }
    process.exit(0);
}

test();
