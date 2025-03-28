const WORKER_URL = 'https://msochat.optimistprojects.workers.dev';

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatbox = document.getElementById('chatbox');
const turnstileWidget = document.querySelector('.cf-turnstile');
let isVerified = false;
let chatHistory = [];
let turnstileToken = null;

// Turnstile callback
window.onTurnstileSuccess = (token) => {
    console.log('Turnstile success, token:', token);
    turnstileToken = token;
    isVerified = true;
    if (turnstileWidget) turnstileWidget.style.display = 'none';
};

function addMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text;
    div.appendChild(content);
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
    return div;
}

async function sendMessage(userMessage) {
    console.log('Sending message:', userMessage);
    addMessage('user', userMessage);
    chatHistory.push({ sender: 'You', message: userMessage, timestamp: new Date().toLocaleString() });

    const loadingMessage = addMessage('bot', '<span class="loading-dots">...</span>');
    form.querySelector('.send-button').disabled = true;

    try {
        let url = `${WORKER_URL}?query=${encodeURIComponent(userMessage)}`;
        if (!isVerified && turnstileToken) {
            url += `&cfToken=${encodeURIComponent(turnstileToken)}`;
            console.log('Using token:', turnstileToken);
        } else if (!isVerified) {
            console.log('No token yet, attempting without cfToken');
        } else {
            console.log('Verified, skipping cfToken');
        }
        console.log('Fetching:', url);

        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
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
                    const data = JSON.parse(dataLine.slice(5));
                    if (data.choices?.[0]?.delta?.content) {
                        content += data.choices[0].delta.content;
                        loadingMessage.querySelector('.message-content').innerHTML = content;
                        if (loadingMessage.querySelector('.loading-dots')) {
                            loadingMessage.querySelector('.loading-dots').remove();
                        }
                    }
                }
            }
        } else {
            content = await response.text();
            loadingMessage.querySelector('.message-content').innerHTML = content || 'No response';
        }

        if (!isVerified && turnstileToken) {
            isVerified = true;
            if (turnstileWidget) turnstileWidget.style.display = 'none';
        }
        chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
    } catch (error) {
        console.error('Error:', error);
        loadingMessage.querySelector('.message-content').innerHTML = `⚠️ ${error.message}`;
        if (error.message.includes('verification') && turnstileWidget) {
            turnstileWidget.style.display = 'block'; // Show again if verification fails
        }
    } finally {
        form.querySelector('.send-button').disabled = false;
        input.focus();
    }
}

if (form && input && chatbox) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = input.value.trim();
        if (message) {
            sendMessage(message);
            input.value = '';
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${input.scrollHeight}px`;
    });
} else {
    console.error('Missing critical elements!');
}
