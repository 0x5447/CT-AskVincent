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
let isVerified = true; // Temporarily bypass Turnstile for testing
let isFirstMessage = true;

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
            // Temporarily disable Turnstile for testing
            /*
            let token = null;
            if (!isVerified) {
                token = turnstileWidget.getAttribute('data-response') || 
                        (typeof turnstile !== 'undefined' ? await turnstile.getResponse('.cf-turnstile') : null);
                if (!token) {
                    throw new Error('Please verify you are human first');
                }
                console.log('Turnstile token:', token);
            }
            */

            const url = `${WORKER_URL}?query=${encodeURIComponent(userMessage)}`; // No cfToken for now
            console.log('Fetching from:', url);

            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
            }).catch(err => {
                console.error('Raw fetch error:', err);
                throw new Error(`Network error: ${err.message}`);
            });

            console.log('Response status:', response.status, 'OK:', response.ok);
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorMessage = 'Unknown error';
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.error || `HTTP Error: ${response.status}`;
                } else {
                    errorMessage = await response.text() || `HTTP Error: ${response.status}`;
                }
                throw new Error(errorMessage);
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
                                if (content && loadingMessage.querySelector('.loading-dots')) {
                                    loadingMessage.querySelector('.loading-dots').remove();
                                }
                            }
                        } catch (e) {
                            console.error('Parse error:', e);
                        }
                    }
                }

                if (!content) {
                    updateMessage(loadingMessage, '⚠️ No response received');
                } else {
                    chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
                }
            } else if (contentType?.includes('application/json')) {
                const data = await response.json();
                content = data.reply || 'No reply provided';
                updateMessage(loadingMessage, content);
                chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
            } else {
                content = await response.text();
                updateMessage(loadingMessage, content || 'Unexpected response format');
            }

            /*
            if (!isVerified && token) {
                isVerified = true;
                turnstileWidget.style.display = 'none';
            }
            */
        } catch (error) {
            console.error('Submission error:', error);
            updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
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
