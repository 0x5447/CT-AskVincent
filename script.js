// ======================
// CONFIGURATION
// ======================
const WORKER_URL = 'https://venice-chatbot.graham-business-ventures.workers.dev/'; // Your Cloudflare Worker URL

// ======================
// ELEMENTS
// ======================
const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');

// ======================
// FUNCTIONS
// ======================
async function sendMessage() {
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Add user message
  addMessage('user', userMessage);
  input.value = '';
  
  // Add loading indicator
  const loadingMessage = addMessage('bot', '<span class="loading-dots"></span>', true);

  try {
    const response = await fetch(`${WORKER_URL}?query=${encodeURIComponent(userMessage)}`);
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    updateMessage(loadingMessage, data.choices[0].message.content);
  } catch (error) {
    updateMessage(loadingMessage, `Oops! There was an error: ${error.message}`);
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

// Allow Enter key to send
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});
