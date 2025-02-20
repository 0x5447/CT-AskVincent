// script.js

// ... (keep configuration and background system code the same) ...

// ======================
// CHAT FUNCTIONS (UPDATED FOR STREAMING)
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
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        // Remove loading dots when first content arrives
        let hasReceivedContent = false;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Process complete SSE events (separated by \n\n)
            while (buffer.includes('\n\n')) {
                const splitIndex = buffer.indexOf('\n\n');
                const event = buffer.slice(0, splitIndex);
                buffer
