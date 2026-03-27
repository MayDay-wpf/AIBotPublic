/**
 * VibeCodeEditor - Enhanced Monaco Editor functionality for VibeCode
 * Handles code selection and chat integration
 */

$(function () {
    // Initialize the editor enhancements after the main editor is ready
    $(document).on('editorReady', initCodeSelectionFeatures);

    // Initialize chat history functionality (direct implementation)
    initChatHistory();
});

/**
 * Initialize code selection features for the Monaco editor
 */
function initCodeSelectionFeatures() {
    // Ensure editor is available from vibecoding.js
    if (typeof editor === 'undefined' || !editor) {
        console.warn('Monaco editor not initialized yet. Selection features will not be available.');
        return;
    }

    // Only show the button on mouseup instead of during selection
    editor.onDidChangeCursorSelection(function (e) {
        // Don't show button while user is actively selecting
        if (e.source === 'mouse' && e.selection && !e.selection.isEmpty()) {
            // Hide the button while mouse is down and selecting
            $('#add-to-chat-btn').hide();
        } else if (e.source !== 'mouse') {
            // If selection changed by any means other than mouse (like keyboard or programmatically),
            // hide the button
            $('#add-to-chat-btn').hide();
        }
    });

    // Listen for mouseup on the editor element
    $('#editor').on('mouseup', function (e) {
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty()) {
            showAddToChatButton(selection, e.clientX, e.clientY);
        }
    });

    // Create the "Add to Chat" button but keep it hidden initially
    createAddToChatButton();

    // Handle window resize to reposition the button
    $(window).on('resize', function () {
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty() && $('#add-to-chat-btn').is(':visible')) {
            // If button is visible, reposition it
            showAddToChatButton(selection);
        }
    });

    // Hide button when clicking elsewhere or when editor loses focus
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#add-to-chat-btn').length && !$(e.target).closest('#editor').length) {
            $('#add-to-chat-btn').hide();
        }
    });

    // Hide button when editor content changes
    editor.onDidChangeModelContent(function () {
        $('#add-to-chat-btn').hide();
    });

    // Hide button when cursor moves without selection
    editor.onDidChangeCursorPosition(function (e) {
        const selection = editor.getSelection();
        if (!selection || selection.isEmpty()) {
            $('#add-to-chat-btn').hide();
        }
    });

    console.log('Code selection features initialized successfully');
}

// Chat history variables
let chatHistoryState = {
    isLoading: false,
    currentPage: 1,
    pageSize: 10,
    hasMoreData: true,
    searchKey: '',
    historyData: []
};

/**
 * Initialize chat history functionality
 */
function initChatHistory() {
    // Set up event listeners for chat history panel
    setupChatHistoryEvents();
}

/**
 * Set up event listeners for chat history panel
 */
function setupChatHistoryEvents() {
    // Open history panel when history icon is clicked
    $('#chat-history').on('click', function () {
        openHistoryPanel();
    });

    // Close history panel when close button is clicked
    $('#chat-history-close').on('click', function () {
        closeHistoryPanel();
    });

    // Close history panel when overlay is clicked
    $('#chat-history-overlay').on('click', function () {
        closeHistoryPanel();
    });

    // Infinite scroll for loading more history
    $('#chat-history-list').on('scroll', handleHistoryScroll);

    // Handle search input with debounce
    let searchTimeout;
    $('#chat-history-search').on('input', function () {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
            chatHistoryState.searchKey = $('#chat-history-search').val();
            resetAndSearchHistory();
        }, 500);
    });

    // Handle clicks on the chat history list (delegation)
    $('#chat-history-list').on('click', '.vibechat-history-item', function () {
        const chatId = $(this).data('chatid');
        if (chatId) {
            loadChatDetail(chatId);
        }
    });

    // Handle delete button clicks
    $('#chat-history-list').on('click', '.vibechat-history-action-btn.delete', function (e) {
        e.stopPropagation(); // Prevent triggering the parent click
        const chatId = $(this).closest('.vibechat-history-item').data('chatid');
        if (chatId) {
            confirmDeleteChat(chatId);
        }
    });
}

/**
 * Open the history panel and load data
 */
function openHistoryPanel() {
    $('#chat-history-panel').addClass('active');
    $('#chat-history-overlay').addClass('active');

    // Reset and load initial data if first time
    // if (chatHistoryState.historyData.length === 0) {
    //     resetAndSearchHistory();
    // }
    resetAndSearchHistory();
}

/**
 * Close the history panel
 */
