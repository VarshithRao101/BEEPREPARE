// ============================================
// BEE CORE — Shared utilities for BEEPREPARE
// ============================================

// Vercel Analytics & Speed Insights Injection
import { inject } from 'https://cdn.jsdelivr.net/npm/@vercel/analytics/+esm';
import { injectSpeedInsights } from 'https://cdn.jsdelivr.net/npm/@vercel/speed-insights/dist/index.mjs';

inject();
injectSpeedInsights();

// Firebase Config
export const firebaseConfig = {
  apiKey: "AIzaSyBUTRNqsbkzLVpYs7oCt1v335PVuomdQ_0",
  authDomain: "beeprepare-1d7b8.firebaseapp.com",
  projectId: "beeprepare-1d7b8",
  storageBucket: "beeprepare-1d7b8.firebasestorage.app",
  messagingSenderId: "221629340476",
  appId: "1:221629340476:web:b9fd677eb5ee0984721c39"
};

// Single source of truth for API URL
export const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.')) 
  ? `http://${window.location.hostname}:5000/api` 
  : '/api';

// Globally initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
const app = initializeApp(firebaseConfig);

// Get fresh Firebase token
let lastToken = null;
let lastFetchTime = 0;

export async function getFreshToken() {
  const now = Date.now();
  
  // 1. Check persistent cache first (instant return, zero network latency)
  const cachedToken = localStorage.getItem(BP.TOKEN);
  const cachedTime = localStorage.getItem('bp_token_time');
  
  if (cachedToken && cachedTime && (now - parseInt(cachedTime) < 45 * 60 * 1000)) {
    // If not logging out, we can safely use the hot cache
    if (!localStorage.getItem(BP.LOGGING_OUT)) {
      lastToken = cachedToken;
      lastFetchTime = parseInt(cachedTime);
      return cachedToken;
    }
  }

  // 2. Load Firebase Auth only if cache is missed or expired
  const { getAuth, onAuthStateChanged } = await import(
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'
  );
  const auth = getAuth();

  // Strategy: Wait for status if currently null on page load
  let user = auth.currentUser;
  if (!user) {
    await new Promise(resolve => {
      let unsubscribe;
      unsubscribe = onAuthStateChanged(auth, (u) => {
        user = u;
        if (unsubscribe) unsubscribe();
        resolve();
      });
      setTimeout(() => { if (unsubscribe) unsubscribe(); resolve(); }, 800); // 800ms max wait for auth state
    });
  }

  if (!user) {
    if (localStorage.getItem(BP.LOGGING_OUT)) return null;
    return cachedToken; // Fallback to whatever is in cache
  }

  try {
    const token = await user.getIdToken();
    lastToken = token;
    lastFetchTime = now;
    localStorage.setItem(BP.TOKEN, token);
    localStorage.setItem('bp_token_time', now.toString());
    return token;
  } catch (err) {
    console.error('Token fetch failed:', err);
    return cachedToken;
  }
}

// Smart path to index.html from any subfolder using import.meta.url
export function getIndexPath() {
  return new URL('../../index.html', import.meta.url).href;
}

const CACHE_PREFIX = 'bp_cache_';
const CACHE_TTL = {
  '/auth/verify-session': 2 * 60 * 1000, // 2 mins (fixes guardTeacher page-load waterfall)
  '/teacher/dashboard': 30 * 1000,       // 30 seconds
  '/student/dashboard': 30 * 1000,       // 30 seconds
  '/student/banks': 30 * 1000,           // 30 seconds
  '/student/profile': 60 * 1000,         // 1 minute
  '/circles': 30 * 1000,                 // 30 seconds
  '/announcements/active': 5 * 60 * 1000, // 5 minutes
  '/quotes': 10 * 60 * 1000,             // 10 minutes
  '/system/maintenance': 30 * 1000,      // 30 seconds
};

