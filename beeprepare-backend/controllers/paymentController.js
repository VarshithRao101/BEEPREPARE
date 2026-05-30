const crypto = require('crypto');
const PaymentRequest = require('../models/PaymentRequest');
const ActivityLog = require('../models/ActivityLog');
const AppSettings = require('../models/AppSettings');
const { connectDB } = require('../config/db');
const {
  sendPaymentSubmitted,
  sendPaymentApproved
} = require('../utils/emailService');
const { success, error } =
  require('../utils/responseHelper');

const PAYMENT_LOOKUP_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const buildLookupTokenSignature = (payment, expiresAt) => {
  const secret = process.env.LOOKUP_HMAC_SECRET;
  if (!secret) {
    return null;
  }

  return crypto.createHmac('sha256', secret)
    .update([
      payment.utrNumber,
      normalizeEmail(payment.authEmail),
      normalizeEmail(payment.email),
      String(expiresAt)
    ].join(':'))
    .digest('hex');
};

const issueLookupToken = (payment) => {
  const expiresAt = Date.now() + PAYMENT_LOOKUP_TOKEN_TTL_MS;
  const signature = buildLookupTokenSignature(payment, expiresAt);

  if (!signature) {
    return null;
  }

  return `${expiresAt}:${signature}`;
};

const getLookupTokenFromRequest = (req) => {
  return req.query.lookup
    || req.query.lookupToken
    || req.body?.lookupToken
    || req.get('X-Payment-Lookup-Token')
    || '';
};

const hasPaymentAccessProof = (req) => {
  return Boolean(req.user || getLookupTokenFromRequest(req));
};

const hasValidLookupToken = (payment, lookupToken) => {
  const parts = String(lookupToken || '').split(':');
  if (parts.length !== 2) {
    return false;
  }

  const [expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = buildLookupTokenSignature(payment, expiresAt);
  if (!expectedSignature) {
    return false;
  }

  return safeCompare(signature, expectedSignature);
};

const isAuthorizedPaymentRequester = (payment, req) => {
  const requesterEmail = normalizeEmail(req.user?.email);
  if (requesterEmail &&
      (requesterEmail === normalizeEmail(payment.authEmail)
        || requesterEmail === normalizeEmail(payment.email))) {
    return true;
  }

  return hasValidLookupToken(payment, getLookupTokenFromRequest(req));
};

// POST /api/payment/submit
const submitPayment = async (req, res) => {
  try {
    await connectDB();
    let { authEmail, email, phone, utrNumber, paymentType } = req.body;

    if (!authEmail) authEmail = email;

    if (!email || !utrNumber || !paymentType) {
      req.markUTRFailed?.();
      return error(res, 'All fields are required', 'MISSING_FIELDS', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || !emailRegex.test(authEmail)) {
      req.markUTRFailed?.();
      return error(res, 'Invalid email format', 'INVALID_EMAIL', 400);
    }

    const existing = await PaymentRequest.findOne({ utrNumber }).select('_id').lean();
    if (existing) {
      req.markUTRFailed?.();
      return error(res, 'This UTR has already been submitted', 'UTR_EXISTS', 409);
    }

    const settingKey = paymentType === 'activation' ? 'activation_price' : 'extra_slot_price';
    const setting = await AppSettings.findOne({ key: settingKey }).lean();
    const amount = setting ? setting.value : (paymentType === 'activation' ? 250 : 100);

    const paymentRequest = await PaymentRequest.create({
      authEmail,
      email,
      phone,
      utrNumber,
      paymentType,
      amount,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const lookupToken = issueLookupToken(paymentRequest);

    sendPaymentSubmitted(email, paymentType, amount).catch(emailErr => {
      console.error('[Email Error] Payment Submitted:', emailErr);
    });

    await ActivityLog.create({
      userId: authEmail,
      type: 'payment_submitted',
      title: 'Payment Submitted',
      description: `UTR: ${utrNumber} submitted for ${paymentType}.`,
      ip: req.ip,
      color: '#3498db'
    });

    req.markUTRProcessed?.();

    return success(res, 'Payment request submitted successfully', {
      requestId: paymentRequest._id,
      status: paymentRequest.status,
      lookupToken
    });

  } catch (err) {
    req.markUTRFailed?.();
    console.error('Submit Payment Error:', err);
    return error(res, 'Failed to submit payment request', 'SUBMIT_ERROR', 500);
  }
};

// GET /api/payment/status/:utrNumber
const checkPaymentStatus = async (req, res) => {
  try {
    await connectDB();

    if (!hasPaymentAccessProof(req)) {
      return error(
        res,
        'Use the original signed-in account or your secure payment status link.',
        'PAYMENT_ACCESS_REQUIRED',
        403
      );
    }

    const { utrNumber } = req.params;
    const payment = await PaymentRequest.findOne({ utrNumber })
      .select('status paymentType createdAt rejectionReason authEmail email utrNumber')
      .lean();

    if (!payment) {
      return error(res, 'Payment request not found', 'NOT_FOUND', 404);
    }

    if (!isAuthorizedPaymentRequester(payment, req)) {
      return error(
        res,
        'This payment status request is not authorized for the current account or link.',
        'PAYMENT_ACCESS_DENIED',
        403
      );
    }

    return success(res, 'Payment status fetched', {
      status: payment.status,
      paymentType: payment.paymentType,
      createdAt: payment.createdAt,
      rejectionReason: payment.rejectionReason
    });

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
    await connectDB();

    if (!hasPaymentAccessProof(req)) {
      return error(
        res,
        'Use the original signed-in account or your secure payment status link.',
        'PAYMENT_ACCESS_REQUIRED',
        403
      );
    }

    const { utrNumber } = req.params;
    const payment = await PaymentRequest.findOne({
      utrNumber,
      status: 'approved'
    }).select('authEmail email assignedKey paymentType utrNumber').lean();

    if (!payment) {
      return error(res,
        'No approved payment found',
        'NOT_FOUND', 404);
    }

    if (!isAuthorizedPaymentRequester(payment, req)) {
      return error(
        res,
        'This payment resend request is not authorized for the current account or link.',
        'PAYMENT_ACCESS_DENIED',
        403
      );
    }

    sendPaymentApproved(
      payment.email,
      payment.assignedKey,
      payment.paymentType
    ).catch(err => {
      console.error('[Email Error] Resend Failed:', err);
    });

    return success(res,
      'Email resent successfully', null);
  } catch (err) {
    return error(res, 'Failed to resend',
      'SERVER_ERROR', 500);
  }
};

module.exports = { submitPayment, checkPaymentStatus, getPaymentConfig, resendApprovalEmail };
