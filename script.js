// Configuration
const WORKER_URL = 'https://ctguide.optimistprojects.workers.dev';
const BACKGROUND_IMAGES = [
    'https://raw.githubusercontent.com/0xTG/venice-mso/main/VeniceAI_Vf7NGoK.webp',
    'https://raw.githubusercontent.com/0xTG/venice-mso/main/VeniceAI_jXw0mwJ.webp',
    'https://raw.githubusercontent.com/0xTG/venice-mso/main/VeniceAI_sFkAxgA.webp'
];
const SUGGESTED_PROMPTS = [
    "What’s the best pizza in Hartford?",
    "Top parks near Bristol?",
    "Fun things to do in New Haven?",
    "Where’s the best seafood in Mystic?",
    "Hidden gems in Connecticut?",
    "Best hiking trails near Stamford?",
    "What’s on in Hartford this weekend?",
    "Cool museums in Connecticut?"
];

// Background System (Preload and Rotate)
BACKGROUND_IMAGES.forEach(url => new Image().src = url);

function rotateBackground() {
    document.body.style.backgroundImage = `url(${BACKGROUND_IMAGES[bgIndex]})`;
    bgIndex = (bgIndex + 1) % BACKGROUND_IMAGES.length;
}

let bgIndex = 0;
rotateBackground();
setInterval(rotateBackground, 30000);

// Chat-specific logic
const form = document.getElementById('chat-form');
const input = document.getElementById('input');
const chatbox = document.getElementById('chatbox');
const turnstileWidget = document.querySelector('.cf-turnstile');
let chatHistory = [];
let lastMessageTime = 0;
const RATE_LIMIT_MS = 3000;
let isVerified = false;

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
        form.querySelector('.ask-btn').disabled = true;

        const loadingMessage = addMessage('bot', '<span class="loading-dots"></span>', true);

        try {
            let token = null;
            if (!isVerified) {
                token = turnstileWidget.getAttribute('data-response') || 
                        (typeof turnstile !== 'undefined' ? await turnstile.getResponse('.cf-turnstile') : null);

                if (!token) {
                    throw new Error('Please verify you are human first');
                }
            }

            const url = isVerified 
                ? `${WORKER_URL}?query=${encodeURIComponent(userMessage)}` 
                : `${WORKER_URL}?query=${encodeURIComponent(userMessage)}&cfToken=${encodeURIComponent(token)}`;

            const response = await fetch(url, {
                headers: { 'Content-Type': 'application/json' }
            });

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
                const content = data.reply || 'No reply provided';
                updateMessage(loadingMessage, formatText(content));
                chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
            } else {
                throw new Error('Unexpected response format');
            }

            if (!isVerified && token) {
                isVerified = true;
                turnstileWidget.style.display = 'none';
            }
        } catch (error) {
            updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
            console.error('Submission error:', error);
        } finally {
            form.querySelector('.ask-btn').disabled = false;
            input.focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });
}

// Dynamic Suggested Prompts
function updateSuggestedPrompts() {
    const container = document.getElementById('suggested-prompts');
    if (!container) return;
    container.innerHTML = '';
    const shuffled = [...SUGGESTED_PROMPTS].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);
    selected.forEach(prompt => {
        const button = document.createElement('button');
        button.textContent = prompt;
        button.onclick = () => usePrompt(prompt);
        container.appendChild(button);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('suggested-prompts')) {
        updateSuggestedPrompts();
        setInterval(updateSuggestedPrompts, 30000);
    }
});

// Helper Functions
function addMessage(sender, text, isHTML = false) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;

    if (sender === 'bot') {
        const icon = document.createElement('img');
        icon.src = 'https://raw.githubusercontent.com/TGrahamGit/venice-mso/refs/heads/main/icon.png';
        icon.alt = 'Bot Icon';
        icon.className = 'bot-icon';
        div.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'message-content';
        isHTML ? content.innerHTML = text : content.textContent = text;
        div.appendChild(content);
    } else {
        isHTML ? div.innerHTML = text : div.textContent = text;
    }

    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
    return div;
}

function updateMessage(element, text) {
    const content = element.querySelector('.message-content');
    content.innerHTML = text;
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

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.startsWith('```')) {
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

        if (line.match(/^#{1,3}\s/)) {
            closePendingElements();
            const level = line.match(/^#+/)[0].length;
            const content = line.replace(/^#+\s/, '');
            html += `<h${level}>${inlineFormat(content)}</h${level}>`;
            continue;
        }

        if (line.match(/^\d+\.\s+/)) {
            if (!inOrderedList) closePendingElements();
            inOrderedList = true;
            inUnorderedList = false;
            listItems.push(`<li>${inlineFormat(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        }

        if (line.match(/^[-*]\s+/)) {
            if (!inUnorderedList) closePendingElements();
            inUnorderedList = true;
            inOrderedList = false;
            listItems.push(`<li>${inlineFormat(line.replace(/^[-*]\s+/, ''))}</li>`);
            continue;
        }

        if (line.startsWith('>')) {
            if (!inBlockquote) closePendingElements();
            inBlockquote = true;
            blockquoteLines.push(inlineFormat(line.replace(/^>\s*/, '')));
            continue;
        }

        if (line && !inOrderedList && !inUnorderedList && !inBlockquote) {
            closePendingElements();
            html += `<p>${inlineFormat(line)}</p>`;
        } else if (!line && (inOrderedList || inUnorderedList || inBlockquote)) {
            closePendingElements();
        }
    }

    closePendingElements();

    return html || text;

    function closePendingElements() {
        if (listItems.length) {
            html += (inOrderedList ? '<ol>' : '<ul>') + listItems.join('') + (inOrderedList ? '</ol>' : '</ul>');
            listItems = [];
            inOrderedList = false;
            inUnorderedList = false;
        }
        if (blockquoteLines.length) {
            html += `<blockquote>${blockquoteLines.join('<br>')}</blockquote>`;
            blockquoteLines = [];
            inBlockquote = false;
        }
    }

    function inlineFormat(text) {
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/__(.*?)__/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/_(.*?)_/g, '<em>$1</em>');
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        return text;
    }
}

function downloadChat() {
    if (!chatHistory.length) {
        alert('No chat history to download yet!');
        return;
    }
    const date = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const filename = `CT Guide - Saved Chat ${date}.txt`;
    
    let formattedChat = '=== Connecticut AI Guide Chat ===\n';
    formattedChat += `Saved on: ${date}\n\n`;
    chatHistory.forEach(entry => {
        formattedChat += `[${entry.timestamp}] ${entry.sender}:\n`;
        formattedChat += `${entry.message}\n`;
        formattedChat += '------------------------\n\n';
    });
    formattedChat += '=== End of Chat ===\n';

    const blob = new Blob([formattedChat], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function usePrompt(text) {
    if (input) {
        input.value = text;
        form.dispatchEvent(new Event('submit'));
    }
}
