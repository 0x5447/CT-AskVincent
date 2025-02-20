// ======================
// CHAT FUNCTIONS (FIXED STREAMING VERSION)
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

        // Check if response is a stream
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            throw new Error('Unexpected response format from server');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        // Process the stream
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events
            while (buffer.indexOf('\n\n') >= 0) {
                const splitIndex = buffer.indexOf('\n\n');
                const event = buffer.slice(0, splitIndex);
                buffer = buffer.slice(splitIndex + 2);

                // Extract data from event
                const dataLine = event.split('\n').find(line => line.startsWith('data:'));
                if (!dataLine) continue;

                try {
                    const data = JSON.parse(dataLine.slice(5)); // Remove 'data:' prefix
                    
                    // Handle actual content
                    if (data.choices?.[0]?.delta?.content) {
                        accumulatedContent += data.choices[0].delta.content;
                        updateMessage(loadingMessage, accumulatedContent);
                    }
                    
                    // Remove loading state when first content arrives
                    if (accumulatedContent && loadingMessage.querySelector('.loading-dots')) {
                        loadingMessage.querySelector('.loading-dots').remove();
                    }
                } catch (e) {
                    console.error('Error parsing event:', e);
                }
            }
        }

        // Final update to ensure complete rendering
        updateMessage(loadingMessage, accumulatedContent || '⚠️ Received empty response');

    } catch (error) {
        updateMessage(loadingMessage, `⚠️ Error: ${error.message}`);
        console.error('Chat error:', error);
    } finally {
        aibutton.disabled = false;
        input.focus();
    }
}
