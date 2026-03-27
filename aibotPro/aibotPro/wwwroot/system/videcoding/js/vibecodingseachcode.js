/**
 * VibeCodeSearch - Code base search functionality for AIBot-Pro
 * Provides semantic code search capabilities by communicating with the backend API
 */

// Main function to search code in the codebase
async function searchCodeBase(query, targetDirectories) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/Product/GetVibeCodingSearchCode',
            type: 'POST',
            data: {
                content: targetDirectories,
                question: query
            },
            success: function (response) {
                if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.message || 'Search failed'));
                }
            },
            error: function (xhr, status, error) {
                reject(new Error(`Search request failed: ${error}`));
            }
        });
    });
}

// Export functions for use in vibeaichat.js
window.VibeCodeSearch = {
    searchCodeBase
};
