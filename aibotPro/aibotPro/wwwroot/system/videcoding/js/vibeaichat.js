let connection = null;
// Store file tree as Markdown
let fileTreeMarkdown = '';
// Store editor tabs structure as Markdown
let editorTabsMarkdown = '';
// Store selected files for context
let selectedFilesForContext = [];

// Custom excluded directories (can be modified at runtime)
let customExcludedDirs = [];

let processOver = true;

let chatid = "";
let chatgroupid = "";
let assistansBoxId = "";
let sysmsg = "";
let thinkmsg = "";
let userTask = "";

// Add variable to store reasoning content
let reasoningMsg = '';

// Add variables to track partial MCP tags
let partialMcpTag = false;
let pendingMcpCommands = [];

// File edit auto-approval system - NEW
let sessionModifiedFiles = new Map(); // filePath -> { originalContent, currentContent, edits: [] }
let isInAIConversation = false; // Track if we're in an AI conversation
let conversationStartTime = null; // Track when conversation started
let originalChatGroupId = ''; // Track the original chat group ID to distinguish from MCP sub-conversations

// XML parser helper function for MCP commands
function parseMcpXml(xmlString) {
    try {
        // 首先尝试修复未转义的特殊字符，这是最常见的XML解析错误原因
        // 特别是代码内容中的&符号
        let fixedXml = xmlString;

        // 检测是否有content标签，如果有，需要特殊处理其中的内容
        const contentTagMatch = /<content>([\s\S]*?)<\/content>/g.exec(fixedXml);
        if (contentTagMatch) {
            // 提取content标签内容
            const contentValue = contentTagMatch[1];

            // 检查内容中是否已经包含CDATA
            if (contentValue.includes('<![CDATA[') && contentValue.includes(']]>')) {
                //console.log("Content already contains CDATA, keeping as is");
                // 内容已经包含CDATA，不做额外处理
            } else {
                // 创建一个CDATA包装的内容来替换原始内容
                // CDATA允许包含任何字符而不需要转义
                const cdataContent = `<content><![CDATA[${contentValue}]]></content>`;
                // 替换原始content标签及其内容
                fixedXml = fixedXml.replace(/<content>[\s\S]*?<\/content>/g, cdataContent);
            }
        }

        // 确保XML字符串是完整的，如果没有包含<mcp>标签，则添加
        let fullXml = fixedXml;
        if (!fullXml.trim().startsWith('<mcp>')) {
            fullXml = `<mcp>${fixedXml}</mcp>`;
        }

        // 使用DOMParser解析XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(fullXml, "text/xml");

        // 检查解析错误
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
            // 如果解析失败，尝试使用更激进的方法修复XML
            throw new Error("Initial XML parsing failed, trying alternative methods");
        }

        // 提取method元素
        const methodElem = xmlDoc.getElementsByTagName("method")[0];
        if (!methodElem) {
            throw new Error("Missing method element in MCP command");
        }
        const method = methodElem.textContent;

        // 提取params元素
        const paramsElem = xmlDoc.getElementsByTagName("params")[0];
        if (!paramsElem) {
            throw new Error("Missing params element in MCP command");
        }

        // 将params XML元素转换为JavaScript对象
        const params = {};
        for (const paramElem of paramsElem.children) {
            const paramName = paramElem.tagName;

            // 特殊处理content标签，从CDATA中提取内容
            if (paramName === "content") {
                // 如果有CDATA节点，从中提取内容
                if (paramElem.firstChild && paramElem.firstChild.nodeType === 4) { // 4 = CDATA_SECTION_NODE
                    params[paramName] = paramElem.firstChild.nodeValue;
                } else {
                    // 否则使用普通文本内容
                    params[paramName] = paramElem.textContent;
                }
                continue;
            }

            const paramValue = paramElem.textContent;

            // 处理特殊参数类型
            if (paramName === "edits" && paramElem.children.length > 0) {
                // 处理edits数组
                params.edits = [];
                for (const editElem of paramElem.children) {
                    if (editElem.tagName === "edit") {
                        const edit = {};
                        for (const editProp of editElem.children) {
                            edit[editProp.tagName] = editProp.textContent;
                        }
                        params.edits.push(edit);
                    }
                }
            } else if (paramElem.children.length > 0 && paramName !== "content") {
                // 处理嵌套对象
                params[paramName] = {};
                for (const nestedElem of paramElem.children) {
                    params[paramName][nestedElem.tagName] = nestedElem.textContent;
                }
            } else {
                // 转换已知的数字参数类型
                if (["startLine", "endLine"].includes(paramName) && !isNaN(paramValue)) {
                    params[paramName] = parseInt(paramValue, 10);
                } else if (paramName === "openAfterCreation" || paramName === "shouldSave") {
                    params[paramName] = paramValue.toLowerCase() === "true";
                } else {
                    params[paramName] = paramValue;
                }
            }
        }

        // 保存原始XML
        const result = { method, params, originalXml: xmlString };
        return result;
    } catch (error) {
        // 如果上面的方法失败，尝试使用正则表达式手动解析关键部分
        try {
            //console.log("Standard XML parsing failed, attempting manual extraction:", error);

            // 提取method
            const methodMatch = /<method>(.*?)<\/method>/s.exec(xmlString);
            if (!methodMatch) {
                throw new Error("Could not extract method tag");
            }
            const method = methodMatch[1].trim();

            // 创建params对象
            const params = {};

            // 提取path
            const pathMatch = /<path>(.*?)<\/path>/s.exec(xmlString);
            if (pathMatch) {
                params.path = pathMatch[1].trim();
            }

            // 提取startLine和endLine
            const startLineMatch = /<startLine>(.*?)<\/startLine>/s.exec(xmlString);
            if (startLineMatch) {
                params.startLine = parseInt(startLineMatch[1].trim(), 10);
            }

            const endLineMatch = /<endLine>(.*?)<\/endLine>/s.exec(xmlString);
            if (endLineMatch) {
                params.endLine = parseInt(endLineMatch[1].trim(), 10);
            }

            // 特殊处理content标签 - 使用非贪婪匹配提取内容
            const contentMatch = /<content>([\s\S]*?)<\/content>/s.exec(xmlString);
            if (contentMatch) {
                params.content = contentMatch[1];
            }

            // 返回手动解析的结果
            //console.log("Manual extraction successful");
            return {
                method,
                params,
                originalXml: xmlString,
                parseMethod: "manual" // 标记这是手动解析的结果
            };
        } catch (manualError) {
            // 如果手动解析也失败，抛出组合错误
            const combinedError = new Error(
                `XML parsing failed. Original error: ${error.message}. Manual parsing error: ${manualError.message}`
            );
            combinedError.originalError = error;
            combinedError.manualError = manualError;
            throw combinedError;
        }
    }
}

// getFileContent function has been moved to vibecodingfileread.js

/**
 * Function to set the file tree Markdown from vibecoding.js
 * @param {string} markdown - The generated Markdown representation of the file tree
 */
window.setFileTreeMarkdown = function (markdown) {
    fileTreeMarkdown = markdown;
    //console.log('File tree Markdown updated');

    // You can trigger any additional actions here when the file tree is updated
    // For example, notify the user or update UI elements
};

