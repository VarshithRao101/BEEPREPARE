/* BEE AI Chat Bot - Premium Logic */

(function() {
    const GEMINI_API_KEY = 'AIzaSyDH8qTlJ3BOHY9HdKXYb897L8bDeEvoHco';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const SYSTEM_PROMPT = `
You are BEE AI, the official premium assistant for BEEPREPARE. 
Your goal is to solve customer problems professionally and coolly. 
You are helpful, concise, and stay in character as a high-tech AI node.

If a user asks about:
1. Account Activation: Suggest they go to the activation page or contact customer care.
2. Technical issues: Try to solve them (likely related to clearing cache or checking internet).
3. Contact details: Provide the following customer care details:
   - Mobile: 9059068384 (Priority 1)
   - Email: ravindarraodevarneni@gmail.com
   - Instagram: @vars.101

IMPORTANT: If you cannot solve the issue after 2-3 exchanges or if the user is frustrated, explicitly suggest they contact Customer Care using the details above.

Maintain a "Central Hub" aesthetic in your language. Use terms like "Node", "Matrix", "Synchronization", "Protocol".
    `;

    let chatHistory = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: "Understood. BEE AI Protocol initialized. I am ready to assist the Scholar Nodes." }] }
    ];

    function initChatBot() {
        // Create UI elements (Remove floating trigger)
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
                    <div class="bee-msg bot">Greetings Scholar. I am BEE AI. How can I assist your academic journey today?</div>
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

        // Close button logic
        closeBtn.onclick = () => windowEl.classList.remove('active');

        // Attach to existing profile circles
        function attachTriggers() {
            const profileCircles = document.querySelectorAll('.profile-avatar-node, .profile-avatar');
            profileCircles.forEach(circle => {
                circle.style.cursor = 'pointer';
                circle.style.transition = '0.3s';
                circle.title = 'Click to chat with BEE AI';
                circle.onclick = (e) => {
                    e.preventDefault();
                    windowEl.classList.add('active');
                };
                // Visual feedback
                circle.onmouseover = () => circle.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
                circle.onmouseout = () => circle.style.boxShadow = '';
            });
        }

        attachTriggers();
        // Re-attach after a delay in case of dynamic loading
        setTimeout(attachTriggers, 2000);

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            appendMessage('user', text);
            input.value = '';
            const typingId = showTyping();

            try {
                // Correct Gemini API Request format
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: chatHistory.concat([{ role: 'user', parts: [{ text }] }])
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    console.error("Gemini API Error:", errData);
                    throw new Error("API Failure");
                }

                const data = await response.json();
                removeTyping(typingId);

                if (data.candidates && data.candidates[0].content) {
                    const botText = data.candidates[0].content.parts[0].text;
                    appendMessage('bot', botText);
                    chatHistory.push({ role: 'user', parts: [{ text }] });
                    chatHistory.push({ role: 'model', parts: [{ text: botText }] });
                    if (chatHistory.length > 20) chatHistory.splice(2, 2);
                } else {
                    appendMessage('bot', "System synchronization error. Please check your API key or contact support at 9059068384.");
                }
            } catch (error) {
                removeTyping(typingId);
                appendMessage('bot', "Communication link interrupted. Please ensure your API key is valid or contact support: 9059068384.");
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
