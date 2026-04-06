# BEEPREPARE Cloudinary + Firestore Sync Engine 🚀

This document outlines the production-ready implementation for PDF uploads using Cloudinary (storage) and Firebase Firestore (metadata).

## 🛠 Flow Architecture
1.  **Frontend Entry**: User drags/selects a PDF (Max 10MB).
2.  **Cloudinary Sync**: File is uploaded directly to Cloudinary using an **Unsigned Preset** via `XMLHttpRequest` (for progress tracking).
3.  **Metadata Capture**: Cloudinary returns a `secure_url` and `public_id`.
4.  **Firestore Sync**: The metadata (URL, public ID, timestamp, subject, user ID) is saved to the `papers` collection.
5.  **Confirmation**: UI updates with a success message and a link preview.

---

## 🔐 Configuration (Assets/js/cloudinary-uploader.js)

### 1. Cloudinary Dashboard Setup
To make this work, you **MUST** create an **Unsigned Upload Preset** in your Cloudinary console.
1.  Navigate to **Settings** > **Upload**.
2.  Scroll down to **Upload Presets**.
3.  Click **Add upload preset**.
4.  Set **Signing Mode** to `Unsigned`.
5.  Save the preset name (e.g., `beeprepare_unsigned`).

### 2. Update Code
Modify `assets/js/cloudinary-uploader.js`:
```javascript
const CLOUDINARY_CONFIG = {
    cloudName: 'dv8rttdqd',
    uploadPreset: 'YOUR_UNSIGNED_PRESET_NAME', // <-- PUT YOUR PRESET NAME HERE
    apiKey: '598458843395379'
};
```

---

## 📦 Files Created

-   [cloudinary-uploader.js](file:///d:/TRNT%20BEE/TRNT%20BEE/BEEPREPARE/BEEPREPARE-main/assets/js/cloudinary-uploader.js): Core logic for uploads and Firestore saving.
-   [CloudinaryUploaderComponent.js](file:///d:/TRNT%20BEE/TRNT%20BEE/BEEPREPARE/BEEPREPARE-main/assets/js/CloudinaryUploaderComponent.js): Reusable UI component with drag & drop support.
-   [test-cloudinary.html](file:///d:/TRNT%20BEE/TRNT%20BEE/BEEPREPARE/BEEPREPARE-main/test-cloudinary.html): Diagnostic/Test page to verify the integration.

---

## 🎯 Implementation Usage (React-like but Modular JS)

To use the uploader in any page:

```javascript
import { createUploader } from './assets/js/CloudinaryUploaderComponent.js';

createUploader('mount-point-id', {
    title: 'Final Term Paper',
    subject: 'Physics',
    userId: 'USER_ID_HERE',
    onComplete: (data) => console.log('Successfully Vaulted:', data)
});
```

### Firestore Schema (Collection: `papers`)
```json
{
    "title": "string",
    "subject": "string",
    "pdfUrl": "string",
    "publicId": "string",
    "createdAt": "timestamp",
    "uploadedBy": "userId"
}
```

---

## 🔒 Security Note (Signed Uploads)
Your `API_SECRET` (`ycg...U`) was provided but **not used** for the frontend integration. This is for security reasons; the secret should **NEVER** be exposed in client-side code.

If you want to use **Signed Uploads** for higher security:
1.  The frontend must request a signature from your backend.
2.  The backend (using the `API_SECRET`) generates a signature based on the upload parameters.
3.  The frontend sends this signature with the file to Cloudinary.

**Current implementation (Unsigned)** is perfect for getting started and is easy to maintain.

---

## ✅ Checklist for Success
- [ ] Create Unsigned Preset in Cloudinary Console.
- [ ] Update `uploadPreset` in `cloudinary-uploader.js`.
- [ ] Open [test-cloudinary.html](file:///d:/TRNT%20BEE/TRNT%20BEE/BEEPREPARE/BEEPREPARE-main/test-cloudinary.html) to test.
