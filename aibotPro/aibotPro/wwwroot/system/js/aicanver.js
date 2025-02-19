let button = document.querySelector('.aicoder');
let newChatBtn = $('.btn-newchat');
let sysmodel = 'chat';
let monacoEditor = null;
let perviewsignal = false;
var oldCode = '';
var selectedElementsInfo = [];
const commentConfig = {
    // 多行注释优先，单行注释备选
    default: {block: ['/*', '*/'], line: '//'},

    // C系语言家族
    c: {block: ['/*', '*/'], line: '//'},
    cpp: {block: ['/*', '*/'], line: '//'},
    csharp: {block: ['/*', '*/'], line: '//'},
    java: {block: ['/*', '*/'], line: '//'},
    javascript: {block: ['/*', '*/'], line: '//'},
    typescript: {block: ['/*', '*/'], line: '//'},
    php: {block: ['/*', '*/'], line: '//'},
    go: {block: ['/*', '*/'], line: '//'},
    swift: {block: ['/*', '*/'], line: '//'},
    kotlin: {block: ['/*', '*/'], line: '//'},
    rust: {block: ['/*', '*/'], line: '//'},

    // 脚本语言
    python: {block: ['"""', '"""'], line: '#'},
    ruby: {block: ['=begin', '=end'], line: '#'},
    perl: {block: ['=pod', '=cut'], line: '#'},

    // Shell系
    shell: {block: [': <<\'END_COMMENT\'', 'END_COMMENT'], line: '#'},
    bash: {block: [': <<\'END_COMMENT\'', 'END_COMMENT'], line: '#'},

    // 标记语言
    html: {block: ['<!--', '-->']},
    xml: {block: ['<!--', '-->']},
    svg: {block: ['<!--', '-->']},

    // 样式表
    css: {block: ['/*', '*/']},
    scss: {block: ['/*', '*/'], line: '//'},
    less: {block: ['/*', '*/'], line: '//'},

    // 配置文件格式
    yaml: {line: '#'},
    toml: {line: '#'},
    ini: {line: ';'},

    // 数据库
    sql: {block: ['/*', '*/'], line: '--'},

    // 特殊格式
    markdown: {line: '[//]: # ('},
    latex: {block: ['\\begin{comment}', '\\end{comment}'], line: '%'},

    // 模板语言
    handlebars: {block: ['{{!--', '--}}'], line: '{{!'},
    ejs: {block: ['<%/*', '*/%>'], line: '<%#'},

    // 其他语言
    r: {line: '#'},
    matlab: {block: ['%{', '%}'], line: '%'},
    haskell: {block: ['{-', '-}'], line: '--'},
    lua: {block: ['--[[', ']]'], line: '--'}
};
// 语言映射表
const languageMap = {
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'csharp',
    'css': 'css',
    'html': 'html',
    'java': 'java',
    'js': 'javascript',
    'javascript': 'javascript',
    'json': 'json',
    'kotlin': 'kotlin',
    'md': 'markdown',
    'markdown': 'markdown',
    'php': 'php',
    'python': 'python',
    'py': 'python',
    'ruby': 'ruby',
    'rust': 'rust',
    'sql': 'sql',
    'swift': 'swift',
    'typescript': 'typescript',
    'ts': 'typescript',
    'xml': 'xml',
    'yaml': 'yaml',
    'go': 'go',
    'shell': 'shell',
    'bash': 'shell',
    'plaintext': 'plaintext',
    'vue': 'html',
    'less': 'less',
    'scss': 'scss',
    'tsx': 'typescript',
    'vue3': 'vue',
    'vue2': 'vue',
    'vue3-html': 'vue',
    'vue2-html': 'vue',
    'vue-html': 'vue',
    'vue-js': 'vue',
    'vue-ts': 'vue',
    'vue-tsx': 'vue',
    'vue-jsx': 'vue',
    'vue-template': 'vue',
    'svelte': 'svelte',
    'tsx-js': 'typescript',
    'tsx-ts': 'typescript',
    'tsx-jsx': 'typescript',
    'tsx-tsx': 'typescript',
    'tsx-html': 'typescript',
    'tsx-vue': 'typescript',
    'tsx-svelte': 'typescript',
    'tsx-plaintext': 'typescript',
    'tsx-markdown': 'typescript'
};

