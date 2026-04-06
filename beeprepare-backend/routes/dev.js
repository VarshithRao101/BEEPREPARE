const express = require('express');
const router = express.Router();

// 🔐 Middleware: Isolation for Development Environment
router.use((req, res, next) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({
      success: false,
      message: "Not available in production mode"
    });
  }
  next();
});

router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: "BEEPREPARE Dev API is active",
    environment: process.env.NODE_ENV
  });
});

module.exports = router;
