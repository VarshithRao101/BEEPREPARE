const Doubt = require('../models/Doubt');
const { cloudinary } = require('./cloudinaryHelper');
const logger = require('./logger');

const extractPublicId = (url) => {
    try {
        const urlObj = new URL(url);
        const parts = urlObj.pathname.split('/');
        const uploadIndex = parts.findIndex(p => p === 'upload');
        if (uploadIndex === -1) return null;
        let remainingParts = parts.slice(uploadIndex + 1);
        if (remainingParts[0] && /^v\d+$/.test(remainingParts[0])) {
            remainingParts = remainingParts.slice(1);
        }
        const publicIdWithExt = remainingParts.join('/');
        const lastDotIdx = publicIdWithExt.lastIndexOf('.');
        return lastDotIdx !== -1 ? publicIdWithExt.substring(0, lastDotIdx) : publicIdWithExt;
    } catch (e) {
        return null;
    }
};

const run70HourCleanup = async () => {
    try {
        logger.info('[CLEANUP] Starting 70-hour file retention cleanup...');
        const expiryTime = new Date(Date.now() - 70 * 60 * 60 * 1000);
        
        // Find any doubt that has an active (not null and not EXPIRED) imageUrl
        const doubts = await Doubt.find({
            "messages.imageUrl": { $nin: [null, 'EXPIRED', ''] }
        });

        let deletedCount = 0;

        for (const doubt of doubts) {
            let modified = false;
            for (const msg of doubt.messages) {
                if (msg.imageUrl && msg.imageUrl !== 'EXPIRED' && msg.timestamp <= expiryTime) {
                    if (msg.imageUrl.includes('cloudinary.com')) {
                         try {
                             const fullPublicId = extractPublicId(msg.imageUrl);
                             if (fullPublicId) {
                                 // Purge from Cloudinary using both image and raw resource types to guarantee deletion
                                 await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'image' });
                                 await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'raw' });
                             }
                         } catch (e) {
                             logger.error('[CLEANUP] Error deleting from cloudinary:', e);
                         }
                    }
                    msg.imageUrl = 'EXPIRED';
                    modified = true;
                    deletedCount++;
                }
            }
            if (modified) {
                await doubt.save();
            }
        }
        
        logger.info(`[CLEANUP] 70-hour cleanup finished. Files expired: ${deletedCount}`);
    } catch (err) {
        logger.error('[CLEANUP] Error during 70-hour cleanup:', err);
    }
};

module.exports = { run70HourCleanup, extractPublicId };