async function createCanver(lang = '') {
    if (sysmodel == 'chat') {
        loadingOverlay.show();
        try {
            await loadMonacoEditor();
            // 等待 Monaco 完全加载
            await new Promise((resolve) => {
                const checkMonaco = setInterval(() => {
                    if (typeof monaco !== 'undefined' && monaco.editor) {
                        clearInterval(checkMonaco);
                        resolve();
                    }
                }, 100);
            });
            sysmodel = 'aicanver';
            $('.chat-body-footer').hide();
            // 修改右侧内容为编辑器
            $('.chat-body-content').css('height', 'calc(100% - 50px)');
            $('.chat-sidebar').css('width', '500px');
            $('.chat-body').css('margin-left', '500px');
            $('.chat-body').css('width', 'calc(100% - 500px)');
            $('.chat-body-main').hide();
            $('#editor-container').show();
            $('#chatlistBox').hide();
            $('#aicanverChatBox').show();
            initMonacoEditor(lang);
            setEditorContent(lang, '', true);
            unloadingBtn('.btn-aicanver');
            changeBtn();
            // 修改 footer 为输入框和发送按钮
            $('.chat-sidebar-footer').html(`
                <div class="d-flex w-100">
                    <button href="#" class="btn btn-link p-0 mr-2" data-toggle="tooltip" title="🖼️ 图片上传" onclick="showCameraMenu()" id="openCamera">
                      <i data-feather="camera"></i>
                      <span class="image-upload-count" id="imageCount">0</span>
                    </button>
                    <div class="flex-grow-1 mr-2">
                      <textarea id="Q" class="form-control" rows="1" placeholder="输入您的问题..."></textarea>
                    </div>
                    <button class="btn btn-link" id="sendBtn">
                        <i data-feather="send"></i>
                    </button>
                </div>
            `);

            // 重新初始化 feather 图标
            feather.replace();
            $('#Q').on('paste', function (event) {
                for (var i = 0; i < event.originalEvent.clipboardData.items.length; i++) {
                    var item = event.originalEvent.clipboardData.items[i];
                    if (item.kind === 'file') {
                        var blob = item.getAsFile();
                        handleFileUpload(blob);
                    }
                }
            });
            // 绑定发送按钮事件
            $('#canverSend').on('click', function () {
                const prompt = $('#canverInput').val();
                if (prompt) {
                    // 这里添加发送处理逻辑
                    console.log('发送提示词:', prompt);
                    $('#canverInput').val('');
                }
            });
            $("#sendBtn").on("click", function () {
                if (!processOver) {
                    stopGenerate();
                } else if (sysmodel == 'chat') sendMsg();
                else sendMsgByCanver();
            });
            newChat();
        } catch (error) {
            console.error('Editor initialization failed:', error);
        } finally {
            loadingOverlay.hide();
        }

    } else {
        sysmodel = 'chat';
        selectedElementsInfo = [];
        changeBtn();
        $('.chat-body-content').css('height', 'calc(100% - 120px)');
        $('.chat-body-footer').show();
        // 恢复原始 footer
        $('.chat-sidebar-footer').html(`
            <div class="avatar avatar-sm avatar-online">
                <img src="/static/picture/fff.png" id="HeadImg" class="rounded-circle" alt="">
            </div>
            <h6 class="chat-loggeduser">
                <i class="fas fa-coins"></i>
                <b id="Mcoin">
                    --
                </b>
            </h6>
            <div>
                <a href="/Users/UserInfo" data-toggle="tooltip" title="个人中心">
                    <i data-feather="user"></i>
                </a>
            </div>
        `);
        $('#editor-container').hide();
        $('.chat-body-main').show();
        $('#aicanverChatBox').hide();
        $('#chatlistBox').show();
        $('.chat-sidebar').css('width', '300px');
        $('.chat-body').css('margin-left', '300px');
        $('.chat-body').css('width', 'calc(100% - 300px)');
        if (monacoEditor) {
            monacoEditor.dispose();
            monacoEditor = null;
        }
        // 重新初始化 feather 图标
        feather.replace();
        getUserInfo();
    }
}

function changeBtn() {
    if (!button.classList.contains('active')) {
        // 切换到关闭状态
        button.classList.add('active');
        button.innerHTML = '<i class="fas fa-times"></i> 关闭';
    } else {
        // 切换回初始状态
        button.classList.remove('active');
        button.innerHTML = '<i class="fas fa-code"></i> Coder';
        selectedElementsInfo = [];
        updateSelectedElementsDisplay();
        $('.previewCode').hide();
        $('.selectDOM').hide();
        $('.newWindow').hide();
        $('#preview-container').remove();
        $('.previewCode').html('<i data-feather="play"></i> 预览');
        perviewsignal = false;
        newChat();
        cleanup();
    }
}

