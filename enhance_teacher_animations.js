const fs = require('fs');
const path = require('path');

const teacherDir = path.join(__dirname, 'beginners', 'teacher');

const styleTag = `    <!-- PREMIUM ANIMATION STYLES -->
    <link rel="stylesheet" href="../../assets/css/premium-student-ui.css">
`;

const scriptBlock = `
    <!-- EXTREME UI SCRIPTS (Animations Only) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/1.8.0/vanilla-tilt.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            // Apply 3D Tilt to Teacher Cards
            const tiltElements = document.querySelectorAll(".subject-card, .class-card, .timeline-card, .req-card, .bank-card, .history-card, .profile-card, .stat-box, .file-item");
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
            const hudElements = document.querySelectorAll(".subject-card, .class-card, .timeline-item, .req-card, .bank-card, .history-card, .profile-card, .stat-box, .file-item");
            hudElements.forEach((el, index) => {
                el.classList.add('hud-element');
                el.style.animationDelay = \`\${index * 0.08}s\`;
            });
        });
    </script>
`;

function processHtmlFiles(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (file.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Inject CSS
            if (!content.includes('premium-student-ui.css')) {
                content = content.replace('</head>', styleTag + '</head>');
                modified = true;
            }

            // Inject JS
            if (!content.includes('EXTREME UI SCRIPTS')) {
                content = content.replace('</body>', scriptBlock + '</body>');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Enhanced animations in: ${file}`);
            }
        }
    });
}

processHtmlFiles(teacherDir);
console.log('All teacher POV files enhanced with animations!');
