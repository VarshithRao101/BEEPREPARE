# BeePrepare PDF Management System Implementation Plan

This plan details the architecture and setup for the production-ready PDF management system using Cloudinary and Firebase Firestore.

## 📂 Folder Structure
The system is designed to be modular and easily integrated into the existing BeePrepare architectural ecosystem.

```text
/assets
  /js
    - bee-core.js            # Global Firebase initialization & shared utilities
    - cloudinary-uploader.js  # Dedicated Cloudinary & Firestore logic layer
    - CloudinaryUploaderComponent.js # Reusable UI Component (JS-based)
/docs
  - CLOUDINARY_IMPLEMENTATION_GUIDE.md # Setup & Configuration manual
/test-cloudinary.html         # Diagnostic interface for the sync engine
```

## 🛠 Core Components
### 1. Cloudinary logic (`cloudinary-uploader.js`)
Handles the direct-to-cloud transmission of binary PDF data using `XMLHttpRequest` for real-time progress events. It automatically generates unique paths in the format `beprepare/{userId}/{timestamp}_{filename}`.

### 2. Firestore Sync (`savePaperMetadata`)
A dedicated service that vaults document metadata into the `papers` collection, ensuring every cloud asset is indexed for retrieval.

### 3. UI Engine (`createUploader`)
A state-driven component that manages the entire lifecycle of an upload:
- Drag-and-drop validation
- Progress visualization
- Success notification & link generation
- **Bonus**: Automatic list retrieval of recent archives

## 🚀 Setup Instructions
### Step 1: Cloudinary Configuration
1. Login to **Cloudinary Dashboard**.
2. Go to **Settings > Upload**.
3. Create an **Unsigned Preset** named `beeprepare_unsigned`.
4. Set the **Folder** option to leave it empty (the code handles path generation dynamically).

### Step 2: Code configuration
Update the `CLOUDINARY_CONFIG` object in `assets/js/cloudinary-uploader.js` with your specific credentials.

```javascript
const CLOUDINARY_CONFIG = {
    cloudName: 'dv8rttdqd',
    uploadPreset: 'YOUR_UNSIGNED_PRESET', // Update this
};
```

### Step 3: Deployment
Mount the component in any page using the following protocol:

```javascript
import { createUploader } from './assets/js/CloudinaryUploaderComponent.js';

createUploader('mount-point-id', {
    userId: 'current-user-uuid',
    subject: 'Subject Category',
    onComplete: (data) => console.log('Vault Synced:', data)
});
```

---

## 🔒 Security Posture
- **Secret Management**: `API_SECRET` is omitted from the implementation to prevent frontend exposure.
- **Validation**: Strict client-side validation for PDF format and 10MB payload limit.
- **Path Isolation**: Files are logically separated by `userId` folders in the cloud.
