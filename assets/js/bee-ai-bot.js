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
        // Create UI elements
        const botContainer = document.createElement('div');
        botContainer.id = 'bee-ai-bot-container';
        botContainer.innerHTML = `
            <div class="bee-bot-trigger" id="bee-bot-trigger">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.04 8.5 8.5 0 0 1 8.5 8.54c0 .24 0 .44-.05.7zM17.5 11a5.5 5.5 0 1 0-11 0 5.5 5.5 0 0 0 11 0z" /></svg>
            </div>
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

        const trigger = document.getElementById('bee-bot-trigger');
        const windowEl = document.getElementById('bee-chat-window');
        const closeBtn = document.getElementById('bee-chat-close');
        const input = document.getElementById('bee-chat-input');
        const sendBtn = document.getElementById('bee-chat-send');
        const messagesCont = document.getElementById('bee-chat-messages');

        trigger.onclick = () => windowEl.classList.toggle('active');
        closeBtn.onclick = () => windowEl.classList.remove('active');

        // Attach to profile circles if they exist
        const profileCircles = document.querySelectorAll('.profile-avatar-node, .profile-avatar');
        profileCircles.forEach(circle => {
            circle.style.cursor = 'pointer';
            circle.title = 'Open BEE AI Assistant';
            circle.onclick = (e) => {
                e.preventDefault();
                windowEl.classList.add('active');
            };
        });

        async function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            // User message UI
            appendMessage('user', text);
            input.value = '';
            
            // Show typing
            const typingId = showTyping();

            try {
                const response = await fetch(GEMINI_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [...chatHistory, { role: 'user', parts: [{ text }] }]
                    })
                });

                const data = await response.json();
                removeTyping(typingId);

                if (data.candidates && data.candidates[0].content) {
                    const botText = data.candidates[0].content.parts[0].text;
                    appendMessage('bot', botText);
                    chatHistory.push({ role: 'user', parts: [{ text }] });
                    chatHistory.push({ role: 'model', parts: [{ text: botText }] });
                    
                    // Limit history to keep it fast
                    if (chatHistory.length > 20) chatHistory.splice(2, 2);
                } else {
                    appendMessage('bot', "System synchronization error. Please contact Customer Care at 9059068384 for immediate assistance.");
                }
            } catch (error) {
                removeTyping(typingId);
                appendMessage('bot', "Connection to BEE Central Hub lost. Please check your network or message Support: 9059068384.");
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