/**
 * Function to get the current file tree Markdown
 * @returns {string} The current Markdown representation of the file tree
 */
function getFileTreeMarkdown() {
    return fileTreeMarkdown;
}

/**
 * Function to set the editor tabs Markdown from vibecoding.js
 * @param {string} markdown - The generated Markdown representation of the editor tabs
 */
window.setEditorTabsMarkdown = function (markdown) {
    editorTabsMarkdown = markdown;
    //console.log('Editor tabs Markdown updated');
};

/**
 * Function to get the current editor tabs Markdown
 * @returns {string} The current Markdown representation of the editor tabs
 */
function getEditorTabsMarkdown() {
    return editorTabsMarkdown;
}

/**
 * Add custom directories to exclude from the file tree Markdown
 * @param {string|string[]} dirs - Directory name or array of directory names to exclude
 */
function addExcludedDirectories(dirs) {
    if (typeof dirs === 'string') {
        if (!customExcludedDirs.includes(dirs)) {
            customExcludedDirs.push(dirs);
        }
    } else if (Array.isArray(dirs)) {
        dirs.forEach(dir => {
            if (!customExcludedDirs.includes(dir)) {
                customExcludedDirs.push(dir);
            }
        });
    }

    // If we have a reference to the vibecoding.js excluded directories, update them
    if (typeof window.updateExcludedDirectories === 'function') {
        window.updateExcludedDirectories(customExcludedDirs);
    }
}

/**
 * Remove directories from the exclusion list
 * @param {string|string[]} dirs - Directory name or array of directory names to include again
 */
function removeExcludedDirectories(dirs) {
    if (typeof dirs === 'string') {
        const index = customExcludedDirs.indexOf(dirs);
        if (index !== -1) {
            customExcludedDirs.splice(index, 1);
        }
    } else if (Array.isArray(dirs)) {
        dirs.forEach(dir => {
            const index = customExcludedDirs.indexOf(dir);
            if (index !== -1) {
                customExcludedDirs.splice(index, 1);
            }
        });
    }

    // If we have a reference to the vibecoding.js excluded directories, update them
    if (typeof window.updateExcludedDirectories === 'function') {
        window.updateExcludedDirectories(customExcludedDirs);
    }
}

/**
 * Get the current list of excluded directories
 * @returns {string[]} Array of excluded directory names
 */
function getExcludedDirectories() {
    return [...customExcludedDirs];
}

// 1. 封装token检查函数
function checkToken() {
    const token = localStorage.getItem('aibotpro_userToken');
    if (!token) {
        window.location.href = "/Home/Welcome";
        return false;
    }
    return token;
}

// 2. 封装connection创建函数 
function createConnection(token) {
    connection = new signalR.HubConnectionBuilder()
        .withUrl('/vibeCodingHub', {
            accessTokenFactory: () => token
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, null]) // 自定义重连间隔
        .build();
    return connection;
}

// 3. 优化启动连接的处理
async function startConnection(connection) {
    try {
        await connection.start();
        console.log('VibeCoding与服务器握手成功 :-)');
    } catch (error) {
        console.error('VibeCoding与服务器握手失败:', error);

        if (isTokenExpiredError(error)) {
            localStorage.removeItem('aibotpro_userToken'); // 清除过期token
            localStorage.removeItem('aibotpro_userToken_Expiration');
            window.location.href = "/Users/Login";
            return;
        }

        // 其他错误处理
        sendExceptionMsg('连接失败: ' + error.message);
    }
}

// 4. 改进token过期检查
function isTokenExpiredError(error) {
    return error.statusCode === 401 ||
        error.message?.toLowerCase().includes('token') ||
        error.message?.toLowerCase().includes('unauthorized');
}

// 5. 主函数整合所有功能
async function initializeConnection() {
    const token = checkToken();
    if (!token) return;

    const connection = createConnection(token);

    // 注册事件处理
    connection.onreconnecting((error) => {
        console.warn(`连接断开,正在重连...`, error);
        // 可以显示重连UI提示
    });

    connection.onreconnected((connectionId) => {
        console.log(`重连成功! ID: ${connectionId}`);
        // 可以隐藏重连UI提示
    });

    connection.onclose(async (error) => {
        console.error(`连接关闭:`, error);
        // 可以显示断开连接UI提示
        await startConnection(connection); // 尝试重新连接
    });

    // 启动连接
    await startConnection(connection);

    return connection;
}

// 6. 启动应用
(async () => {
    try {
        const connection = await initializeConnection();
        // 在这里可以使用connection进行后续操作
    } catch (error) {
        console.error('初始化连接失败:', error);
    }
})();

// AI assistant
$(document).ready(function () {
    // Initialize the file selector after models are loaded
    $(document).on('aiModelsLoaded', function (e, model) {
        if (typeof VibeFileSelector !== 'undefined') {
            // Initialize with the current model ID for image uploads
            VibeFileSelector.init('#ai-question', model ? model.id : '');
            //console.log('File selector initialized with model:', model);
        } else {
            console.warn('VibeFileSelector not found');
        }
    });

    // Initialize without model if the event doesn't fire
    setTimeout(() => {
        if (typeof VibeFileSelector !== 'undefined' &&
            !$._data(document, 'events').aiModelsLoaded) {
            VibeFileSelector.init('#ai-question');
            //console.log('File selector initialized without model (fallback)');
        }
    }, 2000);

    // Existing event handlers
    $('#ask-ai-btn').on('click', askAI);
    $('#ai-question').on('keydown', function (e) {
        if (e.which === 13) {
            if ((isMacOS() ? e.metaKey : e.ctrlKey) || e.shiftKey) {
                var start = this.selectionStart;
                var end = this.selectionEnd;
                var value = $(this).val();
                $(this).val(value.substring(0, start) + '\n' + value.substring(end));
                this.selectionStart = this.selectionEnd = start + 1;
                e.preventDefault();
                return false;
            } else {
                // 单独按 Enter 键，触发发送操作
                e.preventDefault();
                askAI();
                return false;
            }
        }
    });

    // Handle dropdown item selections
    $(document).on('click', '#ai-model-dropdown-menu .dropdown-item', function () {
        const modelId = $(this).data('model-id');
        // Update the VibeFileSelector with the new model ID
        if (typeof VibeFileSelector !== 'undefined') {
            // Reinitialize with the new model ID
            VibeFileSelector.init('#ai-question', modelId);
        }
    });

    // Handle mode selection
    $(document).on('click', '#ai-mode-dropdown-menu .dropdown-item', function () {
        const mode = $(this).data('mode');
        $('#selected-mode-text').text($(this).text());
        $('#ai-mode-selector').val(mode);
    });

    // Initialize default mode to Agent
    $('#ai-mode-selector').val('agent');
    $('#selected-mode-text').text('Agent模式');

    // Enhance the AI chat interface with a file drop zone
    enhanceAIChatInterface();
});

/**
 * Enhance the AI chat interface with additional features
 */
function enhanceAIChatInterface() {
    // Function is empty after removing the drop functionality
    // The file sharing drag-and-drop feature has been removed
}

/**
 * Show notification when file is dropped
 * @param {Object} fileData - File data object
 * @param {string} target - Target area ('input' only, 'chat' removed)
 */
