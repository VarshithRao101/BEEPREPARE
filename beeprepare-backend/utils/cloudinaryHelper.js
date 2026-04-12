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
    sign_url: true,
    secure: true
  };
  
  // For 'image' resources, we must specify the format (extension) in the URL
  // to ensure Cloudinary validates the signed URL correctly.
  if (resourceType === 'image') {
    options.format = format || 'pdf'; // Default to pdf if not specified for backward compatibility
  }
  
  if (asAttachment) {
    options.flags = 'attachment';
  }

  return cloudinary.url(public_id, options);
};

module.exports = {
  cloudinary,
  generatePdfUrl
};