function initMonacoEditor(language = '') {
    if (typeof monaco !== 'undefined') {
        function isDarkMode() {
            return document.querySelector('html').classList.contains('dark');
        }

        // 定义深色主题
        monaco.editor.defineTheme('customDark', {
            base: 'vs-dark', inherit: true, rules: [{token: 'keyword', foreground: '569CD6', fontStyle: 'bold'}, {
                token: 'string', foreground: 'CE9178'
            }, {token: 'number', foreground: 'B5CEA8'}, {
                token: 'comment', foreground: '6A9955', fontStyle: 'italic'
            }, {token: 'type', foreground: '4EC9B0'}, {token: 'function', foreground: 'DCDCAA'}, {
                token: 'variable', foreground: '9CDCFE'
            }, {token: 'operator', foreground: 'D4D4D4'}
            ],
            colors: {
                'editor.background': '#1E1E1E',
                'editor.foreground': '#D4D4D4',
                'editor.lineHighlightBackground': '#2D2D2D',
                'editor.selectionBackground': '#264F78',
                'editor.inactiveSelectionBackground': '#3A3D41'
            }
        });

        // 定义浅色主题
        monaco.editor.defineTheme('customLight', {
            base: 'vs', inherit: true, rules: [{token: 'keyword', foreground: '0000FF', fontStyle: 'bold'}, {
                token: 'string', foreground: 'A31515'
            }, {token: 'number', foreground: '098658'}, {
                token: 'comment', foreground: '008000', fontStyle: 'italic'
            }, {token: 'type', foreground: '267F99'}, {token: 'function', foreground: '795E26'}, {
                token: 'variable', foreground: '001080'
            }, {token: 'operator', foreground: '000000'}
            ],
            colors: {
                'editor.background': '#FFFFFF',
                'editor.foreground': '#000000',
                'editor.lineHighlightBackground': '#F7F7F7',
                'editor.selectionBackground': '#ADD6FF',
                'editor.inactiveSelectionBackground': '#E5EBF1'
            }
        });

        // 初始语言设置
        const initialLanguage = language ? (languageMap[language.toLowerCase()] || 'plaintext') : 'plaintext';

        monacoEditor = monaco.editor.create(document.getElementById('editor-container'), {
            value: '',
            language: initialLanguage,
            theme: isDarkMode() ? 'customDark' : 'customLight',
            lineNumbers: 'on',
            roundedSelection: true,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            minimap: {
                enabled: true,
                scale: 0.8,
                showSlider: "always"
            },
            fontSize: 14,
            fontFamily: 'Consolas, "Courier New", monospace',
            wordWrap: 'on',
            wrappingIndent: 'same',
            bracketPairColorization: {
                enabled: true,
                independentColorPoolPerBracketType: true,
            },
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoSurround: 'brackets',
            formatOnPaste: true,
            formatOnType: true,
            renderWhitespace: 'selection',
            smoothScrolling: true,
            mouseWheelZoom: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: true,
            guides: {
                bracketPairs: true,
                indentation: true
            }
        });

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isDark = isDarkMode();
                    monaco.editor.setTheme(isDark ? 'customDark' : 'customLight');
                }
            });
        });

        // 开始观察 html 根标签
        observer.observe(document.querySelector('html'), {
            attributes: true,
            attributeFilter: ['class']
        });

        // 如果没有指定语言，启用智能检测
        if (!language) {
            monacoEditor.onDidChangeModelContent(() => {
                const content = monacoEditor.getValue();
                const model = monacoEditor.getModel();

                // 避免空内容检测
                if (!content.trim()) return;

                // 智能检测规则
                if (/^\s*<(!DOCTYPE|html|head|body)/i.test(content) || /<\w+>[\s\S]*<\/\w+>/.test(content)) {
                    monaco.editor.setModelLanguage(model, 'html');
                } else if (/\b(class|function|var|let|const|if|for|while|return|import|export)\b/.test(content)) {
                    if (content.includes('interface ') || content.includes(': ') || /\w+<\w+>/.test(content)) {
                        monaco.editor.setModelLanguage(model, 'typescript');
                    } else {
                        monaco.editor.setModelLanguage(model, 'javascript');
                    }
                } else if (/\b(def|class|import|from|if|for|while|return|and|or|not)\b/.test(content)) {
                    monaco.editor.setModelLanguage(model, 'python');
                } else if (/^#include\s*<[\w\.]+>/.test(content) || /\b(int|void|char|double|float|struct|class)\b.*\{/.test(content)) {
                    if (content.includes('cout') || content.includes('cin') || content.includes('std::')) {
                        monaco.editor.setModelLanguage(model, 'cpp');
                    } else {
                        monaco.editor.setModelLanguage(model, 'c');
                    }
                } else if (/\b(public|private|protected|class|interface|namespace)\b/.test(content)) {
                    monaco.editor.setModelLanguage(model, 'csharp');
                } else if (/^package\s+[\w\.]+;|import\s+[\w\.]+;/.test(content)) {
                    monaco.editor.setModelLanguage(model, 'java');
                } else if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(content)) {
                    monaco.editor.setModelLanguage(model, 'sql');
                } else if (/^[\s\n]*[{[]/.test(content)) {
                    try {
                        JSON.parse(content);
                        monaco.editor.setModelLanguage(model, 'json');
                    } catch (e) {
                    }
                } else if (content.includes('{') && (content.includes('.') || content.includes('#'))) {
                    monaco.editor.setModelLanguage(model, 'css');
                } else if (content.includes('```') || /^#+\s/.test(content) || /\[.+\]\(.+\)/.test(content)) {
                    monaco.editor.setModelLanguage(model, 'markdown');
                } else if (/^(\$|>)\s/.test(content) || /\b(apt|yum|brew|chmod|sudo)\b/.test(content)) {
                    monaco.editor.setModelLanguage(model, 'shell');
                }
            });
        }

        const cleanup = () => {
            observer.disconnect();
            if (monacoEditor) {
                monacoEditor.dispose();
            }
        };

        monacoEditor.cleanup = cleanup;
        return monacoEditor;
    }
    return null;
}

