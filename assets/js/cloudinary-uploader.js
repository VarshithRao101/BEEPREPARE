import { 
    getStorage, 
    ref, 
    uploadBytesResumable, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const storage = getStorage();
const db = getFirestore();

/**
 * Perform Note Upload using Firebase Storage (The Sealed Method)
 * Eliminates "Blocked for delivery" issues.
 */
export async function performNoteUpload(file, metadata, onProgress) {
    try {
        console.log("[STORAGE] Initiating Firebase Vault Upload...");

        // 1. Create a unique path in the bucket
        const fileName = `${metadata.noteType}_${Date.now()}_${file.name}`;
        const storagePath = `notes_vault/${metadata.userId}/${metadata.bankId}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        // 2. Start Uploader
        const uploadTask = uploadBytesResumable(storageRef, file);

        return new Promise((resolve, reject) => {
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    if (onProgress) onProgress(progress);
                }, 
                (error) => {
                    console.error("[STORAGE] Upload Failed:", error);
                    reject(error);
                }, 
                async () => {
                    // 3. Get the permanent URL
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // 4. Save metadata to Firestore
                    // Important: ensure teacherId key matches what getNotes expects
                    const noteEntry = {
                        teacherId: metadata.userId,
                        bankId: metadata.bankId,
                        chapterId: metadata.chapterId,
                        chapterName: metadata.chapterName,
                        noteType: metadata.noteType,
                        fileUrl: downloadURL,
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type.includes('pdf') ? 'pdf' : 'image',
                        createdAt: serverTimestamp()
                    };

                    const docRef = await addDoc(collection(db, "notes"), noteEntry);
                    
                    resolve({
                        success: true,
                        noteId: docRef.id,
                        url: downloadURL
                    });
                }
            );
        });
    } catch (err) {
        console.error("[STORAGE] Critical Fault:", err);
        throw err;
    }
}

export async function saveNoteMetadata(metadata) {
    // This is now handled inside performNoteUpload
    return { success: true };
}
