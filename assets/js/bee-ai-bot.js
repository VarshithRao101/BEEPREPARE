/* BEE AI Chat Bot - Nexus 2.8 Premium Hybrid Logic */

(function() {
    // ══════════════════════════════════════════════════════════════════════════════
    // 1. CONFIGURATION & STATE
    // ══════════════════════════════════════════════════════════════════════════════
    let chatHistory = []; 
    let isProcessing = false;

    // ══════════════════════════════════════════════════════════════════════════════
    // 2. CORE INITIALIZATION
    // ══════════════════════════════════════════════════════════════════════════════
    function initChatBot() {
        if (document.getElementById('bee-chat-window')) return;

        const botContainer = document.createElement('div');
        botContainer.id = 'bee-ai-bot-container';
        botContainer.innerHTML = `
            <div class="bee-chat-backdrop" id="bee-chat-backdrop"></div>
            <div class="bee-chat-window" id="bee-chat-window">
                <div class="bee-chat-header">
                    <div class="bee-chat-header-info">
                        <div class="bee-bot-avatar">B</div>
                        <div>
                            <h3>BEE AI Assistant</h3>
                            <p id="bee-bot-status">Online • Secure Node</p>
                        </div>
                    </div>
                    <div class="bee-chat-close" id="bee-chat-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                </div>
                <div class="bee-chat-messages" id="bee-chat-messages">
                    <div class="bee-msg bot">Nexus 2.8 Online. Uplink Stable. I am the BEE Support Assistant. How can I help with your account or technical issues today?</div>
                </div>
                <div class="bee-chat-input-area">
                    <div class="bee-input-wrapper">
                        <input type="text" class="bee-chat-input" id="bee-chat-input" placeholder="Ask about login, payments, account...">
                        <button class="bee-chat-send" id="bee-chat-send">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(botContainer);

        const windowEl = document.getElementById('bee-chat-window');
        const backdropEl = document.getElementById('bee-chat-backdrop');
        const closeBtn = document.getElementById('bee-chat-close');
        const input = document.getElementById('bee-chat-input');
        const sendBtn = document.getElementById('bee-chat-send');
        const messagesCont = document.getElementById('bee-chat-messages');
        const statusEl = document.getElementById('bee-bot-status');
        
        const toggleBottomNav = (show) => {
            const btmNav = document.querySelector('.nav-bottom');
            if (btmNav) {
                btmNav.style.display = show ? '' : 'none';
            }
        };

        const closeChat = () => {
            windowEl.classList.remove('active');
            backdropEl.classList.remove('active');
            toggleBottomNav(true);
        };

        closeBtn.onclick = closeChat;
        backdropEl.onclick = closeChat;

        // Hijack Customer Care Button
        function secureHijack() {
            const ccBtn = document.getElementById('customerCareBtn');

            const triggerBot = (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                windowEl.classList.add('active');
                backdropEl.classList.add('active');
                toggleBottomNav(false);
                setTimeout(() => input.focus(), 100);
                return false;
            };

            if (ccBtn && !ccBtn.dataset.hijacked) {
                ccBtn.addEventListener('click', triggerBot, true);
                ccBtn.addEventListener('touchstart', triggerBot, {passive: false});
                ccBtn.dataset.hijacked = "true";
                ccBtn.style.cursor = "pointer";
            }
        }
        setInterval(secureHijack, 1000);

        async function sendMessage() {
            const text = input.value.trim();
            if (!text || isProcessing) return;

            isProcessing = true;
            appendMessage('user', text);
            input.value = '';
            const typingId = showTyping();
            statusEl.innerText = "Processing Query...";
            statusEl.classList.add('processing');

            try {
                // Use /ai/support for free support bot
                const response = await window.apiCall('/ai/support', 'POST', { message: text }, true, false, false);

                removeTyping(typingId);
                statusEl.innerText = "Online";
                statusEl.classList.remove('processing');

                if (response && response.success) {
                    const botText = response.data.aiMessage;
                    appendMessage('bot', botText);
                } else {
                    const errorMsg = response?.message || "There was a problem processing your request.";
                    appendMessage('bot', `I am sorry, but I encountered an error: ${errorMsg}`);
                }
            } catch (error) {
                removeTyping(typingId);
                statusEl.innerText = "Connection Fault";
                console.error("BEE AI Error:", error);
                appendMessage('bot', `Uplink Failure: Neural link disrupted. Please retry in 30 seconds.`);
            } finally {
                isProcessing = false;
            }
        }

        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

        function appendMessage(role, text) {
            const msg = document.createElement('div');
            msg.className = `bee-msg ${role}`;
            
            // Render Markdown if marked is available
            if (role === 'bot' && window.marked) {
                msg.innerHTML = window.marked.parse(text);
            } else {
                msg.innerText = text;
            }
            
            messagesCont.appendChild(msg);
            messagesCont.scrollTop = messagesCont.scrollHeight;
        }

        function showTyping() {
            const id = 'typing-' + Date.now();
            const typing = document.createElement('div');
            typing.id = id;
            typing.className = 'bee-msg bot typing';
            typing.innerHTML = '<span></span><span></span><span></span>';
            messagesCont.appendChild(typing);
            messagesCont.scrollTop = messagesCont.scrollHeight;
            return id;
        }

        function removeTyping(id) {
            const el = document.getElementById(id);
            if (el) el.remove();
        }
    }

    // Delay initialization to ensure bee-core is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initChatBot, 500));
    } else {
        setTimeout(initChatBot, 500);
    }
})();
