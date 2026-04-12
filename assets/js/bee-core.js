// ============================================
// BEE CORE — Shared utilities for BEEPREPARE
// Import this in every HTML page
// ============================================

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
// Change this ONE line to switch between
// dev and production:
export const API_BASE = 'http://localhost:5000/api';

// Globally initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
const app = initializeApp(firebaseConfig);

// Get fresh Firebase token
let lastToken = null;
let lastFetchTime = 0;

export async function getFreshToken() {
  const { getAuth, onAuthStateChanged } = await import(
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js'
  );
  const auth = getAuth();
  
  // Strategy: Wait for status if currently null on page load
  let user = auth.currentUser;
  if (!user) {
    await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, (u) => {
        user = u;
        unsubscribe();
        resolve();
      });
      setTimeout(() => { if (unsubscribe) unsubscribe(); resolve(); }, 800); // 800ms max wait for auth state
    });
  }

  if (!user) {
    // Return cached token if available, otherwise null
    // DO NOT REDIRECT HERE - Page Guards handle redirects
    if (localStorage.getItem('bp_logging_out')) return null;
    return localStorage.getItem('bp_token');
  }

  // Rate limit refreshes to every 45 mins
  const now = Date.now();
  if (lastToken && (now - lastFetchTime < 45 * 60 * 1000)) {
    return lastToken;
  }

  try {
    const token = await user.getIdToken();
    lastToken = token;
    lastFetchTime = now;
    localStorage.setItem('bp_token', token);
    return token;
  } catch (err) {
    console.error('Token fetch failed:', err);
    return localStorage.getItem('bp_token');
  }
}

