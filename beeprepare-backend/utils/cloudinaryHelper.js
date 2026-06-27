const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Generates a Cloudinary PDF URL with optional forced download
 * @param {string} publicId - The Cloudinary public_id (raw)
 * @param {boolean} asAttachment - Force browser download via fl_attachment
 */
const generatePdfUrl = (public_id, asAttachment = false, resourceType = 'raw', format = null) => {
  const options = {
    resource_type: resourceType,
    type: 'upload', // Explicitly specify the delivery type
    sign_url: true,
    secure: true
  };
  
  if (resourceType === 'image') {
    options.format = format || 'pdf'; 
  }
  
  if (asAttachment) {
    options.flags = 'attachment';
  }

  return cloudinary.url(public_id, options);
};

/**
 * Extracts Cloudinary public_id from a full delivery URL
 */
const extractPublicId = (url) => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/');
    
    // Find the index of the version segment (e.g. 'v123456789' or 'v1')
    const versionIndex = parts.findIndex(p => /^v\d+$/.test(p));
    if (versionIndex !== -1 && versionIndex < parts.length - 1) {
      return parts.slice(versionIndex + 1).join('/');
    }
    
    // Fallback: find the index of the delivery type segment (e.g. 'upload', 'private', 'authenticated')
    const typeIndex = parts.findIndex(p => ['upload', 'private', 'authenticated'].includes(p));
    if (typeIndex !== -1) {
      let remainingParts = parts.slice(typeIndex + 1);
      // Strip signature if present (starts with s--)
      if (remainingParts[0] && remainingParts[0].startsWith('s--')) {
        remainingParts = remainingParts.slice(1);
      }
      // Strip version if it starts with v and digits
      if (remainingParts[0] && /^v\d+$/.test(remainingParts[0])) {
        remainingParts = remainingParts.slice(1);
      }
      return remainingParts.join('/');
    }
    
    return null;
  } catch (e) {
    return null;
  }
};

/**
 * Deletes a resource from Cloudinary (or Firebase as legacy fallback)
 */
const deleteFromStorage = async (identifier, resourceType = 'raw') => {
  if (!identifier) return;
  try {
    let publicId = identifier;

    // 1. If it's a full Cloudinary URL
    if (identifier.includes('cloudinary.com')) {
      publicId = extractPublicId(identifier);
    }

    if (publicId && !publicId.startsWith('http')) {
      const lastDotIdx = publicId.lastIndexOf('.');
      const hasExt = lastDotIdx !== -1 && lastDotIdx > publicId.lastIndexOf('/');
      const publicIdWithExt = hasExt ? publicId : `${publicId}.pdf`;
      const publicIdNoExt = hasExt ? publicId.substring(0, lastDotIdx) : publicId;

      console.log(`[CLOUDINARY_DELETE] Purging resource: ${publicId} (NoExt: ${publicIdNoExt}, WithExt: ${publicIdWithExt})`);

      // Try raw deletion (requires extension)
      const resRaw = await cloudinary.uploader.destroy(publicIdWithExt, { resource_type: 'raw' });
      console.log(`[CLOUDINARY_DELETE] Raw delete result:`, resRaw);

      // Try image deletion (requires no extension)
      const resImg = await cloudinary.uploader.destroy(publicIdNoExt, { resource_type: 'image' });
      console.log(`[CLOUDINARY_DELETE] Image delete result:`, resImg);

      // Try video deletion (requires no extension)
      const resVid = await cloudinary.uploader.destroy(publicIdNoExt, { resource_type: 'video' });
      console.log(`[CLOUDINARY_DELETE] Video delete result:`, resVid);

      // Try raw deletion without extension (just in case)
      if (publicIdNoExt !== publicIdWithExt) {
        const resRawNoExt = await cloudinary.uploader.destroy(publicIdNoExt, { resource_type: 'raw' });
        console.log(`[CLOUDINARY_DELETE] Raw (NoExt) delete result:`, resRawNoExt);
      }
      return;
    }

    // 2. Legacy Firebase URL cleanup
    if (identifier.includes('firebasestorage')) {
      const url = new URL(identifier);
      const pathMatch = url.pathname.match(/\/o\/(.+)/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        const { bucket } = require('../config/firebase');
        if (bucket) {
          await bucket.file(filePath).delete();
          console.log(`[FIREBASE_DELETE] Legacy file deleted: ${filePath}`);
        }
      }
    }
  } catch (e) {
    console.warn(`Storage delete failed for ${identifier}: ${e.message}`);
  }
};

module.exports = {
  cloudinary,
  generatePdfUrl,
  extractPublicId,
  deleteFromStorage
};
