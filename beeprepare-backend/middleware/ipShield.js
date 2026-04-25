const Blacklist = require('../models/Blacklist');
const logger = require('../utils/logger');

/**
 * Automated IP Shield
 * Blocks requests from IPs found in the Blacklist database.
 */
const ipShield = async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
        const mongoose = require('mongoose');
        // If DB not connected, skip the check (don't block legitimate users)
        if (mongoose.connection.readyState !== 1) {
            return next();
        }

        const bannedEntry = await Blacklist.findOne({ ip });

        if (bannedEntry && (bannedEntry.isPermanentlyBanned || bannedEntry.strikes >= 3)) {
            logger.warn(`[AUTO-BLOCK] Blocked request from banned IP: ${ip}`, {
                path: req.originalUrl,
                strikes: bannedEntry.strikes
            });

            return res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Access Denied | Security Protocol</title>
                    <style>
                        body { background: #000; color: #ff4444; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                        .box { border: 1px solid #ff4444; padding: 40px; border-radius: 20px; background: rgba(255,0,0,0.05); }
                        h1 { font-size: 40px; margin: 0; }
                        p { color: #888; margin-top: 10px; }
                        .code { color: #ff4444; font-weight: bold; margin-top: 20px; border-top: 1px dashed #333; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="box">
                        <h1>ACCESS DENIED</h1>
                        <p>Your IP address has been flagged for multiple security violations.</p>
                        <div class="code">SECURITY_NODE_ID: ${ip.substring(0, 8)}...</div>
                    </div>
                </body>
                </html>
            `);
        }
    } catch (err) {
        // Fallback: if DB check fails, don't block legitimate users
        console.error('IP Shield Check Failed:', err);
    }

    next();
};

/**
 * Record a strike against an IP
 */
const recordStrike = async (ip, reason) => {
    try {
        const entry = await Blacklist.findOneAndUpdate(
            { ip },
            { 
                $inc: { strikes: 1 },
                $set: { lastAttempt: new Date(), reason: reason }
            },
            { upsert: true, new: true }
        );

        if (entry.strikes >= 3) {
            logger.error(`[SYSTEM BAN] IP ${ip} has been automatically banned after 3 strikes. Reason: ${reason}`);
        }
    } catch (err) {
        console.error('Failed to record strike:', err);
    }
};

module.exports = { ipShield, recordStrike };
