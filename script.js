const chatbox = document.getElementById('chatbox');
const input = document.getElementById('input');
const workerUrl = 'https://venice-chatbot.graham-business-ventures.workers.dev/'; // Replace with your actual Worker URL

function sendMessage() {
  const query = input.value.trim();
  console.log('Sending query:', query);
  
  if (query) {
    const messageElement = document.createElement('p');
    messageElement.className = 'user';
    messageElement.textContent = query;
    chatbox.appendChild(messageElement);

    input.value = '';
    chatbox.scrollTop = chatbox.scrollHeight;

    fetch(workerUrl + '?query=' + encodeURIComponent(query))
      .then(response => {
        console.log('Worker response:', response);
        return response.json();
      })
      .then(data => {
        console.log('Worker data:', data);
        const botMessageElement = document.createElement('p');
        botMessageElement.className = 'bot';
        botMessageElement.textContent = data.choices[0].message.content;
        chatbox.appendChild(botMessageElement);
        chatbox.scrollTop = chatbox.scrollHeight;
      })
      .catch(error => {
        console.error('Error:', error);
      });
  } else {
    console.error('No query provided');
  }
}
