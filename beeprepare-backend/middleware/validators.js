const { body, param, query, validationResult } = require('express-validator');
const { error } = require('../utils/responseHelper');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res,
      errors.array()[0].msg,
      'VALIDATION_ERROR', 400);
  }
  next();
};

const validateGoogleLogin = [
  body('idToken')
    .notEmpty()
    .withMessage('Token required')
    .isString()
    .withMessage('Invalid token'),
  handleValidation
];

const validateLicenseKey = [
  body('licenseKey')
    .notEmpty()
    .withMessage('License key required')
    .matches(/^(BEE|RDM)-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    .withMessage('Invalid key format. Expected: BEE-XXXX-XXXX-XXXX'),
  handleValidation
];

const validateSetRole = [
  body('role')
    .notEmpty()
    .withMessage('Role required')
    .isIn(['teacher', 'student'])
    .withMessage('Invalid role'),
  handleValidation
];

const validatePaymentSubmit = [
  body('email')
    .isEmail()
    .withMessage('Valid email required')
    .normalizeEmail(),
  body('utrNumber')
    .notEmpty()
    .withMessage('UTR number required')
    .isLength({ min: 12, max: 12 })
    .withMessage('UTR must be 12 digits')
    .isNumeric()
    .withMessage('UTR must be numeric'),
  body('paymentType')
    .isIn(['activation', 'extra_slot'])
    .withMessage('Invalid payment type'),
  handleValidation
];

const validateQuestion = [
  body('questionText')
    .notEmpty()
    .withMessage('Question text required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Question 5-1000 chars'),
  body('questionType')
    .isIn(['MCQ', 'Short Answer', 'Very Short Answer', 'Long Answer', 'Essay'])
    .withMessage('Invalid question type'),
  body('marks')
    .isInt({ min: 1, max: 10 })
    .withMessage('Marks must be 1-10'),
  handleValidation
];

const validateDoubt = [
  body('questionText')
    .notEmpty()
    .withMessage('Doubt question required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Question 10-500 chars'),
  handleValidation
];

const validateMessage = [
  body('content')
    .notEmpty()
    .withMessage('Message required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Message max 500 chars'),
  handleValidation
];

module.exports = {
  validateGoogleLogin,
  validateLicenseKey,
  validateSetRole,
  validatePaymentSubmit,
  validateQuestion,
  validateDoubt,
  validateMessage,
  handleValidation
};