function showDropNotification(fileData, target = 'input') {
    // Make sure we have valid file data
    if (!fileData || !fileData.name) {
        //console.error('Invalid file data for notification');
        return;
    }

    // Create notification element
    const notification = $(`
        <div class="vibe-file-notification">
            <i class="fas ${fileData.type === 'folder' ? 'fa-folder' : 'fa-file'}"></i>
            Added ${fileData.name} to context
        </div>
    `);

    // Add to body
    $('body').append(notification);

    // Animate in
    setTimeout(() => {
        notification.addClass('show');

        // Remove after delay
        setTimeout(() => {
            notification.removeClass('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 2000);
    }, 10);
}

/**
 * Detect if the user is on macOS
 * @returns {boolean} true if the user is on macOS
 */
function isMacOS() {
    return navigator.platform.indexOf('Mac') !== -1 ||
        navigator.userAgent.indexOf('Mac') !== -1;
}

/**
 * Ask a question to the AI
 */
function askAI() {
    if (!processOver) {
        showNotification('对话进行中,请结束后再试', 'warning');
        return;
    }

    // Start conversation tracking
    isInAIConversation = true;
    conversationStartTime = Date.now();
    sessionModifiedFiles.clear(); // Clear previous session files

    const question = $('#ai-question').val().trim();
    userTask = question;
    const selectedModel = $('#ai-model-selector').val();
    const selectedMode = $('#ai-mode-selector').val() || 'agent'; // Default to agent mode if not set

    if (!selectedModel) {
        showErrorDialog('请选择一个AI模型');
        return;
    }

    // Get files and images
    const selectedFiles = [];
    const uploadedImages = [];

    // Check if we have a question or selected files/images
    if (!question) {
        showNotification('请输入问题', 'warning');
        return;
    }

    // Ensure we have up-to-date editor tabs info
    if (typeof window.generateEditorTabsMarkdown === 'function') {
        window.generateEditorTabsMarkdown();
    }
    processOver = false;
    // Clear input
    $('#ai-question').val('');
    chatgroupid = generateGUID(true);
    originalChatGroupId = chatgroupid; // Store the original chat group ID
    var msgid_u = generateGUID(true);
    var msgid_g = generateGUID(true);
    assistansBoxId = msgid_g;

    // Add user message to UI
    let userMessageHtml = `<div class="ai-message user-message" id="${msgid_u}" data-chatgroupid="${chatgroupid}">`;

    // Add message text if present
    if (question) {
        userMessageHtml += `<div class="user-question-text">${formatMarkdown(escapeHtml(question))}</div>`;
    }

    // Add file references if any
    if (typeof VibeFileSelector !== 'undefined') {
        // Get selected files
        selectedFiles.push(...VibeFileSelector.getSelectedFiles());

        // Store selected files for context
        selectedFilesForContext = [...selectedFiles];

        // Get uploaded images
        uploadedImages.push(...VibeFileSelector.getUploadedImages());

        // Add files to message if present
        if (selectedFiles.length > 0) {
            userMessageHtml += `<div class="selected-files-list">`;
            selectedFiles.forEach(file => {
                const icon = file.type === 'folder' ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>';
                userMessageHtml += `<div class="selected-file-item">${icon} ${escapeHtml(file.path)}</div>`;
            });
            userMessageHtml += `</div>`;
        }

        // Add images to message if present
        if (uploadedImages.length > 0) {
            userMessageHtml += `<div class="uploaded-images-list">`;
            uploadedImages.forEach(imagePath => {
                userMessageHtml += `
                    <div class="uploaded-image-item">
                        <img src="${imagePath}" alt="上传图片" onclick="openImagePreview('${imagePath}')">
                    </div>
                `;
            });
            userMessageHtml += `</div>`;
        }

        // Clear selected files and images after sending
        // VibeFileSelector.clearAll();
    }

    userMessageHtml += `</div>`;
    $('#ai-qa-content').append(userMessageHtml);

    // Scroll to bottom
    const content = document.getElementById('ai-qa-content');
    content.scrollTop = content.scrollHeight;

    // Add a "thinking" message
    const thinkingMsg = $(`
        <div class="ai-message ai-response thinking">
          <div id="${msgid_g}" data-chatgroupid="${chatgroupid}"></div>
          <div class="spinner-grow spinner-grow-sm LDI"></div>  
        </div>
    `);
    $('#ai-qa-content').append(thinkingMsg);
    content.scrollTop = content.scrollHeight;

    // Change send button to stop button
    $('#ask-ai-btn').removeClass('btn-primary').addClass('btn-danger');
    $('#ask-ai-btn').html('<i class="fas fa-stop"></i> 停止');
    $('#ask-ai-btn').off('click').on('click', stopAIGeneration);

    // Get model info
    const selectedModelOption = $('#ai-model-selector option:selected');
    const modelName = selectedModelOption.data('name') || '';
    const modelNick = selectedModelOption.data('nick') || '';
    const visionModel = selectedModelOption.data('vision') === true || selectedModelOption.data('vision') === 'true';
    thisAiModel = modelName;

    // Get code context from editor
    const codeContext = getCodeContext();

    var data = {
        "msg": question,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": uploadedImages,
        "file_path": selectedFiles.length > 0 ? selectedFiles.map(file => file.path) : [],
        "system_prompt": "",
        "systemCacheKey": "",
        "inputCacheKey": "",
        "stream": true,
        "useMode": selectedMode // Add the selected mode to the data
    };

    // Make sure to wait for the cache key before sending the message
    const sendMessage = async () => {
        if (codeContext) {
            try {
                const systemCacheKey = await createCache(codeContext, "VibeCoding_" + generateGUID(true));
                if (systemCacheKey) {
                    data.systemCacheKey = systemCacheKey;
                }
                if (data.msg.length > 500) {
                    const inputCacheKey = await createCache(data.msg, "VibeCodingInput_" + generateGUID(true));
                    if (inputCacheKey) {
                        data.inputCacheKey = inputCacheKey;
                        data.msg = inputCacheKey;
                    }
                }
            } catch (error) {
                //console.error('Error creating cache:', error);
                $('.LDI').remove();
                resetSendButton();
                processOver = true;
            }
        }

        connection.invoke("SendVibeCodingMessage", data)
            .then(function () {
                // 消息发送成功
            })
            .catch(function (err) {
                //console.error("Send message failed:", err);
                $('.LDI').remove();
                resetSendButton();
                processOver = true;
            });
    };

    sendMessage();
}

//VibeCodingReceiveMessage
connection.on('VibeCodingReceiveMessage', async function (message) {
    chatid = message.chatid;

    if (message.message != null) {
        // Add message to the accumulated message
        sysmsg += message.message;

        // Check if this chunk might contain parts of an MCP tag
        const openTagIndex = sysmsg.lastIndexOf('<mcp>');
        const closeTagIndex = sysmsg.lastIndexOf('</mcp>');

        // We have a partial tag if there's an open tag with no matching close tag
        partialMcpTag = openTagIndex > closeTagIndex && openTagIndex !== -1;

        // Extract and store MCP commands, but keep them in the original markdown
        const mcpRegex = /<mcp>([\s\S]*?)<\/mcp>/g;
        let match;

        // Reset pending commands on each complete pass
        pendingMcpCommands = [];

        // Only process the first complete MCP command
        if ((match = mcpRegex.exec(sysmsg)) !== null) {
            const originalTag = match[0]; // 完整的<mcp>...</mcp>标签
            const mcpContent = match[1]; // 标签内的内容

            //console.log('Found MCP tag:', originalTag);

            // Store only the first command with both the complete tag and inner content
            pendingMcpCommands.push({
                originalTag: originalTag,
                content: mcpContent,
                id: generateGUID(true)
            });
        }

        // Prepare content for display - handle both complete and partial tags
        let cleanedContent;

        if (partialMcpTag) {
            // For partial tags, only remove complete MCP tags and the partial opening tag
            cleanedContent = sysmsg.replace(/<mcp>[\s\S]*?<\/mcp>/g, '');

            // Only attempt to substring if we actually found a partial tag
            if (openTagIndex !== -1) {
                cleanedContent = cleanedContent.substring(0, cleanedContent.lastIndexOf('<mcp>'));
            }
        } else {
            // For complete tags, just remove all MCP tags
            cleanedContent = sysmsg.replace(/<mcp>[\s\S]*?<\/mcp>/g, '');
        }

        // Render the markdown content
        // Create dedicated containers if they don't exist
        if ($(`#${assistansBoxId}`).children('.content-container').length === 0) {
            $(`#${assistansBoxId}`).html(`
                <div class="content-container"></div>
                <div class="progress-container"></div>
            `);
        }

        // Update only the content container, preserving the progress container
        $(`#${assistansBoxId} .content-container`).html(md.render(cleanedContent));
        $(`#${assistansBoxId} .content-container pre code`).each((i, block) => hljs.highlightElement(block));

        // If we have a partial tag, add a visual indicator that a command is being prepared
        if (partialMcpTag) {
            // Create a unique ID for this progress bar
            const progressId = `mcp-progress-${assistansBoxId}`;
            const progressContainer = $(`#${assistansBoxId} .progress-container`);

            if ($(`#${progressId}`).length === 0) {
                progressContainer.html(`
                <div class="mcp-preparing text-info">
                    <i class="fas fa-tools"></i> 正在接收命令...
                    <div class="progress mt-2" style="height: 10px;">
                        <div id="${progressId}" class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" style="width: 5%;" 
                             aria-valuenow="5" aria-valuemin="0" aria-valuemax="100">
                        </div>
                    </div>
                </div>
                `);
            }
            // Start simulating progress
            simulateMcpProgress(progressId);
        } else {
            // Clear progress container if no partial tag
            $(`#${assistansBoxId} .progress-container`).empty();
        }

        // Create or update MCP elements container
        let mcpContainer = $(`#mcp-container-${assistansBoxId}`);
        if (mcpContainer.length === 0 && pendingMcpCommands.length > 0) {
            mcpContainer = $(`<div id="mcp-container-${assistansBoxId}" class="mcp-commands-container"></div>`);
            $(`#${assistansBoxId}`).after(mcpContainer);
        }

        // Clear existing MCP elements
        if (mcpContainer.length > 0) {
            mcpContainer.empty();
        }

        // Add MCP loading elements
        pendingMcpCommands.forEach(cmd => {
            const loadingElement = $(`
                <div class="mcp-command-item" id="mcp-${cmd.id}">
                    <div class="mcp-loading">
                        <i class="fas fa-circle-notch fa-spin"></i> 执行命令中...
                    </div>
                </div>
            `);
            if ($(`#mcp-${cmd.id}`).length === 0) {
                mcpContainer.append(loadingElement);
            }
        });
    }

    // Track reasoning content if available
    if (message.reasoning != null && message.reasoning != "" && message.reasoning != "null") {
        // Store reasoning content
        if (!reasoningMsg) {
            // Initialize the reasoning container if it doesn't exist yet
            $(`#${assistansBoxId}`).parent().append(`
                <div class="reasoning-container" data-msgid="${assistansBoxId}">
                    <div class="reasoning-header">
                        <button class="toggle-reasoning collapsed">
                            <i class="fas fa-chevron-down"></i> 查看思考过程
                        </button>
                    </div>
                    <div class="reasoning-content" id="reasoning-${assistansBoxId}" style="display: none;"></div>
                </div>
            `);
        }

        reasoningMsg += message.reasoning;
        $(`#reasoning-${assistansBoxId}`).html(md.render(reasoningMsg));
        $(`#reasoning-${assistansBoxId} pre code`).each((i, block) => hljs.highlightElement(block));
    }

    if (message.isFinished) {
        $('.LDI').remove();
        // Reset button back to send state
        resetSendButton();
        processOver = true;

        // Check if we have pending MCP commands
        if (pendingMcpCommands.length > 0) {
            // Process all pending MCP commands while keeping conversation state
            await processPendingMcpCommands();
            // After processing MCP commands, AI will continue, so don't show final diff yet
        } else {
            // No MCP commands means AI is done with tool calls
            // Show final diff if we have modifications
            if (isInAIConversation && sessionModifiedFiles.size > 0) {
                await showFinalDiffConfirmation();
            }

            // End conversation tracking
            isInAIConversation = false;
            conversationStartTime = null;
            originalChatGroupId = '';
        }

        // Reset variables for next conversation
        partialMcpTag = false;
        sysmsg = '';
        reasoningMsg = ''; // Reset reasoning content
    }
});

/**
 * Update progress for MCP command preparation - no timer, just increments each time called
 * @param {string} progressId - The ID of the progress bar element
 */
function simulateMcpProgress(progressId) {
    // Get the progress element
    const progressBar = document.getElementById(progressId);
    if (!progressBar) return;

    // Get current progress from the element
    let currentProgress = parseFloat(progressBar.getAttribute('aria-valuenow') || 5);

    // Simple increment based on current progress
    let increment;
    if (currentProgress < 40) {
        // Faster at start
        increment = 0.5;
    } else if (currentProgress < 75) {
        // Medium in middle
        increment = 0.3;
    } else {
        // Slower at end
        increment = 0.1;
    }

    // Simply add the increment
    currentProgress += increment;

    // Limit to 95%
    currentProgress = Math.min(95, currentProgress);

    // Update the progress bar
    progressBar.style.width = `${currentProgress}%`;
    progressBar.setAttribute('aria-valuenow', currentProgress);
}

/**
 * Reset the send button to its original state
 */
function resetSendButton() {
    $('#ask-ai-btn').removeClass('btn-danger').addClass('btn-primary');
    $('#ask-ai-btn').html('<i class="fas fa-paper-plane"></i> 发送');
    $('#ask-ai-btn').prop('disabled', false);
    // Remove stop event and re-add send event
    $('#ask-ai-btn').off('click').on('click', askAI);
}

/**
 * Process all pending MCP commands
 */
async function processPendingMcpCommands() {
    // Clear any ongoing progress simulations
    clearAllMcpProgressSimulations();

    if (pendingMcpCommands.length === 0) {
        return;
    }

    // Process each command sequentially to avoid race conditions
    for (const pendingCommand of pendingMcpCommands) {
        try {
            try {
                // 直接解析XML内容，不做额外清理
                // 传入内容部分，不包含<mcp></mcp>标签
                const mcpCommand = parseMcpXml(pendingCommand.content);

                // 执行成功解析的命令
                await executeMcpCommand(mcpCommand, pendingCommand.id);
                $(`#mcp-${pendingCommand.id}`).html(`
                    <div class="mcp-result">
                        ${getMcpCommandIcon(mcpCommand.method)} ${formatMcpCommandSummary(mcpCommand)}
                    </div>
                `);
                // Change send button to stop button
                $('#ask-ai-btn').removeClass('btn-primary').addClass('btn-danger');
                $('#ask-ai-btn').html('<i class="fas fa-stop"></i> 停止');
                $('#ask-ai-btn').off('click').on('click', stopAIGeneration);
            } catch (parseError) {
                //console.error('XML parsing error:', parseError);

                // 增强的错误日志记录
                //console.log('XML content that failed parsing:', pendingCommand.content);

                // 尝试修复常见XML问题
                if (pendingCommand.content.includes('&') && !pendingCommand.content.includes('&amp;')) {
                    //console.log('Attempting to fix unescaped ampersands');
                    const fixedContent = pendingCommand.content.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;');
                    try {
                        const mcpCommand = parseMcpXml(fixedContent);
                        //console.log('Parse succeeded with ampersand fix:', mcpCommand);

                        // 执行成功解析的命令
                        await executeMcpCommand(mcpCommand, pendingCommand.id);
                        $(`#mcp-${pendingCommand.id}`).html(`
                            <div class="mcp-result">
                                ${getMcpCommandIcon(mcpCommand.method)} ${formatMcpCommandSummary(mcpCommand)}
                            </div>
                        `);
                        continue; // 跳过下面的错误处理
                    } catch (e) {
                        // 继续常规错误处理
                        console.log('Fix attempt failed:', e);
                    }
                }

                throw parseError;
            }
        } catch (error) {
            console.error('Error processing MCP command:', error);

            // 为AI处理格式化错误消息
            const errorContent = `# MCP命令处理错误\n\n` +
                `## 错误详情\n` +
                `- 错误类型: ${error.name}\n` +
                `- 错误信息: ${error.message}\n` +
                `- 错误堆栈: ${error.stack || '无'}\n\n` +
                `## 原始命令内容\n\`\`\`\n${pendingCommand.originalTag}\n\`\`\`\n\n` +
                `请根据以上错误信息，提供解决方案或替代方案。`;

            // 在MCP元素中显示错误
            $(`#mcp-${pendingCommand.id}`).html(`
                <div class="mcp-error">
                    <div>命令处理错误: ${error.message}</div>
                    <div class="mcp-error-details">
                        <pre>${escapeHtml(pendingCommand.originalTag)}</pre>
                    </div>
                </div>
            `);

            // 创建错误处理的命令对象
            const errorCommand = {
                method: 'error',
                params: {
                    content: errorContent
                }
            };

            // 使用executeMcpCommand处理错误消息
            await executeMcpCommand(errorCommand, pendingCommand.id);
        }
    }
}

/**
 * Execute an MCP command
 * @param {Object} command - The parsed MCP command
 * @param {string} commandId - The unique ID for this command
 */
async function executeMcpCommand(command, commandId) {
    // Check if this is a valid command
    if (!command.method || !command.params) {
        console.error('Invalid MCP command format:', command);
        return;
    }
    const selectedMode = $('#ai-mode-selector').val() || 'agent';

    // Create a unique identifier for this command execution
    const executionId = generateGUID(true);
    try {
        // Don't change processOver or conversation state during MCP execution
        // processOver = false; // Remove this line
        var content = await runCommand(command, commandId);
        chatgroupid = generateGUID(true);
        var msgid_u = generateGUID(true);
        var msgid_g = generateGUID(true);
        assistansBoxId = msgid_g;
        // Prepare data for server
        var data = {
            "msg": content,
            "chatid": chatid,
            "aiModel": thisAiModel,
            "chatgroupid": chatgroupid,
            "msgid_u": msgid_u,
            "msgid_g": msgid_g,
            "ip": IP,
            "image_path": [],
            "file_path": [],
            "system_prompt": "",
            "systemCacheKey": "",
            "inputCacheKey": "",
            "stream": true,
            "shouldSave": false,
            "useMode": selectedMode // Add the selected mode to the data
        };

        // console.log('MCP command data:', data);
        // Add a "thinking" message
        const thinkingMsg = $(`
                <div class="ai-message ai-response thinking">
                  <div id="${msgid_g}" data-chatgroupid="${chatgroupid}"></div>
                  <div class="spinner-grow spinner-grow-sm LDI"></div>  
                </div>
            `);
        $('#ai-qa-content').append(thinkingMsg);

        // Scroll to bottom
        const aiQaContent = document.getElementById('ai-qa-content');
        if (aiQaContent) {
            aiQaContent.scrollTop = aiQaContent.scrollHeight;
        }

        const codeContext = getCodeContext();
        // Send the command to the server
        const sendMessage = async () => {
            if (codeContext) {
                try {
                    const systemCacheKey = await createCache(codeContext, "VibeCoding_" + generateGUID(true));
                    if (systemCacheKey) {
                        data.systemCacheKey = systemCacheKey;
                    }
                    if (data.msg.length > 500) {
                        const inputCacheKey = await createCache(data.msg, "VibeCodingInput_" + generateGUID(true));
                        if (inputCacheKey) {
                            data.inputCacheKey = inputCacheKey;
                            data.msg = inputCacheKey;
                        }
                    }
                } catch (error) {
                    console.error('Error creating cache:', error);
                }
            }

            connection.invoke("SendVibeCodingMessage", data)
                .then(function () {
                    // 消息发送成功
                })
                .catch(function (err) {
                    console.error("Send message failed:", err);
                    // Reset UI state if message sending fails
                    $('.LDI').remove();
                    resetSendButton();
                    processOver = true;
                });
        };

        sendMessage();
    } catch (error) {
        console.error('MCP command execution failed:', error);
        // Show error in the MCP element
        $(`#mcp-${commandId}`).html(`
            <div class="mcp-error">
                命令执行失败: ${error.message || '未知错误'}
            </div>
        `);

        // Reset UI state if command execution fails
        $('.LDI').remove();
        resetSendButton();
        processOver = true;
    }
}

/**
 * Render the result of an MCP command
 * @param {Object} command - The original MCP command
 * @param {Object} result - The result from the server
 * @returns {Promise<string>} HTML to display
 */
async function runCommand(command, commandId) {
    // Handle different command types
    var content = '';
    try {
        switch (command.method) {
            case 'readfile_path':
                const filepath = command.params.path;
                const startLine = command.params.startLine;
                const endLine = command.params.endLine;

                // Use the VibeFileReader module instead of the local function
                const fileContent = await window.VibeFileReader.getFileContent(filepath, startLine, endLine);
                content = window.VibeFileReader.formatFileContentForAI(filepath, startLine, endLine, fileContent, true);
                break;
            case 'create_file':
                const createfilepath = command.params.path;
                const createfileContent = command.params.content || '';

                // Use the VibeFileCreator module to create the file
                try {
                    const createdFilePath = await window.VibeFileCreator.createFile(
                        createfilepath,
                        createfileContent
                    );

                    // If the file was successfully created, check if we should open it
                    if (command.params.openAfterCreation !== false && typeof openFile === 'function') {
                        try {
                            // Try to open the file in the editor
                            await openFile(createdFilePath);
                        } catch (openError) {
                            console.warn('Failed to open file after creation:', openError);
                        }
                    }

                    content = window.VibeFileCreator.formatFileCreationForAI(createdFilePath);
                } catch (error) {
                    // Handle cancellation differently from other errors
                    if (error.message === 'File creation cancelled by user') {
                        content = `# 文件创建已取消\n\n用户拒绝了对文件 \`${createfilepath}\` 的更改。`;
                    } else {
                        content = `# 创建文件失败\n\n错误: ${error.message}`;
                    }
                }
                break;
            case 'edit_file':
                const selectedModelOption = $('#ai-model-selector option:selected');
                if (selectedModelOption === 'chat') {
                    content = `# 编辑文件失败\n\n错误: 当前模式为Chat模式，无法编辑文件,请直接回答需要修改的文件和代码内容即可`;
                    break;
                }
                const editfilepath = command.params.path;
                const editfileContent = command.params.content || '';
                const editfileStartLine = command.params.startLine || 1;
                const editfileEndLine = command.params.endLine || editfileStartLine;

                // Debug: Log conversation state
                console.log(`Edit file called: ${editfilepath}, isInAIConversation: ${isInAIConversation}, skipConfirmation: ${isInAIConversation}`);

                // Track file modification for session
                await trackFileModification(editfilepath, editfileContent, editfileStartLine, editfileEndLine);

                // Perform a single edit
                try {
                    // Use the VibeFileEditor module to edit the file
                    // During conversation, auto-approve without backup
                    const editResult = await window.VibeFileEditor.editFile(
                        editfilepath,
                        editfileContent,
                        editfileStartLine,
                        editfileEndLine,
                        isInAIConversation, // skipConfirmation = true during conversation
                        isInAIConversation  // skipBackup = true during conversation (no backup for intermediate edits)
                    );

                    // Prepare edit details for AI confirmation
                    const editDetails = {
                        startLine: editfileStartLine,
                        endLine: editfileEndLine,
                        newContent: editfileContent
                    };

                    content = await window.VibeFileEditor.formatFileEditForAI(editResult, editDetails);
                } catch (error) {
                    // Handle error
                    content = `# 编辑文件失败\n\n错误: ${error.message}`;
                }

                break;
            case 'code_base_search':
                const query = command.params.query;
                const path = command.params.path;
                const fullFileContent = await window.VibeFileReader.getFileContent(path, 0, 0, true);
                //每500行进行切片
                const lines = fullFileContent.split('\n');
                const checkchunks = [];//切片内容
                for (let i = 0; i < lines.length; i += 500) {
                    checkchunks.push(lines.slice(i, i + 500).join('\n'));
                }

                // Update MCP element to show progress
                $(`#mcp-${commandId}`).html(`
                    <div class="mcp-progress">
                        <div><i class="fas fa-search"></i> 正在搜索代码库...</div>
                        <div class="progress mt-2" style="height: 10px;">
                            <div id="search-progress-${commandId}" class="progress-bar" 
                                 role="progressbar" style="width: 0%;" 
                                 aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                            </div>
                        </div>
                        <div id="search-status-${commandId}" class="mt-1">准备搜索 ${checkchunks.length} 个代码块...</div>
                    </div>
                `);

                for (let i = 0; i < checkchunks.length; i++) {
                    // Update progress bar
                    const progressPercent = Math.round((i / checkchunks.length) * 100);
                    $(`#search-progress-${commandId}`).css('width', `${progressPercent}%`).attr('aria-valuenow', progressPercent);
                    $(`#search-status-${commandId}`).text(`正在搜索第 ${i + 1}/${checkchunks.length} 个代码块 (${progressPercent}%)...`);

                    const searchResults = await window.VibeCodeSearch.searchCodeBase(query, checkchunks[i]);
                    if (searchResults && searchResults.length > 0) {
                        content += '**代码分析搜索结果** \n\n' + searchResults;
                    }
                }

                // Update to completed state
                $(`#search-progress-${commandId}`).css('width', '100%').attr('aria-valuenow', 100);
                $(`#search-status-${commandId}`).text(`搜索完成 - 处理了 ${checkchunks.length} 个代码块`);
                $(`#mcp-${commandId}`).html(`
                    <div class="mcp-result">
                        <i class="fas fa-check"></i> 代码搜索完成 (${checkchunks.length} 个代码块)
                    </div>
                `);
                break;
            case 'web_scraping':
                const webQuery = command.params.query;

                try {
                    const webSearchResults = await window.VibeWebSearch.searchWeb(webQuery);
                    if (webSearchResults && webSearchResults.length > 0) {
                        content = '**联网搜索结果** \n\n' + webSearchResults;
                    } else {
                        content = '**联网搜索结果** \n\n未找到相关信息';
                    }
                } catch (error) {
                    content = `**联网搜索失败** \n\n错误: ${error.message}`;
                }
                break;
            case 'error':
                // Direct passthrough for error messages
                content = command.params.content || '# 未知错误\n\n发生了一个未具体说明的错误。';
                break;

            default:
                content = `# 未知命令类型\n\n错误: 不支持的命令类型 "${command.method}"`;
                break;
        }
    } catch (error) {
        // Format error message for AI processing
        content = `# 命令执行错误\n\n` +
            `## 错误详情\n` +
            `- 命令类型: ${command.method}\n` +
            `- 错误信息: ${error.message}\n` +
            `- 错误堆栈: ${error.stack || '无'}\n\n` +
            `## 原始命令\n\`\`\`xml\n${command.originalXml || ''}\n\`\`\`\n\n` +
            `请根据以上错误信息，提供解决方案或替代方案。`;
    }
    if (userTask) {
        content = `**提醒：用户问题或需求：** \n\n ${userTask} \n\n` + content;
    }
    return content;
}

// Add event handler for toggling reasoning visibility
$(document).on('click', '.toggle-reasoning', function () {
    const reasoningContent = $(this).closest('.reasoning-container').find('.reasoning-content');
    const isCollapsed = $(this).hasClass('collapsed');

    if (isCollapsed) {
        // Expand
        reasoningContent.slideDown(200);
        $(this).removeClass('collapsed');
        $(this).html('<i class="fas fa-chevron-up"></i> 收起思考过程');
    } else {
        // Collapse
        reasoningContent.slideUp(200);
        $(this).addClass('collapsed');
        $(this).html('<i class="fas fa-chevron-down"></i> 查看思考过程');
    }
});

/**
 * Get the current code context from the editor
 * @returns {string} Current code in the editor or empty string if no file is open
 */
function getCodeContext() {
    let contextInfo = '';

    // Add project structure information
    if (fileTreeMarkdown) {
        contextInfo += "## Project Directory Structure\n\n";
        contextInfo += fileTreeMarkdown + "\n\n";
    }

    // Add workspace file paths (editor tabs information)
    if (editorTabsMarkdown) {
        contextInfo += "## File path of the workspace\n\n";
        contextInfo += editorTabsMarkdown + "\n\n";
    }

    // Add user selected files information from the global variable
    if (selectedFilesForContext && selectedFilesForContext.length > 0) {
        contextInfo += "## User selected file path\n\n";
        selectedFilesForContext.forEach(file => {
            contextInfo += `* ${file.path}\n`;
        });
        contextInfo += "\n";
    }

    // Add current file content
    // if (typeof editor !== 'undefined' && editor && currentOpenFile) {
    //     const fileContent = editor.getValue();
    //     contextInfo += `## 当前文件内容: ${currentOpenFile}\n\n`;
    //     contextInfo += "```\n" + fileContent + "\n```\n";
    // }

    return contextInfo || '';
}

/**
 * Format markdown text
 * @param {string} text - Markdown text
 * @returns {string} HTML
 */
function formatMarkdown(text) {
    // Replace code blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, function (match, language, code) {
        return `<pre><code class="${language || ''}">${escapeHtml(code)}</code></pre>`;
    });

    // Replace inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Replace lists
    text = text.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    text = text.replace(/^-\s+(.+)$/gm, '<li>$1</li>');

    // Replace paragraphs
    text = text.replace(/^(.+)$/gm, function (match) {
        if (!match.startsWith('<li>') && !match.startsWith('<pre>')) {
            return `<p>${match}</p>`;
        }
        return match;
    });

    return text;
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

/**
 * Show error dialog
 * @param {string} message - Error message
 */
function showErrorDialog(message) {
    // Check if error dialog exists in vibecoding.js
    if (typeof window.showErrorDialog === 'function') {
        window.showErrorDialog(message);
    } else {
        // Fallback to alert
        alert(message);
    }
}

async function createCache(codeContext, key) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: '/Product/CreateCache',
            type: 'POST',
            data: {
                codeContext: codeContext,
                key: key
            },
            success: function (response) {
                if (response.success) {
                    resolve(response.data);
                } else {
                    resolve(null);
                }
            },
            error: function (xhr, status, error) {
                reject(error);
            }
        });
    });
}

