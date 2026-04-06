
/**
 * BEEPREPARE Cloudinary + Firestore Upload System
 * Modular, production-ready implementation
 */

import { firebaseConfig } from './bee-core.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Configuration
const CLOUDINARY_CONFIG = {
    cloudName: 'dv8rttdqd',
    uploadPreset: 'beeprepare_unsigned', // <-- REPLACE THIS with your actual unsigned preset
    apiKey: '598458843395379'
};

const db = getFirestore();

/**
 * 1. CLOUDINARY UPLOAD LOGIC
 * Uses XMLHttpRequest for progress tracking
 */
export async function uploadToCloudinary(file, userId, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        
        // Requirements: folder = "beprepare/{userId}" and unique public_id
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const folderPath = `beprepare/${userId}`;
        const customPublicId = `${timestamp}_${safeFileName}`.slice(0, 200); // 200 limit

        formData.append('folder', folderPath);
        formData.append('public_id', customPublicId);
        formData.append('resource_type', 'auto'); 

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const percentCompleted = Math.round((event.loaded * 100) / event.total);
                onProgress(percentCompleted);
            }
        };

        xhr.onload = () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                resolve({
                    secure_url: response.secure_url,
                    public_id: response.public_id
                });
            } else {
                const error = JSON.parse(xhr.responseText);
                reject(new Error(error.error.message || 'Cloudinary upload failed'));
            }
        };

        xhr.onerror = () => reject(new Error('Network error during upload bridge sync.'));
        xhr.send(formData);
    });
}

/**
 * 2. FIRESTORE SERVICES
 * Sync and management functions
 */
import { 
    query, 
    where, 
    orderBy, 
    getDocs, 
    limit 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export async function savePaperMetadata(metadata) {
    try {
        const docRef = await addDoc(collection(db, 'papers'), {
            title: metadata.title,
            subject: metadata.subject,
            pdfUrl: metadata.pdfUrl,
            publicId: metadata.publicId,
            uploadedBy: metadata.userId,
            createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Firestore Error:', error);
        throw new Error('Failed to save document metadata to architectural vault.');
    }
}

export async function saveNoteMetadata(metadata) {
    try {
        const docRef = await addDoc(collection(db, 'notes'), {
            teacherId: metadata.userId,
            bankId: metadata.bankId,
            chapterId: metadata.chapterId,
            chapterName: metadata.chapterName,
            noteType: metadata.noteType,
            fileName: metadata.fileName,
            fileUrl: metadata.pdfUrl, // Cloudinary URL
            publicId: metadata.publicId,
            fileType: 'pdf',
            fileSize: metadata.fileSize,
            createdAt: serverTimestamp()
        });
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Firestore Error:', error);
        throw new Error('Failed to save note metadata to vault.');
    }
}

export async function fetchPapersList(userId, limitCount = 10) {
    try {
        const q = query(
            collection(db, 'papers'),
            where('uploadedBy', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Fetch error:', error);
        return [];
    }
}

/**
 * 3. COMPLETE UPLOAD FLOW (The Architect's Bridge)
 */
export async function performFullUpload(file, metadata, onProgress) {
    // 1. Structural Validation
    if (!file) throw new Error('Input node empty. No file detected.');
    if (file.type !== 'application/pdf') throw new Error('Incorrect protocol. Only PDF files are accepted.');
    if (file.size > 10 * 1024 * 1024) throw new Error('Node too heavy. Max limit 10MB.');

    // 2. Transmit to Cloudinary
    const cloudinaryData = await uploadToCloudinary(file, metadata.userId, onProgress);

    // 3. Vault in Firestore
    const firestoreResult = await savePaperMetadata({
        ...metadata,
        pdfUrl: cloudinaryData.secure_url,
        publicId: cloudinaryData.public_id
    });

    return {
        success: true,
        docId: firestoreResult.id,
        pdfUrl: cloudinaryData.secure_url
    };
}

/**
 * 4. NOTE UPLOAD FLOW
 */
export async function performNoteUpload(file, metadata, onProgress) {
    if (!file) throw new Error('No file detected.');
    
    // 1. Transmit to Cloudinary
    const cloudinaryData = await uploadToCloudinary(file, metadata.userId, onProgress);

    // 2. Vault in Firestore (notes collection)
    const firestoreResult = await saveNoteMetadata({
        ...metadata,
        pdfUrl: cloudinaryData.secure_url,
        publicId: cloudinaryData.public_id,
        fileSize: file.size,
        fileName: file.name
    });

    return {
        success: true,
        noteId: firestoreResult.id,
        fileUrl: cloudinaryData.secure_url
    };
}
