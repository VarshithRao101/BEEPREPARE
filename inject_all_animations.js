const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const assetsCssPath = 'assets/css/premium-student-ui.css';

function getDepth(filePath) {
    const rel = path.relative(rootDir, filePath);
    const parts = rel.split(path.sep);
    return Math.max(0, parts.length - 1);
}

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory() && file !== 'assets' && file !== '.git') {
            results = results.concat(walk(fullPath));
        } else if (file.endsWith('.html')) {
            results.push(fullPath);
        }
    });
    return results;
}

const htmlFiles = walk(rootDir);

htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // figure out correct relative path to assets
    const depth = getDepth(file);
    let prefix = '';
    if (depth === 0) {
        prefix = './';
    } else {
        prefix = '../'.repeat(depth);
    }

    // Inject CSS
    if (!content.includes('premium-student-ui.css')) {
        const styleTag = `    <!-- PREMIUM ANIMATION STYLES -->\n    <link rel="stylesheet" href="${prefix}${assetsCssPath}">\n`;
        content = content.replace('</head>', styleTag + '</head>');
        modified = true;
    }

    // Inject JS
    if (!content.includes('EXTREME UI SCRIPTS')) {
        const scriptBlock = `
    <!-- EXTREME UI SCRIPTS (Animations Only) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.0/vanilla-tilt.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // Apply 3D Tilt to all interactive elements
            const tiltElements = document.querySelectorAll(".subject-card, .class-card, .timeline-card, .req-card, .bank-card, .history-card, .profile-card, .stat-box, .file-item, .action-card, .subject-mini-card, .document-item, .result-card, .request-card, .auth-card, .d-profile-card, .adv-card, .role-card, .dash-card, .paper-card, .stream-card");
            if(tiltElements.length > 0) {
                try {
                    VanillaTilt.init(tiltElements, {
                        max: 8,
                        speed: 400,
                        glare: true,
                        "max-glare": 0.15,
                        scale: 1.02
                    });
                } catch(e) {}
            }

            // Apply Staggered HUD Load-in
            const hudElements = document.querySelectorAll(".subject-card, .class-card, .timeline-item, .req-card, .bank-card, .history-card, .profile-card, .stat-box, .file-item, .action-card, .subject-mini-card, .document-item, .result-card, .request-card, .d-profile-stats, .d-xp-container, .dash-card, .role-card, .paper-card, .stream-card");
            hudElements.forEach((el, index) => {
                el.classList.add('hud-element');
                el.style.animationDelay = \`\${index * 0.08}s\`;
            });
        });
    </script>
`;
        content = content.replace('</body>', scriptBlock + '</body>');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Animated: ${path.relative(rootDir, file)}`);
    }
});

console.log('Finished injecting dynamic peak animations across ALL HTML pages!');
