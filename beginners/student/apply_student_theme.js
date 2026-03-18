const fs = require('fs');
const path = require('path');

const studentDir = String.raw`d:\TRNT BEE\TRNT BEE\BEEPREPARE\BEEPREPARE-main\beginners\student`;

const files = fs.readdirSync(studentDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filepath = path.join(studentDir, file);
    let content = fs.readFileSync(filepath, 'utf-8');

    // Inject CSS link just before </head> if not already
    if (!content.includes('student-theme.css')) {
        content = content.replace('</head>', '    <link rel="stylesheet" href="../../assets/css/student-theme.css">\n</head>');
    }

    // Header title glow standardization
    content = content.replace(/class="header-title"/g, 'class="header-title text-gold-glow"');
    content = content.replace(/class="welcome-title"/g, 'class="welcome-title text-gold-glow"');

    // Button standardizations
    content = content.replace(/class="btn btn-primary"/g, 'class="btn-adv"');
    content = content.replace(/class="btn-primary"/g, 'class="btn-adv"');

    fs.writeFileSync(filepath, content, 'utf-8');
});

console.log(`Updated ${files.length} student pages successfully!`);
