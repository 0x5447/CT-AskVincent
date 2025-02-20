const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');
const workerUrl = 'venice-chatbot.graham-business-ventures.workers.dev
';

function sendMessage() {
  const query = input.value.trim();
  if (query) {
    const messageElement = document.createElement('p');
    messageElement.className = 'user';
    messageElement.textContent = query;
    chatbox.appendChild(messageElement);

    input.value = '';
    chatbox.scrollTop = chatbox.scrollHeight;

    fetch(workerUrl + '?query=' + encodeURIComponent(query))
      .then(response => response.json())
      .then(data => {
        const botMessageElement = document.createElement('p');
        botMessageElement.className = 'bot';
        botMessageElement.textContent = data.choices[0].message.content;
        chatbox.appendChild(botMessageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
      })
      .catch(error => {
        console.error('Error:', error);
      });
  }
}