// Smart path to index.html from any subfolder
export function getIndexPath() {
  const depth = window.location.pathname
    .split('/').filter(Boolean).length;
  // Note: This logic assumes the environment base path. 
  // In many local setups, it might need adjustment if served from a subfolder.
  // But we will follow the user's logic provided.
  if (depth <= 1) return 'index.html';
  if (depth === 2) return '../index.html';
  return '../../index.html';
}

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
  isRetry = false // Track retry attempts (Step 8 Seal)
) {
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
      localStorage.removeItem('bp_token'); // Clean cached token

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

    const data = await res.json();

    // Auto-update activation status if returned (but only if NOT logging out)
    if (data?.data?.isActivated !== undefined && !localStorage.getItem('bp_logging_out')) {
      localStorage.setItem(BP.ACTIVATED, data.data.isActivated ? 'true' : 'false');
    }

    return data;
  } catch (err) {
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
export function guardTeacher() {
  const uid = localStorage.getItem('bp_uid');
  const activated =
    localStorage.getItem('bp_activated');
  const role = localStorage.getItem('bp_role');
  const base = getIndexPath();

  if (!uid) {
    window.location.href = base;
    return false;
  }
  if (activated !== 'true') {
    window.location.href = base
      .replace('index.html', 'activation.html');
    return false;
  }
  if (role !== 'teacher') {
    window.location.href = base;
    return false;
  }
  return true;
}

// Page guard for student pages
export function guardStudent() {
  const uid = localStorage.getItem('bp_uid');
  const activated =
    localStorage.getItem('bp_activated');
  const role = localStorage.getItem('bp_role');
  const base = getIndexPath();

  if (!uid) {
    window.location.href = base;
    return false;
  }
  if (activated !== 'true') {
    window.location.href = base
      .replace('index.html', 'activation.html');
    return false;
  }
  if (role !== 'student') {
    window.location.href = base;
    return false;
  }
  return true;
}

// Page guard for admin pages
export function guardAdmin() {
  const uid = localStorage.getItem('bp_uid');
  const role = localStorage.getItem('bp_role');
  const base = getIndexPath();

  if (!uid || role !== 'admin') {
    window.location.href = base;
    return false;
  }
  return true;
}

// Debounce utility (Step 4)
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
  
  /**
   * Helper to get current user data (Sync/Async)
   * Prioritizes Firebase Auth but falls back to localStorage
   */
  getAuthUser: async () => {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    const auth = getAuth();
    
    // Wait for auth to initialize if needed (800ms max)
    if (!auth.currentUser) {
       await new Promise(r => {
         const uns = auth.onAuthStateChanged(u => { uns(); r(); });
         setTimeout(r, 800);
       });
    }

    const user = auth.currentUser;
    return {
       uid: user?.uid || localStorage.getItem('bp_uid'),
       displayName: user?.displayName || localStorage.getItem('bp_name'),
       email: user?.email || localStorage.getItem('bp_email'),
       photoURL: user?.photoURL || localStorage.getItem('bp_photo')
    };
  },
  /**
   * Universal Streak Flame Animation (Matches Student POV)
   * @param {string} canvasId - The ID of the canvas element
   */
  initStreakFlame: (canvasId = 'streak-canvas') => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.translate(0, 16);
    ctx.scale(1, -1);
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
        ctx.strokeStyle = "#d14234"; // Outer
        let i = 0;
        for (let x = 4; x < 12; x++) {
          const h = Math.random() * (max[i] - min[i] + 1) + min[i];
          ctx.beginPath(); ctx.moveTo(x + 0.5, y[i++]); ctx.lineTo(x + 0.5, h); ctx.stroke();
        }
        ctx.strokeStyle = "#f2a55f"; // Middle
        let j = 1;
        for (let x = 5; x < 11; x++) {
          const h = Math.random() * (max[j] - 5 - (min[j] - 5) + 1) + (min[j] - 5);
          ctx.beginPath(); ctx.moveTo(x + 0.5, y[j++] + 1); ctx.lineTo(x + 0.5, h); ctx.stroke();
        }
        ctx.strokeStyle = "#e8dec5"; // Core
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
  
  /**
   * GLOBAL MAINTENANCE PROTOCOL
   * Checks system status and injects overlay if active
   */
  initMaintenanceCheck: async () => {
    try {
      // EXCLUDE ADMIN PORTAL (Secret URL check)
      if (window.location.pathname.includes('matrix-core-v1419')) return;

      const res = await apiCall('/system/maintenance', 'GET', null, false);
      if (res && res.success && res.data.isMaintenance) {
        // INJECT MAINTENANCE OVERLAY
        const overlay = document.createElement('div');
        overlay.className = 'maintenance-overlay';
        overlay.innerHTML = `
          <div class="maintenance-content" style="max-width: 600px; padding: 40px; background: rgba(10,10,10,0.8); border: 1px solid rgba(255,207,0,0.2); border-radius: 40px; backdrop-filter: blur(20px);">
            <div style="margin: 0 auto 30px; width: 100px; height: 100px; background: rgba(255,207,0,0.05); border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,207,0,0.2);">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#FFCF00" stroke-width="1.5">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
                </svg>
            </div>
            <div class="maintenance-badge" style="margin-bottom: 25px;">Matrix Reconstruction</div>
            <h1 class="maintenance-title" style="font-size: 42px; margin-bottom: 25px;">Maintenance Active</h1>
            <p class="maintenance-msg" style="font-size: 16px; color: #fff; line-height: 1.8; opacity: 0.8; font-weight: 400;">
                The BEE core is currently undergoing manual synchronization. <br>
                <strong>System access is restricted. Please contact customer care.</strong>
            </p>
            <div style="margin-top: 40px; font-size: 10px; color: #FFCF00; letter-spacing: 4px; font-weight: 900; opacity: 0.3;">
              CORE_SEC_LEVEL: 1419 // ACCESS_DENIED
            </div>
          </div>
        `;
        document.body.prepend(overlay);
        document.body.style.overflow = 'hidden';
        
        // Block all UI interactions
        window.stop();
      }
    } catch (e) {
      console.error('Maintenance check deferred:', e);
    }
  },

  /**
   * SKELETON LOADER UTILITY
   * Replaces content with shimmery placeholders
   */
  showSkeleton: (containerId, type = 'card', count = 3) => {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    
    let html = '';
    for(let i=0; i<count; i++) {
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
  }
};

// AUTO-INIT MAINTENANCE CHECK
window.addEventListener('DOMContentLoaded', BP.initMaintenanceCheck);

