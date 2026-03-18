const fs = require('fs');
const path = require('path');

const studentDir = String.raw`d:\TRNT BEE\TRNT BEE\BEEPREPARE\BEEPREPARE-main\beginners\student`;
const cssFile = String.raw`d:\TRNT BEE\TRNT BEE\BEEPREPARE\BEEPREPARE-main\assets\css\premium-student-ui.css`;

// Extreme CSS Upgrade
let cssContent = fs.readFileSync(cssFile, 'utf-8');
const extremeStyles = `

/* --- EXTREME ENHANCEMENTS --- */
/* Shimmering Welcome Text */
.welcome-title {
    background: linear-gradient(90deg, #fff 0%, #FFD700 50%, #fff 100%) !important;
    background-size: 200% auto !important;
    color: #fff;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
    animation: shine 4s linear infinite !important;
}

@keyframes shine {
    to {
        background-position: 200% center;
    }
}

/* Floating Elements */
.action-icon, .bank-banner-icon, .icon-header {
    animation: floatIcon 3s ease-in-out infinite !important;
}

@keyframes floatIcon {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
}

/* Pulsing Timeline Dots */
.timeline-dot {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
    animation: pulseDot 2s infinite !important;
}
.timeline-dot.warning {
    box-shadow: 0 0 0 0 rgba(255, 165, 0, 0.7);
    animation: pulseWarning 2s infinite !important;
}

@keyframes pulseDot {
    70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
    100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
}
@keyframes pulseWarning {
    70% { box-shadow: 0 0 0 10px rgba(255, 165, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 165, 0, 0); }
}

/* HUD Load-in Animation */
.hud-element {
    opacity: 0;
    transform: translateY(30px);
    animation: loadHUD 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes loadHUD {
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Neon Borders on Hover */
.subject-mini-card, .action-card, .document-item {
    position: relative;
}
.subject-mini-card::after, .action-card::after, .document-item::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 2px;
    background: linear-gradient(135deg, transparent, rgba(255, 215, 0, 0.8), transparent);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    opacity: 0;
    transition: 0.4s ease;
    pointer-events: none;
}
.subject-mini-card:hover::after, .action-card:hover::after, .document-item:hover::after {
    opacity: 1;
    transform: scale(1);
}
`;

if (!cssContent.includes('EXTREME ENHANCEMENTS')) {
    fs.writeFileSync(cssFile, cssContent + extremeStyles, 'utf-8');
}

// Inject VanillaTilt and HUD classes to HTML files
const files = fs.readdirSync(studentDir).filter(f => f.endsWith('.html'));

const vanillaTiltScript = `
    <!-- EXTREME UI SCRIPTS -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.0/vanilla-tilt.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // Apply 3D Tilt
            VanillaTilt.init(document.querySelectorAll(".action-card, .subject-mini-card, .timeline-card, .chapter-box, .document-item, .result-card, .request-card, .auth-card, .d-profile-card, .adv-card"), {
                max: 8,
                speed: 400,
                glare: true,
                "max-glare": 0.15,
                scale: 1.02
            });

            // Apply Staggered HUD Load-in
            const elements = document.querySelectorAll(".action-card, .subject-mini-card, .timeline-item, .chapter-box, .document-item, .result-card, .request-card, .d-profile-stats, .d-xp-container");
            elements.forEach((el, index) => {
                el.classList.add('hud-element');
                el.style.animationDelay = \`\${index * 0.08}s\`;
            });
        });
    </script>
</body>`;

files.forEach(file => {
    const filepath = path.join(studentDir, file);
    let content = fs.readFileSync(filepath, 'utf-8');

    if (!content.includes('vanilla-tilt.min.js')) {
        content = content.replace('</body>', vanillaTiltScript);
        fs.writeFileSync(filepath, content, 'utf-8');
    }
});

console.log('Successfully injected EXTREME 3D tilts, floating animations, and HUD load-ins to all student pages!');
