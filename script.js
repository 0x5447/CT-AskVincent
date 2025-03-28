// Configuration
const WORKER_URL = 'https://msochat.optimistprojects.workers.dev';

// Chat-specific logic
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatbox = document.getElementById('chatbox');
const chatTitle = document.querySelector('.chat-title');
const turnstileWidget = document.querySelector('.cf-turnstile');

if (turnstileWidget) {
    turnstileWidget.style.display = 'none'; // Hide Turnstile explicitly
}

let chatHistory = [];
let lastMessageTime = 0;
const RATE_LIMIT_MS = 3000;
let isVerified = true; // Bypassing Turnstile
let isFirstMessage = true;

if (form && input && chatbox) {
    console.log('Form, input, and chatbox found. Attaching event listener.');
    form.addEventListener('submit', async (e) => {
        console.log('Form submitted');
        e.preventDefault(); // Ensure no default form action
        const userMessage = input.value.trim();
        if (!userMessage) {
            console.log('Empty message, aborting');
            return;
        }

        const now = Date.now();
        if (now - lastMessageTime < RATE_LIMIT_MS) {
            console.log('Rate limit hit');
            addMessage('bot', '⚠️ Please wait a few seconds before sending another message.');
            return;
        }
        lastMessageTime = now;

        console.log('Adding user message:', userMessage);
        addMessage('user', userMessage);
        chatHistory.push({ sender: 'You', message: userMessage, timestamp: new Date().toLocaleString() });
        console.log('Clearing input');
        input.value = '';
        form.querySelector('.send-button').disabled = true;

        if (isFirstMessage && chatTitle) {
            console.log('Hiding chat title');
            chatTitle.classList.add('hidden');
            isFirstMessage = false;
        }

        console.log('Adding loading message');
        const loadingMessage = addMessage('bot', '<span class="loading-dots">...</span>', true);

        try {
            const url = `${WORKER_URL}?query=${encodeURIComponent(userMessage)}`;
            console.log('Fetching from:', url);

            const response = await fetch(url, {
                method: 'GET',
            }).catch(err => {
                console.error('Fetch failed:', err, 'URL:', url);
                throw new Error(`Network error: ${err.message}`);
            });

            console.log('Response status:', response.status, 'OK:', response.ok);
            console.log('Response headers:', [...response.headers.entries()]);
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
                                console.log('Updating with:', content);
                                updateMessage(loadingMessage, content);
                                if (content && loadingMessage.querySelector('.loading-dots')) {
                                    loadingMessage.querySelector('.loading-dots').remove();
                                }
                            }
                        } catch (e) {
                            console.error('Parse error:', e, 'Line:', dataLine);
                        }
                    }
                }

                if (!content) {
                    console.log('No content received');
                    updateMessage(loadingMessage, '⚠️ No response received');
                } else {
                    chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
                }
            } else {
                content = await response.text();
                console.log('Non-stream response:', content);
                updateMessage(loadingMessage, content || 'Unexpected response format');
            }
        } catch (error) {
            console.error('Caught error:', error);
            updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
        } finally {
            console.log('Re-enabling button');
            form.querySelector('.send-button').disabled = false;
            input.focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('Enter key pressed');
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    });
} else {
    console.error('Form, input, or chatbox missing!');
}

// Helper Functions
function addMessage(sender, text, isHTML = false) {
    console.log('Adding message:', sender, text);
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
    console.log('Updating message with:', text);
    const content = element.querySelector('.message-content');
    content.innerHTML = text;
    chatbox.scrollTop = chatbox.scrollHeight;
}
