// script.js

// ===========================================
// CONFIGURATION - REPLACE THESE VALUES!
// ===========================================
const WORKER_URL = 'https://venice-chatbot.graham-business-ventures.workers.dev/'; // Your actual Worker URL
// ===========================================

// Get HTML elements
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');

// Function to send message to AI
async function sendMessage() {
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Add user message to chat
  addMessage('user', userMessage);
  input.value = '';
  
  // Show loading animation
  const loadingMessage = addMessage('bot', '<span class="loading-dots"></span>', true);

  try {
    // Send request to Cloudflare Worker
    const response = await fetch(`${WORKER_URL}?query=${encodeURIComponent(userMessage)}`);
    const data = await response.json();

    // DEBUG: Log full response to console
    console.log('API Response:', data);

    // Check for HTTP errors
    if (!response.ok) {
      throw new Error(data.error || `HTTP Error: ${response.status}`);
    }

    // Verify response structure
    if (!data?.choices?.[0]?.message?.content) {
      throw new Error('Unexpected response format from API');
    }

    // Display AI response
    updateMessage(loadingMessage, data.choices[0].message.content);

  } catch (error) {
    // Show error message in chat
    updateMessage(loadingMessage, `Error: ${error.message}`);
    console.error('Error details:', error);
  }
}

// Helper function to add messages to chat
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

// Update loading message with final response
function updateMessage(messageElement, newText) {
  messageElement.innerHTML = newText;
  messageElement.classList.remove('loading');
  chatbox.scrollTop = chatbox.scrollHeight;
}

// Allow Enter key to send messages
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
