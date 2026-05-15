const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM = 'BEEPREPARE <info@beeprepare.in>';

const EMAIL_STYLE = `
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #050505;
  color: #e5e7eb;
  margin: 0;
  padding: 0;
  line-height: 1.6;
`;

const CARD_STYLE = `
  max-width: 600px;
  margin: 40px auto;
  background-color: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
`;

const HEADER_STYLE = `
  padding: 32px;
  text-align: center;
  background: linear-gradient(to bottom, #1e293b, #0f172a);
  border-bottom: 1px solid #1e293b;
`;

const BODY_STYLE = `
  padding: 32px;
`;

const FOOTER_STYLE = `
  padding: 24px;
  text-align: center;
  background-color: #0f172a;
  border-top: 1px solid #1e293b;
  font-size: 12px;
  color: #64748b;
`;

const ACCENT_COLOR = '#fbbf24'; // Premium Gold

// Email 1: Payment submission confirmation
const sendPaymentSubmitted = async (email, paymentType, amount) => {
  const typeText = paymentType === 'activation' ? 'Full Platform Activation' : 'Additional Subject Inventory Slot';

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Acknowledgment of Payment Receipt | BEEPREPARE`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="${EMAIL_STYLE}">
        <div style="${CARD_STYLE}">
          <div style="${HEADER_STYLE}">
            <h1 style="color: ${ACCENT_COLOR}; margin: 0; font-size: 24px; letter-spacing: 2px; font-weight: 800; text-transform: uppercase;">BEEPREPARE</h1>
            <p style="margin: 4px 0 0; color: #94a3b8; font-size: 12px;">ACADEMIC EXCELLENCE PLATFORM</p>
          </div>
          <div style="${BODY_STYLE}">
            <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Transaction Receipt Acknowledged</h2>
            <p>This is an automated acknowledgment of your payment of <span style="color: ${ACCENT_COLOR}; font-weight: bold;">INR ${amount}</span> for <strong>${typeText}</strong>.</p>
            
            <div style="background-color: #1e293b; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${ACCENT_COLOR};">
              <h3 style="margin: 0 0 8px; color: ${ACCENT_COLOR}; font-size: 14px; text-transform: uppercase;">Verification Protocol</h3>
              <p style="margin: 0; font-size: 14px; color: #cbd5e1;">Our automated reconciliation system is currently validating your transaction with the banking gateway. This process typically concludes within a window of 5 to 30 minutes.</p>
            </div>

            <p style="font-size: 14px;">Once verified, your unique access credentials will be dispatched to this email address. We appreciate your patience during this security verification phase.</p>
            
            <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">For inquiries regarding this transaction, please reference your transaction ID and contact our administrative office at support@beeprepare.in.</p>
          </div>
          <div style="${FOOTER_STYLE}">
            <p style="margin: 0;">&copy; 2026 BEEPREPARE. All rights reserved.</p>
            <p style="margin: 4px 0 0;">This is a system-generated notification. Please do not reply directly to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
};

// Email 2: Payment approved — send key
const sendPaymentApproved = async (email, licenseKey, paymentType) => {
  const typeText = paymentType === 'activation' ? 'Full Platform Activation' : 'Subject Inventory Slot';
  const instructionHeader = paymentType === 'activation' ? 'Platform Initialization Steps' : 'Inventory Expansion Protocol';
  
  const instructions = paymentType === 'activation' 
    ? `<ul style="padding-left: 20px; color: #cbd5e1; font-size: 14px;">
        <li style="margin-bottom: 8px;">Access the official portal at <strong>www.beeprepare.in</strong> and authenticate via your Google identity.</li>
        <li style="margin-bottom: 8px;">Navigate to the secure activation terminal when prompted.</li>
        <li style="margin-bottom: 8px;">Input the alphanumeric key provided below to authorize your account.</li>
        <li style="margin-bottom: 8px;">Configure your professional profile as either Educator (Teacher) or Learner (Student).</li>
       </ul>`
    : `<ul style="padding-left: 20px; color: #cbd5e1; font-size: 14px;">
        <li style="margin-bottom: 8px;">Log in to your existing account profile.</li>
        <li style="margin-bottom: 8px;">Access the 'Resource Management' or 'Redeem' section.</li>
        <li style="margin-bottom: 8px;">Apply the key below to immediately expand your subject capacity.</li>
       </ul>`;

  try {
    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `Authorization Credentials for BEEPREPARE Platform`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="${EMAIL_STYLE}">
          <div style="${CARD_STYLE}">
            <div style="${HEADER_STYLE}">
              <h1 style="color: ${ACCENT_COLOR}; margin: 0; font-size: 24px; letter-spacing: 2px; font-weight: 800; text-transform: uppercase;">BEEPREPARE</h1>
            </div>
            <div style="${BODY_STYLE}">
              <h2 style="color: #10b981; font-size: 20px; margin-top: 0;">Verification Successful</h2>
              <p>Your transaction has been formally verified. Your requested authorization key for <strong>${typeText}</strong> is now active and ready for deployment.</p>
              
              <div style="background-color: #020617; border: 1px dashed #10b981; border-radius: 8px; padding: 32px; text-align: center; margin: 32px 0;">
                <p style="color: #94a3b8; margin: 0 0 12px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">Unique Authorization Key</p>
                <p style="color: ${ACCENT_COLOR}; font-size: 32px; font-weight: 900; letter-spacing: 6px; margin: 0; font-family: 'Courier New', Courier, monospace;">${licenseKey}</p>
              </div>

              <h3 style="color: #ffffff; font-size: 16px; margin-bottom: 12px;">${instructionHeader}</h3>
              ${instructions}

              <div style="background-color: #1e293b; border-radius: 8px; padding: 16px; margin-top: 32px;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; font-style: italic;">Note: This credential is for single-point authentication and is bound to the first account that redeems it. Please maintain strict confidentiality.</p>
              </div>
            </div>
            <div style="${FOOTER_STYLE}">
              <p style="margin: 0;">&copy; 2026 BEEPREPARE. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log('[RESEND] Email sent successfully:', response.id);
  } catch (err) {
    console.error('[RESEND] Failed to send email:', err.message);
    if (err.response) {
      console.error('[RESEND_ERROR_DATA]', err.response.data);
    }
  }
};

// Email 3: Payment rejected
const sendPaymentRejected = async (email, reason) => {
  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Notification of Unsuccessful Payment Verification`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="${EMAIL_STYLE}">
        <div style="${CARD_STYLE}">
          <div style="${HEADER_STYLE}">
            <h1 style="color: ${ACCENT_COLOR}; margin: 0; font-size: 24px; letter-spacing: 2px; font-weight: 800; text-transform: uppercase;">BEEPREPARE</h1>
          </div>
          <div style="${BODY_STYLE}">
            <h2 style="color: #ef4444; font-size: 20px; margin-top: 0;">Verification Unsuccessful</h2>
            <p>Our administrative team was unable to reconcile your submitted payment details with our financial records.</p>
            
            ${reason ? `
            <div style="background-color: #1e293b; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Reason for Rejection</p>
              <p style="margin: 4px 0 0; color: #ffffff; font-weight: 500;">${reason}</p>
            </div>
            ` : ''}

            <h3 style="color: #ffffff; font-size: 16px; margin-bottom: 12px;">Required Remedial Actions</h3>
            <ul style="padding-left: 20px; color: #cbd5e1; font-size: 14px;">
              <li style="margin-bottom: 8px;">Verify that the Unique Transaction Reference (UTR) number was entered without typographical errors.</li>
              <li style="margin-bottom: 8px;">Confirm that the transferred amount precisely matches the required platform fee.</li>
              <li style="margin-bottom: 8px;">Ensure that the uploaded transaction screenshot clearly displays the date, time, and recipient details.</li>
            </ul>

            <p style="margin-top: 32px; font-size: 14px;">To resolve this discrepancy, please contact our support department at support@beeprepare.in or via our administrative WhatsApp channel.</p>
          </div>
          <div style="${FOOTER_STYLE}">
            <p style="margin: 0;">&copy; 2026 BEEPREPARE. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
};

module.exports = {
  sendPaymentSubmitted,
  sendPaymentApproved,
  sendPaymentRejected
};
