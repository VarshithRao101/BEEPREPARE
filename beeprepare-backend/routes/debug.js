const express = require('express');
const router = express.Router();
const { Resend } = require('resend');

router.get('/debug-email', async (req, res) => {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM || 'BEEPREPARE <info@beeprepare.in>';
    const toEmail = req.query.to || 'ravindarraodevarneni@gmail.com';

    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'RESEND_API_KEY is missing in environment.' });
    }

    const resend = new Resend(apiKey);
    
    console.log(`[DEBUG_EMAIL] Attempting to send from ${fromEmail} to ${toEmail}`);
    
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'BEEPREPARE - SYSTEM DIAGNOSTIC TEST',
      html: '<h1>DIAGNOSTIC TEST</h1><p>If you see this, the email engine is operational.</p>'
    });

    if (error) {
      console.error('[DEBUG_EMAIL] Resend Error:', error);
      return res.status(400).json({ 
        success: false, 
        message: 'Resend rejected the request.',
        error: error,
        config: { from: fromEmail, to: toEmail, apiKeyPrefix: apiKey.substring(0, 7) }
      });
    }

    return res.json({ 
      success: true, 
      message: 'Resend accepted the email!',
      data: data,
      config: { from: fromEmail, to: toEmail }
    });

  } catch (err) {
    console.error('[DEBUG_EMAIL] Crash:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'The debug route crashed.',
      error: err.message,
      stack: err.stack
    });
  }
});

module.exports = router;