function newChat() {
    if (!processOver) {
        showNotification("请等待上一次对话结束");
        return;
    }

    // Reset conversation state
    isInAIConversation = false;
    conversationStartTime = null;
    sessionModifiedFiles.clear();
    originalChatGroupId = '';

    sysmsg = "";
    chatid = "";
    chatgroupid = "";
    assistansBoxId = "";
    $('#ai-qa-content').html(`
            <div class="ai-message ai-response">
                Hello! I'm your AI coding assistant. How can I help you with your code today?
            </div>`);
}

// Add this function to the script to enable copying MCP code
window.copyMcpCode = function (elementId) {
    const codeElement = document.getElementById(elementId);
    if (!codeElement) return;

    const text = codeElement.textContent;

    // Use the clipboard API to copy the text
    navigator.clipboard.writeText(text).then(
        function () {
            // Show a brief success message
            const button = document.querySelector(`button[onclick="copyMcpCode('${elementId}')"]`);
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> 已复制';
                setTimeout(() => {
                    button.innerHTML = originalText;
                }, 2000);
            }
        },
        function (err) {
            console.error('Could not copy text: ', err);
        }
    );
};

/**
 * Stop the current AI generation
 */
function stopAIGeneration() {
    if (!chatgroupid) {
        console.warn('No active chat group ID to stop');
        return;
    }

    $.ajax({
        type: "Post",
        url: "/Home/StopGenerate",
        dataType: "json",
        data: {
            chatId: chatgroupid
        },
        success: function (res) {
            //console.log('Generation stopped successfully');
            // Reset the UI to allow new questions
            $('.LDI').remove();
            resetSendButton();
            processOver = true;

            // If we were in conversation and had modified files, still show final diff
            if (isInAIConversation && sessionModifiedFiles.size > 0) {
                setTimeout(async () => {
                    await showFinalDiffConfirmation();
                }, 100);
            }

            // End conversation tracking
            isInAIConversation = false;
            conversationStartTime = null;
            originalChatGroupId = '';
        },
        error: function (err) {
            console.error('Failed to stop generation:', err);
            showNotification('停止生成失败', 'error');
        }
    });
}

