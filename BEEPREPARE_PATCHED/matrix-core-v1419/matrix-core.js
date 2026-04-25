/**
 * MATRIX CORE V1419 — Shared Admin Logic
 * Handles Authentication, API Calls, and Centralized UI Components
 */

const API_BASE = 'http://localhost:5000/api/admin';
const AUTH_TOKEN = sessionStorage.getItem('admin_token');
const ADMIN_ID = sessionStorage.getItem('admin_id');

// Global Auth Guard
if (!AUTH_TOKEN && !window.location.pathname.endsWith('index.html')) {
    window.location.href = 'index.html';
}

/**
 * CSRF Token Cache — fetched once per session, reused until expiry
 */
let _csrfToken = null;
let _csrfExpiry = 0;

async function getCsrfToken() {
    const now = Date.now();
    if (_csrfToken && now < _csrfExpiry - 60000) return _csrfToken; // Reuse if >1min left
    try {
        const res = await fetch(API_BASE.replace('/admin', '') + '/admin-csrf-token', {
            headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN }
        });
        const data = await res.json();
        if (data.success) {
            _csrfToken = data.data.csrfToken;
            _csrfExpiry = data.data.expiresAt;
        }
    } catch (_) { /* Non-blocking — server still validates */ }
    return _csrfToken;
}

/**
 * Standardized Admin API Caller
 * Automatically attaches CSRF token on POST/PUT/PATCH/DELETE requests.
 */
export async function adminApi(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + AUTH_TOKEN
        }
    };
    if (body) options.body = JSON.stringify(body);

    // Auto-attach CSRF token on state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        const csrfToken = await getCsrfToken();
        if (csrfToken) options.headers['X-CSRF-Token'] = csrfToken;
    }

    // Ensure endpoint is a string and not an object accidentally passed in
    const safeEndpoint = String(endpoint).replace('[object Object]', 'INVALID_ID');
    
    try {
        const res = await fetch(API_BASE + safeEndpoint, options);
        if (res.status === 401) {
            sessionStorage.clear();
            window.location.href = 'index.html';
            return null;
        }
        return await res.json();
    } catch (err) {
        showToast('Server connection failed', 'error');
        return null;
    }
}

/**
 * Premium Toast Notifications
 */
export function showToast(msg, type = 'success') {
    const colors = {
        success: '#4CAF50',
        error: '#ff4444',
        warning: '#FFA500',
        info: '#FFD700'
    };
    const toast = document.createElement('div');
    toast.style.cssText = `
        position:fixed; top:20px; right:20px;
        background: rgba(18, 18, 18, 0.9);
        backdrop-filter: blur(10px);
        border: 1px solid ${colors[type]};
        color: ${colors[type]}; padding: 16px 24px;
        border-radius: 12px; font-weight: 800;
        z-index: 9999; font-family: 'Outfit', sans-serif;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        animation: toastSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        text-transform: uppercase; letter-spacing: 1px; font-size: 13px;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);

    // Fade out animation
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = '0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

/**
 * Secure Secret Code Verification Modal
 */
export async function showCodeModal(title, desc, isDangerous = false) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.85);
            backdrop-filter: blur(10px); display: flex; align-items: center;
            justify-content: center; z-index: 10000; font-family: 'Outfit', sans-serif;
        `;
        overlay.innerHTML = `
            <div class="glass" style="
                width: 90%; max-width: 450px; padding: 40px;
                border: 1px solid ${isDangerous ? '#ff4444' : '#FFD700'};
                animation: modalPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                background: #0a0a0a; border-radius: 24px;
            ">
                <h3 style="color: ${isDangerous ? '#ff4444' : '#FFD700'}; margin-bottom: 8px; font-weight: 900; font-size: 20px;">${title}</h3>
                <p style="color: #888; margin-bottom: 25px; font-size: 14px; font-weight: 500; line-height: 1.5;">${desc}</p>
                
                <input id="secretCodeInput" type="password" placeholder="ENTER SECRET CODE" 
                    style="width: 100%; padding: 15px; background: #1a1a1a; border: 1px solid #333; 
                    border-radius: 12px; color: #fff; font-size: 18px; letter-spacing: 6px; 
                    text-align: center; margin-bottom: 20px; outline: none;">
                
                <div style="display: flex; gap: 15px;">
                    <button id="modalCancel" style="flex: 1; padding: 14px; background: transparent; 
                        border: 1px solid #333; color: #888; border-radius: 12px; cursor: pointer; 
                        font-weight: 700; font-size: 13px;">CANCEL</button>
                    <button id="modalConfirm" style="flex: 1; padding: 14px; 
                        background: ${isDangerous ? '#ff4444' : '#FFD700'}; color: #000; 
                        border: none; border-radius: 12px; cursor: pointer; 
                        font-weight: 900; font-size: 13px;">CONFIRM</button>
                </div>
            </div>
            <style>
                @keyframes modalPop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes toastSlideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
            </style>
        `;
        document.body.appendChild(overlay);
        const input = overlay.querySelector('#secretCodeInput');
        const confirmBtn = overlay.querySelector('#modalConfirm');
        const cancelBtn = overlay.querySelector('#modalCancel');
        
        input.focus();

        cancelBtn.addEventListener('click', () => {
            overlay.remove();
            resolve(null);
        });

        confirmBtn.addEventListener('click', () => {
            const val = input.value;
            overlay.remove();
            resolve(val);
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        });
    });
}

/**
 * Handle Session Termination
 */
window.terminateSession = () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
};

// Initialize Admin ID Display
document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('adminIdDisplay');
    if (display) display.textContent = ADMIN_ID || 'BEE_ADMIN';
});
