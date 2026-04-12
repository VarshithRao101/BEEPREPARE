
import { performFullUpload, fetchPapersList } from './cloudinary-uploader.js';

export function createUploader(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    // Define initial state
    const state = {
        isUploading: false,
        progress: 0,
        error: null,
        success: false,
        file: null,
        pdfUrl: null,
        recentUploads: []
    };

    // Component Styles
    const styles = `
        .bee-uploader-root {
            display: flex;
            flex-direction: column;
            gap: 30px;
        }
        .bee-uploader {
            background: rgba(15, 15, 15, 0.7);
            border: 2px dashed var(--border, #333);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            backdrop-filter: blur(20px);
        }
        .bee-uploader:hover {
            border-color: var(--primary, #ffd700);
            background: rgba(255, 215, 0, 0.05);
        }
        .bee-uploader.dragging {
            border-color: var(--primary, #ffd700);
            transform: scale(1.01);
            background: rgba(255, 215, 0, 0.1);
        }
        .progress-container {
            width: 100%;
            height: 4px;
            background: rgba(255,255,255,0.05);
            border-radius: 2px;
            margin: 25px 0;
            overflow: hidden;
        }
        .progress-bar {
            height: 100%;
            background: var(--primary, #ffd700);
            width: 0%;
            transition: width 0.2s ease;
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
        }
        .upload-btn {
            background: var(--primary, #ffd700);
            color: #000;
            border: none;
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 900;
            cursor: pointer;
            transition: 0.3s;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-size: 13px;
        }
        .recent-uploads-section {
            background: rgba(255, 255, 255, 0.02);
            border-radius: 20px;
            border: 1px solid var(--border, #333);
            padding: 25px;
        }
        .upload-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(255,255,255,0.03);
            border-radius: 12px;
            margin-bottom: 10px;
            transition: 0.2s;
            border: 1px solid transparent;
        }
        .upload-item:hover {
            border-color: var(--primary, #ffd700);
            background: rgba(255, 215, 0, 0.02);
        }
        .item-info h4 { margin: 0; font-size: 14px; color: #fff; }
        .item-info p { margin: 5px 0 0 0; font-size: 11px; color: #666; font-weight: 800; text-transform: uppercase; }
        .view-link {
            color: var(--primary, #ffd700);
            text-decoration: none;
            font-size: 11px;
            font-weight: 900;
            border: 1px solid rgba(255,215,0,0.3);
            padding: 6px 12px;
            border-radius: 8px;
            transition: 0.3s;
        }
        .view-link:hover {
            background: var(--primary, #ffd700);
            color: #000;
        }
        .skeleton {
            background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            height: 60px;
            border-radius: 12px;
            margin-bottom: 10px;
        }
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
    `;

    // Inject styles
    if (!document.getElementById('bee-uploader-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'bee-uploader-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    async function loadRecentUploads() {
        if (!options.userId) return;
        state.recentUploads = await fetchPapersList(options.userId);
        render();
    }

    // Render Function
    function render() {
        container.innerHTML = `
            <div class="bee-uploader-root">
                <div class="bee-uploader" id="uploader-box">
                    <div style="font-size: 40px; margin-bottom: 15px;">${state.isUploading ? '⚡' : '📂'}</div>
                    <h3 style="margin:0 0 10px 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">
                        ${state.isUploading ? 'UPLOADING TO VAULT...' : 'ARCHIVE NEW PDF'}
                    </h3>
                    <p style="margin: 0 0 25px 0; color: #666; font-size: 12px; font-weight: 600;">
                        Secure Cloud Storage Hub. Max 7MB per protocol.
                    </p>

                    <input type="file" id="file-input" accept="application/pdf" style="display:none;">
                    
                    ${!state.isUploading ? `
                        <button class="upload-btn" id="browse-btn">SELECT DOCUMENT</button>
                    ` : `
                        <div class="progress-container">
                            <div class="progress-bar" id="p-bar" style="width: ${state.progress}%"></div>
                        </div>
                        <div style="font-size:10px; color:var(--primary); font-weight:900;">${state.progress}% TRANSFERRED</div>
                    `}

                    ${state.error ? `<div style="color:#ff4d4d; font-size:12px; font-weight:800; margin-top:20px;">⚠️ ${state.error}</div>` : ''}
                    ${state.success ? `<div style="color:#00ff88; font-size:12px; font-weight:800; margin-top:20px;">✅ ARCHIVE SYNC COMPLETE</div>` : ''}
                </div>

                <div class="recent-uploads-section">
                    <h4 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 900; color: #fff; letter-spacing: 1px; text-transform: uppercase;">
                        Recent Archives
                    </h4>
                    <div id="uploads-list">
                        ${state.recentUploads.length === 0 ? `
                            <div class="skeleton"></div>
                            <div class="skeleton"></div>
                        ` : state.recentUploads.map(item => `
                            <div class="upload-item">
                                <div class="item-info">
                                    <h4>${item.title}</h4>
                                    <p>${item.subject} • ${new Date(item.createdAt?.toDate()).toLocaleDateString()}</p>
                                </div>
                                <a href="${item.pdfUrl}" target="_blank" class="view-link">VIEW ARCHIVE</a>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        setupListeners();
    }

    function setupListeners() {
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const uploaderBox = document.getElementById('uploader-box');

        if (browseBtn) browseBtn.onclick = () => fileInput.click();
        if (fileInput) {
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) handleSelection(e.target.files[0]);
            };
        }

        if (uploaderBox) {
            uploaderBox.ondragover = (e) => { e.preventDefault(); uploaderBox.classList.add('dragging'); };
            uploaderBox.ondragleave = () => uploaderBox.classList.remove('dragging');
            uploaderBox.ondrop = (e) => {
                e.preventDefault();
                uploaderBox.classList.remove('dragging');
                if (e.dataTransfer.files.length > 0) handleSelection(e.dataTransfer.files[0]);
            };
        }
    }

    async function handleSelection(file) {
        if (file.type !== 'application/pdf') {
            state.error = 'Invalid protocol. Only PDF files are accepted.';
            render();
            return;
        }

        if (file.size > 7 * 1024 * 1024) {
            state.error = 'Vault Overflow: PDF must be under 7MB.';
            render();
            return;
        }

        try {
            state.isUploading = true;
            state.error = null;
            state.success = false;
            render();

            const metadata = {
                title: options.title || file.name.replace('.pdf', ''),
                subject: options.subject || 'General Protocol',
                userId: options.userId || 'system_root'
            };

            await performFullUpload(file, metadata, (p) => {
                state.progress = p;
                const pBar = document.getElementById('p-bar');
                if (pBar) pBar.style.width = p + '%';
            });

            state.isUploading = false;
            state.success = true;
            await loadRecentUploads(); 
        } catch (err) {
            state.isUploading = false;
            state.error = err.message;
            render();
        }
    }

    loadRecentUploads(); // Initial load
    render();
}