function closeHistoryPanel() {
    $('#chat-history-panel').removeClass('active');
    $('#chat-history-overlay').removeClass('active');
}

/**
 * Handle scroll event for infinite scrolling
 */
function handleHistoryScroll() {
    const $list = $(this);
    const scrollPosition = $list.scrollTop() + $list.innerHeight();
    const scrollHeight = $list[0].scrollHeight;

    // Load more when scroll reaches bottom (with a 50px threshold)
    if (scrollHeight - scrollPosition < 50 && !chatHistoryState.isLoading && chatHistoryState.hasMoreData) {
        loadMoreHistory();
    }
}

/**
 * Reset search and reload data
 */
function resetAndSearchHistory() {
    // Reset state
    chatHistoryState.currentPage = 1;
    chatHistoryState.hasMoreData = true;
    chatHistoryState.historyData = [];

    // Clear list and show loading
    $('#chat-history-list').html('<div class="vibechat-history-loading" id="chat-history-initial-loading">' +
        '<div class="vibechat-history-loading-spinner"></div>' +
        '<span>加载历史记录...</span>' +
        '</div>');

    // Load data
    loadHistories();
}

/**
 * Load history data from API
 */
function loadHistories() {
    if (chatHistoryState.isLoading || !chatHistoryState.hasMoreData) return;

    chatHistoryState.isLoading = true;

    // Show loading indicator if not initial load
    if (chatHistoryState.currentPage > 1) {
        $('#chat-history-list').append('<div class="vibechat-history-loading" id="chat-history-loading">' +
            '<div class="vibechat-history-loading-spinner"></div>' +
            '<span>加载更多...</span>' +
            '</div>');
    }

    // Make API call
    $.ajax({
        url: '/Product/GetVibeCodingHistoriesList',
        type: 'POST',
        data: {
            pageIndex: chatHistoryState.currentPage,
            pageSize: chatHistoryState.pageSize,
            searchKey: chatHistoryState.searchKey
        },
        success: function (response) {
            // Remove loading indicator
            $('#chat-history-initial-loading, #chat-history-loading').remove();

            if (response.success && response.data) {
                // Handle empty response
                if (response.data.length === 0) {
                    chatHistoryState.hasMoreData = false;

                    if (chatHistoryState.currentPage === 1) {
                        // Show empty state for initial load
                        showEmptyState();
                    }

                    chatHistoryState.isLoading = false;
                    return;
                }

                // Process and render data
                processHistoryData(response.data);

                // Update page for next load
                chatHistoryState.currentPage++;
            } else {
                console.error('Failed to load chat histories:', response);
                showErrorState();
            }

            chatHistoryState.isLoading = false;
        },
        error: function (error) {
            console.error('Error loading chat histories:', error);

            // Remove loading indicator
            $('#chat-history-initial-loading, #chat-history-loading').remove();

            showErrorState();
            chatHistoryState.isLoading = false;
        }
    });
}

/**
 * Load more history data (for infinite scrolling)
 */
function loadMoreHistory() {
    loadHistories();
}

/**
 * Process history data and render to UI
 */
function processHistoryData(data) {
    // Add to our local storage
    chatHistoryState.historyData = [...chatHistoryState.historyData, ...data];

    // Render each history item
    const $historyList = $('#chat-history-list');

    data.forEach(function (item) {
        const historyItemHtml = createHistoryItemHtml(item);
        $historyList.append(historyItemHtml);
    });
}

/**
 * Create HTML for a history item
 */
function createHistoryItemHtml(item) {
    return `
        <div class="vibechat-history-item" data-chatid="${item.chatId}">
            <div class="vibechat-history-item-header">
                <div class="vibechat-history-item-model">${item.model || 'Unknown Model'}</div>
                <div class="vibechat-history-item-date">${formatDate(item.createTime)}</div>
            </div>
            <div class="vibechat-history-item-content">${item.chat}</div>
            <div class="vibechat-history-actions">
                <button class="vibechat-history-action-btn delete text-danger">
                    <i class="fas fa-trash-alt"></i> 删除
                </button>
            </div>
        </div>
    `;
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Today, show time
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
        // Yesterday
        return '昨天';
    } else if (diffDays < 7) {
        // Within a week
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return days[date.getDay()];
    } else {
        // Older than a week
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }
}

/**
 * Show empty state when no histories are found
 */
function showEmptyState() {
    const searchKey = chatHistoryState.searchKey;
    let message = searchKey ?
        `没有找到包含 "${searchKey}" 的历史记录` :
        '暂无聊天历史记录';

    $('#chat-history-list').html(`
        <div class="vibechat-history-empty">
            <i class="fas fa-history"></i>
            <p>${message}</p>
        </div>
    `);
}