function loadMonacoEditor() {
    return new Promise((resolve, reject) => {
        if (document.getElementById('monaco-editor-scripts')) {
            resolve();
            return;
        }

        // 创建容器
        const container = document.createElement('div');
        container.id = 'monaco-editor-scripts';
        document.head.appendChild(container);

        // 添加 require 配置
        const requireConfig = document.createElement('script');
        requireConfig.textContent = `
            var require = {
                paths: { 'vs': '/system/monaco-editor-0.45.0/package/min/vs' },
                'vs/nls': { availableLanguages: { '*': 'zh-cn' } }
            };
        `;
        container.appendChild(requireConfig);

        // 按顺序加载脚本
        const loadScriptSequentially = (scripts, index = 0) => {
            if (index >= scripts.length) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = scripts[index];
            script.onload = () => loadScriptSequentially(scripts, index + 1);
            script.onerror = (error) => reject(error);
            container.appendChild(script);
        };

        // 定义加载顺序
        const scripts = [
            '/system/monaco-editor-0.45.0/package/min/vs/loader.js',
            '/system/monaco-editor-0.45.0/package/min/vs/editor/editor.main.nls.js',
            '/system/monaco-editor-0.45.0/package/min/vs/editor/editor.main.nls.zh-cn.js',
            '/system/monaco-editor-0.45.0/package/min/vs/editor/editor.main.js',
            '/system/monaco-editor-0.45.0/diff_match_patch.js'
        ];

        loadScriptSequentially(scripts);
    });
}

// 内容更新队列管理器
const ContentQueue = {
    queue: [],
    isProcessing: false,
    lastContent: '',
    lastProcessedIndex: 0, // 记录上次处理到的字符位置

    add: function (editor, content, processOver, reviewCode) {
        this.queue.push({content, processOver}); // 将 content 和 processOver 作为一个对象入队
        if (!this.isProcessing || reviewCode) {
            this.process(editor);
        }
    },

    process: function (editor) {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        // 取最新的内容和状态
        const {content, processOver} = this.queue[this.queue.length - 1];

        // 增量更新：只处理新添加的部分
        const newContent = content.substring(this.lastProcessedIndex);

        if (newContent !== '') {
            // 获取当前光标位置
            const currentPosition = editor.getPosition();

            // 获取当前文本
            let currentText = editor.getValue();

            // 插入新内容 (使用 edit operation，支持撤销/重做)
            const range = new monaco.Range(
                currentPosition.lineNumber,
                currentPosition.column,
                currentPosition.lineNumber,
                currentPosition.column
            );

            const editOperation = {
                range: range,
                text: newContent,
                forceMoveMarkers: true // 强制移动光标
            };

            editor.executeEdits("my-source", [editOperation]);

            // 更新 lastProcessedIndex
            this.lastProcessedIndex = content.length;

            //移动光标到最后
            const endPosition = {
                lineNumber: editor.getModel().getLineCount(),
                column: editor.getModel().getLineLength(editor.getModel().getLineCount()) + 1
            };
            editor.setPosition(endPosition);

            // 更新 lastContent
            this.lastContent = content;


        }


        // 延迟执行格式化，只在流结束（processOver 为 true）时执行
        if (processOver) {
            clearTimeout(this.formatTimer);
            this.formatTimer = setTimeout(() => {
                try {
                    editor.getAction('editor.action.formatDocument').run();
                } catch (e) {
                    console.log('Format failed:', e);
                }
                //格式化成功后，清空所有状态
                this.queue = [];
                this.lastProcessedIndex = 0;
                this.lastContent = "";
                this.isProcessing = false;  // 确保队列清空后，isProcessing 设置为 false

            }, 300);
        } else {
            // 如果流还没有结束，也清空队列，但是保留 lastProcessedIndex, lastContent 和 isProcessing
            this.queue = [];
        }


        // 使用 requestAnimationFrame 来控制更新频率
        if (!processOver) { //流没有结束才继续
            requestAnimationFrame(() => {
                this.process(editor);
            });
        }
    }
};

