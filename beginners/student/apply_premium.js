const fs = require('fs');
const path = require('path');

const studentDir = String.raw`d:\TRNT BEE\TRNT BEE\BEEPREPARE\BEEPREPARE-main\beginners\student`;
const cssFile = String.raw`d:\TRNT BEE\TRNT BEE\BEEPREPARE\BEEPREPARE-main\assets\css\premium-student-ui.css`;

const cssContent = `/* THE ULTIMATE PREMIUM UI OVERHAUL FOR STUDENT POV */

/* Global Premium Glows & Text */
.header-title, .welcome-title {
    text-shadow: 0 0 20px rgba(255, 207, 0, 0.4) !important;
}

/* Action Cards (Home) */
.action-card {
    background: linear-gradient(145deg, rgba(20, 20, 20, 0.8), rgba(10, 10, 10, 0.95)) !important;
    border: 1px solid rgba(255, 215, 0, 0.2) !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), inset 0 2px 15px rgba(255, 215, 0, 0.05) !important;
    border-radius: 28px !important;
    transform: perspective(1px) translateZ(0);
}
.action-card:hover {
    transform: translateY(-10px) scale(1.02) !important;
    border-color: #FFD700 !important;
    box-shadow: 0 20px 50px rgba(255, 215, 0, 0.25), inset 0 2px 15px rgba(255, 215, 0, 0.1) !important;
}

/* Subject Mini Cards */
.subject-mini-card {
    background: rgba(15, 15, 15, 0.8) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 20px !important;
    backdrop-filter: blur(15px) !important;
}
.subject-mini-card:hover {
    background: rgba(30, 30, 30, 0.9) !important;
    border-color: #FFD700 !important;
    box-shadow: 0 10px 25px rgba(255, 215, 0, 0.2) !important;
}

/* Document & Chapter Boxes (Notes) */
.document-item {
    background: linear-gradient(145deg, rgba(25, 25, 25, 0.8), rgba(15, 15, 15, 0.95)) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 22px !important;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5) !important;
}
.document-item:hover {
    border-color: rgba(255, 215, 0, 0.4) !important;
    transform: translateY(-5px) !important;
    box-shadow: 0 15px 40px rgba(255, 215, 0, 0.15) !important;
}

/* Timeline Cards */
.timeline-card {
    background: linear-gradient(145deg, rgba(22, 22, 22, 0.8), rgba(12, 12, 12, 0.9)) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 20px !important;
}
.timeline-card:hover {
    border-color: rgba(255, 215, 0, 0.3) !important;
    transform: translateX(8px) !important;
    box-shadow: 0 10px 25px rgba(255, 215, 0, 0.1) !important;
}

/* Test Area (Test) */
.question-container {
    background: linear-gradient(145deg, rgba(20, 20, 20, 0.85), rgba(10, 10, 10, 0.98)) !important;
    border: 1px solid rgba(255, 215, 0, 0.15) !important;
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.6), inset 0 2px 20px rgba(255, 215, 0, 0.05) !important;
    border-radius: 30px !important;
}
.option-item {
    background: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 18px !important;
}
.option-item:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    border-color: rgba(255, 215, 0, 0.5) !important;
    box-shadow: 0 8px 25px rgba(255, 215, 0, 0.1) !important;
}
.option-item.selected {
    background: rgba(255, 215, 0, 0.08) !important;
    border-color: #FFD700 !important;
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.1) !important;
}
.option-item.selected .option-circle {
    border-color: #FFD700 !important;
    background: #FFD700 !important;
}

/* Results */
.result-card {
    background: linear-gradient(145deg, rgba(25, 25, 25, 0.9), rgba(15, 15, 15, 0.95)) !important;
    border: 1px solid rgba(255, 215, 0, 0.25) !important;
    border-radius: 35px !important;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), inset 0 0 30px rgba(255, 215, 0, 0.05) !important;
}

/* Requests */
.request-card {
    background: linear-gradient(145deg, rgba(20, 20, 20, 0.8), rgba(10, 10, 10, 0.95)) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 20px !important;
}
.request-card:hover {
    border-color: #FFD700 !important;
    transform: translateY(-4px) !important;
    box-shadow: 0 15px 35px rgba(255, 215, 0, 0.15) !important;
}

/* Auth / Validation */
.auth-card {
    background: linear-gradient(145deg, rgba(25, 25, 25, 0.95), rgba(10, 10, 10, 0.98)) !important;
    border: 1px solid rgba(255, 215, 0, 0.2) !important;
    border-radius: 35px !important;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), inset 0 2px 25px rgba(255, 215, 0, 0.1) !important;
}

/* Input Fields everywhere */
input[type="text"], input[type="password"], input[type="email"] {
    background: rgba(0, 0, 0, 0.4) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 12px !important;
}
input[type="text"]:focus, input[type="password"]:focus, input[type="email"]:focus {
    border-color: #FFD700 !important;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.15) !important;
}

/* Universal Buttons */
.btn-adv, .btn-primary, .btn-finish, .unlock-btn, .btn-enter-otp {
    background: linear-gradient(135deg, #FFD700, #FFA500) !important;
    color: #000 !important;
    border: none !important;
    box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2) !important;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}
.btn-adv:hover, .btn-primary:hover, .btn-finish:hover, .unlock-btn:hover, .btn-enter-otp:hover {
    transform: translateY(-3px) scale(1.02) !important;
    box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4) !important;
}

/* SweetAlert Glassmorphism (Overriding defaults) */
.swal2-popup {
    background: linear-gradient(145deg, rgba(25, 25, 25, 0.95), rgba(15, 15, 15, 0.98)) !important;
    border: 1px solid rgba(255, 215, 0, 0.2) !important;
    backdrop-filter: blur(20px) !important;
    border-radius: 24px !important;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), inset 0 2px 25px rgba(255, 215, 0, 0.05) !important;
}
.swal2-title {
    color: #FFD700 !important;
}
.swal2-html-container {
    color: #ccc !important;
}
`;

fs.writeFileSync(cssFile, cssContent, 'utf-8');

const files = fs.readdirSync(studentDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filepath = path.join(studentDir, file);
    let content = fs.readFileSync(filepath, 'utf-8');

    // Add CSS link immediately after student-theme.css if it exists, or just before </head>
    if (!content.includes('premium-student-ui.css')) {
        if (content.includes('student-theme.css')) {
            content = content.replace('student-theme.css">', 'student-theme.css">\n    <link rel="stylesheet" href="../../assets/css/premium-student-ui.css">');
        } else {
            content = content.replace('</head>', '    <link rel="stylesheet" href="../../assets/css/premium-student-ui.css">\n</head>');
        }
    }

    // Also aggressively remove any hardcoded padding or weird inline sizes from specific broken cards if needed, but !important solves mostly anything.

    fs.writeFileSync(filepath, content, 'utf-8');
});

console.log('Successfully injected premium-student-ui.css into all ' + files.length + ' html files!');