/**
 * Show error state when loading fails
 */
function showErrorState() {
    $('#chat-history-list').append(`
        <div class="vibechat-history-empty">
            <i class="fas fa-exclamation-circle"></i>
            <p>加载历史记录失败，请稍后再试</p>
        </div>
    `);
}

/**
 * Load chat detail when a history item is clicked
 */
function loadChatDetail(chatId) {
    $.ajax({
        url: '/Product/GetVibeCodingHistoryDetail',
        type: 'POST',
        data: { chatId },
        success: function (response) {
            if (response.success && response.data) {
                // Load the chat into the current chat window
                loadChatIntoView(response.data);
                chatid = chatId;
                // Close the history panel
                closeHistoryPanel();
            } else {
                console.error('Failed to load chat detail:', response);
                alert('加载聊天详情失败，请稍后再试');
            }
        },
        error: function (error) {
            console.error('Error loading chat detail:', error);
            alert('加载聊天详情失败，请稍后再试');
        }
    });
}

/**
 * Load chat data into the current chat view
 */
function loadChatIntoView(chatData) {
    // Clear current chat
    $('#ai-qa-content').empty();

    // Set current chat ID (if available in parent scope)
    if (typeof window.chatId !== 'undefined') {
        window.chatId = chatData[0]?.chatId || '';
    }

    // Render chat messages
    chatData.forEach(function (msg) {
        let messageHtml = '';

        if (msg.role === 'user') {
            // Process user message content
            let userContent = msg.chat;
            
            // Check if there are images to display
            let imagesHtml = '<div class="uploaded-images-list">';
            if (msg.imageList && msg.imageList.length > 0) {
                const images = msg.imageList.split(',');
                images.forEach(imgUrl => {
                    if (imgUrl.trim()) {
                        imagesHtml += `
                            <div class="uploaded-image-item">
                                <img src="${imgUrl}" alt="User uploaded image" onclick="openImagePreview('${imgUrl}')">
                            </div>
                        `;
                    }
                });
                imagesHtml += '</div>';
            }
            
            messageHtml = `
                <div class="ai-message user-message">
                    <div class="user-question-text">
                    ${userContent}
                    </div>
                    ${imagesHtml}
                </div>
            `;

            // Add the message to the chat content
            $('#ai-qa-content').append(messageHtml);
        } else if (msg.role === 'assistant') {
            // Process MCP commands in assistant messages
            let processedChat = msg.chat;
            let mcpCommands = [];

            // Extract MCP commands using regex
            const mcpRegex = /<mcp>([\s\S]*?)<\/mcp>/g;
            let match;
            while ((match = mcpRegex.exec(processedChat)) !== null) {
                const originalTag = match[0]; // Complete <mcp>...</mcp> tag
                const mcpContent = match[1]; // Content inside the tag

                mcpCommands.push({
                    originalTag: originalTag,
                    content: mcpContent,
                    id: generateUniqueId()
                });
            }

            // Remove MCP tags from the content for display
            processedChat = processedChat.replace(/<mcp>[\s\S]*?<\/mcp>/g, '');

            // Process markdown in assistant messages
            let processedContent = '';
            if (typeof md !== 'undefined') {
                processedContent = md.render(processedChat);
            } else {
                processedContent = processedChat;
            }

            // Create a unique ID for the message content
            const msgId = 'msg-' + generateUniqueId();

            // Add the AI response
            messageHtml = `
                <div class="ai-message ai-response">
                    <div id="${msgId}" class="content-container">${processedContent}</div>
                </div>
            `;

            // Add to the chat content
            $('#ai-qa-content').append(messageHtml);

            // Process MCP commands
            if (mcpCommands.length > 0) {
                // Create MCP container
                const mcpContainer = $(`<div id="mcp-container-${msgId}" class="mcp-commands-container"></div>`);
                $(`#${msgId}`).after(mcpContainer);

                // Process each MCP command
                mcpCommands.forEach(function (cmd) {
                    try {
                        // Try to parse the MCP command
                        let mcpCommand;
                        try {
                            // Try to extract the method using regex if parseMcpXml is not available
                            const methodMatch = /<method>(.*?)<\/method>/s.exec(cmd.content);
                            const method = methodMatch ? methodMatch[1].trim() : 'unknown';
                            mcpCommand = { method: method };

                            // Add result UI
                            mcpContainer.append(`
                                <div class="mcp-command-item" id="mcp-${cmd.id}">
                                    <div class="mcp-result">
                                        命令执行完成(${mcpCommand.method})
                                    </div>
                                </div>
                            `);
                        } catch (error) {
                            // If parsing fails, just display an error
                            mcpContainer.append(`
                                <div class="mcp-command-item" id="mcp-${cmd.id}">
                                    <div class="mcp-error">
                                        <div>MCP 命令解析错误: ${error.message}</div>
                                    </div>
                                </div>
                            `);
                        }
                    } catch (error) {
                        console.error('Error processing MCP command:', error);
                    }
                });
            }
        }

        // Add highlight to code blocks
        $(`#ai-qa-content .ai-response pre code`).each((i, block) => hljs.highlightElement(block));
    });

    // Scroll to bottom
    $('#ai-qa-content').scrollTop($('#ai-qa-content')[0].scrollHeight);
}

