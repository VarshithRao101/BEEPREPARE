/**
 * Advanced Notification & Activity Management System
 * Handles activity logging, push notifications (toasts), and history management.
 */

window.ActivityManager = {
    // Configuration
    keySettings: 'beeprepare_settings_notifications_enabled',
    keyLog: 'beeprepare_activity_log',
    maxLogSize: 50,

    // Initialize
    init() {
        if (localStorage.getItem(this.keySettings) === null) {
            localStorage.setItem(this.keySettings, 'true'); // Default enabled
        }
        this.renderBadge();
    },

    // Check if notifications are enabled
    isEnabled() {
        return localStorage.getItem(this.keySettings) === 'true';
    },

    // Toggle setting
    toggle(state) {
        localStorage.setItem(this.keySettings, state);
        console.log(`Notifications ${state ? 'ENABLED' : 'DISABLED'}`);
    },

    // Log a new activity
    log(action, description, type = 'info') {
        if (!this.isEnabled()) {
            console.log('Activity skipped: Notifications disabled by user.');
            return;
        }

        const activity = {
            id: Date.now(),
            action: action,
            description: description,
            type: type, // 'success', 'warning', 'info', 'error'
            timestamp: new Date().toISOString(),
            read: false
        };

        // Get existing log
        let log = this.getLog();
        log.unshift(activity); // Add to top

        // Limit size
        if (log.length > this.maxLogSize) {
            log = log.slice(0, this.maxLogSize);
        }

        // Save
        localStorage.setItem(this.keyLog, JSON.stringify(log));

        // Show Toast
        this.showToast(action, description, type);

        // Update Badge if on page
        this.renderBadge();
    },

    // Get log
    getLog() {
        const data = localStorage.getItem(this.keyLog);
        return data ? JSON.parse(data) : [];
    },

    // Clear history
    clear() {
        localStorage.removeItem(this.keyLog);
        this.renderBadge();
    },

    // Render Notification Badge on Bell Icon
    renderBadge() {
        const badge = document.getElementById('notif-badge');
        if (badge) {
            const log = this.getLog();
            const unread = log.filter(item => !item.read).length;

            if (unread > 0) {
                badge.style.display = 'flex';
                badge.innerText = unread > 9 ? '9+' : unread;
                badge.classList.add('pulse-animation');
            } else {
                badge.style.display = 'none';
                badge.classList.remove('pulse-animation');
            }
        }
    },

    // Mark all as read
    markAsRead() {
        let log = this.getLog();
        log = log.map(item => ({ ...item, read: true }));
        localStorage.setItem(this.keyLog, JSON.stringify(log));
        this.renderBadge();
    },

    // --- UI: Toast Notifications ---
    showToast(title, message, type) {
        // Create container if not exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        // Icons
        const icons = {
            success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
            error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2196F3" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
            warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFC107" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
        };

        const toast = document.createElement('div');
        toast.className = 'toast-notification glass-panel';
        toast.style.cssText = `
            background: rgba(20, 20, 20, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-left: 4px solid ${type === 'success' ? '#4CAF50' : type === 'error' ? '#ff4d4d' : '#2196F3'};
            padding: 16px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            display: flex;
            align-items: flex-start;
            gap: 12px;
            min-width: 300px;
            transform: translateX(100px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
            color: #fff;
        `;

        toast.innerHTML = `
            <div style="margin-top: 2px;">${icons[type] || icons.info}</div>
            <div>
                <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${title}</div>
                <div style="font-size: 12px; color: #aaa; line-height: 1.4;">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        // Animate In
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // Auto remove
        setTimeout(() => {
            toast.style.transform = 'translateX(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }
};

// Auto-run init on load
document.addEventListener('DOMContentLoaded', () => {
    ActivityManager.init();
});
