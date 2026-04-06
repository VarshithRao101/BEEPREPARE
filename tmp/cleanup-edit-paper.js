const fs = require('fs');
const path = 'd:\\TRNT BEE\\TRNT BEE\\BEEPREPARE\\BEEPREPARE-main\\beginners\\teacher\\edit-paper.html';
let content = fs.readFileSync(path, 'utf8');

// Use regex to empty the #paper div
const regex = /(<div id="paper" class="paper-sheet" contenteditable="true">)[\s\S]*?(<\/div>)/;
const replacement = `$1
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 500px; color: #999; font-family: sans-serif;" contenteditable="false">
                    <div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
                    <div style="font-size: 18px; font-weight: 600; color: #fff;">Assembling Examination Paper...</div>
                    <div style="font-size: 13px; margin-top: 8px; opacity: 0.6;">Fetching architected content from database</div>
                </div>
            $2`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content);
console.log('Cleaned mockup data from edit-paper.html');
