// 深度研究 - AI对话功能模块
// 此文件包含AI对话的核心功能，包括消息发送、接收、历史管理等

// 聊天相关全局变量
let chatHistory = [];
let isChatInitialized = false;
let currentAssistantMessageId = null;
let currentAssistantMessage = '';
let currentReasoningMessage = '';
let md = null; // markdown-it实例
var chatId = '';
var currentGroupId = '';
// 聊天状态：'idle' - 空闲, 'generating' - 生成中, 'stopping' - 停止中
let chatState = 'idle';

// 初始化AI对话功能
function initDeepResearchChat() {
    if (isChatInitialized) {
        return;
    }

    // 初始化markdown-it
    initMarkdownRenderer();

    // 初始化聊天事件监听器
    initChatEventListeners();

    // 初始化聊天界面
    initChatInterface();


    isChatInitialized = true;
}

// 初始化markdown渲染器
function initMarkdownRenderer() {
    if (typeof window.markdownit !== 'undefined') {
        md = window.markdownit({
            html: true,
            linkify: true,
            typographer: true,
            breaks: true
        });
    } else {
        console.warn('markdown-it未加载，将使用纯文本显示');
    }
}

// 初始化聊天事件监听器
function initChatEventListeners() {
    // 聊天发送按钮
    $('#sendChatBtn').off('click').on('click', function () {
        if (chatState === 'generating') {
            // 如果正在生成，则停止生成
            stopChatGeneration();
        } else {
            // 如果没有在生成，则发送消息
            sendChatMessage();
        }
    });

    // 聊天输入框回车发送
    $('#chatInput').off('keypress').on('keypress', function (e) {
        if (e.which === 13 && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // 清除聊天
    $('#clearChatBtn').off('click').on('click', function () {
        clearChatHistory();
    });

    // 自定义Tab切换（聊天相关部分）
    $('#chatTabs').off('click.deepchat').on('click.deepchat', '.nav-link', function (e) {
        e.preventDefault();
        const targetPaneId = $(this).data('target');
        const tabId = $(this).attr('id');

        // 如果编辑器处于禁用状态且用户试图切换到Chat tab，则阻止切换
        if (tabId === 'chat-tab' && $('#researchEditContainer').hasClass('disabled')) {
            if (typeof balert === 'function') {
                balert('请先选择一个已完成的研究项目', 'warning');
            }
            return;
        }

        // 移除所有 active 类
        $('#chatTabs .nav-link').removeClass('active');
        $('.chat-panel-content .tab-pane').removeClass('active show');

        // 添加 active 类到点击的tab和目标pane
        $(this).addClass('active');
        $(targetPaneId).addClass('active show');

        // 如果切换到聊天tab，加载聊天历史
        if (tabId === 'chat-tab' && window.currentResearchId) {
            //用deepResearchChatId加入群组
            window.joinResearchSignalRGroup(window.currentResearchId);
            // 加载聊天历史
            loadChatHistory(window.currentResearchId);
        }
    });
}

// 处理流式聊天消息
function handleStreamingChatMessage(data) {
    if (!data || !data.chatId) {
        return;
    }
    chatId = data.chatId;

    // 如果正在停止过程中，直接忽略所有推送
    if (chatState === 'stopping') {
        return;
    }

    if (data.status === "success" && (data.message || data.reasoning)) {
        // 流式消息内容
        if (!currentAssistantMessageId) {
            // 如果没有当前助手消息ID，说明出现了异常情况，创建一个新的
            currentAssistantMessageId = addChatMessage('', 'assistant', true, false, currentGroupId);
            currentAssistantMessage = '';
            currentReasoningMessage = '';
        }

        // 累积消息内容
        if (data.message) {
            currentAssistantMessage += data.message;
        }

        // 累积思考内容
        if (data.reasoning) {
            currentReasoningMessage += data.reasoning;
        }

        // 更新消息显示
        updateAssistantMessage(currentAssistantMessageId, currentAssistantMessage, currentReasoningMessage);

    } else if (data.status === "finished") {
        // 消息完成
        if (currentAssistantMessageId) {
            // 最终更新思考状态
            const messageElement = $(`[data-message-id="${currentAssistantMessageId}"]`);
            const thinkBox = messageElement.find('.deepchat-think-box');
            if (thinkBox.length > 0) {
                thinkBox.find('.deepchat-think-status').text('思考完成（点击展开）');
            }

            // 最终渲染完整消息
            finalizeAssistantMessage(currentAssistantMessageId, currentAssistantMessage, currentGroupId, currentReasoningMessage);

            // 重置状态
            currentAssistantMessageId = null;
            currentAssistantMessage = '';
            currentReasoningMessage = '';
        }

        // 重置发送按钮状态和停止状态
        resetSendButton();
        chatState = 'idle';

    } else if (data.status === "error") {
        // 错误处理
        if (currentAssistantMessageId) {
            // 更新消息为错误状态，移除黑点指示器
            const messageElement = $(`[data-message-id="${currentAssistantMessageId}"]`);
            if (messageElement.length > 0) {
                const contentElement = messageElement.find('.message-content');
                contentElement.html(`<p><span class="text-danger">抱歉，消息发送失败，请重试。</span></p>`);
                // 移除加载状态
                messageElement.removeClass('loading-message');
                messageElement.find('.fa-spinner').remove();
            }
            currentAssistantMessageId = null;
            currentAssistantMessage = '';
            currentReasoningMessage = '';
        }

        // 重置发送按钮状态和停止状态
        resetSendButton();
        chatState = 'idle';

        if (typeof balert === 'function') {
            balert(data.message || '消息发送失败', 'danger');
        }
    }
}

// 更新助手消息内容
function updateAssistantMessage(messageId, content, reasoning = '', isError = false) {
    const messageElement = $(`[data-message-id="${messageId}"]`);
    if (messageElement.length === 0) {
        return;
    }

    if (isError) {
        const contentElement = messageElement.find('.message-content');
        contentElement.html(`<p><span class="text-danger">${escapeHtml(content)}</span></p>`);
    } else {
        const contentElement = messageElement.find('.message-content');

        // 处理思考内容
        let thinkBox = contentElement.find('.deepchat-think-box');
        const hasThinkContent = reasoning && reasoning.trim();

        // 创建思考框（如果需要且不存在）
        if (hasThinkContent && !thinkBox.length) {
            thinkBox = $(`
                <details class="deepchat-think-box">
                    <summary class="deepchat-think-summary">
                        <i class="fas fa-brain"></i>
                        <span class="deepchat-think-status">正在思考中...</span>
                        <button class="btn btn-sm btn-outline-info deepchat-think-copy" title="复制思考过程">
                            <i class="fas fa-copy"></i>
                        </button>
                    </summary>
                    <div class="deepchat-think-content"></div>
                </details>
            `);
            contentElement.prepend(thinkBox);

            // 绑定思考过程复制事件
            thinkBox.find('.deepchat-think-copy').off('click').on('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const reasoningText = thinkBox.find('.deepchat-think-content').text().trim();
                copyText(reasoningText);
            });
        }

        // 更新思考框内容
        if (thinkBox.length && hasThinkContent) {
            const reasoningRendered = renderMarkdownContent(reasoning);
            thinkBox.find('.deepchat-think-content').html(reasoningRendered);

            // 更新思考状态
            if (content && content.trim()) {
                thinkBox.find('.deepchat-think-status').text('思考完成（点击展开）');
            } else {
                thinkBox.find('.deepchat-think-status').text('正在思考中...');
            }
        }

        // 处理主要回复内容
        let mainResponse = contentElement.find('.deepchat-main-response');
        if (!mainResponse.length) {
            mainResponse = $('<div class="deepchat-main-response"></div>');
            contentElement.append(mainResponse);
        }

        if (content && content.trim()) {
            const contentRendered = renderMarkdownContent(content);
            // 在流式输出时添加黑点指示器
            mainResponse.html(contentRendered + '<span class="deepchat-streaming-indicator">●</span>');
        } else if (hasThinkContent) {
            // 只有思考过程但没有回复内容时，显示黑点指示器表示还在处理中
            mainResponse.html('<span class="deepchat-streaming-indicator">●</span>');
        } else {
            // 既没有思考过程也没有回复内容时，清空主回复区域
            mainResponse.html('');
        }
    }

    // 移除加载状态
    messageElement.removeClass('loading-message');
    messageElement.find('.fa-spinner').remove();

    // 滚动到底部
    scrollToBottom();
}

// 渲染Markdown内容的辅助函数
function renderMarkdownContent(content) {
    if (md) {
        try {
            const renderedContent = md.render(content);

            // 创建临时元素来处理代码高亮和数学公式
            const tempElement = $('<div>').html(renderedContent);

            // 高亮代码块
            tempElement.find('pre code').each(function (i, block) {
                if (typeof hljs !== 'undefined') {
                    hljs.highlightElement(block);
                }
            });

            // 渲染数学公式
            if (typeof MathJax !== 'undefined' && MathJax.typeset) {
                MathJax.typeset([tempElement[0]]);
            }

            return tempElement.html();
        } catch (e) {
            // markdown渲染失败，使用纯文本
            return escapeHtml(content).replace(/\n/g, '<br>');
        }
    } else {
        // 没有markdown-it，使用纯文本
        return escapeHtml(content).replace(/\n/g, '<br>');
    }
}

// 完成助手消息
function finalizeAssistantMessage(messageId, content, groupId = null, reasoning = '') {
    // 最终更新消息内容，不带黑点指示器
    const messageElement = $(`[data-message-id="${messageId}"]`);
    if (messageElement.length > 0) {
        const contentElement = messageElement.find('.message-content');

        // 处理思考内容
        let thinkBox = contentElement.find('.deepchat-think-box');
        const hasThinkContent = reasoning && reasoning.trim();

        // 更新思考框内容
        if (thinkBox.length && hasThinkContent) {
            const reasoningRendered = renderMarkdownContent(reasoning);
            thinkBox.find('.deepchat-think-content').html(reasoningRendered);
            thinkBox.find('.deepchat-think-status').text('思考完成（点击展开）');
        }

        // 处理主要回复内容，移除黑点指示器
        let mainResponse = contentElement.find('.deepchat-main-response');
        if (!mainResponse.length) {
            mainResponse = $('<div class="deepchat-main-response"></div>');
            contentElement.append(mainResponse);
        }

        if (content && content.trim()) {
            const contentRendered = renderMarkdownContent(content);
            // 最终渲染时不添加黑点指示器
            mainResponse.html(contentRendered);
        }

        // 移除加载状态
        messageElement.removeClass('loading-message');
        messageElement.find('.fa-spinner').remove();
    }

    // 添加复制按钮等功能
    addMessageActions(messageElement, groupId);

    // 对于历史消息，如果有思考内容，默认收起状态
    const thinkBox = messageElement.find('.deepchat-think-box');
    if (thinkBox.length > 0 && reasoning && reasoning.trim()) {
        // 确保思考框处于收起状态
        thinkBox.removeAttr('open');
        thinkBox.find('.deepchat-think-status').text('思考完成（点击展开）');
    }
}

// 添加消息操作按钮
function addMessageActions(messageElement, groupId = null) {
    if (messageElement.find('.message-actions').length > 0) {
        return;
    }

    const actionsHtml = `
        <div class="message-actions">
            <button class="btn btn-sm btn-outline-secondary deepchat-copy-btn" title="复制完整内容">
                <i class="fas fa-copy"></i>
            </button>
            ${groupId ? `<button class="btn btn-sm btn-outline-danger deepchat-delete-btn" title="删除" data-group-id="${groupId}">
                <i class="fas fa-trash"></i>
            </button>` : ''}
        </div>
    `;

    messageElement.find('.message-content').append(actionsHtml);

    // 绑定复制事件
    messageElement.find('.deepchat-copy-btn').on('click', function () {
        // 获取整个消息内容区域的文本，包括思考过程
        const contentContainer = messageElement.find('.message-content');

        // 构建完整的复制内容
        let copyContent = '';

        // 添加思考过程（如果存在）
        const thinkBox = contentContainer.find('.deepchat-think-box');
        if (thinkBox.length > 0) {
            copyContent += '【AI思考过程】\n';
            copyContent += thinkBox.find('.deepchat-think-content').text().trim() + '\n\n';
        }

        // 添加主要回复内容
        const mainResponse = contentContainer.find('.deepchat-main-response');
        if (mainResponse.length > 0) {
            copyContent += '【回复内容】\n';
            copyContent += mainResponse.text().trim();
        } else {
            // 如果没有分离的主要回复，获取除了操作按钮外的所有文本
            const actionsElement = contentContainer.find('.message-actions');
            actionsElement.hide(); // 临时隐藏操作按钮
            copyContent = contentContainer.text().trim();
            actionsElement.show(); // 恢复显示操作按钮
        }

        copyText(copyContent);
    });

    // 绑定删除事件
    if (groupId) {
        messageElement.find('.deepchat-delete-btn').on('click', function () {
            const currentGroupId = $(this).data('group-id');
            deleteChatByGroupId(currentGroupId);
        });
    }
}

// 删除聊天记录（根据groupId）
function deleteChatByGroupId(groupId) {
    if (!groupId) {
        if (typeof balert === 'function') {
            balert('无效的聊天记录ID', 'warning');
        }
        return;
    }

    // 显示确认对话框
    if (typeof showConfirmationModal === 'function') {
        showConfirmationModal(
            '删除聊天记录',
            '确定要删除这条聊天记录吗？此操作无法撤销。',
            function () {
                performDeleteChatByGroupId(groupId);
            }
        );
    } else {
        // 后备确认方式
        if (confirm('确定要删除这条聊天记录吗？此操作无法撤销。')) {
            performDeleteChatByGroupId(groupId);
        }
    }
}

// 执行删除聊天记录
function performDeleteChatByGroupId(groupId) {
    // 调用后端API删除聊天记录
    $.ajax({
        type: "POST",
        url: "/DeepResearch/DeleteDeepResearchChatHistoryByGroupId",
        data: { groupId: groupId },
        dataType: "json",
        success: function (res) {
            if (res.success) {
                // 删除成功，从界面移除相关消息
                $(`.user-message[data-group-id="${groupId}"], .assistant-message[data-group-id="${groupId}"]`).remove();

                if (typeof balert === 'function') {
                    balert(`已删除 ${res.data} 条聊天记录`, 'success');
                }

                // 如果删除后没有消息了，显示欢迎消息
                if ($('#chatMessages .user-message, #chatMessages .assistant-message').length === 0) {
                    showWelcomeMessage();
                }
            } else {
                if (typeof balert === 'function') {
                    balert(res.msg || '删除聊天记录失败', 'danger');
                }
            }
        },
        error: function (err) {
            if (typeof balert === 'function') {
                balert('删除聊天记录异常', 'danger');
            }
        }
    });
}

// 初始化聊天界面
function initChatInterface() {
    // 设置默认欢迎消息
    if ($('#chatMessages').children().length === 0) {
        showWelcomeMessage();
    }
}

// 显示欢迎消息
function showWelcomeMessage() {
    const welcomeHtml = `
        <div class="welcome-message">
            <div class="assistant-message">
                <div class="message-content">
                    <p>您好！我是您的研究助手。我可以帮助您分析当前研究主题</p>
                    <p>当前Chat版本：beta 0.0.1</p>
                    <p>功能可能并不完善，将持续优化</p>
                </div>
            </div>
        </div>
    `;
    $('#chatMessages').html(welcomeHtml);
}

// 发送聊天消息
function sendChatMessage() {
    const message = $('#chatInput').val().trim();
    if (!message) return;

    // 检查是否有选中的研究项目
    if (!window.currentResearchId) {
        if (typeof balert === 'function') {
            balert('请先选择一个研究项目', 'warning');
        }
        return;
    }

    // 检查是否有选中的模型
    if (!window.currentModel) {
        if (typeof balert === 'function') {
            balert('请先选择一个AI模型', 'warning');
        }
        return;
    }

    // 生成新的groupId用于这次对话
    currentGroupId = generateGUID(true);

    // 添加用户消息
    addChatMessage(message, 'user', false, false, currentGroupId);

    // 立即创建AI助手消息DOM，显示加载状态
    currentAssistantMessageId = addChatMessage('', 'assistant', true, false, currentGroupId);
    currentAssistantMessage = '';
    currentReasoningMessage = '';

    // 清空输入框
    $('#chatInput').val('');

    // 设置生成状态并更新按钮
    chatState = 'generating';
    updateSendButtonToStop();

    // 调用AI API
    callAIAPI(message);
}

// 停止聊天生成
function stopChatGeneration() {
    if (!chatId) {
        if (typeof balert === 'function') {
            balert('没有正在进行的对话', 'warning');
        }
        return;
    }

    // 设置停止状态，防止后续推送创建新消息
    chatState = 'stopping';

    // 调用停止生成API
    $.ajax({
        type: "POST",
        url: "/Home/StopGenerate",
        dataType: "json",
        data: {
            chatId: chatId
        },
        success: function (res) {
            if (res.success) {
                // 停止成功，重置状态
                resetSendButton();

                // 如果有正在显示的助手消息，完成它并保留现有内容
                if (currentAssistantMessageId) {
                    // 完成当前消息，保留已有的内容
                    if (currentAssistantMessage && currentAssistantMessage.trim()) {
                        // 有内容则正常完成消息
                        finalizeAssistantMessage(currentAssistantMessageId, currentAssistantMessage, currentGroupId, currentReasoningMessage);
                    } else if (currentReasoningMessage && currentReasoningMessage.trim()) {
                        // 只有思考内容没有回复内容，也要保留思考内容
                        finalizeAssistantMessage(currentAssistantMessageId, '', currentGroupId, currentReasoningMessage);
                    } else {
                        // 既没有回复内容也没有思考内容，移除这个空消息
                        const messageElement = $(`[data-message-id="${currentAssistantMessageId}"]`);
                        if (messageElement.length > 0) {
                            messageElement.remove();
                        }
                    }

                    // 重置状态
                    currentAssistantMessageId = null;
                    currentAssistantMessage = '';
                    currentReasoningMessage = '';
                }

                // 立即重置停止状态
                chatState = 'idle';
            } else {
                // 停止失败，重置停止状态
                chatState = 'idle';
                if (typeof balert === 'function') {
                    balert(res.msg || '停止失败', 'danger');
                }
            }
        },
        error: function (err) {
            // 停止异常，重置停止状态
            chatState = 'idle';
            if (typeof balert === 'function') {
                balert('停止生成异常', 'danger');
            }
        }
    });
}

// 更新发送按钮为停止状态
function updateSendButtonToStop() {
    $('#sendChatBtn')
        .removeClass('btn-primary')
        .addClass('btn-danger')
        .prop('disabled', false)
        .html('<i class="fas fa-stop"></i> 停止生成');
}

// 重置发送按钮状态
function resetSendButton() {
    chatState = 'idle';
    $('#sendChatBtn')
        .removeClass('btn-danger')
        .addClass('btn-primary')
        .prop('disabled', false)
        .html('<i class="fas fa-paper-plane"></i>');
}

// 调用AI API
async function callAIAPI(message) {
    try {
        // 检查消息长度，如果过长则创建缓存
        let cacheKey = '';
        const maxDirectMessageLength = 1000; // 设置直接发送的最大长度

        if (message.length > maxDirectMessageLength) {
            // 创建缓存
            cacheKey = 'deepchat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            try {
                const cacheResponse = await $.ajax({
                    type: "POST",
                    url: "/DeepResearch/CreateCache",
                    data: {
                        content: message,
                        key: cacheKey
                    },
                    dataType: "json"
                });

                if (!cacheResponse.success) {
                    throw new Error('缓存创建失败');
                }
            } catch (error) {
                console.error('创建缓存失败:', error);

                // 更新已创建的助手消息为错误状态
                if (currentAssistantMessageId) {
                    const messageElement = $(`[data-message-id="${currentAssistantMessageId}"]`);
                    if (messageElement.length > 0) {
                        const contentElement = messageElement.find('.message-content');
                        contentElement.html(`<p><span class="text-danger">消息过长且缓存创建失败，请缩短消息长度</span></p>`);
                        // 移除加载状态
                        messageElement.removeClass('loading-message');
                        messageElement.find('.fa-spinner').remove();
                    }
                    currentAssistantMessageId = null;
                    currentAssistantMessage = '';
                    currentReasoningMessage = '';
                }

                if (typeof balert === 'function') {
                    balert('消息过长且缓存创建失败，请缩短消息长度', 'danger');
                }
                resetSendButton();
                return;
            }
        }

        // 确保SignalR连接可用
        if (!window.deepResearchConnection || window.deepResearchConnection.state !== signalR.HubConnectionState.Connected) {
            // 尝试重新连接
            if (typeof window.initDeepResearchSignalR === 'function') {
                await window.initDeepResearchSignalR();
            }

            if (!window.deepResearchConnection || window.deepResearchConnection.state !== signalR.HubConnectionState.Connected) {
                throw new Error('SignalR连接不可用');
            }
        }

        // 构建请求数据
        const chatRequest = {
            chatId: chatId,
            groupId: currentGroupId,
            deepResearchChatId: window.currentResearchId,
            model: window.currentModel,
            chatMessage: cacheKey ? '' : message, // 如果有缓存则发送空消息
            cacheKey: cacheKey,
            viewportContent: window.researchEditor.getViewportContent().content
        };

        // 通过SignalR发送消息
        await window.deepResearchConnection.invoke("ChatWithAI", chatRequest);

    } catch (error) {
        console.error('发送消息失败:', error);

        // 显示错误消息
        if (currentAssistantMessageId) {
            // 更新已存在的助手消息为错误状态，移除黑点指示器
            const messageElement = $(`[data-message-id="${currentAssistantMessageId}"]`);
            if (messageElement.length > 0) {
                const contentElement = messageElement.find('.message-content');
                contentElement.html(`<p><span class="text-danger">抱歉，消息发送失败：${escapeHtml(error.message)}</span></p>`);
                // 移除加载状态
                messageElement.removeClass('loading-message');
                messageElement.find('.fa-spinner').remove();
            }
            currentAssistantMessageId = null;
            currentAssistantMessage = '';
            currentReasoningMessage = '';
        } else {
            addChatMessage('抱歉，消息发送失败：' + error.message, 'assistant', false, true);
        }

        // 重置发送按钮状态
        resetSendButton();

        if (typeof balert === 'function') {
            balert('消息发送失败: ' + error.message, 'danger');
        }
    }
}

// 添加聊天消息
function addChatMessage(message, sender, isLoading = false, isError = false, groupId = null) {
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    let messageHtml = '';

    if (sender === 'user') {
        messageHtml = `
            <div class="user-message" data-message-id="${messageId}" ${groupId ? `data-group-id="${groupId}"` : ''}>
                <div class="message-content">
                    <p>${escapeHtml(message)}</p>
                </div>
            </div>
        `;
    } else {
        const loadingClass = isLoading ? 'loading-message' : '';
        const loadingIcon = isLoading ? '<i class="fas fa-spinner fa-spin"></i> ' : '';

        messageHtml = `
            <div class="assistant-message ${loadingClass}" data-message-id="${messageId}" ${groupId ? `data-group-id="${groupId}"` : ''}>
                <div class="message-content">
                    <p>${loadingIcon}${escapeHtml(message)}</p>
                </div>
            </div>
        `;
    }

    $('#chatMessages').append(messageHtml);
    scrollToBottom();

    return messageId;
}

// 移除加载消息
function removeLoadingMessage(messageId) {
    if (messageId) {
        $(`[data-message-id="${messageId}"]`).remove();
    }
}

// 滚动到底部
function scrollToBottom() {
    const chatMessages = $('#chatMessages')[0];
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// 格式化消息时间
function formatMessageTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
        return '刚刚';
    } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
    } else {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// HTML转义函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 保存聊天到历史记录
function saveChatToHistory(userMessage, aiResponse) {
    const chatItem = {
        id: Date.now(),
        userMessage: userMessage,
        aiResponse: aiResponse,
        timestamp: new Date(),
        researchId: window.currentResearchId
    };

    chatHistory.push(chatItem);

    // 限制历史记录数量，避免内存占用过多
    if (chatHistory.length > 100) {
        chatHistory = chatHistory.slice(-100);
    }
}

// 加载聊天历史
function loadChatHistory(researchId) {
    if (!researchId) return;

    // 显示加载状态
    $('#chatMessages').html('<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> 正在加载聊天历史...</div>');

    // 调用后端API获取聊天历史
    $.ajax({
        type: "POST",
        url: "/DeepResearch/GetDeepResearchChatHistory",
        data: { deepResearchChatId: researchId },
        dataType: "json",
        success: function (res) {
            if (res.success && res.data && res.data.length > 0) {
                // 清空当前消息
                $('#chatMessages').html('');

                // 渲染历史消息
                res.data.forEach(function (chat) {
                    if (chat.role === 'user') {
                        addChatMessage(chat.chat, 'user', false, false, chat.chatGroupId);
                    } else {
                        const messageId = addChatMessage('', 'assistant', false, false, chat.chatGroupId);
                        // 对于历史消息，直接渲染完整内容，不需要流式更新
                        updateAssistantMessage(messageId, chat.chat, chat.reasoning || '');
                        finalizeAssistantMessage(messageId, chat.chat, chat.chatGroupId, chat.reasoning || '');
                    }
                });

                // 更新本地历史记录
                chatHistory = res.data.map(chat => ({
                    id: chat.id,
                    userMessage: chat.role === 'user' ? chat.chat : '',
                    aiResponse: chat.role === 'assistant' ? chat.chat : '',
                    timestamp: new Date(chat.createTime),
                    researchId: researchId
                }));
            } else {
                // 没有历史记录，显示欢迎消息
                showWelcomeMessage();
            }
        },
        error: function (err) {
            // 加载失败，显示欢迎消息
            showWelcomeMessage();
            if (typeof balert === 'function') {
                balert('加载聊天历史失败', 'warning');
            }
        }
    });
}

// 清除聊天历史
function clearChatHistory() {
    if (!window.currentResearchId) {
        if (typeof balert === 'function') {
            balert('请先选择一个研究项目', 'warning');
        }
        return;
    }

    // 显示确认对话框
    if (typeof showConfirmationModal === 'function') {
        showConfirmationModal(
            '清除聊天记录',
            '确定要清除当前研究项目的所有聊天记录吗？此操作无法撤销。',
            function () {
                performClearChatHistory();
            }
        );
    } else {
        // 后备确认方式
        if (confirm('确定要清除当前研究项目的所有聊天记录吗？此操作无法撤销。')) {
            performClearChatHistory();
        }
    }
}

// 执行清除聊天历史
function performClearChatHistory() {
    // 调用后端API清除历史
    $.ajax({
        type: "POST",
        url: "/DeepResearch/ClearChatHistory",
        data: { chatId: window.currentResearchId },
        dataType: "json",
        success: function (res) {
            if (res.success) {
                // 清除成功，重置界面
                showWelcomeMessage();

                // 清除本地历史记录
                chatHistory = chatHistory.filter(chat => chat.researchId !== window.currentResearchId);

                if (typeof balert === 'function') {
                    balert('聊天记录已清除', 'success');
                }
            } else {
                if (typeof balert === 'function') {
                    balert(res.msg || '清除聊天记录失败', 'danger');
                }
            }
        },
        error: function (err) {
            if (typeof balert === 'function') {
                balert('清除聊天记录异常', 'danger');
            }
        }
    });
}

// 重置聊天状态（用于切换研究项目时）
function resetChatState() {
    // 清空当前显示的消息
    $('#chatMessages').html('');

    // 显示欢迎消息
    showWelcomeMessage();

    // 清空输入框
    $('#chatInput').val('');

    // 重置发送按钮状态
    resetSendButton();

    // 重置流式消息状态
    currentAssistantMessageId = null;
    currentAssistantMessage = '';
    currentReasoningMessage = '';

    // 重置生成状态和停止状态
    chatState = 'idle';
    chatId = '';
}

// 检查聊天功能是否可用
function isChatAvailable() {
    return window.currentResearchId &&
        !$('#researchEditContainer').hasClass('disabled') &&
        !$('#chat-tab').hasClass('disabled');
}

// 导出函数到全局作用域
window.initDeepResearchChat = initDeepResearchChat;
window.sendChatMessage = sendChatMessage;
window.addChatMessage = addChatMessage;
window.clearChatHistory = clearChatHistory;
window.loadChatHistory = loadChatHistory;
window.resetChatState = resetChatState;
window.isChatAvailable = isChatAvailable;
window.deleteChatByGroupId = deleteChatByGroupId;
window.stopChatGeneration = stopChatGeneration;

// 页面加载完成后自动初始化
$(document).ready(function () {
    initDeepResearchChat();
});