function setEditorContent(possibleLanguage = '', content = '', processOver = false, reviewCode = false) {
    if (!monacoEditor) return;
    if (processOver && possibleLanguage.toLowerCase() === 'html') {
        $('.previewCode').show();
    }
    // 获取当前模型
    const model = monacoEditor.getModel();

    // 设置语言
    if (possibleLanguage) {
        const normalizedLanguage = possibleLanguage.toLowerCase();
        const language = languageMap[normalizedLanguage] || 'plaintext';
        monaco.editor.setModelLanguage(model, language);
    }

    // 将内容添加到队列
    ContentQueue.add(monacoEditor, content, processOver, reviewCode);
}

// 清理函数（在页面卸载时调用）
function cleanup() {
    ContentQueue.queue = [];
    ContentQueue.isProcessing = false;
    if (ContentQueue.formatTimer) {
        clearTimeout(ContentQueue.formatTimer);
    }
}

// 页面卸载时清理
$(window).on('unload', cleanup);

function getSelectedText(editor) {
    const selection = editor.getSelection();
    return editor.getModel().getValueInRange(selection);
}


//发送消息
function sendMsgByCanver(retryCount = 3) {
    var msg = $("#Q").val().trim();
    if (msg == "") {
        balert("请输入问题", "warning", false, 2000);
        return;
    }
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    processOver = false;
    msg = buildMessageForLLMAndInit(msg);
    selectedElementsInfo = [];
    updateSelectedElementsDisplay();
    $("#sendBtn").html(`<i data-feather="stop-circle"></i>`);
    feather.replace();
    $("#sendBtn").addClass("text-danger");
    chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    var temperatureText = $('#temperatureValue').text();
    var temperature = parseFloat(temperatureText);
    if (isNaN(temperature)) {
        temperature = 1.00;
    }
    var presenceText = $('#frequencyPenaltyValue').text();
    var presence = parseFloat(presenceText);
    if (isNaN(presence)) {
        presence = 0;
    }

    var frequencyText = $('#presencePenaltyValue').text();
    var frequency = parseFloat(frequencyText);
    if (isNaN(frequency)) {
        frequency = 0;
    }
    var maxtokensText = $('#maxTokensValue').text();
    var maxtokens = parseInt(maxtokensText);
    if (isNaN(maxtokens)) {
        maxtokens = 4095;
    }
    var shortcutSystemPrompt = $("#shortcutSystemPrompt").val() === "" ? systemPrompt : $("#shortcutSystemPrompt").val();
    assistansBoxId = msgid_g;
    var coderMsg = monacoEditor.getValue();
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": image_path,
        "file_list": file_list,
        "system_prompt": `${shortcutSystemPrompt}`,
        "useMemory": useMemory,
        "createAiPrompt": createAiPrompt,
        "temperature": temperature,
        "presence": presence,
        "frequency": frequency,
        "maxtokens": maxtokens,
        "seniorSetting": seniorSetting,
        "inputCacheKey": "",
        "stream": stream,
        "readingMode": readingMode,
        "coderMsg": coderMsg,
        "coderModel": true
    };
    $("#Q").val("");
    $("#Q").focus();
    monacoEditor.setValue('');
    ContentQueue.lastProcessedIndex = 0;
    ContentQueue.lastContent = "";
    ContentQueue.queue = [];
    var html = ` <div class="aicanver-message aicanver-user-message chat-message" data-group="${chatgroupid}">
                            <pre id="${msgid_u}"></pre>
                        </div>`;
    $('.aicanver-chat-container').append(html);
    if (msg.length > 1000) {
        setInputToCache(data, function (responseData) {
            data.inputCacheKey = responseData;
            data.msg = "";
        });
    }
    $("#" + msgid_u).text(msg);
    if (image_path.length > 0) {
        image_path.forEach(function (path) {
            if (path != "") {
                $("#" + msgid_u).append(`<br /><img src="${path.replace("wwwroot", "")}" style="max-width:50%" />`);
            }
        });
    }
    applyMagnificPopup("#" + msgid_u);
    initImageFolding("#" + msgid_u);
    var gpthtml = `<div class="aicanver-message aicanver-ai-message chat-message" data-group="${chatgroupid}">
                            <div id="${msgid_g}"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                             <div id="ctrl-${msgid_g}" style="display: none;">
                                <i data-feather="copy" data-toggle="tooltip" title="复制" class="chatbtns" onclick="copyAll('${msgid_g}')"></i>
                                <i data-feather="trash-2" class="chatbtns custom-delete-btn-1" data-toggle="tooltip" title="删除" data-chatgroupid="${chatgroupid}"></i>
                            </div>
                        </div>`;
    $('.aicanver-chat-container').append(gpthtml);
    $('.chat-sidebar-body').animate({
        scrollTop: $('.chat-sidebar-body').prop("scrollHeight")
    }, 500);
    oldCode = monacoEditor.getValue();

    // 尝试发送消息
    function trySendMessage() {
        connection.invoke("SendMessage", data)
            .then(function () {
                // 消息发送成功
            })
            .catch(function (err) {
                console.error("Send message failed:", err);
                retryCount--;
                if (retryCount > 0) {
                    setTimeout(trySendMessage, 1000); // 1秒后重试
                } else {
                    processOver = true;
                    balert("发送消息失败,请刷新页面后重试", "danger", false, 2000, "center");
                    $('#' + assistansBoxId).html("发送消息失败,请刷新页面后重试 <a href='javascript:location.reload();'>点击刷新</a>");
                    $('.LDI').remove();
                    sendExceptionMsg("发送消息失败，请检查网络连接并重试。");
                }
            });
    }

    trySendMessage();
}

