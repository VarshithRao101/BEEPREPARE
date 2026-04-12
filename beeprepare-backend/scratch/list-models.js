require('dotenv').config();

async function listAllModels() {
  const key = process.env.GEMINI_API_KEY;
  try {
     const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
     const data = await res.json();
     console.log('Available Models:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listAllModels();
