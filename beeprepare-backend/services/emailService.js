const { Resend } = require('resend');
const logger = require('../utils/logger');

// Initialize Resend with API Key from .env
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a professional email via Resend
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @returns {Promise<Object>} - Resend response
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const from = process.env.EMAIL_FROM || 'BEEPREPARE <onboarding@resend.dev>';
    
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html
    });

    if (error) {
      logger.error('Resend Email Error:', error);
      throw error;
    }

    logger.info(`Email sent successfully to ${to}. ID: ${data.id}`);
    return data;
  } catch (err) {
    logger.error('Email Service Failure:', err);
    throw err;
  }
};

/**
 * Test function as requested by USER
 */
const sendTestEmail = async () => {
  return await sendEmail({
    to: 'ravindarraodevarneni@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
  });
};

module.exports = {
  sendEmail,
  sendTestEmail
};
