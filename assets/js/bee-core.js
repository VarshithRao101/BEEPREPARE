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
// Choices between Local Dev vs Production (Vercel)
export const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
  ? 'http://localhost:5000/api' 
  : '/api';

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
  }
};
