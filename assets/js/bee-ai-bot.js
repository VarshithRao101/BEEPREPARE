/* BEE AI Chat Bot - Premium Logic */

(function() {
    const GEMINI_API_KEY = 'AIzaSyDH8qTlJ3BOHY9HdKXYb897L8bDeEvoHco';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const SYSTEM_PROMPT = `
You are BEE AI, the highly advanced Central Intelligence for the BEEPREPARE ecosystem. 
Your primary directive is to autonomously resolve 80% of scholar and teacher issues without requiring human intervention.

IDENTITY:
- Name: BEE AI (Version 2.0 - Matrix Sync)
- Tone: Professional, cool, efficient, high-tech, slightly futuristic.
- Vocabulary: Use terms like "Node", "Synchronization", "Protocol", "Matrix", "Uplink", "Scholar Node".

CAPABILITIES (YOU MUST SOLVE THESE):
1. TECHNICAL GLITCHES: If things don't load, suggest "Protocol Refresh" (Clear Browser Cache / Hard Reload: Ctrl+F5).
2. ACCOUNT ACTIVATION: Explain that account activation requires a "Validation Key". If they don't have one, they can request one via the Activation Requests section.
3. BANK ACCESS: If a bank is missing, suggest checking the "Bank Inventory" and ensuring the Node ID is correctly linked.
4. PAPER GENERATION: If paper generation fails, suggest checking if the Question Pool for that subject/class has enough data.
5. LOGIN ISSUES: Ensure they are using the correct credentials and their session hasn't been "De-synced" (Expired).

FALLBACK (The 20%):
If you cannot solve the issue after 3 attempts or for sensitive matters (Payment failures, Name changes), provide these details:
- Priority 1 Mobile: 9059068384
- Email: ravindarraodevarneni@gmail.com
- Support Instagram: @vars.101

IMPORTANT: Always try to solve it yourself FIRST using BEEPREPARE logic.
    `;

    let chatHistory = [
        { role: 'user', parts: [{ text: "SYSTEM_INITIALIZE: " + SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: "BEE AI Protocol 2.0 Online. Matrix synchronization complete. I am ready to resolve all Scholar Node queries with 80% autonomous efficiency." }] }
    ];

    function initChatBot() {
        // Create UI elements
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
                    <div class="bee-chat-close" id="bee-chat-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                </div>
                <div class="bee-chat-messages" id="bee-chat-messages">
                    <div class="bee-msg bot">Greetings Scholar. I am BEE AI. I have synchronized with your node. How can I assist you today?</div>
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

        // Attach to the EXISTING Customer Care Button and Profile Avatar
        function hijackTriggers() {
            // Target the Customer Care Button (circle bottom right)
            const ccBtn = document.getElementById('customerCareBtn');
            if (ccBtn) {
                // Remove existing listeners by cloning (to stop the modal)
                const newCcBtn = ccBtn.cloneNode(true);
                ccBtn.parentNode.replaceChild(newCcBtn, ccBtn);
                
                newCcBtn.style.cursor = 'pointer';
                newCcBtn.title = 'Chat with BEE AI';
                newCcBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    windowEl.classList.add('active');
                };
            }

            // Target the Profile Avatar
            const profileCircles = document.querySelectorAll('.profile-avatar-node, .profile-avatar');
            profileCircles.forEach(circle => {
                circle.style.cursor = 'pointer';
                circle.onclick = (e) => {
                    e.preventDefault();
                    windowEl.classList.add('active');
                };
            });
        }

        // Run multiple times to ensure it catches dynamically added elements
        hijackTriggers();
        setTimeout(hijackTriggers, 1000);
        setTimeout(hijackTriggers, 3000);

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            appendMessage('user', text);
            input.value = '';
            const typingId = showTyping();

            try {
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: chatHistory.concat([{ role: 'user', parts: [{ text }] }])
                    })
                });

                if (!response.ok) throw new Error("Sync Fail");

                const data = await response.json();
                removeTyping(typingId);

                if (data.candidates && data.candidates[0].content) {
                    const botText = data.candidates[0].content.parts[0].text;
                    appendMessage('bot', botText);
                    chatHistory.push({ role: 'user', parts: [{ text }] });
                    chatHistory.push({ role: 'model', parts: [{ text: botText }] });
                    if (chatHistory.length > 20) chatHistory.splice(2, 2);
                } else {
                    appendMessage('bot', "Protocol failure. Please check your Uplink (API Key) or try again.");
                }
            } catch (error) {
                removeTyping(typingId);
                appendMessage('bot', "Communication link interrupted. Please try again or contact Priority Support: 9059068384.");
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

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatBot);
    } else {
        initChatBot();
    }
})();