function handleAicanverContent(message, assistansBoxId, processOver = false) {
    // 移除所有 <think> 标签及其内容
    message = message.replace(/<think>[\s\S]*?<\/think>/g, '');

    // 创建临时 div 来解析 markdown
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = md.render(message);

    // 存储非代码块内容
    let nonCodeContent = '';

    // 遍历所有元素
    const elements = tempDiv.childNodes;
    let foundCodeBlock = false;

    for (let element of elements) {
        if (element.tagName === 'PRE' && element.querySelector('code')) {
            // 处理代码块
            foundCodeBlock = true;
            const codeElement = element.querySelector('code');
            const codeContent = codeElement.textContent;

            // 获取语言
            let language = '';
            const languageMatch = codeElement.className.match(/language-(\w+)/);
            if (languageMatch) {
                language = languageMatch[1];
            }

            // 设置编辑器内容
            setEditorContent(language, codeContent, processOver);

        } else {
            // 收集非代码块内容
            nonCodeContent += element.outerHTML || element.textContent;
        }
    }

    // 如果存在非代码块内容，则渲染到消息框中
    if (nonCodeContent) {
        $("#" + assistansBoxId).html(nonCodeContent);

        // 代码高亮
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
    } else if (!foundCodeBlock) {
        // 如果既没有代码块也没有其他内容，直接显示原始消息
        $("#" + assistansBoxId).html(md.render(message));
    }
}

function highlightChanges(oldCode, newCode, editor) {
    if (oldCode == "") {
        return;
    }
    // 使用 diff-match-patch 计算差异
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(oldCode, newCode);
    dmp.diff_cleanupSemantic(diffs);

    // 用于记录当前处理的位置
    let currentPosition = 0;
    let decorations = [];

    // 修改遍历方式
    for (let i = 0; i < diffs.length; i++) {
        const diff = diffs[i];
        const type = diff[0];  // -1: 删除, 0: 相等, 1: 插入
        const text = diff[1];

        if (type === 1) { // 新增内容
            const startPosition = currentPosition;
            const endPosition = currentPosition + text.length;

            // 计算行列信息
            const startPos = editor.getModel().getPositionAt(startPosition);
            const endPos = editor.getModel().getPositionAt(endPosition);

            // 添加装饰器
            decorations.push({
                range: new monaco.Range(
                    startPos.lineNumber,
                    startPos.column,
                    endPos.lineNumber,
                    endPos.column
                ),
                options: {
                    inlineClassName: 'modified-code'
                }
            });
        }
        if (type !== -1) { // 不是删除的内容才计入位置
            currentPosition += text.length;
        }
    }

    // 应用装饰器
    editor.deltaDecorations([], decorations);
}

