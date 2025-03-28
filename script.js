// Configuration
const WORKER_URL = 'https://msochat.optimistprojects.workers.dev';

// Chat-specific logic
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatbox = document.getElementById('chatbox');
const chatTitle = document.querySelector('.chat-title');
const turnstileWidget = document.querySelector('.cf-turnstile');
let chatHistory = [];
let lastMessageTime = 0;
const RATE_LIMIT_MS = 3000;
let isVerified = false; // Persists across submissions
let isFirstMessage = true;
let turnstileToken = null;

// Turnstile callback
window.onTurnstileSuccess = (token) => {
    console.log('Turnstile verified, token:', token);
    turnstileToken = token;
    isVerified = true;
    turnstileWidget.style.display = 'none'; // Hide permanently after success
};

if (form && input && chatbox) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userMessage = input.value.trim();
        if (!userMessage) return;

        const now = Date.now();
        if (now - lastMessageTime < RATE_LIMIT_MS) {
            addMessage('bot', '⚠️ Please wait a few seconds before sending another message.');
            return;
        }
        lastMessageTime = now;

        console.log('User message:', userMessage);
        addMessage('user', userMessage);
        chatHistory.push({ sender: 'You', message: userMessage, timestamp: new Date().toLocaleString() });
        input.value = '';
        form.querySelector('.send-button').disabled = true;

        if (isFirstMessage && chatTitle) {
            chatTitle.classList.add('hidden');
            isFirstMessage = false;
        }

        const loadingMessage = addMessage('bot', '<span class="loading-dots">...</span>', true);

        try {
            if (!isVerified && !turnstileToken) {
                throw new Error('Please complete the verification first.');
            }

            const requestBody = {
                query: userMessage,
            };
            // Only include cfToken on first request
            if (!isVerified) {
                requestBody.cfToken = turnstileToken;
            }
            console.log('Sending request to:', WORKER_URL, 'with body:', requestBody);

            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            }).catch(err => {
                throw new Error(`Network error: ${err.message}`);
            });

            console.log('Response status:', response.status, 'OK:', response.ok);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
                throw new Error(`Server error: ${response.status} - ${errorData.error || 'No details provided'}`);
            }

            const contentType = response.headers.get('content-type');
            console.log('Content-Type:', contentType);

            let content = '';
            if (contentType?.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const events = buffer.split('\n\n');
                    buffer = events.pop();

                    for (const event of events) {
                        const dataLine = event.split('\n').find(line => line.startsWith('data:'));
                        if (!dataLine) continue;

                        try {
                            const data = JSON.parse(dataLine.slice(5));
                            if (data.choices?.[0]?.delta?.content) {
                                content += data.choices[0].delta.content;
                                updateMessage(loadingMessage, content);
                                if (loadingMessage.querySelector('.loading-dots')) {
                                    loadingMessage.querySelector('.loading-dots').remove();
                                }
                            }
                        } catch (e) {
                            console.error('Stream parse error:', e);
                        }
                    }
                }
            } else {
                content = await response.text();
                updateMessage(loadingMessage, content || 'No response received');
            }

            if (!content) throw new Error('Empty response from server');
            chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
        } catch (error) {
            console.error('Detailed error:', error);
            updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
            // Don’t reset Turnstile unless explicitly needed
            if (error.message.includes('Turnstile')) {
                isVerified = false;
                turnstileToken = null;
                turnstileWidget.style.display = 'block'; // Only reset if Turnstile fails
                if (typeof turnstile !== 'undefined') turnstile.reset();
            }
        } finally {
            form.querySelector('.send-button').disabled = false;
            input.focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    });
}

// Helper Functions
function addMessage(sender, text, isHTML = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    if (isHTML) content.innerHTML = text;
    else content.textContent = text;
    div.appendChild(content);
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
    return div;
}

function updateMessage(element, text) {
    const content = element.querySelector('.message-content');
    content.innerHTML = text;
    chatbox.scrollTop = chatbox.scrollHeight;
}