/**
 * Clear all active MCP progress simulations
 */
function clearAllMcpProgressSimulations() {
    if (window.mcpProgressIntervals) {
        // Clear all intervals
        Object.values(window.mcpProgressIntervals).forEach(interval => {
            clearInterval(interval);
        });

        // Reset the intervals object
        window.mcpProgressIntervals = {};

        // Find all progress bars and set them to 100%
        $('.progress-bar[id^="mcp-progress-"]').each(function () {
            $(this).css('width', '100%').attr('aria-valuenow', 100);
        });
    }
}

/**
 * Track file modifications during AI conversation
 * @param {string} filePath - Path to the file being modified
 * @param {string} newContent - New content being added
 * @param {number} startLine - Start line of modification
 * @param {number} endLine - End line of modification
 */
async function trackFileModification(filePath, newContent, startLine, endLine) {
    try {
        // Get current file content if we haven't tracked this file yet
        if (!sessionModifiedFiles.has(filePath)) {
            // Get the original content from the file system
            const fileContent = await window.VibeFileReader.getFileContent(filePath);
            sessionModifiedFiles.set(filePath, {
                originalContent: fileContent,
                currentContent: fileContent,
                edits: []
            });
        }

        // Add this edit to the tracked edits
        const fileInfo = sessionModifiedFiles.get(filePath);
        fileInfo.edits.push({
            startLine,
            endLine,
            newContent,
            timestamp: Date.now()
        });

        // Update current content by applying the edit
        const lines = fileInfo.currentContent.split('\n');
        const beforeLines = lines.slice(0, startLine - 1);
        const afterLines = lines.slice(endLine);
        const newContentLines = newContent.split('\n');
        const updatedLines = [...beforeLines, ...newContentLines, ...afterLines];
        fileInfo.currentContent = updatedLines.join('\n');

        //console.log(`Tracked modification for ${filePath}: ${fileInfo.edits.length} edits total`);
    } catch (error) {
        console.error('Error tracking file modification:', error);
    }
}

