// script.js

// ======================
// CONFIGURATION (ORIGINAL)
// ======================
const WORKER_URL = 'https://venice-chatbot.graham-business-ventures.workers.dev';
const BACKGROUND_IMAGES = [
    'https://raw.githubusercontent.com/TGrahamGit/venice-mso/main/VeniceAI_Vf7NGoK.webp',
    'https://raw.githubusercontent.com/TGrahamGit/venice-mso/main/VeniceAI_jXw0mwJ.webp',
    'https://raw.githubusercontent.com/TGrahamGit/venice-mso/main/VeniceAI_sFkAxgA.webp'
];

// ======================
// DOM ELEMENTS (ORIGINAL)
// ======================
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');
const aibutton = document.getElementById('aibutton');
let bgIndex = 0;

// ======================
// BACKGROUND SYSTEM (ORIGINAL)
// ======================
// Preload images for smooth rotation
BACKGROUND_IMAGES.forEach(url => {
    new Image().src = url;
});

function rotateBackground() {
    document.body.style.backgroundImage = `url(${BACKGROUND_IMAGES[bgIndex]})`;
    bgIndex = (bgIndex + 1) % BACKGROUND_IMAGES.length;
}

// Initial rotation and interval
rotateBackground();
setInterval(rotateBackground, 30000);

// ======================
// CHAT FUNCTIONS (UPDATED STREAMING VERSION)
// ======================
async function sendMessage() {
    const userMessage = input.value.trim();
    if (!userMessage) return;

    addMessage('user', userMessage);
    input.value = '';
    aibutton.disabled = true;

    const loadingMessage = addMessage('bot', '<span class="loading-dots"></span>', true);

    try {
        const response = await fetch(`${WORKER_URL}?query=${encodeURIComponent(userMessage)}`);
        
        // Handle HTTP errors first
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP Error: ${response.status}`);
        }

        // Verify stream content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            throw new Error('Unexpected response format from server');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events
            while (buffer.indexOf('\n\n') >= 0) {
                const splitIndex = buffer.indexOf('\n\n');
                const event = buffer.slice(0, splitIndex);
                buffer = buffer.slice(splitIndex + 2);

                const dataLine = event.split('\n').find(line => line.startsWith('data:'));
                if (!dataLine) continue;

                try {
                    const data = JSON.parse(dataLine.slice(5));
                    
                    if (data.choices?.[0]?.delta?.content) {
                        accumulatedContent += data.choices[0].delta.content;
                        updateMessage(loadingMessage, accumulatedContent);
                    }
                    
                    // Remove loading dots when content starts arriving
                    if (accumulatedContent && loadingMessage.querySelector('.loading-dots')) {
                        loadingMessage.querySelector('.loading-dots').remove();
                    }
                } catch (e) {
                    console.error('Error parsing event:', e);
                }
            }
        }

        updateMessage(loadingMessage, accumulatedContent || '⚠️ Received empty response');

    } catch (error) {
        updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
        console.error('Chat error:', error);
    } finally {
        aibutton.disabled = false;
        input.focus();
    }
}

// ======================
// HELPER FUNCTIONS (ORIGINAL)
// ======================
function addMessage(sender, text, isHTML = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    isHTML ? messageDiv.innerHTML = text : messageDiv.textContent = text;
    chatbox.appendChild(messageDiv);
    scrollToNewMessage(messageDiv);
    return messageDiv;
}

function updateMessage(messageElement, newText) {
    messageElement.innerHTML = newText;
    messageElement.classList.remove('loading');
    scrollToNewMessage(messageElement);
}

function scrollToNewMessage(element) {
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start'
    });
}

// ======================
// EVENT LISTENERS (ORIGINAL)
// ======================
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

input.focus();