/**
 * Open image preview in a modal
 * @param {string} imageUrl - URL of the image to preview
 */
function openImagePreview(imageUrl) {
    // Create modal if it doesn't exist
    let imageModal = $('#image-preview-modal');
    if (imageModal.length === 0) {
        $('body').append(`
            <div id="image-preview-modal" class="image-preview-modal">
                <div class="image-preview-content">
                    <span class="image-preview-close">&times;</span>
                    <img id="image-preview-img" class="image-preview-img">
                </div>
            </div>
        `);
        
        // Add CSS if not already added
        if ($('#image-preview-styles').length === 0) {
            $('head').append(`
                <style id="image-preview-styles">
                    .image-preview-modal {
                        display: none;
                        position: fixed;
                        z-index: 9999;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        overflow: auto;
                        background-color: rgba(0,0,0,0.9);
                    }
                    .image-preview-content {
                        margin: auto;
                        display: block;
                        position: relative;
                        max-width: 90%;
                        max-height: 90%;
                        top: 50%;
                        transform: translateY(-50%);
                    }
                    .image-preview-img {
                        display: block;
                        margin: 0 auto;
                        max-width: 100%;
                        max-height: 90vh;
                    }
                    .image-preview-close {
                        position: absolute;
                        top: -30px;
                        right: 0;
                        color: #f1f1f1;
                        font-size: 40px;
                        font-weight: bold;
                        cursor: pointer;
                    }
                    .user-uploaded-image {
                        max-width: 200px;
                        max-height: 200px;
                        margin: 10px 5px;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: transform 0.2s;
                    }
                    .user-uploaded-image:hover {
                        transform: scale(1.05);
                    }
                    .user-image-container {
                        display: inline-block;
                        margin-right: 10px;
                    }
                </style>
            `);
        }
        
        // Add event listener to close button
        $(document).on('click', '.image-preview-close', function() {
            $('#image-preview-modal').hide();
        });
        
        // Close modal when clicking outside the image
        $(document).on('click', '#image-preview-modal', function(e) {
            if (e.target === this) {
                $(this).hide();
            }
        });
    }
    
    // Set image source and show modal
    $('#image-preview-img').attr('src', imageUrl);
    $('#image-preview-modal').show();
}

/**
 * Generate a unique ID for MCP commands
 * @returns {string} Generated ID
 */
function generateUniqueId() {
    return 'id-' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Confirm deletion of a chat history
 */
function confirmDeleteChat(chatId) {
    showConfirmDialog(`确定要删除此历史记录吗？此操作无法撤销。`)
        .then(confirmResult => {
            if (confirmResult) {
                deleteChat(chatId);
            }
        });
}

/**
 * Delete a chat history
 */
function deleteChat(chatId) {
    $.ajax({
        url: '/Product/DeleteVibeCodingHistory',
        type: 'POST',
        data: { chatId },
        success: function (response) {
            if (response.success) {
                // Remove from UI
                $(`.vibechat-history-item[data-chatid="${chatId}"]`).fadeOut(300, function () {
                    $(this).remove();

                    // Update local data
                    chatHistoryState.historyData = chatHistoryState.historyData.filter(function (item) {
                        return item.chatId !== chatId;
                    });

                    // Show empty state if no items left
                    if (chatHistoryState.historyData.length === 0) {
                        showEmptyState();
                    }
                });
                if(chatId==chatid){
                    newChat();
                }
            } else {
                console.error('Failed to delete chat history:', response);
                alert('删除失败，请稍后再试');
            }
        },
        error: function (error) {
            console.error('Error deleting chat history:', error);
            alert('删除失败，请稍后再试');
        }
    });
}

/**
 * Create the "Add to Chat" button in the DOM
 */
function createAddToChatButton() {
    // Remove any existing button first
    $('#add-to-chat-btn').remove();

    // Create the button element
    const button = $(`
        <div id="add-to-chat-btn" class="add-to-chat-button">
            <i class="fas fa-comment"></i> Add to Chat <span class="keyboard-shortcut">Ctrl+L</span>
        </div>
    `);

    // Add click handler to the button
    button.on('click', addSelectionToChat);

    // Add the button to the editor container but keep it hidden
    $('#editor').parent().append(button);
    button.hide();

    // Add keyboard shortcut (Ctrl+L) to add selection to chat
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, addSelectionToChat);
}

