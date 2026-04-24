const PaymentRequest = require('../models/PaymentRequest');
const ActivityLog = require('../models/ActivityLog');
const { AppSettings } =
  require('../models/AppSettings');
const {
  sendPaymentSubmitted,
  sendPaymentApproved
} = require('../utils/emailService');
const { success, error } =
  require('../utils/responseHelper');

// POST /api/payment/submit
// Public endpoint — no auth required
// Body: { email, utrNumber, paymentType }
// paymentType: activation | extra_slot
const submitPayment = async (req, res) => {
  try {
    let { authEmail, email, utrNumber, paymentType } = req.body;

    // Fallback if authEmail is not provided
    if (!authEmail) authEmail = email;

    // Validate email + utrNumber format
    if (!email || !utrNumber || !paymentType) {
      return error(res, 'All fields are required', 'MISSING_FIELDS', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || !emailRegex.test(authEmail)) {
      return error(res, 'Invalid email format', 'INVALID_EMAIL', 400);
    }

    // Check UTR not already used
    const existing = await PaymentRequest.findOne({ utrNumber });
    if (existing) {
      return error(res, 'This UTR has already been submitted', 'UTR_EXISTS', 409);
    }

    // Get amount from AppSettings
    const settingKey = paymentType === 'activation' ? 'activation_price' : 'extra_slot_price';
    const setting = await AppSettings.findOne({ key: settingKey });
    const amount = setting ? setting.value : (paymentType === 'activation' ? 250 : 100);

    // Create PaymentRequest
    const paymentRequest = await PaymentRequest.create({
      authEmail,
      email,
      utrNumber,
      paymentType,
      amount,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Send confirmation email (Async - Don't block response)
    sendPaymentSubmitted(email, paymentType, amount).catch(emailErr => {
      console.error('[Email Error] Payment Submitted:', emailErr);
    });

    await ActivityLog.create({
      userId: authEmail, // Use authEmail as identifier since user might not be formally in user DB yet or using diff email
      type: 'payment_submitted',
      title: 'Payment Submitted',
      description: `UTR: ${utrNumber} submitted for ${paymentType}.`,
      ip: req.ip,
      color: '#3498db'
    });

    return success(res, 'Payment request submitted successfully', { 
      requestId: paymentRequest._id,
      status: paymentRequest.status
    });

  } catch (err) {
    console.error('Submit Payment Error:', err);
    return error(res, 'Failed to submit payment request', 'SUBMIT_ERROR', 500);
  }
};

// GET /api/payment/status/:utrNumber
const checkPaymentStatus = async (req, res) => {
  try {
    const { utrNumber } = req.params;
    const payment = await PaymentRequest.findOne({ utrNumber })
      .select('status paymentType createdAt rejectionReason')
      .lean();

    if (!payment) {
      return error(res, 'Payment request not found', 'NOT_FOUND', 404);
    }

    return success(res, 'Payment status fetched', payment);

  } catch (err) {
    return error(res, 'Failed to check status', 'STATUS_CHECK_ERROR', 500);
  }
};

const getPaymentConfig = async (req, res) => {
  return success(res, 'Payment config', {
    upiId: process.env.UPI_ID,
    upiName: process.env.UPI_NAME,
    upiBank: process.env.UPI_BANK,
    activationPrice: parseInt(
      process.env.ACTIVATION_PRICE) || 250,
    extraSlotPrice: parseInt(
      process.env.EXTRA_SLOT_PRICE) || 100
  });
};

const resendApprovalEmail = async (req, res) => {
  try {
    const { utrNumber } = req.params;
    const payment = await PaymentRequest.findOne({
      utrNumber,
      status: 'approved'
    });

    if (!payment) {
      return error(res,
        'No approved payment found',
        'NOT_FOUND', 404);
    }

    await sendPaymentApproved(
      payment.email,
      payment.assignedKey,
      payment.paymentType
    );

    return success(res,
      'Email resent successfully', null);
  } catch (err) {
    return error(res, 'Failed to resend',
      'SERVER_ERROR', 500);
  }
};

module.exports = { submitPayment, checkPaymentStatus, getPaymentConfig, resendApprovalEmail };