/**
 * Show final diff confirmation for all modified files
 */
async function showFinalDiffConfirmation() {
    try {
        // Create confirmation data for all modified files
        const modifiedFiles = Array.from(sessionModifiedFiles.entries()).map(([filePath, fileInfo]) => ({
            filePath,
            originalContent: fileInfo.originalContent,
            currentContent: fileInfo.currentContent,
            editsCount: fileInfo.edits.length
        }));

        //console.log(`Showing final diff for ${modifiedFiles.length} modified files`);

        // Show confirmation using the existing showEditConfirmation system
        // We'll create a combined edit info for all files
        if (modifiedFiles.length === 1) {
            // Single file modification
            const fileInfo = modifiedFiles[0];
            const editInfo = {
                filePath: fileInfo.filePath,
                oldContent: fileInfo.originalContent,
                newContent: fileInfo.currentContent,
                lineRanges: [{
                    startLine: 1,
                    endLine: fileInfo.originalContent.split('\n').length,
                    oldContent: fileInfo.originalContent,
                    newContent: fileInfo.currentContent
                }]
            };

            // Show the confirmation dialog for the final changes
            const confirmResult = await window.VibeFileEditor.showEditConfirmation(editInfo);

            if (confirmResult.accepted) {
                // Apply final changes with backup
                await applyFinalChangesWithBackup(fileInfo.filePath, fileInfo.originalContent, confirmResult.resultContent || fileInfo.currentContent);
            } else {
                // Revert all changes for this file
                await revertFileChanges(fileInfo.filePath, fileInfo.originalContent);
            }
        } else {
            // Multiple files - show a custom multi-file diff dialog
            const confirmResult = await showMultiFileDiffConfirmation(modifiedFiles);

            if (confirmResult.accepted) {
                // Apply changes for accepted files with backup
                for (const [filePath, shouldApply] of confirmResult.fileDecisions.entries()) {
                    const fileInfo = sessionModifiedFiles.get(filePath);
                    if (shouldApply) {
                        await applyFinalChangesWithBackup(filePath, fileInfo.originalContent, fileInfo.currentContent);
                    } else {
                        await revertFileChanges(filePath, fileInfo.originalContent);
                    }
                }
            } else {
                // Revert all changes
                for (const [filePath, fileInfo] of sessionModifiedFiles.entries()) {
                    await revertFileChanges(filePath, fileInfo.originalContent);
                }
            }
        }

        // Clear session tracking
        sessionModifiedFiles.clear();
    } catch (error) {
        console.error('Error showing final diff confirmation:', error);
    }
}

