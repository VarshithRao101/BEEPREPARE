const { Resend } = require('resend');
const resend = new Resend(
  process.env.RESEND_API_KEY
);

const EMAIL_FROM = process.env.EMAIL_FROM
  || 'BEEPREPARE <onboarding@resend.dev>';

// Email 1: Payment submission confirmation
const sendPaymentSubmitted = async (
  email, paymentType, amount
) => {
  const typeText = paymentType === 'activation'
    ? 'Account Activation'
    : 'Extra Subject Slot';

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Payment Received — ${typeText} | BEEPREPARE`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;
        background: #0a0a1a; color: #ffffff;
        padding: 40px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto;
          background: #111128; border-radius: 16px;
          padding: 40px; border: 1px solid #FFD700;">
          <div style="text-align: center;
            margin-bottom: 30px;">
            <h1 style="color: #FFD700; font-size: 28px;
              margin: 0;">🐝 BEEPREPARE</h1>
            <p style="color: #888; margin: 8px 0 0;">
              Academic Excellence Platform</p>
          </div>
          <h2 style="color: #ffffff;">
            Payment Received ✅</h2>
          <p style="color: #ccc; line-height: 1.6;">
            Thank you for your payment of
            <strong style="color: #FFD700;">
              ₹${amount}</strong>
            for <strong>${typeText}</strong>.</p>
          <div style="background: #1a1a3a;
            border-radius: 12px; padding: 20px;
            margin: 24px 0; border-left: 4px solid
            #FFD700;">
            <p style="margin: 0; color: #FFD700;
              font-weight: bold;">
              ⏱ Verification in Progress</p>
            <p style="margin: 8px 0 0; color: #ccc;">
              Our team is verifying your transaction.
              You will receive your access key within
              <strong>5–30 minutes</strong>.</p>
          </div>
          <p style="color: #888; font-size: 14px;">
            If you face any issues, contact us at
            support@beeprepare.com</p>
          <hr style="border: 1px solid #222;
            margin: 30px 0;">
          <p style="color: #555; font-size: 12px;
            text-align: center;">
            © 2026 BEEPREPARE. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `
  });
};

// Email 2: Payment approved — send key
const sendPaymentApproved = async (
  email, licenseKey, paymentType
) => {
  const typeText = paymentType === 'activation'
    ? 'Account Activation'
    : 'Extra Subject Slot';

  const instructions = paymentType === 'activation'
    ? `<ol style="color: #ccc; line-height: 2;">
        <li>Open BEEPREPARE and sign in with Google</li>
        <li>On the activation screen, enter your key</li>
        <li>Select your role (Teacher or Student)</li>
        <li>Start learning! 🚀</li>
       </ol>`
    : `<ol style="color: #ccc; line-height: 2;">
        <li>Open BEEPREPARE and go to your Profile</li>
        <li>Find the Redeem Code section</li>
        <li>Enter your key to unlock extra slots</li>
       </ol>`;

  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Your Access Key is Here! 🎉 | BEEPREPARE`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;
        background: #0a0a1a; color: #ffffff;
        padding: 40px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto;
          background: #111128; border-radius: 16px;
          padding: 40px; border: 1px solid #FFD700;">
          <div style="text-align: center;
            margin-bottom: 30px;">
            <h1 style="color: #FFD700; font-size: 28px;
              margin: 0;">🐝 BEEPREPARE</h1>
          </div>
          <h2 style="color: #4CAF50;">
            Payment Approved! 🎉</h2>
          <p style="color: #ccc;">
            Your ${typeText} key is ready.</p>
          <div style="background: #0a2a0a;
            border: 2px solid #4CAF50;
            border-radius: 12px; padding: 24px;
            text-align: center; margin: 24px 0;">
            <p style="color: #888; margin: 0 0 8px;
              font-size: 14px;">YOUR ACTIVATION KEY</p>
            <p style="color: #FFD700;
              font-size: 28px; font-weight: bold;
              letter-spacing: 4px; margin: 0;
              font-family: monospace;">
              ${licenseKey}</p>
          </div>
          <h3 style="color: #FFD700;">
            How to use your key:</h3>
          ${instructions}
          <div style="background: #1a1a3a;
            border-radius: 12px; padding: 16px;
            margin-top: 24px;">
            <p style="margin: 0; color: #888;
              font-size: 13px;">
              ⚠️ This key is one-time use only.
              Do not share it with anyone.</p>
          </div>
          <hr style="border: 1px solid #222;
            margin: 30px 0;">
          <p style="color: #555; font-size: 12px;
            text-align: center;">
            © 2026 BEEPREPARE. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `
  });
};

// Email 3: Payment rejected
const sendPaymentRejected = async (
  email, reason
) => {
  await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `Payment Verification Failed | BEEPREPARE`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif;
        background: #0a0a1a; color: #ffffff;
        padding: 40px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto;
          background: #111128; border-radius: 16px;
          padding: 40px; border: 1px solid #ff4444;">
          <div style="text-align: center;
            margin-bottom: 30px;">
            <h1 style="color: #FFD700; font-size: 28px;
              margin: 0;">🐝 BEEPREPARE</h1>
          </div>
          <h2 style="color: #ff4444;">
            Verification Failed ❌</h2>
          <p style="color: #ccc; line-height: 1.6;">
            We could not verify your payment.
            ${reason ? `<br><br>Reason:
            <strong>${reason}</strong>` : ''}</p>
          <div style="background: #2a0a0a;
            border-radius: 12px; padding: 20px;
            margin: 24px 0; border-left: 4px solid
            #ff4444;">
            <p style="margin: 0; color: #ff4444;
              font-weight: bold;">What to do next:</p>
            <ul style="color: #ccc; line-height: 2;
              margin: 8px 0 0;">
              <li>Double-check your UTR number</li>
              <li>Ensure payment amount was ₹250</li>
              <li>Contact support with your
                transaction screenshot</li>
            </ul>
          </div>
          <p style="color: #888; font-size: 14px;">
            Support: support@beeprepare.com<br>
            WhatsApp: +91 90590 68384</p>
          <hr style="border: 1px solid #222;
            margin: 30px 0;">
          <p style="color: #555; font-size: 12px;
            text-align: center;">
            © 2026 BEEPREPARE. All rights reserved.
          </p>
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