// Standard API caller
let firestoreCallCount = 0;
const CALL_HISTORY = [];
const CALL_LIMIT_MS = 10000; // 10s window
const MAX_CALLS_WINDOW = 50;   // Max 50 calls per window

export async function apiCall(
  endpoint,
  method = 'GET',
  body = null,
  needsAuth = true,
  isRetry = false, // Track retry attempts (Step 8 Seal)
  showOverlay = true // PREMIUM LOADER (Step 10)
) {
  if (method === 'GET') {
    const ttl = CACHE_TTL[endpoint] || 0;
    if (ttl > 0) {
      try {
        const cachedStr = sessionStorage.getItem(CACHE_PREFIX + endpoint);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (Date.now() - cached.at < ttl) {
            return cached.data; // Return instantly from cross-page cache
          }
        }
      } catch (e) {
        console.warn('Cache parse error', e);
      }
    }
  }

  if (showOverlay) BP.showLoader();
  // GLOBAL SAFETY (Step 1): Rate limiting in frontend
  const now = Date.now();

  // Filter history to keep only last 10s
  while (CALL_HISTORY.length > 0 && CALL_HISTORY[0] < now - CALL_LIMIT_MS) {
    CALL_HISTORY.shift();
  }

  if (CALL_HISTORY.length >= MAX_CALLS_WINDOW) {
    console.warn('%c[KILL SWITCH] Too many requests! Please wait 10s.', 'color: #FF5555; font-weight: 900;');
    if (window.Swal) {
      Swal.fire({
        icon: 'error',
        title: 'System Busy',
        text: 'Too many requests. Please wait a few seconds before trying again.',
        timer: 3000,
        showConfirmButton: false,
        background: '#1a1a2e',
        color: '#fff'
      });
    }
    return { success: false, message: 'Too many requests', error: { code: 'CLIENT_RATE_LIMIT' } };
  }

  CALL_HISTORY.push(now);

  try {
    // TRACKING (Step 7)
    if (endpoint.includes('verify') || endpoint.includes('redeem')) {
      firestoreCallCount++;
      console.log(`%c[FIRESTORE TRACKER] Verification Call #${firestoreCallCount}`, 'color: #FFD700; font-weight: bold;');
    }

    const headers = {
      'Content-Type': 'application/json'
    };
    if (needsAuth) {
      const token = await getFreshToken();
      if (!token) return { success: false, message: 'Auth token missing' };
      headers['Authorization'] = 'Bearer ' + token;
    }
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, options);

    // ERROR HANDLING (Step 8): Handle Firestore exhaustion specifically
    if (res.status === 429) {
      console.error('[CRITICAL] Firestore Quota Exhausted or Server Rate Limited');
      throw new Error('SERVER_BUSY');
    }

    // AUTH RETRY LOGIC (Step 8 SEAL): If 401 and haven't retried yet, force token refresh
    if (res.status === 401 && !isRetry) {
      console.log('[API_RECOVERY] Received 401. Refreshing architectural token and retrying...');
      lastToken = null;
      lastFetchTime = 0;
      localStorage.removeItem(BP.TOKEN); // Clean cached token

      // Wait a tiny bit for Firebase to sync if it's lagging
      await new Promise(r => setTimeout(r, 400));

      // Recursive retry
      return await apiCall(endpoint, method, body, needsAuth, true);
    }

    // FINAL AUTH FAIL (Step 8 SEAL): Even after retry, we got 401. User is likely not in DB.
    if (res.status === 401 && isRetry) {
      console.error('[CRITICAL AUTH FAIL] Persistent 401. Redirecting to login for re-sync.');
      localStorage.clear(); // Wipe everything
      window.location.href = getIndexPath();
      return { success: false, message: 'Session invalid. Please login again.' };
    }

    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('JSON Parse Error. Server returned:', text);
      return { success: false, message: 'Server synchronization failed. Please try again later.' };
    }

    // MAINTENANCE CHECK (Step 9): If maintenance mode is active, block everything
    if (data.code === 'MAINTENANCE_MODE' || data.maintenance === true) {
      BP.showMaintenanceOverlay(data.message);
      return data;
    }

    // GLOBAL BLOCKED/BLACKLISTED HANDLING
    if (res.status === 403 && (data.error?.code === 'ACCOUNT_BLOCKED' || data.error?.code === 'ACCOUNT_BLACKLISTED')) {
      localStorage.clear();
      sessionStorage.clear();
      document.body.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a1a;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:Arial,sans-serif;z-index:999999;">
          <h1 style="color:#ff4444;font-size:48px;">🚫</h1>
          <h2 style="color:#fff;margin:16px 0 8px;">Account Suspended</h2>
          <p style="color:#888;max-width:400px;text-align:center;">Your account has been suspended. Contact support for assistance.</p>
          <p style="color:#FFD700;margin-top:24px;">support@beeprepare.com</p>
          <a href="/index.html" style="color:#555;margin-top:16px;font-size:14px;">Return to Home</a>
        </div>
      `;
      return data;
    }

    if (data?.data?.isActivated !== undefined && !localStorage.getItem(BP.LOGGING_OUT)) {
      localStorage.setItem(BP.ACTIVATED, data.data.isActivated ? 'true' : 'false');
    }

    if (showOverlay) BP.hideLoader();
    
    if (method === 'GET' && data?.success) {
      const ttl = CACHE_TTL[endpoint] || 0;
      if (ttl > 0) {
        try {
          sessionStorage.setItem(CACHE_PREFIX + endpoint, JSON.stringify({ data, at: Date.now() }));
        } catch(e) {}
      }
    } else if (method !== 'GET' && data?.success) {
      // Invalidate relevant caches automatically on mutations (POST/PUT/DELETE)
      sessionStorage.removeItem(CACHE_PREFIX + '/teacher/dashboard');
      sessionStorage.removeItem(CACHE_PREFIX + '/student/dashboard');
      sessionStorage.removeItem(CACHE_PREFIX + '/student/banks');
    }
    
    return data;
  } catch (err) {
    if (showOverlay) BP.hideLoader();
    console.error('API Error:', err);
    if (err.message === 'SERVER_BUSY') {
      if (window.Swal) {
        Swal.fire({
          icon: 'warning',
          title: 'Server Busy',
          text: 'The server is currently under high load. Please try again later.',
          confirmButtonColor: '#FFD700',
          background: '#1a1a2e',
          color: '#fff'
        });
      }
    }
    return { success: false, message: err.message || 'Network error' };
  }
}

// Page guard for teacher pages
export async function guardTeacher() {
  const uid = localStorage.getItem(BP.UID);
  const activated = localStorage.getItem(BP.ACTIVATED);
  const role = localStorage.getItem(BP.ROLE);
  const base = getIndexPath();

  if (!uid || role !== 'teacher') {
    window.location.href = base;
    return false;
  }
  
  if (activated !== 'true') {
    window.location.href = base.replace('index.html', 'activation.html');
    return false;
  }

  // Cross-verify with server session
  const res = await apiCall('/auth/verify-session', 'GET', null, true);
  if (!res.success || res.data.role !== 'teacher') {
    localStorage.clear();
    window.location.href = base;
    return false;
  }
  return true;
}

// Page guard for student pages
export async function guardStudent() {
  const uid = localStorage.getItem(BP.UID);
  const activated = localStorage.getItem(BP.ACTIVATED);
  const role = localStorage.getItem(BP.ROLE);
  const base = getIndexPath();

  if (!uid || role !== 'student') {
    window.location.href = base;
    return false;
  }

  if (activated !== 'true') {
    window.location.href = base.replace('index.html', 'activation.html');
    return false;
  }

  // Cross-verify with server session
  const res = await apiCall('/auth/verify-session', 'GET', null, true);
  if (!res.success || res.data.role !== 'student') {
    localStorage.clear();
    window.location.href = base;
    return false;
  }
  return true;
}

// Page guard for admin pages (STRICT)
export async function guardAdmin() {
  const token = sessionStorage.getItem('admin_token');
  const base = getIndexPath();

  if (!token) {
    window.location.href = base;
    return false;
  }

  // Admin MUST verify with server on every dashboard entry
  try {
    const res = await fetch(API_BASE + '/admin/verify-session', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!data.success) {
      sessionStorage.clear();
      window.location.href = base;
      return false;
    }
    return true;
  } catch (e) {
    window.location.href = base;
    return false;
  }
}

// Debounce utility
export function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// localStorage key constants
export const BP = {
  TOKEN: 'bp_token',
  UID: 'bp_uid',
  NAME: 'bp_name',
  EMAIL: 'bp_email',
  PHOTO: 'bp_photo',
  ROLE: 'bp_role',
  ACTIVATED: 'bp_activated',
  PLAN: 'bp_plan',
  SUBJECT_LIMIT: 'bp_subject_limit',
  LOGGING_OUT: 'bp_logging_out',
  AI_DAILY_LIMIT: 30,

  getAuthUser: async () => {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const auth = getAuth();
    if (!auth.currentUser) {
      await new Promise(r => {
        let uns;
        uns = auth.onAuthStateChanged(u => { if (uns) uns(); r(); });
        setTimeout(r, 800);
      });
    }
    const user = auth.currentUser;
    return {
      uid: user?.uid || localStorage.getItem(BP.UID),
      displayName: user?.displayName || localStorage.getItem(BP.NAME),
      email: user?.email || localStorage.getItem(BP.EMAIL),
      photoURL: user?.photoURL || localStorage.getItem(BP.PHOTO)
    };
  },

  initStreakFlame: (canvasId = 'streak-canvas') => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Prevent multiple animation loops on the same canvas
    if (canvas.dataset.streakActive === 'true') return;
    canvas.dataset.streakActive = 'true';

    const ctx = canvas.getContext("2d");
    // Idempotent transform: Reset to identity, then apply fixed flip
    ctx.setTransform(1, 0, 0, -1, 0, 16);
    const fps = 8;
    const interval = 1000 / fps;
    let prev = Date.now();
    const y = [2, 1, 0, 0, 0, 0, 1, 2];
    const max = [7, 9, 11, 13, 13, 11, 9, 7];
    const min = [4, 7, 8, 10, 10, 8, 7, 4];

    function flame() {
      const now = Date.now();
      if (now - prev > interval) {
        prev = now;
        ctx.clearRect(0, 0, 16, 16);
        ctx.strokeStyle = "#d14234";
        let i = 0;
        for (let x = 4; x < 12; x++) {
          const h = Math.random() * (max[i] - min[i] + 1) + min[i];
          ctx.beginPath(); ctx.moveTo(x + 0.5, y[i++]); ctx.lineTo(x + 0.5, h); ctx.stroke();
        }
        ctx.strokeStyle = "#f2a55f";
        let j = 1;
        for (let x = 5; x < 11; x++) {
          const h = Math.random() * (max[j] - 5 - (min[j] - 5) + 1) + (min[j] - 5);
          ctx.beginPath(); ctx.moveTo(x + 0.5, y[j++] + 1); ctx.lineTo(x + 0.5, h); ctx.stroke();
        }
        ctx.strokeStyle = "#e8dec5";
        let k = 3;
        for (let x = 7; x < 9; x++) {
          const h = Math.random() * (max[k] - 9 - (min[k] - 9) + 1) + (min[k] - 9);
          ctx.beginPath(); ctx.moveTo(x + 0.5, y[k++]); ctx.lineTo(x + 0.5, h); ctx.stroke();
        }
      }
      requestAnimationFrame(flame);
    }
    flame();
  },

  showMaintenanceOverlay: (msg) => {
    if (document.querySelector('.maintenance-overlay')) return;
    
    // Disable all interactive elements
    document.querySelectorAll('button, input, a, form').forEach(el => el.disabled = true);
    // Prevent further navigation
    window.onbeforeunload = () => true;

    const overlay = document.createElement('div');
    overlay.className = 'maintenance-overlay';
    overlay.innerHTML = `
      <div class="maintenance-content" style="max-width: 600px; padding: 40px; background: rgba(10,10,10,0.8); border: 1px solid rgba(255,207,0,0.2); border-radius: 40px; backdrop-filter: blur(20px); position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 100000; text-align: center; font-family: sans-serif; color: #fff;">
        <div style="margin: 0 auto 30px; width: 100px; height: 100px; background: rgba(255,207,0,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,207,0,0.2);">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#FFCF00" stroke-width="1.5">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
            </svg>
        </div>
        <div style="background: rgba(255,207,0,0.1); color: #FFCF00; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; display: inline-block; margin-bottom: 25px;">Matrix Reconstruction</div>
        <h1 style="font-size: 42px; margin-bottom: 25px; color: #fff;">Maintenance Active</h1>
        <p style="font-size: 16px; color: #fff; line-height: 1.8; opacity: 0.8; font-weight: 400;">
            ${msg || 'The BEE core is currently undergoing manual synchronization. <br> System access is restricted. Please contact customer care.'}
        </p>
        <div style="margin-top: 40px; font-size: 10px; color: #FFCF00; letter-spacing: 4px; font-weight: 900; opacity: 0.3;">
          CORE_SEC_LEVEL: 1419 // ACCESS_DENIED
        </div>
      </div>
    `;
    document.body.prepend(overlay);
    document.body.style.overflow = 'hidden';
  },

  initMaintenanceCheck: async () => {
    try {
      if (window.location.pathname.includes('matrix-core-v1419')) return;
      const res = await apiCall('/system/maintenance', 'GET', null, false);
      if (res && res.success && res.data.isMaintenance) {
        BP.showMaintenanceOverlay(res.data.message);
        window.stop();
      }
    } catch (e) {
      console.error('Maintenance check deferred:', e);
    }
  },

  showSkeleton: (containerId, type = 'card', count = 3) => {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      if (type === 'card') {
        html += `
                <div class="adv-card skeleton" style="min-height: 150px; padding: 20px; display: flex; flex-direction: column; gap: 10px;">
                    <div class="skeleton-title skeleton"></div>
                    <div class="skeleton-text skeleton"></div>
                    <div class="skeleton-text skeleton" style="width: 40%"></div>
                </div>
            `;
        } else if (type === 'list') {
            html += `
                <div style="display: flex; align-items: center; gap: 15px; padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div class="skeleton-circle skeleton"></div>
                    <div style="flex: 1;">
                        <div class="skeleton-title skeleton" style="margin:0; height:14px;"></div>
                        <div class="skeleton-text skeleton" style="margin:5px 0 0; height:10px; width:50%;"></div>
                    </div>
                </div>
            `;
        }
    }
    cont.innerHTML = html;
  },

  initAnnouncementBanner: async () => {
    try {
      if (window.location.pathname.includes('admin') || 
          window.location.pathname.endsWith('index.html') || 
          window.location.pathname === '/') return;

      const res = await fetch(API_BASE + '/announcements/active');
      const json = await res.json();
      
      const data = json.data?.announcement;

      if (json.success && data && data._id) {
        // Check if user dismissed this specific announcement
        const dismissKey = `BP_DISMISSED_ANNOUNCEMENT_${data._id}`;
        if (localStorage.getItem(dismissKey) === 'true') return;

        // Create the professional modal
        const overlay = document.createElement('div');
        overlay.id = 'bee-announcement-modal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.4s ease;';
        
        overlay.innerHTML = `
          <div style="background:rgba(15,15,20,0.95);border:1px solid rgba(255,215,0,0.3);border-radius:24px;padding:30px;max-width:450px;width:90%;box-shadow:0 25px 50px rgba(0,0,0,0.5);transform:translateY(20px);transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
              <div style="background:rgba(255,215,0,0.15);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#FFD700;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              </div>
              <h2 style="color:#fff;margin:0;font-size:20px;font-weight:700;letter-spacing:1px;font-family:sans-serif;">Admin Update</h2>
            </div>
            
            <p style="color:#ccc;font-size:15px;line-height:1.6;margin-bottom:25px;font-family:sans-serif;">
              ${data.text}
            </p>

            <div style="background:rgba(255,255,255,0.03);padding:12px;border-radius:12px;margin-bottom:25px;border-left:3px solid #FFD700;">
              <p style="margin:0;color:#aaa;font-size:12px;font-style:italic;font-family:sans-serif;">Note: This message will appear every time you visit the dashboard unless you dismiss it.</p>
            </div>

            <div style="display:flex;gap:12px;justify-content:flex-end;">
              <button id="announcement-close-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.1);color:#fff;padding:10px 20px;border-radius:12px;cursor:pointer;font-weight:600;transition:0.3s;font-family:sans-serif;">Close for now</button>
              <button id="announcement-dismiss-btn" style="background:#FFD700;border:none;color:#000;padding:10px 20px;border-radius:12px;cursor:pointer;font-weight:700;transition:0.3s;box-shadow:0 4px 15px rgba(255,215,0,0.3);font-family:sans-serif;">Don't remind me again</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(overlay);

        // Add hover effects dynamically
        const closeBtn = document.getElementById('announcement-close-btn');
        const dismissBtn = document.getElementById('announcement-dismiss-btn');
        
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255,255,255,0.05)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'transparent';
        
        dismissBtn.onmouseenter = () => dismissBtn.style.transform = 'translateY(-2px)';
        dismissBtn.onmouseleave = () => dismissBtn.style.transform = 'translateY(0)';

        // Animate in
        requestAnimationFrame(() => {
          overlay.style.opacity = '1';
          overlay.children[0].style.transform = 'translateY(0)';
        });

        // Event listeners
        const closeModal = () => {
          overlay.style.opacity = '0';
          overlay.children[0].style.transform = 'translateY(20px)';
          setTimeout(() => overlay.remove(), 400);
        };

        closeBtn.addEventListener('click', closeModal);
        dismissBtn.addEventListener('click', () => {
          localStorage.setItem(dismissKey, 'true');
          closeModal();
        });
      }
    } catch (e) {
      console.warn('Announcement fetch failed', e);
    }
  },

  syncTeacherSignals: async () => {
    try {
      const res = await apiCall('/teacher/dashboard');
      if (res && res.success) {
        const hasReq = res.data.pendingRequestsCount > 0;
        const hasDoubt = res.data.pendingDoubtsCount > 0;
        
        const reqDots = document.querySelectorAll('#sidebar-request-signal, #card-request-signal');
        const doubtDots = document.querySelectorAll('#sidebar-doubt-signal, #card-doubt-signal');
        const profileDots = document.querySelectorAll('#profile-signal');

        reqDots.forEach(d => d.style.display = hasReq ? 'block' : 'none');
        doubtDots.forEach(d => d.style.display = hasDoubt ? 'block' : 'none');
        profileDots.forEach(d => d.style.display = (hasReq || hasDoubt) ? 'block' : 'none');
      }
    } catch(e) { console.warn("Signal Sync Failed", e); }
  },

  showLoader: () => {
    let loader = document.getElementById('bee-loader-overlay');
    if (!loader) {
      BP.initLoader();
      loader = document.getElementById('bee-loader-overlay');
    }
    
    BP._loaderCount = (BP._loaderCount || 0) + 1;
    
    // Safety check: if loader still doesn't exist (DOM not ready), try again shortly
    if (!loader) {
        setTimeout(() => BP.showLoader(), 100);
        return;
    }



    loader.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock scroll
  },

  hideLoader: () => {
    let loader = document.getElementById('bee-loader-overlay');
    if (!loader) {
        BP._loaderCount = Math.max(0, (BP._loaderCount || 1) - 1);
        return;
    }
    
    BP._loaderCount = Math.max(0, (BP._loaderCount || 1) - 1);
    


    if (BP._loaderCount === 0) {
      setTimeout(() => {
        if (BP._loaderCount === 0) {
          loader.classList.remove('active');
          if (document.body) document.body.style.overflow = ''; // Unlock scroll
        }
      }, 300); // Small grace period to prevent flickering
    }
  },

  initLoader: () => {
    if (document.getElementById('bee-loader-overlay')) return;

    // Inject CSS Link with Cache Buster (v2.3) using robust import.meta.url
    if (!document.getElementById('bee-loader-css')) {
      const link = document.createElement('link');
      link.id = 'bee-loader-css';
      link.rel = 'stylesheet';
      link.href = new URL('../../assets/css/loader.css?v=2.3', import.meta.url).href;
      document.head.appendChild(link);
    }

    // NUCLEAR OPTION: Inject critical loader styles directly via JS 
    // This ensures the loader works even if the CSS file is cached/missing
    if (!document.getElementById('bee-loader-style-inline')) {
        const style = document.createElement('style');
        style.id = 'bee-loader-style-inline';
        style.textContent = `
            .bee-loader-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.4); -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px);
                display: none; align-items: center; justify-content: center;
                z-index: 999999; opacity: 0; transition: opacity 0.4s ease;
                pointer-events: none;
            }
            .bee-loader-overlay.active { display: flex; opacity: 1; pointer-events: all; visibility: visible; }
            .loader-container { 
                background: rgba(15, 15, 20, 0.95); padding: 40px; border-radius: 30px;
                border: 1px solid rgba(255, 215, 0, 0.3); display: flex; flex-direction: column;
                align-items: center; gap: 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
            }
            .loader-main-text { color: #FFD700; font-size: 13px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; margin-top: 15px; }
            @media (max-width: 480px) { .loader-container { padding: 25px; width: 80%; } .loader-main-text { font-size: 10px; letter-spacing: 2px; } }
        `;
        document.head.appendChild(style);
    }

    if (!document.body) {
      setTimeout(() => BP.initLoader(), 50);
      return;
    }

    const loaderHtml = `
      <div id="bee-loader-overlay" class="bee-loader-overlay">
        <div class="loader-container">
          <div class="pl">
            <div class="pl__dot"></div>
            <div class="pl__dot"></div>
            <div class="pl__dot pl__dot--yellow pl__dot--sm"></div>
            <div class="pl__dot"></div>
            <div class="pl__dot pl__dot--gold pl__dot--lg"></div>
            <div class="pl__dot"></div>
            <div class="pl__dot pl__dot--white pl__dot--sm"></div>
            <div class="pl__dot"></div>
            <div class="pl__dot pl__dot--grey pl__dot--sm"></div>
          </div>
          <div class="loader-text-wrapper">
            <div class="loader-main-text">Loading</div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loaderHtml);
    console.log("[BEE CORE] Loader Node Protocol v2.2 Initialized");
  }
};

// AUTO-INIT TASKS
const initCore = () => {
    // Silent warm-up ping — fires immediately, result ignored
    fetch(API_BASE.replace('/api', '') + '/health', { method: 'GET' }).catch(() => {});
    
    BP.initLoader();
    BP.initMaintenanceCheck();
    BP.initAnnouncementBanner();
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initCore);
} else {
    // If body already exists, run immediately
    if (document.body) initCore();
    else window.addEventListener('DOMContentLoaded', initCore);
}
