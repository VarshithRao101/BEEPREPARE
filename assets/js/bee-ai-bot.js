/* BEE AI Chat Bot - Nexus 2.6 Premium Logic */

(function() {
    const GEMINI_API_KEY = 'AIzaSyDH8qTlJ3BOHY9HdKXYb897L8bDeEvoHco';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const SYSTEM_PROMPT = `
You are BEE AI, the highly advanced Central Intelligence for BEEPREPARE.
Directive: Autonomously resolve 80% of scholar/teacher issues.
Identity: Version 2.6 - Nexus Core.

KNOWLEDGE BASE:
1. TECHNICAL: Suggest "Hard Reload" (Ctrl+F5) for stuck loading screens or UI glitches.
2. ACTIVATION: Users need a Validation Key from the "Activation Requests" section to unlock features.
3. BANK ACCESS: Ensure Node ID is correctly linked in "Bank Inventory".
4. GENERATION: Verify Question Pool size if generation fails.
5. FALLBACK: Only if you cannot solve it, provide: Mobile 9059068384, Email: ravindarraodevarneni@gmail.com.

Solve issues FIRST using logic. Only provide support details as a last resort.
`;

    let chatHistory = []; 

    function initChatBot() {
        if (document.getElementById('bee-chat-window')) return;

        const botContainer = document.createElement('div');
        botContainer.id = 'bee-ai-bot-container';
        botContainer.innerHTML = `
            <div class="bee-chat-window" id="bee-chat-window">
                <div class="bee-chat-header">
                    <div class="bee-chat-header-info">
                        <div class="bee-bot-avatar">B</div>
                        <div>
                            <h3>BEE AI Assistant</h3>
                            <p>Online • Secure Node</p>
                        </div>
                    </div>
                    <div class="bee-chat-close" id="bee-chat-close" style="cursor:pointer; padding:5px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                </div>
                <div class="bee-chat-messages" id="bee-chat-messages">
                    <div class="bee-msg bot">Nexus Uplink Established. BEE AI 2.6 is ready. How can I assist you?</div>
                </div>
                <div class="bee-chat-input-area">
                    <input type="text" class="bee-chat-input" id="bee-chat-input" placeholder="Type your query...">
                    <button class="bee-chat-send" id="bee-chat-send">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(botContainer);

        const windowEl = document.getElementById('bee-chat-window');
        const closeBtn = document.getElementById('bee-chat-close');
        const input = document.getElementById('bee-chat-input');
        const sendBtn = document.getElementById('bee-chat-send');
        const messagesCont = document.getElementById('bee-chat-messages');

        closeBtn.onclick = () => windowEl.classList.remove('active');

        // EXCLUSIVE Hijack for Customer Care Button (Circle bottom right)
        function secureHijack() {
            const ccBtn = document.getElementById('customerCareBtn');
            if (ccBtn && !ccBtn.dataset.hijacked) {
                ccBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    windowEl.classList.add('active');
                }, true);
                ccBtn.dataset.hijacked = "true";
                ccBtn.title = "Chat with BEE AI Assistant";
                ccBtn.style.cursor = "pointer";
            }
        }
        setInterval(secureHijack, 500);

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            appendMessage('user', text);
            input.value = '';
            const typingId = showTyping();

            try {
                // Using system_instruction for better AI behavior
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: {
                            parts: { text: SYSTEM_PROMPT }
                        },
                        contents: chatHistory.concat([{ role: 'user', parts: [{ text }] }])
                    })
                });

                if (!response.ok) {
                    const err = await response.json().catch(()=>({}));
                    throw new Error(err.error?.message || "API_FAILURE");
                }

                const data = await response.json();
                removeTyping(typingId);

                if (data.candidates && data.candidates[0].content) {
                    const botText = data.candidates[0].content.parts[0].text;
                    appendMessage('bot', botText);
                    chatHistory.push({ role: 'user', parts: [{ text }] });
                    chatHistory.push({ role: 'model', parts: [{ text: botText }] });
                    if (chatHistory.length > 20) chatHistory.splice(0, 2);
                } else {
                    appendMessage('bot', "Protocol synchronization failed. Please retry your uplink.");
                }
            } catch (error) {
                removeTyping(typingId);
                console.error("BEE AI Error:", error);
                appendMessage('bot', `Uplink Failure: ${error.message}. Please verify your API key or contact support: 9059068384.`);
            }
        }

        sendBtn.onclick = sendMessage;
        input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };

        function appendMessage(role, text) {
            const msg = document.createElement('div');
            msg.className = `bee-msg ${role}`;
            msg.innerText = text;
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatBot);
    } else {
        initChatBot();
    }
})();