function previewCode() {
    const $previewBtn = $('.previewCode');
    const $editorContainer = $('#editor-container');

    let selectorMode = false;
    let $selectorBtn;

    let $previewContainer = $('#preview-container');
    if ($previewContainer.length === 0) {
        $previewContainer = $('<div>', {
            id: 'preview-container',
            css: {
                height: '100%',
                overflow: 'hidden',
                display: 'none'
            }
        });

        $selectorBtn = $('.selectDOM');

        const $iframe = $('<iframe>', {
            id: 'preview-iframe',
            css: {
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#fff'
            },
            sandbox: 'allow-same-origin allow-scripts allow-modals'
        });

        $previewContainer.append($iframe);
        $editorContainer.after($previewContainer);

        $selectorBtn.on('click', function () {
            selectorMode = !selectorMode;
            if (selectorMode) {
                $(this).addClass('active');

                const iframeDoc = $('#preview-iframe')[0].contentDocument;
                $(iframeDoc).find('*').on('mouseover', function (e) {
                    if (selectorMode) {
                        e.stopPropagation();
                        $(this).css('outline', '2px solid #007bff');
                        //添加透明背景色强调
                        $(this).css('background-color', 'rgba(0, 123, 255, 0.1)');
                    }
                }).on('mouseout', function () {
                    $(this).css('outline', '');
                    $(this).css('background-color', '');
                }).on('click', function (e) {
                    if (selectorMode) {
                        // 阻止事件冒泡
                        e.stopPropagation();
                        $(this).css('outline', '');
                        $(this).css('background-color', '');
                        // 检查目标元素是否为需要忽略的元素类型
                        const ignoredElements = [
                            'input',
                            'button',
                            'select',
                            'textarea',
                            'a',
                            'area', // 图像映射区域
                            'audio', // 音频
                            'video', // 视频
                            'iframe', // 内联框架
                            'object', // 嵌入对象
                            'embed', // 嵌入内容
                            'script', // 脚本
                            'style', // 样式
                            'meta', // 元数据
                            'head', // 头部
                            'link', // 链接
                            'title', // 标题
                            'base', // 基准URL
                            'svg', // SVG图形
                            'img', //图像，有用户可能会希望记录图片
                            'canvas', // 画布
                            'form', //表单
                        ];
                        if (ignoredElements.includes(e.target.tagName)) {
                            return;
                        }

                        //阻止元素默认行为
                        e.preventDefault();
                        const selector = getUniqueSelector(this);
                        const outerHTML = formatHTML(this.outerHTML);
                        const innerHTML = formatHTML(this.innerHTML);

                        const isDuplicate = selectedElementsInfo.some(info => info.element === this);

                        if (!isDuplicate) {
                            const elementInfo = {
                                selector: selector,
                                element: this,
                                outerHTML: outerHTML,
                                innerHTML: innerHTML
                            };
                            selectedElementsInfo.push(elementInfo);
                            updateSelectedElementsDisplay(); // 更新下拉列表
                        }
                        selectorMode = false;
                        $selectorBtn.removeClass('active');
                        //关闭事件监听
                        $(iframeDoc).find('*').off('mouseover mouseout click');
                    }
                });
            } else {
                $(this).removeClass('active');
                const iframeDoc = $('#preview-iframe')[0].contentDocument;
                $(iframeDoc).find('*').off('mouseover mouseout click');
            }
        });
    }

    if ($editorContainer.is(':visible')) {
        if (!processOver) {
            balert("请等待AI处理完毕", "warning", false, 2000, "center");
            return;
        }
        const content = monacoEditor.getValue();
        const $iframe = $('#preview-iframe');

        $iframe.attr('srcdoc', content);

        $editorContainer.hide();
        $previewContainer.show();
        $('.selectDOM').show();
        $('.newWindow').show();
        $previewBtn.html('<i data-feather="edit"></i> 代码');
        perviewsignal = true;
    } else {
        $previewContainer.hide();
        $editorContainer.show();
        $('.selectDOM').hide();
        $('.newWindow').hide();
        $previewBtn.html('<i data-feather="play"></i> 预览');
        perviewsignal = false;
    }

    feather.replace();
}

function newWindow() {
    const content = monacoEditor.getValue();
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
        balert('无法打开新窗口,请为此网站启用弹出窗口。', 'danger', false, 2000, 'center');
        return;
    }
    previewWindow.document.open();
    previewWindow.document.write(content);
    previewWindow.document.close();

    // Give focus to the new window
    previewWindow.focus();
}

// 获取元素的唯一选择器
function getUniqueSelector(element) {
    if (element.id) {
        return '#' + element.id;
    }

    if (element.className) {
        const classes = element.className.split(' ').join('.');
        return '.' + classes;
    }

    let path = [];
    while (element.tagName) {
        let selector = element.tagName.toLowerCase();
        let sibling = element;
        let nth = 1;

        while (sibling = sibling.previousElementSibling) {
            if (sibling.tagName.toLowerCase() === selector) nth++;
        }
        if (nth !== 1) selector += ":nth-of-type(" + nth + ")";
        path.unshift(selector);
        element = element.parentNode;
    }
    return path.join(' > ');
}

// 格式化HTML代码
function formatHTML(html) {
    let formatted = '';
    let indent = '';
    const tab = '    '; // 4个空格作为缩进

    html.split(/>\s*</).forEach(function (element) {
        if (element.match(/^\/\w/)) {
            // 结束标签，减少缩进
            indent = indent.substring(tab.length);
        }

        formatted += indent + '<' + element + '>\r\n';

        if (element.match(/^<?\w[^>]*[^\/]$/) && !element.startsWith("input") && !element.startsWith("img")) {
            // 开始标签，增加缩进
            indent += tab;
        }
    });

    return formatted.substring(1, formatted.length - 3);
}

