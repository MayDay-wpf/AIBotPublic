/**
 * VibeWebSearch - Web search functionality for AIBot-Pro
 * Provides web search capabilities using JINA AI by communicating with the backend API
 */

// Main function to search the web using JINA AI
async function searchWeb(query) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/Product/GetVibeCodingWebSearch',
            type: 'POST',
            data: {
                query: query
            },
            success: function (response) {
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.message || 'Web search failed'));
                }
            },
            error: function (xhr, status, error) {
                reject(new Error(`Web search request failed: ${error}`));
            }
        });
    });
}

// Export functions for use in vibeaichat.js
window.VibeWebSearch = {
    searchWeb
};