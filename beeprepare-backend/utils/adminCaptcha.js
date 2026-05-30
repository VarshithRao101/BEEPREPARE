'use strict';

const crypto = require('crypto');

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const MAX_CAPTCHA_STORE_SIZE = 200;
const captchaStore = new Map();

const purgeExpiredChallenges = () => {
  const now = Date.now();
  for (const [captchaId, challenge] of captchaStore.entries()) {
    if (!challenge || challenge.expiresAt <= now) {
      captchaStore.delete(captchaId);
    }
  }
};

const cleanupTimer = setInterval(purgeExpiredChallenges, 60 * 1000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const buildSignature = (captchaId, expiresAt) => {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET is missing');
  }

  return crypto.createHmac('sha256', secret)
    .update(`${captchaId}:${expiresAt}`)
    .digest('hex');
};

const enforceStoreLimit = () => {
  if (captchaStore.size < MAX_CAPTCHA_STORE_SIZE) {
    return;
  }

  const oldestKey = captchaStore.keys().next().value;
  if (oldestKey) {
    captchaStore.delete(oldestKey);
  }
};

const issueCaptchaChallenge = () => {
  purgeExpiredChallenges();
  enforceStoreLimit();

  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  const answer = String(num1 + num2);
  const captchaId = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;
  const signature = buildSignature(captchaId, expiresAt);

  captchaStore.set(captchaId, {
    answer,
    expiresAt
  });

  return {
    question: `What is ${num1} + ${num2}?`,
    token: `${captchaId}:${expiresAt}:${signature}`
  };
};

const verifyCaptchaChallenge = (captchaToken, answer) => {
  purgeExpiredChallenges();

  const parts = String(captchaToken || '').split(':');
  if (parts.length !== 3) {
    return false;
  }

  const [captchaId, expiresAtRaw, signature] = parts;
  const expiresAt = Number(expiresAtRaw);

  if (!captchaId || !Number.isFinite(expiresAt)) {
    return false;
  }

  let expectedSignature;
  try {
    expectedSignature = buildSignature(captchaId, expiresAt);
  } catch (err) {
    return false;
  }

  if (!safeCompare(signature, expectedSignature)) {
    captchaStore.delete(captchaId);
    return false;
  }

  const challenge = captchaStore.get(captchaId);
  if (!challenge || challenge.expiresAt < Date.now() || expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    return false;
  }

  captchaStore.delete(captchaId);
  return safeCompare(String(answer || '').trim(), challenge.answer);
};

module.exports = {
  issueCaptchaChallenge,
  verifyCaptchaChallenge
};
