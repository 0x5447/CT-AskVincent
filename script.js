// script.js

// ======================
// CONFIGURATION
// ======================
const WORKER_URL = 'venice-chatbot.graham-business-ventures.workers.dev';
const BACKGROUND_IMAGES = [
    'https://github.com/TGrahamGit/venice-mso/blob/main/VeniceAI_Vf7NGoK.webp',
    'https://github.com/TGrahamGit/venice-mso/blob/main/VeniceAI_jXw0mwJ.webp',
    'https://github.com/TGrahamGit/venice-mso/blob/main/VeniceAI_sFkAxgA.webp'
];
// ======================

// DOM Elements
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');
const aibutton = document.getElementById('aibutton');
let bgIndex = 0;

// ======================
// BACKGROUND ROTATION
// ======================
function rotateBackground() {
    document.body.style.backgroundImage = `url(${BACKGROUND_IMAGES[bgIndex]})`;
    bgIndex = (bgIndex + 1) % BACKGROUND_IMAGES.length;
}

// Rotate background every 30 seconds
rotateBackground();
setInterval(rotateBackground, 30000);

// ======================
// CHAT FUNCTIONS
// ======================
async function sendMessage() {
    const userMessage = input.value.trim();
    if (!userMessage) return;

    // Add user message
    addMessage('user', userMessage);
    input.value = '';
    aibutton.disabled = true;

    // Add loading state
    const loadingMessage = addMessage('bot', '<span class="loading-dots"></span>', true);

    try {
        const response = await fetch(`${WORKER_URL}?query=${encodeURIComponent(userMessage)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Error: ${response.status}`);
        }

        if (!data?.choices?.[0]?.message?.content) {
            throw new Error('Unexpected response format');
        }

        updateMessage(loadingMessage, data.choices[0].message.content);

    } catch (error) {
        updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
        console.error('Chat error:', error);
    } finally {
        aibutton.disabled = false;
    }
}

function addMessage(sender, text, isHTML = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    if (isHTML) {
        messageDiv.innerHTML = text;
    } else {
        messageDiv.textContent = text;
    }

    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    return messageDiv;
}

function updateMessage(messageElement, newText) {
    messageElement.innerHTML = newText;
    messageElement.classList.remove('loading');
    chatbox.scrollTop = chatbox.scrollHeight;
}

// ======================
// EVENT LISTENERS
// ======================
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
