// Configuration
const WORKER_URL = 'https://ctguide.optimistprojects.workers.dev';
const SUGGESTED_PROMPTS = [
    "What services do you offer?",
    "How much to design my website?",
    "How can I contact you?",
];

// Chat-specific logic
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatbox = document.getElementById('chatbox');
const chatTitle = document.querySelector('.chat-title');
let chatHistory = [];
let lastMessageTime = 0;
const RATE_LIMIT_MS = 3000;
let isVerified = false;
let isFirstMessage = true;
let turnstileToken = null;

// Turnstile callback
window.onTurnstileSuccess = (token) => {
    turnstileToken = token;
    isVerified = true;
    document.querySelector('.cf-turnstile').style.display = 'none';
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

        const timestamp = new Date().toLocaleString();
        addMessage('user', userMessage);
        chatHistory.push({ sender: 'You', message: userMessage, timestamp });
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

            const url = isVerified
                ? `${WORKER_URL}?query=${encodeURIComponent(userMessage)}`
                : `${WORKER_URL}?query=${encodeURIComponent(userMessage)}&cfToken=${encodeURIComponent(turnstileToken)}`;

            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let content = '';

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
                                updateMessage(loadingMessage, formatText(content));
                                if (content && loadingMessage.querySelector('.loading-dots')) {
                                    loadingMessage.querySelector('.loading-dots').remove();
                                }
                            }
                        } catch (e) {
                            console.error('Stream parse error:', e);
                        }
                    }
                }

                if (!content) throw new Error('No response received');
                chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
            } else if (contentType?.includes('application/json')) {
                const data = await response.json();
                const content = data.reply || 'No reply provided';
                updateMessage(loadingMessage, formatText(content));
                chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
            console.error('Submission error:', error);
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
    content.innerHTML = formatText(text);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function formatText(text) {
    const lines = text.split('\n');
    let html = '';
    let inOrderedList = false;
    let inUnorderedList = false;
    let inCodeBlock = false;
    let inBlockquote = false;
    let listItems = [];
    let codeBlockContent = [];
    let blockquoteLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
                closePendingElements();
                inCodeBlock = true;
            } else {
                html += `<pre><code>${codeBlockContent.join('\n')}</code></pre>`;
                codeBlockContent = [];
                inCodeBlock = false;
            }
            continue;
        }
        if (inCodeBlock) {
            codeBlockContent.push(line);
            continue;
        }

        if (trimmed.match(/^#{1,3}\s/)) {
            closePendingElements();
            const level = trimmed.match(/^#+/)[0].length;
            const content = trimmed.replace(/^#+\s/, '');
            html += `<h${level}>${inlineFormat(content)}</h${level}>`;
            continue;
        }

        if (trimmed.match(/^\d+\.\s/)) {
            if (!inOrderedList) closePendingElements();
            inOrderedList = true;
            listItems.push(`<li>${inlineFormat(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
            continue;
        }

        if (trimmed.match(/^[-*]\s/)) {
            if (!inUnorderedList) closePendingElements();
            inUnorderedList = true;
            listItems.push(`<li>${inlineFormat(trimmed.replace(/^[-*]\s/, ''))}</li>`);
            continue;
        }

        if (trimmed.startsWith('>')) {
            if (!inBlockquote) closePendingElements();
            inBlockquote = true;
            blockquoteLines.push(inlineFormat(trimmed.replace(/^>\s*/, '')));
            continue;
        }

        if (trimmed) {
            closePendingElements();
            html += `<p>${inlineFormat(trimmed)}</p>`;
        }
    }

    closePendingElements();
    return html || text;

    function closePendingElements() {
        if (listItems.length) {
            html += inOrderedList ? `<ol>${listItems.join('')}</ol>` : `<ul>${listItems.join('')}</ul>`;
            listItems = [];
            inOrderedList = inUnorderedList = false;
        }
        if (blockquoteLines.length) {
            html += `<blockquote>${blockquoteLines.join('<br>')}</blockquote>`;
            blockquoteLines = [];
            inBlockquote = false;
        }
    }

    function inlineFormat(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    }
}
