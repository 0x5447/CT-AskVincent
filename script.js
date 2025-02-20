// script.js

// ======================
// CONFIGURATION
// ======================
const WORKER_URL = 'https://venice-chatbot.graham-business-ventures.workers.dev'; // Added https://
const BACKGROUND_IMAGES = [
    'https://raw.githubusercontent.com/TGrahamGit/venice-mso/main/VeniceAI_Vf7NGoK.webp', // Removed /refs/heads
    'https://raw.githubusercontent.com/TGrahamGit/venice-mso/main/VeniceAI_jXw0mwJ.webp',
    'https://raw.githubusercontent.com/TGrahamGit/venice-mso/main/VeniceAI_sFkAxgA.webp'
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

// Initial rotation and interval
rotateBackground();
setInterval(rotateBackground, 30000);

// ======================
// CHAT FUNCTIONS
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
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || `HTTP Error: ${response.status}`);
        if (!data?.choices?.[0]?.message?.content) throw new Error('Invalid response format');

        updateMessage(loadingMessage, data.choices[0].message.content);
    } catch (error) {
        updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
        console.error('Chat error:', error);
    } finally {
        aibutton.disabled = false;
    }
}

// Helper functions
function addMessage(sender, text, isHTML = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    isHTML ? messageDiv.innerHTML = text : messageDiv.textContent = text;
    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
    return messageDiv;
}

function updateMessage(messageElement, newText) {
    messageElement.innerHTML = newText;
    messageElement.classList.remove('loading');
    chatbox.scrollTop = chatbox.scrollHeight;
}

// Event listeners
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