/**
 * Show and position the "Add to Chat" button near the selection
 * @param {monaco.ISelection} selection - The current selection
 * @param {number} clientX - Optional mouse X position
 * @param {number} clientY - Optional mouse Y position
 */
function showAddToChatButton(selection, clientX, clientY) {
    const button = $('#add-to-chat-btn');

    if (clientX && clientY) {
        const left = clientX - 300;
        const top = clientY;

        button.css({
            top: top + 'px',
            left: left + 'px'
        }).show();
    } else {
        // Fallback to position at the end of the selection
        const endLineNumber = selection.endLineNumber;
        const endColumn = selection.endColumn;

        // Convert position to pixel coordinates
        const position = editor.getScrolledVisiblePosition({ lineNumber: endLineNumber, column: endColumn });

        if (!position) {
            // If position is not visible, hide the button
            button.hide();
            return;
        }

        // Position the button below the end of the selection
        const editorContainer = $('#editor');
        const containerOffset = editorContainer.offset();

        const top = containerOffset.top + position.top;

        // Apply the position and show the button
        button.css({
            top: top + 'px',
            left: '20px'
        }).show();
    }
}

/**
 * Add the selected code to the AI chat
 */
function addSelectionToChat() {
    if (!editor) return;

    // Get the current selection
    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return;

    // Get the selected text
    const model = editor.getModel();
    if (!model) return;

    const selectedText = model.getValueInRange(selection);

    // Get the file path and selection range
    const filePath = currentOpenFile || 'untitled';
    const fileName = filePath.split('/').pop();
    const startLine = selection.startLineNumber;
    const endLine = selection.endLineNumber;

    // Create a formatted representation for the chat
    addCodeSnippetToChat(fileName, filePath, startLine, endLine, selectedText);

    // Hide the button after adding to chat
    $('#add-to-chat-btn').hide();
}

/**
 * Add a code snippet to the AI chat
 * @param {string} fileName - Name of the file
 * @param {string} filePath - Full path to the file
 * @param {number} startLine - Start line number (1-based)
 * @param {number} endLine - End line number (1-based)
 * @param {string} code - The selected code
 */
function addCodeSnippetToChat(fileName, filePath, startLine, endLine, code) {
    // Format the file reference for display in the chat
    const fileReference = `${fileName}(${startLine}-${endLine})`;

    // Get the AI question input
    const aiQuestion = $('#ai-question');
    if (!aiQuestion.length) {
        console.error('AI question input not found');
        alert('无法找到AI输入框，请确保AI聊天面板已打开');
        return false;
    }

    // Add code reference to the question input
    const existingText = aiQuestion.val();
    const newText = existingText ?
        `${existingText}\n@${fileReference}` :
        `@${fileReference}`;
    aiQuestion.val(newText);

    // Focus on the question input
    aiQuestion.focus();

    // Attempt to add code snippet as a file tag if VibeFileSelector is available
    if (typeof window.VibeFileSelector !== 'undefined') {
        // Create a file-like object for the code snippet
        const codeFile = {
            path: `${filePath}:${startLine}-${endLine}`,
            name: fileReference,
            type: 'code',
            content: code // Store the code content for potential later use
        };

        try {
            // Check if we can add the code to the VibeFileSelector
            if (typeof window.VibeFileSelector.addCodeToSelection === 'function') {
                window.VibeFileSelector.addCodeToSelection(codeFile);
            } else if (typeof window.VibeFileSelector.addFileToSelection === 'function') {
                // Fall back to using addFileToSelection
                window.VibeFileSelector.addFileToSelection(codeFile);
            }
        } catch (e) {
            console.warn('Error adding code to VibeFileSelector:', e);
            // The code reference is still added to the input, so we can consider this partial success
        }
    }

    return true;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Export functions for use in other modules
window.VibeCodeEditor = {
    addSelectionToChat,
    initCodeSelectionFeatures,
    openHistoryPanel,
    closeHistoryPanel,
    loadChatDetail,
    deleteChat
};
