const WORKER_URL = 'https://msochat.optimistprojects.workers.dev';

function addMessage(sender, text) {
    console.log(`Adding ${sender} message:`, text);
    const chatbox = document.getElementById('chatbox');
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text;
    div.appendChild(content);
    chatbox.appendChild(div);
    console.log('Message appended to chatbox');
    chatbox.scrollTop = chatbox.scrollHeight;
    return div;
}

async function sendMessage(userMessage) {
    console.log('sendMessage started with:', userMessage);
    try {
        console.log('Adding user message');
        addMessage('user', userMessage);
        console.log('Pushing to chatHistory');
        window.chatHistory.push({ sender: 'You', message: userMessage, timestamp: new Date().toLocaleString() });

        console.log('Adding loading message');
        const loadingMessage = addMessage('bot', 'Thinking...');
        document.querySelector('.send-button').disabled = true;

        const url = `${WORKER_URL}?query=${encodeURIComponent(userMessage)}`;
        console.log('Fetching:', url);

        const response = await fetch(url, { method: 'GET' })
            .catch(err => {
                console.error('Fetch error:', err);
                throw new Error(`Fetch failed: ${err.message}`);
            });
        console.log('Fetch response received, status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        let content = '';

        if (contentType?.includes('text/event-stream')) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('Stream complete');
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split('\n\n');
                buffer = events.pop();

                for (const event of events) {
                    const dataLine = event.split('\n').find(line => line.startsWith('data:'));
                    if (!dataLine) continue;
                    const data = JSON.parse(dataLine.slice(5));
                    if (data.choices?.[0]?.delta?.content) {
                        content += data.choices[0].delta.content;
                        console.log('Stream chunk:', content);
                        loadingMessage.querySelector('.message-content').innerHTML = content;
                    }
                }
            }
        } else {
            content = await response.text();
            console.log('Non-stream content:', content);
            loadingMessage.querySelector('.message-content').innerHTML = content || 'No response';
        }

        if (!content) throw new Error('No content received');
        window.chatHistory.push({ sender: 'Vincent', message: content, timestamp: new Date().toLocaleString() });
    } catch (error) {
        console.error('sendMessage error:', error);
        addMessage('bot', `⚠️ Error: ${error.message}`);
    } finally {
        console.log('Re-enabling send button');
        document.querySelector('.send-button').disabled = false;
        document.getElementById('user-input').focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    const sendButton = document.querySelector('.send-button');
    const input = document.getElementById('user-input');
    const chatbox = document.getElementById('chatbox');

    if (sendButton && input && chatbox) {
        console.log('Chat elements found, initializing');
        window.chatHistory = [];

        sendButton.addEventListener('click', () => {
            console.log('Send button clicked');
            const message = input.value.trim();
            if (message) {
                console.log('Calling sendMessage with:', message);
                sendMessage(message);
                console.log('Clearing input');
                input.value = '';
            } else {
                console.log('Empty message, skipping');
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                console.log('Enter pressed');
                e.preventDefault();
                const message = input.value.trim();
                if (message) {
                    console.log('Calling sendMessage with:', message);
                    sendMessage(message);
                    console.log('Clearing input');
                    input.value = '';
                } else {
                    console.log('Empty message, skipping');
                }
            }
        });

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = `${input.scrollHeight}px`;
        });

        // Test button functionality
        console.log('Adding test button listener');
        sendButton.addEventListener('click', () => console.log('Test click registered'));
    } else {
        console.error('Missing chat elements:', { sendButton: !!sendButton, input: !!input, chatbox: !!chatbox });
    }

    // Test fetch on load
    console.log('Running test fetch');
    fetch(`${WORKER_URL}?query=test`)
        .then(res => res.text())
        .then(text => console.log('Test fetch result:', text.slice(0, 100) + '...'))
        .catch(err => console.error('Test fetch failed:', err));
});
