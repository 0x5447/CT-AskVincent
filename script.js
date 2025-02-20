// script.js

// ===========================================
// Configuration - Replace these with your details!
// ===========================================
const workerUrl = 'https://venice-chatbot.graham-business-ventures.workers.dev/'; // <-- YOUR WORKER URL HERE
// ===========================================

// Get HTML elements
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');

async function sendMessage() {
  // Get user's message and clear input
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Add user message to chat
  addMessage('user', userMessage);
  input.value = '';

  try {
    // Send request to Cloudflare Worker
    const response = await fetch(`${workerUrl}?query=${encodeURIComponent(userMessage)}`);
    
    // Handle HTTP errors
    if (!response.ok) {
      throw new Error(`Bot failed to respond (HTTP ${response.status})`);
    }

    // Parse JSON response
    const data = await response.json();
    
    // Add bot response to chat
    addMessage('bot', data.choices[0].message.content);

  } catch (error) {
    // Show error message in chat
    addMessage('bot', `Error: ${error.message}`);
    console.error('Chat error:', error);
  }

  // Scroll to bottom of chat
  chatbox.scrollTop = chatbox.scrollHeight;
}

// Helper function to add messages
function addMessage(sender, text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `${sender}-message`;
  messageDiv.textContent = text;
  chatbox.appendChild(messageDiv);
}