function updateSelectedElementsDisplay() {
    const $selectedElementsDropdown = $('#selected-elements-dropdown');
    const $selectDOMButton = $('.selectDOM'); // 选择按钮

    // 更新选中元素下拉框
    if (selectedElementsInfo.length > 0) {
        // 创建或更新下拉框
        if ($selectedElementsDropdown.length === 0) {
            const dropdown = `
        <div id="selected-elements-dropdown" class="dropdown mg-l-2">
          <button class="btn btn-sm btn-outline-magic dropdown-toggle" type="button" id="selectedElementsDropdownBtn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
            已选: <span id="count">${selectedElementsInfo.length}</span>
          </button>
          <div class="dropdown-menu" aria-labelledby="selectedElementsDropdownBtn" style="min-width: 300px;">
            <ul id="selected-elements-list" class="list-group"></ul>
            <div class="dropdown-divider"></div>
            <button id="clear-selected-elements" class="btn btn-sm btn-danger mx-2 mb-2">清空</button>
          </div>
        </div>
      `;
            $selectDOMButton.after(dropdown); // 添加到选择按钮后面

            // 清空按钮的点击事件
            $('#clear-selected-elements').on('click', function () {
                selectedElementsInfo.length = 0; // 清空数组
                updateSelectedElementsDisplay(); // 更新显示
            });

            // 不需要阻止默认的 hide.bs.dropdown 事件
        } else {
            // 更新数量
            $('#count').text(selectedElementsInfo.length);
        }

        // 更新下拉框内容
        const $selectedElementsList = $('#selected-elements-list');
        $selectedElementsList.empty();
        selectedElementsInfo.forEach((info, index) => {
            const listItem = `
              <li class="list-group-item d-flex justify-content-between align-items-center">
                <a class="text-truncate" data-toggle="tooltip" title="${escapeHtml(info.outerHTML)}" style="max-width: 200px;">${info.selector}</a>
                <button class="btn btn-sm btn-outline-danger remove-element" data-index="${index}">移除</button>
              </li>
            `;
            $selectedElementsList.append(listItem);
        });
        $('[data-toggle="tooltip"]').tooltip();
        // 移除按钮的点击事件
        $('.remove-element').off('click').on('click', function (event) {
            // 阻止事件向上冒泡到 dropdown 容器
            event.stopPropagation();

            const indexToRemove = $(this).data('index');
            selectedElementsInfo.splice(indexToRemove, 1);

            // 移除元素后判断是否需要更新下拉框
            if (selectedElementsInfo.length === 0) {
                updateSelectedElementsDisplay(); // 数组为空，更新显示（会移除下拉框）
            } else {
                // 数组不为空，更新列表内容
                updateSelectedElementsList();
            }
        });

    } else {
        // 没有选中元素时，移除下拉框
        $('#selected-elements-dropdown').dropdown('hide'); // 手动隐藏
        $selectedElementsDropdown.remove();
    }
}

// 只更新列表内容的函数
function updateSelectedElementsList() {
    // 更新数量
    $('#count').text(selectedElementsInfo.length);

    // 更新下拉框内容
    const $selectedElementsList = $('#selected-elements-list');
    $selectedElementsList.empty();
    selectedElementsInfo.forEach((info, index) => {
        const listItem = `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <a class="text-truncate" data-toggle="tooltip" title="${escapeHtml(info.outerHTML)}" style="max-width: 200px;">${info.selector}</a>
            <button class="btn btn-sm btn-outline-danger remove-element" data-index="${index}">移除</button>
          </li>
        `;
        $selectedElementsList.append(listItem);
    });
    $('[data-toggle="tooltip"]').tooltip();
    // 重新绑定移除按钮的点击事件
    $('.remove-element').off('click').on('click', function (event) {
        // 阻止事件向上冒泡到 dropdown 容器
        event.stopPropagation();

        const indexToRemove = $(this).data('index');
        selectedElementsInfo.splice(indexToRemove, 1);
        // 移除元素后判断是否需要更新下拉框
        if (selectedElementsInfo.length === 0) {
            updateSelectedElementsDisplay(); // 数组为空，更新显示（会移除下拉框）
        } else {
            // 数组不为空，更新列表内容
            updateSelectedElementsList();
        }
    });
}

function buildMessageForLLMAndInit(msg) {
    //切换回代码界面
    if (perviewsignal) {
        previewCode();
    }
    if (getSelectedText(monacoEditor) != "") {
        msg += `\n\nSelected text: \`${getSelectedText(monacoEditor)}\``;
    }
    if (selectedElementsInfo.length > 0) {
        msg += "\n\nSelected elements:\n";
        selectedElementsInfo.forEach((info, index) => {
            msg += `${index + 1}. Selector: \`${info.selector}\`, OuterHTML: \`${info.outerHTML}\`\n`;
        });
        return msg;
    } else {
        return msg;
    }
}