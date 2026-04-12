require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testFirstGuess() {
  const key = 'AIzaSyC1qTmtRMgAh4MFliWSEf0rmPbvk2OgYA'; // My first guess from image
  console.log('Testing key:', key);
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  try {
    const result = await model.generateContent('Hi');
    console.log('✅ Success:', result.response.text());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testFirstGuess();