/**
 * Apply final changes with backup for a single file
 * @param {string} filePath - Path to the file
 * @param {string} originalContent - Original content for backup
 * @param {string} finalContent - Final content to apply
 */
async function applyFinalChangesWithBackup(filePath, originalContent, finalContent) {
    try {
        // Get file handle
        const fileHandle = fileHandles.get(filePath);
        if (!fileHandle) {
            throw new Error(`File handle not found for ${filePath}`);
        }

        // Create backup using the original content (backup what was before the session)
        await window.VibeFileEditor.createFileBackup(filePath, originalContent);

        // Apply final content without additional backup since we already backed up
        await window.VibeFileEditor.saveUpdatedContent(fileHandle, finalContent, true); // skipBackup = true since we already backed up

        // Update the file tree and editor if needed
        if (typeof refreshFileTree === 'function') {
            await refreshFileTree();
        }

        //console.log(`Applied final changes with backup for ${filePath}`);
    } catch (error) {
        console.error(`Error applying final changes for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Revert file changes to original content
 * @param {string} filePath - Path to the file
 * @param {string} originalContent - Original content to restore
 */
async function revertFileChanges(filePath, originalContent) {
    try {
        // Get file handle
        const fileHandle = fileHandles.get(filePath);
        if (!fileHandle) {
            throw new Error(`File handle not found for ${filePath}`);
        }

        // Restore original content without backup
        await window.VibeFileEditor.saveUpdatedContent(fileHandle, originalContent, true); // skipBackup = true

        // Update the file tree and editor if needed
        if (typeof refreshFileTree === 'function') {
            await refreshFileTree();
        }

        //console.log(`Reverted changes for ${filePath}`);
    } catch (error) {
        console.error(`Error reverting changes for ${filePath}:`, error);
        throw error;
    }
}

/**
 * Show multi-file diff confirmation dialog
 * @param {Array} modifiedFiles - Array of modified file info
 * @returns {Promise<Object>} Confirmation result
 */
async function showMultiFileDiffConfirmation(modifiedFiles) {
    return new Promise((resolve) => {
        // Create a simplified multi-file confirmation dialog
        const overlay = $(`
            <div id="multi-file-diff-overlay" class="editor-diff-overlay">
                <div class="diff-overlay-controls">
                    <div class="diff-notification">
                        <i class="fas fa-code-branch"></i>
                        会话期间修改了 ${modifiedFiles.length} 个文件，是否应用所有更改？
                    </div>
                    <div class="diff-actions">
                        <div class="rejection-reason-container">
                            <input type="text" id="rejection-reason-multi" placeholder="拒绝原因（选填）" />
                        </div>
                        <button class="diff-action-button reject-button" id="reject-all-changes">
                            <i class="fas fa-times"></i> 拒绝全部
                        </button>
                        <button class="diff-action-button accept-button" id="accept-all-changes">
                            <i class="fas fa-check"></i> 应用全部
                        </button>
                    </div>
                </div>
                <div style="max-height: 200px; overflow-y: auto; padding: 10px; color: white;">
                    <h4>修改的文件列表：</h4>
                    <ul>
                        ${modifiedFiles.map(f => `<li>${f.filePath} (${f.editsCount} 次修改)</li>`).join('')}
                    </ul>
                </div>
            </div>
        `);

        // Append to editor container or body
        if ($('#editor').parent().length > 0) {
            $('#editor').parent().append(overlay);
        } else {
            $('body').append(overlay);
        }

        // Event handlers
        $('#accept-all-changes').on('click', function () {
            cleanup(true);
        });

        $('#reject-all-changes').on('click', function () {
            cleanup(false);
        });

        function cleanup(accepted) {
            overlay.remove();
            $('#accept-all-changes').off('click');
            $('#reject-all-changes').off('click');

            const fileDecisions = new Map();
            // For now, apply same decision to all files
            modifiedFiles.forEach(f => {
                fileDecisions.set(f.filePath, accepted);
            });

            resolve({
                accepted,
                fileDecisions,
                rejectionReason: $('#rejection-reason-multi').val() || ''
            });
        }
    });
}

/**
 * Get appropriate icon for MCP command type
 * @param {string} method - The MCP command method
 * @returns {string} HTML for the appropriate icon
 */
function getMcpCommandIcon(method) {
    switch (method) {
        case 'readfile_path':
            return '<i class="fas fa-file-alt"></i>';
        case 'create_file':
            return '<i class="fas fa-file-plus"></i>';
        case 'edit_file':
            return '<i class="fas fa-edit"></i>';
        case 'code_base_search':
            return '<i class="fas fa-search"></i>';
        case 'web_scraping':
            return '<i class="fas fa-globe"></i>';
        case 'error':
            return '<i class="fas fa-exclamation-triangle"></i>';
        default:
            return '<i class="fas fa-terminal"></i>';
    }
}

/**
 * Format user-friendly summary of MCP command
 * @param {Object} command - The MCP command object
 * @returns {string} User-friendly summary
 */
function formatMcpCommandSummary(command) {
    const path = command.params.path || '';
    
    switch (command.method) {
        case 'readfile_path':
            const startLine = command.params.startLine;
            const endLine = command.params.endLine;
            const lineRange = startLine && endLine ? ` (${startLine}-${endLine})` : '';
            return `读取文件: ${path}${lineRange}`;
            
        case 'create_file':
            return `创建文件: ${path}`;
            
        case 'edit_file':
            const editStartLine = command.params.startLine;
            const editEndLine = command.params.endLine;
            const editLineRange = editStartLine && editEndLine ? ` (${editStartLine}-${editEndLine})` : '';
            return `编辑文件: ${path}${editLineRange}`;
            
        case 'code_base_search':
            return `代码搜索完成: ${path || '项目文件'}`;

        case 'web_scraping':
            return `联网搜索完成: ${command.params.query || '搜索查询'}`;

        case 'error':
            return `错误处理完成`;

        default:
            return `命令执行完成`;
    }
}