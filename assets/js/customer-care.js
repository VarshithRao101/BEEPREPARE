
/**
 * BEEPREPARE - PREMIUM CUSTOMER CARE WIDGET
 * Injected into Profile Pages and Customer Care page.
 */

(function() {
    // 1. Create and Inject Styles
    const styles = `
        :root {
            --cc-primary: #FFD700;
            --cc-bg: rgba(10, 10, 12, 0.95);
            --cc-border: rgba(255, 215, 0, 0.3);
            --cc-glass: blur(25px);
        }

        .cc-float-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 55px;
            height: 55px;
            border-radius: 50%;
            background: #000;
            border: 2px solid var(--cc-primary);
            box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
            cursor: pointer;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            overflow: hidden;
        }

        .cc-float-btn:hover {
            transform: scale(1.15) rotate(10deg);
            box-shadow: 0 0 25px rgba(255, 215, 0, 0.5);
        }

        .cc-float-btn img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
        }

        /* Modal Overlay */
        .cc-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: 0.3s;
        }

        .cc-overlay.active {
            display: flex;
            opacity: 1;
        }

        .cc-card {
            background: var(--cc-bg);
            width: 90%;
            max-width: 450px;
            border-radius: 30px;
            border: 1px solid var(--cc-border);
            padding: 35px;
            position: relative;
            transform: scale(0.8) translateY(50px);
            transition: 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 40px 100px rgba(0,0,0,0.8);
            backdrop-filter: var(--cc-glass);
        }

        .cc-overlay.active .cc-card {
            transform: scale(1) translateY(0);
        }

        .cc-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .cc-title {
            font-size: 24px;
            font-weight: 800;
            color: #fff;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }

        .cc-subtitle {
            font-size: 11px;
            font-weight: 800;
            color: var(--cc-primary);
            text-transform: uppercase;
            letter-spacing: 3px;
        }

        .cc-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .cc-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 18px;
            padding: 15px 20px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            transition: 0.3s;
            position: relative;
        }

        .cc-item:hover {
            border-color: var(--cc-primary);
            background: rgba(255, 215, 0, 0.05);
            transform: translateX(5px);
        }

        .cc-priority {
            font-size: 9px;
            font-weight: 900;
            color: var(--cc-primary);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 2px;
        }

        .cc-info-row {
            display: flex;
            align-items: center;
            gap: 12px;
            color: #fff;
            font-weight: 600;
            font-size: 14px;
        }

        .cc-icon {
            width: 16px;
            height: 16px;
            color: var(--cc-primary);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .cc-email {
            font-size: 12px;
            color: #888;
            font-weight: 500;
            margin-left: 28px;
        }

        .cc-socials {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .cc-social-link {
            color: #fff;
            text-decoration: none;
            font-size: 12px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: 0.3s;
        }

        .cc-social-link:hover {
            color: var(--cc-primary);
            transform: translateY(-2px);
        }

        .cc-close {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: rgba(255,255,255,0.05);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #888;
            cursor: pointer;
            transition: 0.3s;
        }

        .cc-close:hover {
            background: #ff4d4d;
            color: #fff;
        }

        @media (max-width: 768px) {
            .cc-float-btn {
                bottom: 100px; /* Above mobile nav */
                right: 20px;
                width: 50px;
                height: 50px;
            }
        }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    // Icons
    const phoneIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;
    const mailIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;

    // 2. Create Elements
    const floatBtn = document.createElement("div");
    floatBtn.className = "cc-float-btn";
    floatBtn.id = "customerCareBtn";
    
    // Use the image path provided by user - more robust path detection
    let imgPath = 'assets/images/1804043.png';
    const depth = window.location.pathname.split('/').filter(Boolean).length;
    
    // Check if we are in a subfolder (like beginners/student/)
    if (window.location.pathname.includes('/beginners/student/') || window.location.pathname.includes('/beginners/teacher/')) {
        imgPath = '../../assets/images/1804043.png';
    } else if (window.location.pathname.includes('/beginners/')) {
        imgPath = '../assets/images/1804043.png';
    }
    floatBtn.innerHTML = `<img src="${imgPath}" alt="Care">`;

    const overlay = document.createElement("div");
    overlay.className = "cc-overlay";
    overlay.id = "customerCareOverlay";

    overlay.innerHTML = `
        <div class="cc-card">
            <div class="cc-close" id="closeCC">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
            <div class="cc-header">
                <div class="cc-subtitle">Technical Assistance</div>
                <div class="cc-title">Customer Care</div>
            </div>
            
            <div class="cc-list">
                <div class="cc-item">
                    <div class="cc-priority">Priority 1</div>
                    <div class="cc-info-row"><div class="cc-icon">${phoneIcon}</div> 9059068384</div>
                    <div class="cc-email">ravindarraodevarneni@gmail.com</div>
                </div>

                <div class="cc-item">
                    <div class="cc-priority">Priority 2</div>
                    <div class="cc-info-row"><div class="cc-icon">${phoneIcon}</div> 9154267518</div>
                    <div class="cc-email">vcccricket7@gmail.com</div>
                </div>

                <div class="cc-item">
                    <div class="cc-priority">Priority 3</div>
                    <div class="cc-info-row"><div class="cc-icon">${phoneIcon}</div> 9391691094</div>
                    <div class="cc-email">beesociety101@gmail.com</div>
                </div>

                <div class="cc-item">
                    <div class="cc-priority">Priority 4</div>
                    <div class="cc-info-row"><div class="cc-icon">${phoneIcon}</div> 7569064222</div>
                    <div class="cc-email">maniikantareddy033@gmail.com</div>
                </div>
            </div>

            <div class="cc-socials">
                <a href="https://instagram.com/vars.101" target="_blank" class="cc-social-link">Instagram @vars.101</a>
                <a href="https://instagram.com/beesociety101" target="_blank" class="cc-social-link">@beesociety101</a>
            </div>
        </div>
    `;

    document.body.appendChild(floatBtn);
    document.body.appendChild(overlay);

    // 3. Event Listeners
    floatBtn.addEventListener("click", () => {
        overlay.classList.add("active");
    });

    document.getElementById("closeCC").addEventListener("click", () => {
        overlay.classList.remove("active");
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            overlay.classList.remove("active");
        }
    });

})();
