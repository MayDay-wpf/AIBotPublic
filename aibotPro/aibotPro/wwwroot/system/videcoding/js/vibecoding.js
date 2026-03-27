$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#vibecoding-nav").addClass('active');
    IsLogin();

    // Initialize the app after login check
    initVibeCoding();

    // Fetch available AI models
    loadAIModels();

    // Initialize drag and drop for folders
    initDragAndDropForFolders();
});

// Global variables
let editor; // Monaco editor instance
let openedFolderHandle = null; // The handle to the opened folder
let fileHandles = new Map(); // Map of file paths to file handles
let openedTabs = new Map(); // Map of file paths to tab elements
let currentOpenFile = null; // Currently opened file path
let isEditorReady = false; // Flag for editor initialization
let dirtyFiles = new Set(); // Set of files with unsaved changes
let directoryHandles = new Map(); // Map of directory paths to directory handles
let selectedFolder = null; // Currently selected folder path
let expandedFolders = new Set(); // Set of expanded folder paths
let originalContents = new Map(); // Map of file paths to original content
let isSearchVisible = false; // Track if search widget is visible
let isDarkTheme = localStorage.getItem('vibeCodingTheme') === 'light' ? false : true; // Track current theme (default is dark unless light is stored)
let hasOpenedFolder = false; // Track if a folder has been opened in the current session
let db = null; // IndexedDB database
let fileModificationTimes = new Map(); // Map of file paths to last modification times
let isPreviewMode = false; // Track if HTML preview mode is active

// Variables for panel resizing
let isResizing = false;
let currentResizer = null;
let startX, startWidth, startWidthAi;
let currentClientX = 0; // Track the current mouse X position

// Selected AI model
let currentModel = null;

// Preview iframe element
let previewFrame = null;

// Cursor navigation history
let cursorHistory = [];
let currentHistoryIndex = -1;
let lastCursorPosition = null;
let isNavigatingHistory = false;
const MAX_HISTORY_SIZE = 50;
const MIN_LINE_JUMP = 5; // Minimum lines to jump to record in history

// Expose key variables to global scope for file watcher
window.fileHandles = fileHandles;
window.openedTabs = openedTabs;
window.currentOpenFile = currentOpenFile;
window.dirtyFiles = dirtyFiles;
window.originalContents = originalContents;
window.editor = editor;
window.generateEditorTabsMarkdown = generateEditorTabsMarkdown;
window.saveFile = saveFile;

/**
 * Initialize the VibeCoding app
 * 
 * Note on file tree loading:
 * The file tree uses lazy loading - only direct children of the root folder
 * are loaded initially. When a folder is clicked, its contents are loaded on demand.
 * This improves performance for large projects by avoiding loading the entire
 * directory structure at once. Previously expanded folders are automatically
 * re-expanded and loaded when refreshing the tree.
 */
function initVibeCoding() {
    // Initialize IndexedDB
    initIndexedDB().then(() => {
        // Try to restore the last opened folder
        tryRestoreLastFolder();
    });

    // Initialize Monaco Editor
    initMonacoEditor();

    // Initialize UI event listeners
    initEventListeners();

    // Initialize resize functionality
    initResizablePanels();

    // Load saved theme preference
    loadThemePreference();

    // Disable AI input and button initially
    disableAIInput();

    // Initialize editor tabs markdown
    generateEditorTabsMarkdown();

    // Setup beforeunload event to warn users when closing the page after opening a folder
    setupBeforeUnloadWarning();

    // Add CSS for drag and drop
    addDragAndDropStyles();
}

/**
 * Initialize IndexedDB for storing file system handles
 */
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('VibeCodingDB', 1);

        request.onerror = function (event) {
            console.error('IndexedDB error:', event.target.error);
            resolve(); // Resolve anyway to continue app initialization
        };

        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            // Create an object store for file system handles if it doesn't exist
            if (!db.objectStoreNames.contains('fileSystemHandles')) {
                db.createObjectStore('fileSystemHandles', { keyPath: 'id' });
            }
        };

        request.onsuccess = function (event) {
            db = event.target.result;
            //console.log('IndexedDB initialized successfully');
            resolve();
        };
    });
}

/**
 * Save folder handle to IndexedDB
 * @param {FileSystemDirectoryHandle} folderHandle - The folder handle to save
 */
async function saveFolderHandle(folderHandle) {
    if (!db) return;

    try {
        const transaction = db.transaction(['fileSystemHandles'], 'readwrite');
        const store = transaction.objectStore('fileSystemHandles');

        // Store the folder handle with a fixed ID
        await store.put({
            id: 'lastOpenedFolder',
            handle: folderHandle,
            name: folderHandle.name,
            timestamp: Date.now()
        });

        //console.log('Folder handle saved successfully');
    } catch (error) {
        console.error('Error saving folder handle:', error);
    }
}

/**
 * Get the last opened folder handle from IndexedDB
 * @returns {Promise<FileSystemDirectoryHandle|null>} The last opened folder handle or null
 */
async function getLastFolderHandle() {
    if (!db) return null;

    return new Promise((resolve) => {
        try {
            const transaction = db.transaction(['fileSystemHandles'], 'readonly');
            const store = transaction.objectStore('fileSystemHandles');
            const request = store.get('lastOpenedFolder');

            request.onsuccess = function (event) {
                if (event.target.result) {
                    resolve(event.target.result.handle);
                } else {
                    resolve(null);
                }
            };

            request.onerror = function (event) {
                console.error('Error getting folder handle:', event.target.error);
                resolve(null);
            };
        } catch (error) {
            console.error('Error accessing IndexedDB:', error);
            resolve(null);
        }
    });
}

/**
 * Try to restore the last opened folder
 */
async function tryRestoreLastFolder() {
    try {
        const folderHandle = await getLastFolderHandle();

        if (folderHandle) {
            // Check if we still have permission to access this folder
            const permissionStatus = await folderHandle.queryPermission({ mode: 'readwrite' });

            if (permissionStatus === 'granted') {
                //console.log('Restoring last opened folder:', folderHandle.name);

                // Show loading notification
                //showNotification('正在恢复上次打开的文件夹: ' + folderHandle.name);

                // Process the folder
                await processOpenedFolder(folderHandle);
            } else {
                // 存储文件夹句柄以供后续使用
                window.lastFolderHandle = folderHandle;

                // 显示恢复按钮
                showRestoreFolderButton(folderHandle.name);
            }
        }
    } catch (error) {
        console.error('Error restoring last folder:', error);
    }
}

/**
 * 显示恢复上次文件夹的按钮
 * @param {string} folderName - 文件夹名称
 */
function showRestoreFolderButton(folderName) {
    // 检查是否已经存在恢复按钮
    if ($('#restore-folder-btn').length === 0) {
        // 保存对现有按钮的引用
        const openFolderBtn = $('#open-folder-btn').length ? $('#open-folder-btn').detach() : $('<button id="open-folder-btn"><i class="fas fa-folder-open"></i> 打开文件夹</button>');
        const newFileBtn = $('#new-file-btn').length ? $('#new-file-btn').detach() : $('<button id="new-file-btn" style="display: none;"><i class="fas fa-file"></i> 新建文件</button>');
        const refreshFolderBtn = $('#refresh-folder-btn').length ? $('#refresh-folder-btn').detach() : $('<button id="refresh-folder-btn" title="刷新文件树" style="display: none;"><i class="fas fa-sync"></i></button>');

        // 重新组织文件浏览器操作区域
        $('.file-explorer-actions').addClass('file-explorer-actions-multi-row');

        // 创建恢复按钮
        const restoreBtn = $(`
            <button id="restore-folder-btn" class="restore-folder-btn" title="恢复上次打开的文件夹: ${folderName}">
                <i class="fas fa-history"></i> 
                <span class="folder-name-text">恢复上次打开的文件夹: ${folderName}</span>
            </button>
        `);

        // 创建一个新的行来包含恢复按钮
        const restoreRow = $('<div class="file-explorer-actions-row restore-row"></div>');
        restoreRow.append(restoreBtn);

        // 创建一个新的行来包含原有按钮
        const originalRow = $('<div class="file-explorer-actions-row original-row"></div>');

        // 将保存的按钮添加到新行
        originalRow.append(openFolderBtn);
        originalRow.append(newFileBtn);
        originalRow.append(refreshFolderBtn);

        // 清空原容器并添加新行
        $('.file-explorer-actions').empty()
            .append(restoreRow)
            .append(originalRow);

        // 确保打开文件夹按钮始终可见
        openFolderBtn.show();

        // 添加点击事件
        restoreBtn.on('click', async function () {
            try {
                // 获取存储的文件夹句柄
                const folderHandle = window.lastFolderHandle;
                if (!folderHandle) return;

                // 请求权限
                const newPermissionStatus = await folderHandle.requestPermission({ mode: 'readwrite' });

                if (newPermissionStatus === 'granted') {
                    //console.log('Permission granted for last folder:', folderHandle.name);

                    // 恢复原始布局
                    restoreOriginalLayout();

                    // 显示加载通知
                    //showNotification('正在恢复上次打开的文件夹: ' + folderHandle.name);

                    // 处理文件夹
                    await processOpenedFolder(folderHandle);
                } else {
                    //console.log('Permission denied for last folder');
                    showErrorDialog('无法获取文件夹访问权限，请尝试重新打开文件夹。');
                }
            } catch (error) {
                console.error('Error restoring folder:', error);
                showErrorDialog('恢复文件夹时出错: ' + error.message);
            }
        });

        // 添加样式
        const style = $(`
            <style>
                .file-explorer-actions-multi-row {
                    display: flex;
                    flex-direction: column;
                    padding: 8px;
                    gap: 8px;
                }
                
                .file-explorer-actions-row {
                    display: flex;
                    gap: 10px;
                    width: 100%;
                }
                
                .restore-row {
                    margin-bottom: 4px;
                }
                
                .restore-folder-btn {
                    background-color: #2c7c26;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 3px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    width: 100%;
                    font-size: 0.8em;
                }
                
                .restore-folder-btn:hover {
                    background-color: #35982e;
                }
                
                .restore-folder-btn i {
                    margin-right: 5px;
                    flex-shrink: 0;
                }
                
                .folder-name-text {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                body.light-theme .restore-folder-btn {
                    background-color: #4caf50;
                }
                
                body.light-theme .restore-folder-btn:hover {
                    background-color: #5dbd61;
                }
                
                /* 调整原有按钮在新布局中的样式 */
                .file-explorer-actions-multi-row #open-folder-btn,
                .file-explorer-actions-multi-row #new-file-btn,
                .file-explorer-actions-multi-row #refresh-folder-btn {
                    flex: 1;
                    min-width: 0;
                    justify-content: center;
                }
                
                /* 确保刷新按钮不会占用太多空间 */
                .file-explorer-actions-multi-row #refresh-folder-btn {
                    flex: 0 0 auto;
                }
            </style>
        `);

        // 添加样式到页面
        $('head').append(style);
    }
}

/**
 * 恢复文件浏览器操作区域的原始布局
 */
function restoreOriginalLayout() {
    // 保存对按钮的引用（以防它们已经从DOM中分离）
    const openFolderBtn = $('#open-folder-btn').length ? $('#open-folder-btn').detach() : $('<button id="open-folder-btn"><i class="fas fa-folder-open"></i> 打开文件夹</button>');
    const newFileBtn = $('#new-file-btn').length ? $('#new-file-btn').detach() : $('<button id="new-file-btn" style="display: none;"><i class="fas fa-file"></i> 新建文件</button>');
    const refreshFolderBtn = $('#refresh-folder-btn').length ? $('#refresh-folder-btn').detach() : $('<button id="refresh-folder-btn" title="刷新文件树" style="display: none;"><i class="fas fa-sync"></i></button>');

    // 移除多行类
    $('.file-explorer-actions').removeClass('file-explorer-actions-multi-row');

    // 清空容器
    $('.file-explorer-actions').empty();

    // 重新添加原始按钮
    $('.file-explorer-actions')
        .append(openFolderBtn)
        .append(newFileBtn)
        .append(refreshFolderBtn);

    // 确保按钮可见性正确
    openFolderBtn.show();

    // 如果已经打开了文件夹，确保这些按钮显示
    if (openedFolderHandle) {
        newFileBtn.show();
        refreshFolderBtn.show();
    } else {
        newFileBtn.hide();
        refreshFolderBtn.hide();
    }

    // 移除恢复按钮
    $('#restore-folder-btn').remove();
}

/**
 * Process an opened folder (common code for both new folder open and restore)
 * @param {FileSystemDirectoryHandle} folderHandle - The folder handle to process
 */
async function processOpenedFolder(folderHandle) {
    try {
        // Close all tabs before processing the new folder
        const tabsClosed = await closeAllTabs();

        // If user canceled closing tabs, don't continue with opening the folder
        if (!tabsClosed) {
            return false;
        }

        // Set the global folder handle
        openedFolderHandle = folderHandle;

        // Reset file handles map
        fileHandles.clear();

        // Reset directory handles
        directoryHandles.clear();

        // Reset selected folder
        selectedFolder = null;

        // Reset expanded folders
        expandedFolders.clear();

        // Clear cursor navigation history for the new project
        clearCursorHistory();

        // Update UI
        $('#file-tree').empty();

        // 显示新建文件和刷新按钮
        $('#new-file-btn').show();
        $('#refresh-folder-btn').show();

        // 如果存在恢复按钮，恢复原始布局（隐藏恢复按钮）
        if ($('#restore-folder-btn').length > 0) {
            restoreOriginalLayout();
        }

        // Show loading indicator
        $('#loading-indicator').show();
        $('#loading-progress').text("正在扫描文件夹...");

        // Process the directory
        let fileCount = 0;
        let folderCount = 0;

        // 使用定时器更新进度信息
        const progressInterval = setInterval(() => {
            $('#loading-progress').text(`已扫描 ${folderCount} 个文件夹，${fileCount} 个文件...`);
        }, 500);

        // 开始处理目录 - 只加载顶层文件和文件夹，其他将在点击时加载
        await processDirectory(openedFolderHandle, $('#file-tree'), '', (type) => {
            if (type === 'file') fileCount++;
            if (type === 'folder') folderCount++;
        }, true); // true = 使用懒加载

        // 处理完成后清理
        clearInterval(progressInterval);
        $('#loading-indicator').hide();

        // Update status
        $('.status-bar-item:contains("就绪")').html(`<i class="fas fa-check-circle"></i> 已打开文件夹: ${openedFolderHandle.name}`);

        // 显示加载完成的文件统计信息
        showNotification(`已加载 ${folderCount} 个文件夹，${fileCount} 个文件`);

        // Enable AI input once folder is loaded
        enableAIInput();

        // Set flag to indicate a folder has been opened
        hasOpenedFolder = true;

        // Save folder handle for future sessions
        await saveFolderHandle(folderHandle);

        // Trigger folderOpened event for other components (like indexer)
        $(document).trigger('folderOpened');

        return true;
    } catch (error) {
        // 如果处理过程中出错，清理定时器
        if (progressInterval) clearInterval(progressInterval);
        $('#loading-indicator').hide();

        console.error('Error processing folder:', error);
        showErrorDialog('处理文件夹时出错: ' + error.message);

        return false;
    }
}

/**
 * Request permission to access the file system and open a folder
 */
async function openFolder() {
    try {
        // Check if the File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            showErrorDialog('您的浏览器不支持文件系统访问API。请使用Chrome或Edge浏览器。');
            return;
        }

        // Show directory picker
        const folderHandle = await window.showDirectoryPicker();

        // 如果存在恢复按钮，先隐藏它
        if ($('#restore-folder-btn').length > 0) {
            restoreOriginalLayout();
        }

        // Process the selected folder
        await processOpenedFolder(folderHandle);
    } catch (error) {
        // User cancelled or an error occurred
        $('#loading-indicator').hide();
        if (error.name !== 'AbortError') {
            showErrorDialog('打开文件夹出错: ' + error.message);
        }
    }
}

/**
 * Setup warning when user tries to close or refresh the page after opening a folder
 */
function setupBeforeUnloadWarning() {
    window.addEventListener('beforeunload', function (e) {
        // Only show warning if a folder has been opened
        if (hasOpenedFolder) {
            // Standard message (browser may override this with a generic message)
            const message = '您已打开文件夹，关闭页面将丢失当前会话。确定要离开吗？';
            e.returnValue = message;
            return message;
        }
    });
}

/**
 * Disable AI input box and send button
 */
function disableAIInput() {
    $('#ai-question').prop('disabled', true);
    $('#ask-ai-btn').prop('disabled', true);

    // Add placeholder text indicating the user needs to open a folder first
    $('#ai-question').attr('placeholder', '请先打开文件夹以启用AI助手...');

    // Add visual indication that the AI panel is disabled
    if ($('#ai-disabled-overlay').length === 0) {
        const aiPanel = $('.ai-qa-panel');
        const overlay = $(`
            <div id="ai-disabled-overlay" class="ai-disabled-overlay">
                <div class="ai-disabled-message">
                    <i class="fas fa-folder-open"></i>
                    <p>请先打开文件夹以启用AI助手</p>
                </div>
            </div>
        `);
        aiPanel.append(overlay);
    }

    // Add disabled class to the AI panel for styling
    $('.ai-qa-panel').addClass('ai-disabled');

    // Disable the model selector as well
    $('#ai-model-selector').prop('disabled', true);
}

/**
 * Enable AI input box and send button
 */
function enableAIInput() {
    $('#ai-question').prop('disabled', false);
    $('#ask-ai-btn').prop('disabled', false);

    // Restore original placeholder
    $('#ai-question').attr('placeholder', '输入@选择文件,并输入关于你的代码的问题...');

    // Remove the disabled overlay
    $('#ai-disabled-overlay').remove();

    // Remove disabled class from the AI panel
    $('.ai-qa-panel').removeClass('ai-disabled');

    // Enable the model selector
    $('#ai-model-selector').prop('disabled', false);
}

/**
 * Initialize Monaco Editor
 */
function initMonacoEditor() {
    // 使用已经在页面中配置好的 require
    require(['vs/editor/editor.main'], function () {
        // 隐藏加载指示器
        $('#monaco-loading').fadeOut(300, function () {
            $(this).remove();
        });

        // 注册 Vue 文件的语言支持
        monaco.languages.register({ id: 'vue', extensions: ['.vue'] });

        // 配置 Vue 语法高亮规则 (基于 HTML、CSS 和 JavaScript 的组合)
        monaco.languages.setMonarchTokensProvider('vue', {
            defaultToken: '',
            tokenPostfix: '.vue',

            // 嵌套模式处理
            embeddedLanguages: {
                'text/html': 'html',
                'text/css': 'css',
                'text/javascript': 'javascript',
                'script': 'javascript',
                'style': 'css',
                'template': 'html'
            },

            // Vue 标签
            tags: [
                'template', 'script', 'style'
            ],

            // 状态
            tokenizer: {
                root: [
                    [/<(template)>/, { token: 'delimiter.html', next: '@template' }],
                    [/<(script)\s*>/, { token: 'delimiter.html', next: '@script' }],
                    [/<(script)\s*(lang=["']ts["'])>/, { token: 'delimiter.html', next: '@typescript' }],
                    [/<(style)\s*>/, { token: 'delimiter.html', next: '@style' }],
                    [/<(style)\s*(lang=["']scss["'])>/, { token: 'delimiter.html', next: '@scss' }],
                    [/{{/, { token: 'delimiter.bracket', next: '@expression' }],
                    [/./, 'html']
                ],

                template: [
                    [/<\/(template)>/, { token: 'delimiter.html', next: '@pop' }],
                    [/./, 'html']
                ],

                script: [
                    [/<\/(script)>/, { token: 'delimiter.html', next: '@pop' }],
                    [/./, 'javascript']
                ],

                typescript: [
                    [/<\/(script)>/, { token: 'delimiter.html', next: '@pop' }],
                    [/./, 'typescript']
                ],

                style: [
                    [/<\/(style)>/, { token: 'delimiter.html', next: '@pop' }],
                    [/./, 'css']
                ],

                scss: [
                    [/<\/(style)>/, { token: 'delimiter.html', next: '@pop' }],
                    [/./, 'scss']
                ],

                expression: [
                    [/}}/, { token: 'delimiter.bracket', next: '@pop' }],
                    [/./, 'expression']
                ]
            }
        });

        // 注册对 .vue 文件的语言配置，提供自动缩进、注释等支持
        monaco.languages.setLanguageConfiguration('vue', {
            comments: {
                lineComment: '//',
                blockComment: ['/*', '*/']
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
                ['<', '>']
            ],
            autoClosingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '<', close: '>' },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
                { open: '`', close: '`' }
            ],
            surroundingPairs: [
                { open: '{', close: '}' },
                { open: '[', close: ']' },
                { open: '(', close: ')' },
                { open: '<', close: '>' },
                { open: '"', close: '"' },
                { open: "'", close: "'" },
                { open: '`', close: '`' }
            ]
        });

        // Define custom themes
        monaco.editor.defineTheme('vibe-light', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#f5f5f5',
                'editor.foreground': '#333333',
                'editor.lineHighlightBackground': '#e3e8ec',
                'editorCursor.foreground': '#007acc',
                'editorWhitespace.foreground': '#d0d0d0',
                'editorIndentGuide.background': '#d0d0d0'
            }
        });

        monaco.editor.defineTheme('vibe-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#1e1e1e',
                'editor.foreground': '#d4d4d4',
                'editor.lineHighlightBackground': '#2d2d30',
                'editorCursor.foreground': '#a6a6a6',
                'editorWhitespace.foreground': '#3a3a3a',
                'editorIndentGuide.background': '#3a3a3a'
            }
        });

        // 检查是否已经有主题设置
        const savedTheme = localStorage.getItem('vibeCodingTheme');
        const initialTheme = savedTheme === 'light' ? 'vibe-light' : 'vibe-dark';

        // Create editor instance with the correct initial theme
        editor = monaco.editor.create(document.getElementById('editor'), {
            value: '',
            language: 'javascript',
            theme: initialTheme,
            automaticLayout: true,
            minimap: {
                enabled: true
            },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbersMinChars: 3,
            folding: true,
            renderLineHighlight: 'all',
            scrollbar: {
                useShadows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
            }
        });

        // Setup editor change listener
        editor.onDidChangeModelContent(function (e) {
            if (currentOpenFile) {
                const currentContent = editor.getValue();
                const originalContent = originalContents.get(currentOpenFile) || '';
                const tabElement = openedTabs.get(currentOpenFile);

                // Compare current content with original content
                if (currentContent === originalContent) {
                    // If content matches original, remove dirty flag
                    if (dirtyFiles.has(currentOpenFile)) {
                        dirtyFiles.delete(currentOpenFile);
                        updateTabTitle(currentOpenFile, false);
                    }
                } else {
                    // Mark the file as dirty if it's not already
                    if (!dirtyFiles.has(currentOpenFile)) {
                        dirtyFiles.add(currentOpenFile);
                        updateTabTitle(currentOpenFile, true);
                    }
                }

                // Update word count
                updateWordCount(currentContent);

                // Update preview if in preview mode and it's an HTML file
                if (isPreviewMode && currentOpenFile.toLowerCase().endsWith('.html')) {
                    // Use debounce to avoid updating preview on every keystroke
                    clearTimeout(window.previewUpdateTimeout);
                    window.previewUpdateTimeout = setTimeout(() => {
                        togglePreview(); // Toggle off and back on to refresh
                        togglePreview();
                    }, 1000); // Wait 1 second after typing stops
                }
            }
        });

        // Track cursor position
        editor.onDidChangeCursorPosition(function (e) {
            updateCursorPosition(e.position);
        });

        // Register key binding for undo
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, function () {
            editor.trigger('keyboard', 'undo', null);
            // After undo, we'll check if we need to update the dirty state
            // This is already handled by the onDidChangeModelContent event
        });

        // Set editor ready flag
        isEditorReady = true;

        // Update global reference for file watcher
        window.editor = editor;

        // Initialize navigation buttons state
        updateNavigationButtons();

        // Trigger event for editor enhancements to initialize
        $(document).trigger('editorReady', [editor]);
    });
}

/**
 * Update cursor position in the status bar
 * @param {Position} position - Monaco editor position object
 */
function updateCursorPosition(position) {
    if (!position) return;

    const lineNumber = position.lineNumber || 0;
    const column = position.column || 0;

    $('#cursor-line').text(lineNumber);
    $('#cursor-column').text(column);

    // Record cursor position in history if it's a significant move
    recordCursorPosition(position);
}

/**
 * Record cursor position in navigation history
 * @param {Position} position - Monaco editor position object
 */
function recordCursorPosition(position) {
    if (!position || !currentOpenFile || isNavigatingHistory) return;

    const currentPos = {
        filePath: currentOpenFile,
        lineNumber: position.lineNumber,
        column: position.column,
        timestamp: Date.now()
    };

    // Check if this is a significant position change
    if (lastCursorPosition) {
        const lineDiff = Math.abs(position.lineNumber - lastCursorPosition.lineNumber);
        const isSameFile = currentOpenFile === lastCursorPosition.filePath;
        
        // Only record if it's a significant jump (different file or jumped multiple lines)
        if (!isSameFile || lineDiff >= MIN_LINE_JUMP) {
            addToCursorHistory(currentPos);
        }
    } else {
        // First position in this file
        addToCursorHistory(currentPos);
    }

    lastCursorPosition = { ...currentPos };
}

/**
 * Add position to cursor history
 * @param {Object} position - Position object with filePath, lineNumber, column
 */
function addToCursorHistory(position) {
    // If we're not at the end of history, remove everything after current index
    if (currentHistoryIndex < cursorHistory.length - 1) {
        cursorHistory = cursorHistory.slice(0, currentHistoryIndex + 1);
    }

    // Add new position
    cursorHistory.push(position);

    // Limit history size
    if (cursorHistory.length > MAX_HISTORY_SIZE) {
        cursorHistory.shift();
    } else {
        currentHistoryIndex++;
    }

    // Update navigation buttons
    updateNavigationButtons();
}

/**
 * Navigate to previous cursor position
 */
async function goBack() {
    if (currentHistoryIndex <= 0) return;

    currentHistoryIndex--;
    await navigateToHistoryPosition(cursorHistory[currentHistoryIndex]);
}

/**
 * Navigate to next cursor position
 */
async function goForward() {
    if (currentHistoryIndex >= cursorHistory.length - 1) return;

    currentHistoryIndex++;
    await navigateToHistoryPosition(cursorHistory[currentHistoryIndex]);
}

/**
 * Navigate to a specific position in history
 * @param {Object} position - Position object with filePath, lineNumber, column
 */
async function navigateToHistoryPosition(position) {
    if (!position) return;

    isNavigatingHistory = true;

    try {
        // Switch to the file if it's different from current
        if (position.filePath !== currentOpenFile) {
            // Check if the file is still available
            if (fileHandles.has(position.filePath)) {
                await openFile(position.filePath);
            } else {
                // File is no longer available, remove this position from history
                cursorHistory.splice(currentHistoryIndex, 1);
                currentHistoryIndex = Math.max(0, Math.min(currentHistoryIndex, cursorHistory.length - 1));
                updateNavigationButtons();
                showNotification('历史位置的文件已不可用', 'warning');
                return;
            }
        }

        // Set cursor position
        if (editor && isEditorReady) {
            editor.setPosition({
                lineNumber: position.lineNumber,
                column: position.column
            });

            // Scroll to the position and center it
            editor.revealLineInCenter(position.lineNumber);

            // Focus the editor
            editor.focus();
        }

        // Update navigation buttons
        updateNavigationButtons();

    } finally {
        // Re-enable position recording after a short delay
        setTimeout(() => {
            isNavigatingHistory = false;
        }, 100);
    }
}

/**
 * Update the state of navigation buttons
 */
function updateNavigationButtons() {
    const canGoBack = currentHistoryIndex > 0;
    const canGoForward = currentHistoryIndex < cursorHistory.length - 1;

    $('#cursor-back-btn').prop('disabled', !canGoBack);
    $('#cursor-forward-btn').prop('disabled', !canGoForward);

    // Update button styling based on state
    if (canGoBack) {
        $('#cursor-back-btn').removeClass('disabled');
    } else {
        $('#cursor-back-btn').addClass('disabled');
    }

    if (canGoForward) {
        $('#cursor-forward-btn').removeClass('disabled');
    } else {
        $('#cursor-forward-btn').addClass('disabled');
    }
}

/**
 * Clear cursor history (called when switching projects)
 */
function clearCursorHistory() {
    cursorHistory = [];
    currentHistoryIndex = -1;
    lastCursorPosition = null;
    updateNavigationButtons();
}

/**
 * Update word count in the status bar
 * @param {string} content - Editor content
 */
function updateWordCount(content) {
    if (typeof content !== 'string') {
        content = '';
    }

    // Count words (split by whitespace)
    const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

    // Count characters (including whitespace)
    const charCount = content.length;

    // Count lines
    const lineCount = content.split('\n').length;

    // Update UI
    $('#word-count').text(wordCount);
    $('#char-count').text(charCount);
    $('#line-count').text(lineCount);
}

/**
 * Initialize UI event listeners
 */
function initEventListeners() {
    // Open folder button
    $('#open-folder-btn').on('click', openFolder);

    // New file button
    $('#new-file-btn').on('click', function () {
        showNewFileModal();
    });

    // Refresh folder button
    $('#refresh-folder-btn').on('click', refreshFileTree);

    // Theme toggle
    $('#theme-toggle').on('click', toggleTheme);

    // New file modal
    $('#new-file-modal .vibe-modal-close, #cancel-new-file').on('click', hideNewFileModal);
    $('#create-new-file').on('click', createNewFile);
    $('#new-file-name').on('keypress', function (e) {
        if (e.which === 13) {
            createNewFile();
        }
    });

    // New folder dialog
    $('#new-folder-cancel').on('click', function () {
        $('#new-folder-dialog').css('display', 'none');
    });
    $('#new-folder-create').on('click', createNewFolder);
    $('#new-folder-name').on('keypress', function (e) {
        if (e.which === 13) {
            createNewFolder();
        }
    });
    // Model selector change
    $('#ai-model-selector').on('change', function () {
        const modelId = $(this).val();
        const selectedOption = $(this).find(`option[value="${modelId}"]`);
        currentModel = {
            id: modelId,
            modelName: selectedOption.data('name'),
            modelNick: selectedOption.data('nick'),
            visionModel: selectedOption.data('vision')
        };
        if (currentModel.visionModel) {

        }
    });

    // Tabs menu button
    $('#editor-tabs-menu').on('click', function (e) {
        e.stopPropagation();
        const menuButton = $(this);
        const dropdown = $('#editor-tabs-dropdown');

        // Position the dropdown relative to the button
        dropdown.css({
            'right': '0',
            'top': menuButton.outerHeight() + 'px'
        });

        // Show/hide dropdown
        dropdown.toggleClass('show');
    });

    // Close dropdown when clicking elsewhere
    $(document).on('click', function () {
        $('#editor-tabs-dropdown').removeClass('show');
    });

    // Close all tabs
    $('#close-all-tabs').on('click', function () {
        closeAllTabs();
        $('#editor-tabs-dropdown').removeClass('show');
    });

    // Close all saved tabs
    $('#close-saved-tabs').on('click', function () {
        closeSavedTabs();
        $('#editor-tabs-dropdown').removeClass('show');
    });

    // Window resize handler
    $(window).on('resize', function () {
        if (isEditorReady && editor) {
            editor.layout();
        }
    });

    // Burger menu handler
    //$('#menuMain').on('click', function (e) {
    //    e.preventDefault();
    //    $('.file-explorer').toggleClass('collapsed');
    //});

    // Handle keyboard shortcuts
    $(document).on('keydown', function (e) {
        // Save (Ctrl+S on Windows/Linux or Cmd+S on macOS)
        if ((isMacOS() ? e.metaKey : e.ctrlKey) && e.which === 83) {
            e.preventDefault();
            if (currentOpenFile) {
                saveFile(currentOpenFile);

                // Update status bar to show saving state
                updateStatusBar('save');
            }
        }

        // Find (Ctrl+F on Windows/Linux or Cmd+F on macOS)
        if ((isMacOS() ? e.metaKey : e.ctrlKey) && e.which === 70) {
            e.preventDefault();
            if (currentOpenFile && editor) {
                toggleEditorSearch();
            }
        }

        // Toggle preview (Ctrl+P or Cmd+P)
        if ((isMacOS() ? e.metaKey : e.ctrlKey) && e.which === 80) {
            e.preventDefault();
            if (currentOpenFile && currentOpenFile.toLowerCase().endsWith('.html')) {
                togglePreview();
            }
        }

        // Go back (Alt+Left Arrow)
        if (e.altKey && e.which === 37) {
            e.preventDefault();
            goBack();
        }

        // Go forward (Alt+Right Arrow)
        if (e.altKey && e.which === 39) {
            e.preventDefault();
            goForward();
        }
    });

    // Update the status bar with keyboard shortcut info based on OS
    updateShortcutInfo();
}

/**
 * Close all open tabs
 * @param {boolean} [skipPrompt=false] - Whether to skip the unsaved changes prompt
 * @returns {Promise<boolean>} - Whether all tabs were successfully closed
 */
async function closeAllTabs(skipPrompt = false) {
    // Check if there are any unsaved changes
    if (!skipPrompt && dirtyFiles.size > 0) {
        const confirmation = await showConfirmDialog(`有 ${dirtyFiles.size} 个文件有未保存的更改。继续关闭所有标签页将丢失这些更改。是否继续？`);
        if (!confirmation) {
            return false; // User canceled
        }
    }

    // Create a copy of the tab paths (since we'll be modifying the map while iterating)
    const tabPaths = Array.from(openedTabs.keys());

    // Close each tab, starting from the end
    for (let i = tabPaths.length - 1; i >= 0; i--) {
        const filePath = tabPaths[i];

        // If file has unsaved changes, remove from dirty files since user confirmed to discard
        if (dirtyFiles.has(filePath)) {
            dirtyFiles.delete(filePath);
        }

        // Get tab element and remove it
        const tab = openedTabs.get(filePath);
        if (tab) {
            tab.remove();
        }
        openedTabs.delete(filePath);
    }

    // Clear editor
    if (editor) {
        editor.setModel(null);
    }

    // Hide editor and show placeholder
    $('#editor').hide();
    $('#editor-placeholder').show();

    // Reset current file
    currentOpenFile = null;
    $('#current-file-type').text('未选择文件');
    $('.file-type-indicator').attr('data-short-type', '--');

    // Reset cursor position and word count
    $('#cursor-line').text('0');
    $('#cursor-column').text('0');
    $('#word-count').text('0');
    $('#char-count').text('0');
    $('#line-count').text('0');

    // Update tabs markdown representation
    generateEditorTabsMarkdown();

    return true;
}

/**
 * Close all saved tabs (tabs without unsaved changes)
 */
async function closeSavedTabs() {
    // Create a copy of the tab paths (since we'll be modifying the map while iterating)
    const tabPaths = Array.from(openedTabs.keys());

    // Track if current file was closed
    let currentFileClosed = false;
    let remainingTabs = [];

    // Close each saved tab
    for (const filePath of tabPaths) {
        // Skip files with unsaved changes
        if (dirtyFiles.has(filePath)) {
            remainingTabs.push(filePath);
            continue;
        }

        // Check if this is the current file
        if (filePath === currentOpenFile) {
            currentFileClosed = true;
        }

        // Close tab using our improved closeTab function
        // For saved files, we can simplify by directly removing the tab
        const tab = openedTabs.get(filePath);
        tab.remove();
        openedTabs.delete(filePath);
    }

    // If current file was closed, switch to another tab or show placeholder
    if (currentFileClosed) {
        if (remainingTabs.length > 0) {
            // Open first available tab
            await openFile(remainingTabs[0]);
        } else {
            // No tabs left, show placeholder
            editor.setModel(null);
            $('#editor').hide();
            $('#editor-placeholder').show();
            currentOpenFile = null;
            window.currentOpenFile = null;
            $('#current-file-type').text('未选择文件');
            $('.file-type-indicator').attr('data-short-type', '--');

            // Reset cursor position and word count
            $('#cursor-line').text('0');
            $('#cursor-column').text('0');
            $('#word-count').text('0');
            $('#char-count').text('0');
            $('#line-count').text('0');
        }
    }

    // Show notification
    const closedCount = tabPaths.length - remainingTabs.length;
    showNotification(`已关闭 ${closedCount} 个已保存标签`);

    // Update tabs markdown representation
    generateEditorTabsMarkdown();
}

/**
 * Initialize resizable panels
 */
function initResizablePanels() {
    const fileExplorerResizer = document.getElementById('file-explorer-resizer');
    const aiQaResizer = document.getElementById('ai-qa-resizer');
    const fileExplorer = document.querySelector('.file-explorer');
    const aiQaPanel = document.querySelector('.ai-qa-panel');

    // Ensure the resize handles don't interfere with scrollbars
    preventScrollbarOverlap();

    // Window resize event to ensure resize handles stay in the right position
    $(window).on('resize', function () {
        preventScrollbarOverlap();
    });

    function preventScrollbarOverlap() {
        // Get the scrollbar width of the file explorer content
        const fileExplorerContent = document.querySelector('.file-explorer-content');
        const hasVerticalScrollbar = fileExplorerContent.scrollHeight > fileExplorerContent.clientHeight;

        // If there's a scrollbar, ensure the resize handle doesn't overlap it
        if (hasVerticalScrollbar) {
            fileExplorerResizer.style.right = '15px';
        } else {
            fileExplorerResizer.style.right = '0';
        }
    }

    // File explorer resizer
    fileExplorerResizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        currentResizer = 'file-explorer';
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(fileExplorer).width, 10);

        // Add classes for visual feedback
        document.body.classList.add('resizing');
        this.classList.add('dragging');

        // Disable transitions during resize
        fileExplorer.style.transition = 'none';
    });

    // AI QA panel resizer
    aiQaResizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        currentResizer = 'ai-qa';
        startX = e.clientX;
        startWidth = parseInt(window.getComputedStyle(aiQaPanel).width, 10);

        // Add classes for visual feedback
        document.body.classList.add('resizing');
        this.classList.add('dragging');

        // Disable transitions during resize
        aiQaPanel.style.transition = 'none';
    });

    // Mouse move handler
    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;

        // Store current mouse position
        currentClientX = e.clientX;

        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(function () {
            // Calculate the new width
            const delta = currentClientX - startX;

            if (currentResizer === 'file-explorer') {
                // For the file explorer, we add the delta to increase width when dragging right
                const newWidth = startWidth + delta;

                // Apply minimum and maximum constraints
                if (newWidth >= 100 && newWidth <= window.innerWidth / 2) {
                    fileExplorer.style.width = `${newWidth}px`;

                    // Relayout the editor if it's initialized
                    if (isEditorReady && editor) {
                        editor.layout();
                    }
                }
            } else if (currentResizer === 'ai-qa') {
                // For the AI QA panel, we subtract the delta to increase width when dragging left
                const newWidth = startWidth - delta;

                // Apply minimum and maximum constraints
                if (newWidth >= 100 && newWidth <= window.innerWidth / 2) {
                    aiQaPanel.style.width = `${newWidth}px`;

                    // Relayout the editor if it's initialized
                    if (isEditorReady && editor) {
                        editor.layout();
                    }
                }
            }
        });
    });

    // Mouse up handler
    document.addEventListener('mouseup', function () {
        if (isResizing) {
            isResizing = false;
            currentResizer = null;

            // Remove classes for visual feedback
            document.body.classList.remove('resizing');
            fileExplorerResizer.classList.remove('dragging');
            aiQaResizer.classList.remove('dragging');

            // Re-enable transitions after resize is complete
            fileExplorer.style.transition = '';
            aiQaPanel.style.transition = '';
        }
    });

    // When user leaves the window while resizing
    document.addEventListener('mouseleave', function () {
        if (isResizing) {
            isResizing = false;
            currentResizer = null;

            // Remove classes for visual feedback
            document.body.classList.remove('resizing');
            fileExplorerResizer.classList.remove('dragging');
            aiQaResizer.classList.remove('dragging');

            // Re-enable transitions after resize is complete
            fileExplorer.style.transition = '';
            aiQaPanel.style.transition = '';
        }
    });
}

/**
 * Process a directory and populate the file tree
 * @param {FileSystemDirectoryHandle} dirHandle - The directory handle
 * @param {jQuery} parentElement - The parent element to append to
 * @param {string} path - The current path
 * @param {Function} [progressCallback] - Callback to report progress
 * @param {boolean} [isLazyLoading=true] - Whether to use lazy loading for subdirectories
 */
async function processDirectory(dirHandle, parentElement, path, progressCallback, isLazyLoading = true) {
    // Ensure path is a string
    path = path || '';

    const dirPath = path + '/' + dirHandle.name;

    // Store directory handle
    directoryHandles.set(dirPath, dirHandle);

    // Report folder progress
    if (progressCallback) progressCallback('folder');

    // Create folder item
    const folderItem = $(`
        <li class="tree-item tree-folder" data-path="${dirPath}" data-loaded="false">
            <i class="fas fa-folder"></i> ${dirHandle.name}
            <ul class="tree-nested"></ul>
        </li>
    `);

    // Check if this folder was expanded before refresh
    const wasExpanded = expandedFolders.has(dirPath);

    // Add click handler to toggle folder
    folderItem.on('click', async function (e) {
        e.stopPropagation();
        const $this = $(this);
        const isLoaded = $this.attr('data-loaded') === 'true';
        const isExpanded = $this.hasClass('tree-expanded');
        const folderPath = $this.data('path');

        // Toggle expanded state
        $this.toggleClass('tree-expanded');
        $this.find('i').first().toggleClass('fa-folder fa-folder-open');

        // If expanding and not loaded yet, load the contents
        if (!isExpanded && !isLoaded) {
            // Show loading indicator inside the folder
            const $nestedContainer = $this.find('.tree-nested').first();
            const $loadingIndicator = $(`
                <li class="tree-item tree-loading">
                    <i class="fas fa-spinner fa-spin"></i> 加载中...
                </li>
            `);
            $nestedContainer.append($loadingIndicator);

            try {
                // Get the directory handle
                const handle = directoryHandles.get(folderPath);

                // Process the directory contents
                await loadDirectoryContents(handle, $nestedContainer, folderPath, progressCallback);

                // Mark as loaded
                $this.attr('data-loaded', 'true');
            } catch (error) {
                console.error('Error loading folder contents:', error);
                $loadingIndicator.html(`<i class="fas fa-exclamation-triangle"></i> 加载失败: ${error.message}`);
                setTimeout(() => {
                    $loadingIndicator.remove();
                }, 3000);
            } finally {
                // Remove loading indicator
                $loadingIndicator.remove();
            }
        }

        // Set as selected folder
        $('.tree-item').removeClass('folder-selected');
        $this.addClass('folder-selected');
        selectedFolder = folderPath;

        // Track expanded state
        if ($this.hasClass('tree-expanded')) {
            expandedFolders.add(folderPath);
        } else {
            expandedFolders.delete(folderPath);
        }
    });

    // Add context menu for folder
    folderItem.on('contextmenu', function (e) {
        e.preventDefault();
        e.stopPropagation();

        // Set as selected folder
        $('.tree-item').removeClass('folder-selected');
        $(this).addClass('folder-selected');
        selectedFolder = $(this).data('path');

        // Create context menu
        showFolderContextMenu(e.pageX, e.pageY, dirPath);
    });

    // Append to parent
    parentElement.append(folderItem);

    // Check if this is the root directory
    const isRootDirectory = path === '';

    // Get nested container
    const nestedContainer = folderItem.find('.tree-nested');

    // If this is the root directory or we're not using lazy loading, load contents immediately
    if (isRootDirectory || !isLazyLoading) {
        await loadDirectoryContents(dirHandle, nestedContainer, dirPath, progressCallback, isLazyLoading);
        folderItem.attr('data-loaded', 'true');

        // If the folder was expanded before refresh or it's the root directory, expand it now
        if (wasExpanded || isRootDirectory) {
            folderItem.addClass('tree-expanded');
            folderItem.find('i').first().removeClass('fa-folder').addClass('fa-folder-open');

            // Add to expanded folders set if it's the root directory
            if (isRootDirectory) {
                expandedFolders.add(dirPath);
            }
        }
    }

    // Generate Markdown representation of the file tree after processing is complete
    // Only do this for the root directory when all processing is done
    if (isRootDirectory) {
        generateFileTreeMarkdown();
    }
}

/**
 * Load the contents of a directory
 * @param {FileSystemDirectoryHandle} dirHandle - The directory handle
 * @param {jQuery} parentElement - The parent element to append to
 * @param {string} dirPath - The current directory path
 * @param {Function} [progressCallback] - Callback to report progress
 * @param {boolean} [isLazyLoading=true] - Whether to use lazy loading for subdirectories
 */
async function loadDirectoryContents(dirHandle, parentElement, dirPath, progressCallback, isLazyLoading = true) {
    // Collect all entries first for sorting
    const directories = [];
    const files = [];

    // Collect all entries from the directory handle
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
            directories.push(entry);
            // Report folder progress
            if (progressCallback) progressCallback('folder');
        } else {
            files.push(entry);
            // Report file progress
            if (progressCallback) progressCallback('file');
        }
    }

    // Sort directories and files alphabetically by name
    directories.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    // Process directories first
    for (const entry of directories) {
        if (isLazyLoading) {
            // Store directory handle for later use
            const subDirPath = dirPath + '/' + entry.name;
            directoryHandles.set(subDirPath, entry);

            // Create folder item with empty nested container
            const folderItem = $(`
                <li class="tree-item tree-folder" data-path="${subDirPath}" data-loaded="false">
                    <i class="fas fa-folder"></i> ${entry.name}
                    <ul class="tree-nested"></ul>
                </li>
            `);

            // Add same click handler as in processDirectory
            folderItem.on('click', async function (e) {
                e.stopPropagation();
                const $this = $(this);
                const isLoaded = $this.attr('data-loaded') === 'true';
                const isExpanded = $this.hasClass('tree-expanded');
                const folderPath = $this.data('path');

                // Toggle expanded state
                $this.toggleClass('tree-expanded');
                $this.find('i').first().toggleClass('fa-folder fa-folder-open');

                // If expanding and not loaded yet, load the contents
                if (!isExpanded && !isLoaded) {
                    // Show loading indicator inside the folder
                    const $nestedContainer = $this.find('.tree-nested').first();
                    const $loadingIndicator = $(`
                        <li class="tree-item tree-loading">
                            <i class="fas fa-spinner fa-spin"></i> 加载中...
                        </li>
                    `);
                    $nestedContainer.append($loadingIndicator);

                    try {
                        // Get the directory handle
                        const handle = directoryHandles.get(folderPath);

                        // Process the directory contents
                        await loadDirectoryContents(handle, $nestedContainer, folderPath, progressCallback);

                        // Mark as loaded
                        $this.attr('data-loaded', 'true');
                    } catch (error) {
                        console.error('Error loading folder contents:', error);
                        $loadingIndicator.html(`<i class="fas fa-exclamation-triangle"></i> 加载失败: ${error.message}`);
                        setTimeout(() => {
                            $loadingIndicator.remove();
                        }, 3000);
                    } finally {
                        // Remove loading indicator
                        $loadingIndicator.remove();
                    }
                }

                // Set as selected folder
                $('.tree-item').removeClass('folder-selected');
                $this.addClass('folder-selected');
                selectedFolder = folderPath;

                // Track expanded state
                if ($this.hasClass('tree-expanded')) {
                    expandedFolders.add(folderPath);
                } else {
                    expandedFolders.delete(folderPath);
                }
            });

            // Add context menu for folder
            folderItem.on('contextmenu', function (e) {
                e.preventDefault();
                e.stopPropagation();

                // Set as selected folder
                $('.tree-item').removeClass('folder-selected');
                $(this).addClass('folder-selected');
                selectedFolder = $(this).data('path');

                // Create context menu
                showFolderContextMenu(e.pageX, e.pageY, selectedFolder);
            });

            // Check if this folder was expanded before refresh
            const wasExpanded = expandedFolders.has(subDirPath);
            if (wasExpanded) {
                folderItem.addClass('tree-expanded');
                folderItem.find('i').first().removeClass('fa-folder').addClass('fa-folder-open');

                // Load the contents immediately if it was expanded before
                const nestedContainer = folderItem.find('.tree-nested');
                await loadDirectoryContents(entry, nestedContainer, subDirPath, progressCallback);
                folderItem.attr('data-loaded', 'true');
            }

            // Append to parent
            parentElement.append(folderItem);
        } else {
            // Process subdirectory recursively (old behavior)
            await processDirectory(entry, parentElement, dirPath, progressCallback, false);
        }
    }

    // Then process files
    for (const entry of files) {
        // Store file handle
        fileHandles.set(dirPath + '/' + entry.name, entry);

        // Create file item
        const fileExtension = entry.name.split('.').pop().toLowerCase();
        const fileIcon = getFileIcon(fileExtension);
        const fileItem = $(`
            <li class="tree-item tree-file" data-path="${dirPath}/${entry.name}">
                ${fileIcon} ${entry.name}
            </li>
        `);

        // Add click handler to open file
        fileItem.on('click', function (e) {
            e.stopPropagation();
            const filePath = $(this).data('path');
            openFile(filePath);
            // Mark as selected
            $('.tree-item').removeClass('selected');
            $(this).addClass('selected');
        });

        // Add context menu for file
        fileItem.on('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Mark as selected
            $('.tree-item').removeClass('selected');
            $(this).addClass('selected');

            // Create context menu
            showFileContextMenu(e.pageX, e.pageY, $(this).data('path'));
        });

        // Append to nested container
        parentElement.append(fileItem);
    }
}

/**
 * Generate a Markdown representation of the file tree
 */
function generateFileTreeMarkdown() {
    // Start with the root folder
    let markdownTree = '';

    // Get the root folder name
    const rootFolderName = openedFolderHandle ? openedFolderHandle.name : 'Root';

    // Start building the markdown
    markdownTree = `# ${rootFolderName}\n\n`;

    // Define directories to exclude from the markdown representation
    const excludedDirs = [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        '.nuxt',
        '.cache',
        '.vscode',
        '.idea',
        'coverage',
        'tmp',
        'temp',
        '.DS_Store',
        '__pycache__',
        'venv',
        'env',
        '.env',
        'vendor',
        'bower_components',
        'jspm_packages',
        '.sass-cache',
        'bin',
        'obj'
    ];

    /**
     * Function to update excluded directories from vibeaichat.js
     * @param {string[]} customDirs - Additional directories to exclude
     */
    window.updateExcludedDirectories = function (customDirs) {
        if (Array.isArray(customDirs) && customDirs.length > 0) {
            // Add any new custom directories that aren't already in the excludedDirs list
            customDirs.forEach(dir => {
                if (!excludedDirs.includes(dir)) {
                    excludedDirs.push(dir);
                }
            });

            // If the file tree is already loaded, regenerate the markdown
            if (openedFolderHandle) {
                generateFileTreeMarkdown();
            }
        }
    };

    /**
     * Check if a folder should be excluded
     * @param {string} folderName - Name of the folder to check
     * @returns {boolean} - True if the folder should be excluded
     */
    function shouldExcludeFolder(folderName) {
        return excludedDirs.includes(folderName);
    }

    /**
     * Recursively build the markdown tree
     * @param {Element} element - The current element in the DOM tree
     * @param {number} level - The current indentation level
     * @param {string} parentPath - The path of the parent element
     */
    function buildMarkdownTree(element, level, parentPath) {
        const items = $(element).children('li');

        items.each(function () {
            const item = $(this);
            const indent = '  '.repeat(level);
            const itemPath = item.data('path') || '';

            if (item.hasClass('tree-folder')) {
                // This is a folder
                const folderName = item.clone().children().remove().end().text().trim();

                // Skip excluded directories
                if (shouldExcludeFolder(folderName)) {
                    markdownTree += `${indent}- 📁 ${folderName} (excluded from detailed view) [${itemPath}]\n`;
                    return; // Skip processing children
                }

                markdownTree += `${indent}- 📁 ${folderName} [${itemPath}]\n`;

                // Process children if this folder has any
                const nestedContainer = item.find('.tree-nested').first();
                if (nestedContainer.length > 0) {
                    buildMarkdownTree(nestedContainer, level + 1, itemPath);
                }
            } else if (item.hasClass('tree-file')) {
                // This is a file
                const fileName = item.clone().children().remove().end().text().trim();

                // Skip certain file types if needed
                if (fileName.endsWith('.map') || fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) {
                    return; // Skip minified files and source maps
                }

                markdownTree += `${indent}- 📄 ${fileName} [${itemPath}]\n`;
            }
        });
    }

    // Start building from the file tree root
    buildMarkdownTree($('#file-tree'), 0, '');

    // Share the markdown with vibeaichat.js
    if (typeof window.setFileTreeMarkdown === 'function') {
        window.setFileTreeMarkdown(markdownTree);
    }

    return markdownTree;
}

/**
 * Get appropriate icon for file type
 * @param {string} extension - File extension
 * @returns {string} HTML icon element
 */
function getFileIcon(extension) {
    const iconMap = {
        'html': '<i class="fas fa-code icon-html"></i>',
        'css': '<i class="fab fa-css3-alt icon-css"></i>',
        'js': '<i class="fab fa-js-square icon-js"></i>',
        'json': '<i class="fas fa-brackets-curly icon-json"></i>',
        'ts': '<i class="fab fa-js icon-ts"></i>',
        'vue': '<i class="fab fa-vuejs" style="color: #41B883;"></i>',
        'md': '<i class="fab fa-markdown icon-md"></i>',
        'php': '<i class="fab fa-php icon-php"></i>',
        'py': '<i class="fab fa-python icon-py"></i>',
        'java': '<i class="fab fa-java icon-java"></i>',
        'go': '<i class="fas fa-code icon-go"></i>',
        'c': '<i class="fas fa-code icon-c"></i>',
        'cpp': '<i class="fas fa-code icon-cpp"></i>',
        'txt': '<i class="fas fa-file-alt"></i>',
        'jpg': '<i class="fas fa-file-image"></i>',
        'jpeg': '<i class="fas fa-file-image"></i>',
        'png': '<i class="fas fa-file-image"></i>',
        'gif': '<i class="fas fa-file-image"></i>',
        'svg': '<i class="fas fa-file-image"></i>',
        'pdf': '<i class="fas fa-file-pdf"></i>'
    };

    return iconMap[extension] || '<i class="fas fa-file"></i>';
}

/**
 * Generate a Markdown representation of the current editor tabs
 * Updates the editorTabsMarkdown variable in vibeaichat.js
 */
function generateEditorTabsMarkdown() {
    // Start with a header
    let markdownTabs = '# Open Editor Tabs\n\n';

    if (openedTabs.size === 0) {
        markdownTabs += '- No tabs are currently open\n';
    } else {
        // Add information about current tab
        if (currentOpenFile) {
            markdownTabs += `**Current active tab:** \`${currentOpenFile}\`\n\n`;
        }

        // List all open tabs
        markdownTabs += '## All Open Tabs\n\n';

        // Convert the Map to an array and sort it
        const tabsArray = Array.from(openedTabs.keys()).sort();

        tabsArray.forEach(filePath => {
            const fileName = filePath.split('/').pop();
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const isDirty = dirtyFiles.has(filePath) ? ' (unsaved changes)' : '';
            const isActive = filePath === currentOpenFile ? ' (active)' : '';

            // Add an emoji based on file type
            let fileIcon = '📄';
            if (['html', 'htm', 'xml'].includes(fileExtension)) fileIcon = '🌐';
            else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension)) fileIcon = '📜';
            else if (['css', 'scss', 'sass', 'less'].includes(fileExtension)) fileIcon = '🎨';
            else if (['json', 'yaml', 'yml'].includes(fileExtension)) fileIcon = '📋';
            else if (['md', 'markdown'].includes(fileExtension)) fileIcon = '📝';
            else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExtension)) fileIcon = '🖼️';

            markdownTabs += `- ${fileIcon} \`${filePath}\`${isDirty}${isActive}\n`;
        });
    }

    // Share the markdown with vibeaichat.js if the function exists
    if (typeof window.setEditorTabsMarkdown === 'function') {
        window.setEditorTabsMarkdown(markdownTabs);
    }

    return markdownTabs;
}

/**
 * Create a new tab for a file
 * @param {string} filePath - Path to the file
 * @param {string} fileName - Name of the file
 * @param {string} fileExtension - Extension of the file
 */
function createNewTab(filePath, fileName, fileExtension) {
    // Create tab element
    const fileIcon = getFileIcon(fileExtension);
    const tab = $(`
        <div class="editor-tab active" data-path="${filePath}">
            ${fileIcon} <span class="tab-title">${fileName}</span>
            <span class="editor-tab-close"><i class="fas fa-times"></i></span>
        </div>
    `);

    // Add click handler to select tab
    tab.on('click', function (e) {
        if (!$(e.target).closest('.editor-tab-close').length) {
            const tabPath = $(this).data('path');

            // 如果标签页有外部修改标记，使用文件监听器的处理函数
            if ($(this).hasClass('externally-modified')) {
                e.preventDefault();
                
                // 调用文件监听器的处理函数
                if (window.fileWatcher && typeof window.fileWatcher.handleExternallyModifiedTabClick === 'function') {
                    window.fileWatcher.handleExternallyModifiedTabClick(tabPath).then((handled) => {
                        if (handled) {
                            // 如果成功处理，继续打开文件
                            openFile(tabPath);
                            scrollTabIntoView($(this));
                        }
                    });
                } else {
                    // 如果文件监听器不可用，使用原来的简单处理方式
                    $(this).removeClass('externally-modified');
                    $(this).find('.external-modification-indicator').remove();
                    showNotification('已加载外部修改的文件', 'info');
                    openFile(tabPath);
                    scrollTabIntoView($(this));
                }
                
                return;
            }

            openFile(tabPath);
            // Ensure tab is visible
            scrollTabIntoView($(this));
        }
    });

    // Add close handler
    tab.find('.editor-tab-close').on('click', function (e) {
        e.stopPropagation();
        const tabPath = $(this).closest('.editor-tab').data('path');
        closeTab(tabPath);
    });

    // Remove active class from other tabs
    $('.editor-tab').removeClass('active');

    // Add to tabs container
    $('#editor-tabs').append(tab);

    // Store tab reference
    openedTabs.set(filePath, tab);

    // Ensure new tab is visible
    scrollTabIntoView(tab);

    // Update tabs markdown representation
    generateEditorTabsMarkdown();
}

/**
 * Scroll the tabs container to make the active tab visible
 * @param {jQuery} tabElement - The tab element to scroll into view
 */
function scrollTabIntoView(tabElement) {
    const tabsContainer = $('#editor-tabs');
    const tabLeft = tabElement.position().left;
    const tabWidth = tabElement.outerWidth();
    const containerWidth = tabsContainer.width();
    const scrollLeft = tabsContainer.scrollLeft();

    // If tab is not fully visible, scroll to make it visible
    if (tabLeft < 0) {
        // Tab is to the left of the visible area
        tabsContainer.animate({ scrollLeft: scrollLeft + tabLeft - 10 }, 200);
    } else if (tabLeft + tabWidth > containerWidth) {
        // Tab is to the right of the visible area
        tabsContainer.animate({ scrollLeft: scrollLeft + tabLeft - containerWidth + tabWidth + 10 }, 200);
    }
}

/**
 * Open a file in the editor
 * @param {string} filePath - Path to the file
 */
async function openFile(filePath) {
    try {
        // Get file handle
        const fileHandle = fileHandles.get(filePath);
        if (!fileHandle) {
            throw new Error('File handle not found');
        }

        // Get file extension
        const fileExtension = filePath.split('.').pop().toLowerCase();

        // Get language ID for Monaco
        const language = getLanguageId(fileExtension);

        // Always reload the file from disk to ensure we get the latest content
        const file = await fileHandle.getFile();
        const contents = await file.text();

        // Store the original content for comparison
        originalContents.set(filePath, contents);

        // Get file name
        const fileName = filePath.split('/').pop();

        // Hide placeholder
        $('#editor-placeholder').hide();
        $('#editor').show();

        // Create or update editor model
        const existingModel = monaco.editor.getModels().find(model => model.uri.path === filePath);

        // Determine current theme based on isDarkTheme
        const currentTheme = isDarkTheme ? 'vibe-dark' : 'vibe-light';

        if (existingModel) {
            // If model exists, update its content to ensure we have the latest
            existingModel.setValue(contents);
            editor.setModel(existingModel);
            // Ensure theme is maintained
            monaco.editor.setTheme(currentTheme);
        } else {
            // Create new model
            const newModel = monaco.editor.createModel(
                contents,
                language,
                monaco.Uri.file(filePath)
            );
            editor.setModel(newModel);
            // Ensure theme is maintained
            monaco.editor.setTheme(currentTheme);
        }

        // Create or select tab
        if (!openedTabs.has(filePath)) {
            createNewTab(filePath, fileName, fileExtension);
        } else {
            // Select existing tab
            $('.editor-tab').removeClass('active');
            const tabElement = openedTabs.get(filePath);
            tabElement.addClass('active');

            // Ensure tab is visible
            scrollTabIntoView(tabElement);
            // Update tabs markdown since active tab changed
            generateEditorTabsMarkdown();
        }

        // Update current file
        currentOpenFile = filePath;
        window.currentOpenFile = currentOpenFile;

        // Update status
        const fileTypeText = fileExtension.toUpperCase();
        $('#current-file-type').text(fileTypeText);
        
        // Update data-short-type attribute for responsive display
        const shortType = fileTypeText.length > 4 ? fileTypeText.substring(0, 3) + '.' : fileTypeText;
        $('.file-type-indicator').attr('data-short-type', shortType);

        // Update word count
        updateWordCount(contents);

        // Reset dirty state for this file when opening
        dirtyFiles.delete(filePath);
        updateTabTitle(filePath, false);

        // Show preview button for HTML files
        togglePreviewButton(fileExtension === 'html');

        // Record initial cursor position for this file
        if (editor && isEditorReady) {
            const position = editor.getPosition();
            if (position) {
                recordCursorPosition(position);
            }
        }

        // Trigger file opened event for file watcher
        $(document).trigger('fileOpened', [filePath]);
    } catch (error) {
        console.error('Error opening file:', error);
        showErrorDialog('打开文件时出错: ' + error.message);
    }
}

/**
 * Close a tab
 * @param {string} filePath - Path to the file
 */
async function closeTab(filePath) {
    // Check if file has unsaved changes
    if (dirtyFiles.has(filePath)) {
        const shouldSave = await showUnsavedChangesDialog();

        if (!shouldSave) {
            // If user doesn't want to save, just remove from dirty files
            dirtyFiles.delete(filePath);
            updateTabTitle(filePath, false);

            // If this is the current open file, we need to handle it specially
            if (currentOpenFile === filePath) {
                // Store the original path because it may change during openFile
                const originalPath = filePath;

                // Get tab element
                const tab = openedTabs.get(filePath);

                // Remove tab first to avoid complications
                tab.remove();
                openedTabs.delete(filePath);

                // If there are other tabs, switch to another one
                if (openedTabs.size > 0) {
                    // Open first available tab
                    const nextTabPath = openedTabs.keys().next().value;
                    await openFile(nextTabPath);
                } else {
                    // No tabs left, show placeholder
                    editor.setModel(null);
                    $('#editor').hide();
                    $('#editor-placeholder').show();
                    currentOpenFile = null;
                    window.currentOpenFile = null;
                    $('#current-file-type').text('未选择文件');

                    // Reset cursor position and word count
                    $('#cursor-line').text('0');
                    $('#cursor-column').text('0');
                    $('#word-count').text('0');
                    $('#char-count').text('0');
                    $('#line-count').text('0');
                }

                // Update tabs markdown representation
                generateEditorTabsMarkdown();

                // Trigger file closed event for file watcher
                $(document).trigger('fileClosed', [originalPath]);

                // Return early as we've already handled everything
                return;
            }
        } else {
            // Save the file
            await saveFile(filePath);
        }
    }

    // Get tab element
    const tab = openedTabs.get(filePath);

    // Check if it's the current tab
    const isCurrentTab = tab.hasClass('active');

    // Remove tab
    tab.remove();
    openedTabs.delete(filePath);

    // If it was the current tab, open another tab or show placeholder
    if (isCurrentTab) {
        // If we're in preview mode, exit it
        if (isPreviewMode) {
            isPreviewMode = false;
            $('#preview-frame').hide();
            $('#preview-container').hide();

            // Revoke any existing blob URL
            if (previewFrame && previewFrame.data('blob-url')) {
                URL.revokeObjectURL(previewFrame.data('blob-url'));
            }
        }

        if (openedTabs.size > 0) {
            // Open first available tab
            const nextTabPath = openedTabs.keys().next().value;
            openFile(nextTabPath);
        } else {
            // No tabs left, show placeholder
            editor.setModel(null);
            $('#editor').hide();
            $('#editor-placeholder').show();
            currentOpenFile = null;
            window.currentOpenFile = null;
            $('#current-file-type').text('未选择文件');
            $('.file-type-indicator').attr('data-short-type', '--');
            $('#preview-container').hide();

            // Reset cursor position and word count
            $('#cursor-line').text('0');
            $('#cursor-column').text('0');
            $('#word-count').text('0');
            $('#char-count').text('0');
            $('#line-count').text('0');
        }
    }

    // Update tabs markdown representation
    generateEditorTabsMarkdown();

    // Trigger file closed event for file watcher
    $(document).trigger('fileClosed', [filePath]);
}

/**
 * Save the current file
 * @param {string} filePath - Path to the file
 */
async function saveFile(filePath) {
    try {
        // Get file handle
        const fileHandle = fileHandles.get(filePath);
        if (!fileHandle) {
            throw new Error('File handle not found');
        }

        // Get file contents from editor
        const contents = editor.getValue();

        // Create writable stream
        const writable = await fileHandle.createWritable();

        // Write and close
        await writable.write(contents);
        await writable.close();

        // Get file again to update the last modified time
        const file = await fileHandle.getFile();
        fileModificationTimes.set(filePath, file.lastModified);

        // Update original content
        originalContents.set(filePath, contents);

        // Update UI
        dirtyFiles.delete(filePath);
        updateTabTitle(filePath, false);

        // Show success notification
        showNotification('文件保存成功');
    } catch (error) {
        console.error('Error saving file:', error);
        showErrorDialog('保存文件时出错: ' + error.message);
    }
}

/**
 * Update tab title to show dirty state
 * @param {string} filePath - Path to the file
 * @param {boolean} isDirty - Whether the file has unsaved changes
 */
function updateTabTitle(filePath, isDirty) {
    const tab = openedTabs.get(filePath);
    if (tab) {
        const title = tab.find('.tab-title');
        const fileName = filePath.split('/').pop();

        if (isDirty) {
            // If file is marked as dirty, show the dirty indicator
            title.text(`${fileName} *`);
        } else {
            // File is not dirty, just show the file name
            title.text(fileName);
        }

        // Update tabs markdown since dirty state changed
        generateEditorTabsMarkdown();
    }
}

/**
 * Get language ID for Monaco based on file extension
 * @param {string} extension - File extension
 * @returns {string} Language ID
 */
function getLanguageId(extension) {
    const languageMap = {
        'html': 'html',
        'css': 'css',
        'js': 'javascript',
        'json': 'json',
        'ts': 'typescript',
        'vue': 'vue',
        'md': 'markdown',
        'php': 'php',
        'py': 'python',
        'java': 'java',
        'go': 'go',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'sql': 'sql',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'txt': 'plaintext',
        'sh': 'shell',
        'bat': 'bat'
    };

    return languageMap[extension] || 'plaintext';
}

/**
 * Show new file modal
 * @param {string} [targetFolder] - Optional target folder path
 */
function showNewFileModal(targetFolder) {
    if (!openedFolderHandle) {
        showErrorDialog('请先打开一个文件夹');
        return;
    }

    // If no target folder is provided, use the selected folder or the root folder
    if (!targetFolder) {
        targetFolder = selectedFolder || ('/' + openedFolderHandle.name);
    }

    // Ensure targetFolder is a string
    targetFolder = String(targetFolder);

    // Store the target folder on the modal for later use
    $('#new-file-modal').data('targetFolder', targetFolder);

    // Update the modal title to show where the file will be created
    const folderPath = targetFolder.split('/');
    const folderName = folderPath.length > 0 ? folderPath[folderPath.length - 1] : '';

    $('#new-file-modal .vibe-modal-header h4').text(`在 "${folderName || '根目录'}" 中创建新文件`);

    // Show the full path in small text
    $('#target-folder-path').text(`路径: ${targetFolder}`);

    // Clear input and show modal
    $('#new-file-name').val('');
    $('#new-file-modal').css('display', 'flex');
}

/**
 * Hide new file modal
 */
function hideNewFileModal() {
    $('#new-file-modal').css('display', 'none');
}

/**
 * Refresh the file tree while preserving expanded state
 */
async function refreshFileTree() {
    if (!openedFolderHandle) {
        showErrorDialog('请先打开一个文件夹');
        return;
    }

    try {
        // Show loading indicator
        $('#refresh-folder-btn').html('<i class="fas fa-sync fa-spin"></i>');

        // Save expanded states before refresh
        saveExpandedStates();

        // Show loading overlay
        $('#loading-indicator').show();
        $('#loading-progress').text("正在刷新文件树...");

        // Clear file tree
        $('#file-tree').empty();

        // Initialize counters
        let fileCount = 0;
        let folderCount = 0;

        // 使用定时器更新进度信息
        const progressInterval = setInterval(() => {
            $('#loading-progress').text(`已扫描 ${folderCount} 个文件夹，${fileCount} 个文件...`);
        }, 500);

        try {
            // Process directory with progress tracking
            await processDirectory(openedFolderHandle, $('#file-tree'), '', (type) => {
                if (type === 'file') fileCount++;
                if (type === 'folder') folderCount++;
            });

            // Clean up timer
            clearInterval(progressInterval);

            // Hide loading indicator
            $('#loading-indicator').hide();

            // Reset the refresh button
            $('#refresh-folder-btn').html('<i class="fas fa-sync"></i>');

            // Show completion notification
            showNotification(`文件树已刷新: ${folderCount} 个文件夹，${fileCount} 个文件`);

        } catch (error) {
            // Clean up on error
            clearInterval(progressInterval);
            $('#loading-indicator').hide();
            $('#refresh-folder-btn').html('<i class="fas fa-sync"></i>');
            throw error;
        }
    } catch (error) {
        console.error('Error refreshing file tree:', error);
        showErrorDialog('刷新文件树时出错: ' + error.message);
        $('#refresh-folder-btn').html('<i class="fas fa-sync"></i>');
    }
}

/**
 * Save current expanded states of folders
 */
function saveExpandedStates() {
    // Clear the set before collecting expanded folder paths
    expandedFolders.clear();

    // Find all expanded folder items
    $('.tree-item.tree-folder.tree-expanded').each(function () {
        const path = $(this).data('path');
        expandedFolders.add(path);
    });

    //console.log('Saved expanded states:', Array.from(expandedFolders));
}

/**
 * Restore expanded states of folders
 */
function restoreExpandedStates() {
    // 使用短延迟确保DOM已完全更新
    setTimeout(async () => {
        // Sort expanded folders by path depth (shallow to deep)
        // This ensures parent folders are expanded before their children
        const sortedPaths = Array.from(expandedFolders).sort((a, b) => {
            return a.split('/').length - b.split('/').length;
        });

        // Process each folder in order
        for (const path of sortedPaths) {
            const folderItem = $(`.tree-item.tree-folder[data-path="${path}"]`);
            if (folderItem.length) {
                // Expand the folder (which will trigger content loading if needed)
                if (!folderItem.hasClass('tree-expanded')) {
                    folderItem.click();
                }
            }
        }
    }, 100); // 短延迟确保DOM已完全更新
}

/**
 * Create a new file
 */
async function createNewFile() {
    try {
        const fileName = $('#new-file-name').val().trim();

        if (!fileName) {
            showErrorDialog('请输入文件名');
            return;
        }

        if (!openedFolderHandle) {
            showErrorDialog('请先打开一个文件夹');
            return;
        }

        // Disable the button and show loading state
        const createButton = $('#create-new-file');
        createButton.prop('disabled', true);
        createButton.html('<i class="fas fa-spinner fa-spin"></i> 创建中...');

        // Get the target folder path from the modal
        let targetFolderPath = $('#new-file-modal').data('targetFolder');

        // Ensure it's a string and provide a fallback
        targetFolderPath = targetFolderPath ? String(targetFolderPath) : ('/' + openedFolderHandle.name);

        //console.log('Creating file in folder:', targetFolderPath);

        // Get the directory handle for the target folder
        const targetDirHandle = directoryHandles.get(targetFolderPath);

        if (!targetDirHandle) {
            console.error('Target folder not found:', targetFolderPath);
            //console.log('Available directory handles:', Array.from(directoryHandles.keys()));

            // Restore button state
            createButton.prop('disabled', false);
            createButton.html('创建');

            showErrorDialog('找不到目标文件夹。请重试或选择其他文件夹。');
            return;
        }

        // Create file in the target folder
        const newFileHandle = await targetDirHandle.getFileHandle(fileName, { create: true });

        // Store file handle
        const filePath = targetFolderPath + '/' + fileName;
        fileHandles.set(filePath, newFileHandle);

        // Create writable stream
        const writable = await newFileHandle.createWritable();

        // Write empty content
        await writable.write('');
        await writable.close();

        // Save expanded states before refresh
        saveExpandedStates();

        // Make sure the parent folder is expanded
        expandedFolders.add(targetFolderPath);

        // Refresh file tree
        $('#file-tree').empty();
        await processDirectory(openedFolderHandle, $('#file-tree'), '', null, true); // Use lazy loading

        // Restore expanded states
        restoreExpandedStates();

        // Select the newly created file's folder
        $('.tree-item.tree-folder').each(function () {
            if ($(this).data('path') === targetFolderPath) {
                $(this).addClass('folder-selected');
                selectedFolder = targetFolderPath;
            }
        });

        // Open the new file
        openFile(filePath);

        // Restore button state
        createButton.prop('disabled', false);
        createButton.html('创建');

        // Hide modal
        hideNewFileModal();

        // Show success notification
        showNotification('文件创建成功');
    } catch (error) {
        console.error('Error creating file:', error);

        // Restore button state
        $('#create-new-file').prop('disabled', false);
        $('#create-new-file').html('创建');

        showErrorDialog('创建文件时出错: ' + error.message);
    }
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
 * Show notification
 * @param {string} message - Message to show
 */
function showNotification(message, type = 'info', autoHide = true) {
    // Create notification element
    const notification = $(`
        <div class="vibe-notification vibe-notification-${type}">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `);

    // Add to body
    $('body').append(notification);

    // Animate in
    setTimeout(() => {
        notification.addClass('show');

        // Auto-hide after delay
        if (autoHide) {
            setTimeout(() => {
                notification.removeClass('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 3000);
        }
    }, 10);

    return notification;
}
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'error': return 'fa-times-circle';
        case 'info':
        default: return 'fa-info-circle';
    }
}
/**
 * Show error message
 * @param {string} message - Error message
 */
function showErrorMessage(message) {
    // Use the custom error dialog instead
    showErrorDialog(message);
}

/**
 * Show custom error dialog
 * @param {string} message - Error message
 * @returns {Promise} - Promise that resolves when dialog is closed
 */
function showErrorDialog(message) {
    return new Promise((resolve) => {
        $('#error-message').text(message);
        $('#error-dialog').css('display', 'flex');

        $('#error-ok').off('click').on('click', function () {
            $('#error-dialog').css('display', 'none');
            resolve(true);
        });
    });
}

/**
 * Show custom confirm dialog
 * @param {string} message - Confirm message
 * @returns {Promise<boolean>} - Promise that resolves with true if OK, false if Cancel
 */
function showConfirmDialog(message) {
    return new Promise((resolve) => {
        $('#confirm-message').text(message);
        $('#confirm-dialog').css('display', 'flex');

        $('#confirm-ok').off('click').on('click', function () {
            $('#confirm-dialog').css('display', 'none');
            resolve(true);
        });

        $('#confirm-cancel').off('click').on('click', function () {
            $('#confirm-dialog').css('display', 'none');
            resolve(false);
        });
    });
}

/**
 * Show unsaved changes dialog
 * @returns {Promise<boolean>} - Promise that resolves with true if Save, false if Don't Save
 */
function showUnsavedChangesDialog() {
    return new Promise((resolve) => {
        $('#unsaved-changes-dialog').css('display', 'flex');

        $('#unsaved-save').off('click').on('click', function () {
            $('#unsaved-changes-dialog').css('display', 'none');
            resolve(true);
        });

        $('#unsaved-discard').off('click').on('click', function () {
            $('#unsaved-changes-dialog').css('display', 'none');
            resolve(false);
        });
    });
}

/**
 * Show context menu for file
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} filePath - Path to the file
 */
function showFileContextMenu(x, y, filePath) {
    // Remove any existing context menu
    $('.context-menu').remove();

    // Create context menu
    const contextMenu = $(`
        <div class="context-menu">
            <div class="context-menu-item" id="open-file-context">
                <i class="fas fa-external-link-alt"></i> 打开
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" id="rename-file-context">
                <i class="fas fa-pencil-alt"></i> 重命名
            </div>
            <div class="context-menu-item" id="delete-file-context">
                <i class="fas fa-trash-alt"></i> 删除
            </div>
        </div>
    `);

    // Add to body to calculate dimensions
    $('body').append(contextMenu);

    // Get menu dimensions
    const menuHeight = contextMenu.outerHeight();
    const menuWidth = contextMenu.outerWidth();

    // Check if menu would go below the window
    const windowHeight = $(window).height();
    const windowWidth = $(window).width();

    // Adjust Y position if needed
    if (y + menuHeight > windowHeight) {
        y = windowHeight - menuHeight - 10; // 10px padding from bottom
    }

    // Adjust X position if needed (prevent right overflow)
    if (x + menuWidth > windowWidth) {
        x = windowWidth - menuWidth - 10; // 10px padding from right
    }

    // Position context menu
    contextMenu.css({
        top: y + 'px',
        left: x + 'px'
    });

    // Add click handlers
    contextMenu.find('#open-file-context').on('click', function () {
        openFile(filePath);
        $('.context-menu').remove();
    });

    contextMenu.find('#rename-file-context').on('click', function () {
        showRenameFileDialog(filePath);
        $('.context-menu').remove();
    });

    contextMenu.find('#delete-file-context').on('click', function () {
        showDeleteFileDialog(filePath);
        $('.context-menu').remove();
    });

    // Close context menu on click elsewhere
    $(document).on('click', function () {
        $('.context-menu').remove();
    });
}

/**
 * Show folder context menu
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} folderPath - Path to the folder
 */
function showFolderContextMenu(x, y, folderPath) {
    // Remove any existing context menu
    $('.context-menu').remove();

    // Create context menu
    const contextMenu = $(`
        <div class="context-menu">
            <div class="context-menu-item" id="new-file-context">
                <i class="fas fa-file"></i> 新建文件
            </div>
            <div class="context-menu-item" id="new-folder-context">
                <i class="fas fa-folder"></i> 新建文件夹
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" id="rename-folder-context">
                <i class="fas fa-pencil-alt"></i> 重命名
            </div>
            <div class="context-menu-item" id="delete-folder-context">
                <i class="fas fa-trash-alt"></i> 删除
            </div>
        </div>
    `);

    // Add to body to calculate dimensions
    $('body').append(contextMenu);

    // Get menu dimensions
    const menuHeight = contextMenu.outerHeight();
    const menuWidth = contextMenu.outerWidth();

    // Check if menu would go below the window
    const windowHeight = $(window).height();
    const windowWidth = $(window).width();

    // Adjust Y position if needed
    if (y + menuHeight > windowHeight) {
        y = windowHeight - menuHeight - 10; // 10px padding from bottom
    }

    // Adjust X position if needed (prevent right overflow)
    if (x + menuWidth > windowWidth) {
        x = windowWidth - menuWidth - 10; // 10px padding from right
    }

    // Position context menu
    contextMenu.css({
        top: y + 'px',
        left: x + 'px'
    });

    // Add click handlers
    contextMenu.find('#new-file-context').on('click', function () {
        showNewFileModal(folderPath);
        $('.context-menu').remove();
    });

    contextMenu.find('#new-folder-context').on('click', function () {
        showNewFolderDialog(folderPath);
        $('.context-menu').remove();
    });

    contextMenu.find('#rename-folder-context').on('click', function () {
        showRenameFolderDialog(folderPath);
        $('.context-menu').remove();
    });

    contextMenu.find('#delete-folder-context').on('click', function () {
        showDeleteFolderDialog(folderPath);
        $('.context-menu').remove();
    });

    // Add context menu to body
    $('body').append(contextMenu);

    // Close context menu on click elsewhere
    $(document).on('click', function () {
        $('.context-menu').remove();
    });
}

/**
 * Show rename file dialog
 * @param {string} filePath - Path to the file
 */
function showRenameFileDialog(filePath) {
    // Get file name and directory
    const fileName = filePath.split('/').pop();
    const directory = filePath.substring(0, filePath.lastIndexOf('/'));

    // Set input value
    $('#rename-input').val(fileName);
    $('#rename-path').text(`路径: ${directory}/`);

    // Store file path
    $('#rename-dialog').data('path', filePath);
    $('#rename-dialog').data('isFolder', false);

    // Show dialog
    $('#rename-dialog').css('display', 'flex');

    // Focus input
    $('#rename-input').focus();

    // Handle keyboard enter
    $('#rename-input').off('keypress').on('keypress', function (e) {
        if (e.which === 13) {
            renameItem();
        }
    });

    // Handle buttons
    $('#rename-cancel').off('click').on('click', function () {
        $('#rename-dialog').css('display', 'none');
    });

    $('#rename-ok').off('click').on('click', renameItem);
}

/**
 * Show rename folder dialog
 * @param {string} folderPath - Path to the folder
 */
function showRenameFolderDialog(folderPath) {
    // Get folder name and parent directory
    const parts = folderPath.split('/');
    const folderName = parts.pop();
    const parentDirectory = parts.join('/');

    // Set input value
    $('#rename-input').val(folderName);
    $('#rename-path').text(`路径: ${parentDirectory}/`);

    // Store folder path
    $('#rename-dialog').data('path', folderPath);
    $('#rename-dialog').data('isFolder', true);

    // Show dialog
    $('#rename-dialog').css('display', 'flex');

    // Focus input
    $('#rename-input').focus();

    // Handle keyboard enter
    $('#rename-input').off('keypress').on('keypress', function (e) {
        if (e.which === 13) {
            renameItem();
        }
    });

    // Handle buttons
    $('#rename-cancel').off('click').on('click', function () {
        $('#rename-dialog').css('display', 'none');
    });

    $('#rename-ok').off('click').on('click', renameItem);
}

/**
 * Rename file or folder
 */
async function renameItem() {
    const path = $('#rename-dialog').data('path');
    const isFolder = $('#rename-dialog').data('isFolder');
    const newName = $('#rename-input').val().trim();

    // Hide dialog
    $('#rename-dialog').css('display', 'none');

    if (!newName) {
        showErrorDialog('请输入有效的名称');
        return;
    }

    try {
        if (isFolder) {
            await renameFolder(path, newName);
        } else {
            await renameFile(path, newName);
        }
    } catch (error) {
        console.error('Error renaming item:', error);
        showErrorDialog(`重命名失败: ${error.message}`);
    }
}

/**
 * Rename a file
 * @param {string} filePath - Path to the file
 * @param {string} newName - New file name
 */
async function renameFile(filePath, newName) {
    // Get directory path
    const directory = filePath.substring(0, filePath.lastIndexOf('/'));

    // Get file handle
    const fileHandle = fileHandles.get(filePath);
    if (!fileHandle) {
        throw new Error('文件句柄未找到');
    }

    // Get directory handle
    const dirHandle = directoryHandles.get(directory);
    if (!dirHandle) {
        throw new Error('目录句柄未找到');
    }

    // Check if a tab is open for this file
    const isTabOpen = openedTabs.has(filePath);
    const isCurrentFile = currentOpenFile === filePath;
    const fileContent = isTabOpen ? editor.getValue() : '';

    try {
        // Close the tab if it's open
        if (isTabOpen) {
            // Get tab element
            const tab = openedTabs.get(filePath);

            // Remove tab
            tab.remove();
            openedTabs.delete(filePath);

            // If it was the current tab, clear editor
            if (isCurrentFile) {
                editor.setModel(null);
                currentOpenFile = null;
            }
        }

        // Create new file with new name
        const newFileHandle = await dirHandle.getFileHandle(newName, { create: true });

        // Get content from old file if we don't have it already
        let content = fileContent;
        if (!isTabOpen) {
            const file = await fileHandle.getFile();
            content = await file.text();
        }

        // Write content to new file
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();

        // Try to remove the old file (may fail if file system doesn't support it)
        try {
            await dirHandle.removeEntry(filePath.split('/').pop());
        } catch (error) {
            console.warn('Could not remove old file, may be a File System API limitation:', error);
        }

        // Update file handles map
        const newPath = directory + '/' + newName;
        fileHandles.delete(filePath);
        fileHandles.set(newPath, newFileHandle);

        // Update file tree
        refreshFileTree();

        // Re-open file if it was open
        if (isTabOpen) {
            await openFile(newPath);
        }

        showNotification('文件重命名成功');
    } catch (error) {
        console.error('Error renaming file:', error);

        // Re-open the original file if we closed it
        if (isTabOpen && isCurrentFile) {
            await openFile(filePath);
        }

        throw error;
    }
}

/**
 * Rename a folder
 * @param {string} folderPath - Path to the folder
 * @param {string} newName - New folder name
 */
async function renameFolder(folderPath, newName) {
    try {
        // Show loading notification
        const progressNotification = $(`
            <div class="alert alert-info" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
                <i class="fas fa-spinner fa-spin"></i> 正在重命名文件夹...
            </div>
        `);
        $('body').append(progressNotification);

        // Get folder parts
        const folderParts = folderPath.split('/');
        const oldName = folderParts.pop(); // Remove the folder name
        const parentPath = folderParts.join('/');

        // Get parent directory handle
        const parentDirHandle = directoryHandles.get(parentPath);
        if (!parentDirHandle) {
            throw new Error('找不到父文件夹句柄');
        }

        // Get current folder handle
        const folderHandle = directoryHandles.get(folderPath);
        if (!folderHandle) {
            throw new Error('找不到文件夹句柄');
        }

        // New path with the new name
        const newFolderPath = parentPath + '/' + newName;

        // Check if target folder already exists
        let targetExists = false;
        try {
            await parentDirHandle.getDirectoryHandle(newName, { create: false });
            targetExists = true;
        } catch (error) {
            // Expected error if folder doesn't exist
            targetExists = false;
        }

        if (targetExists) {
            throw new Error(`名为 ${newName} 的文件夹已存在`);
        }

        // Create new folder with new name
        const newFolderHandle = await parentDirHandle.getDirectoryHandle(newName, { create: true });

        // Close all tabs for files in this folder
        await closeAllFilesInFolder(folderPath);

        // Get all files in the folder and subfolders
        const { files, folders } = await collectFilesAndFolders(folderHandle, folderPath);

        // Collect directories to create in the new folder structure
        const directoriesToCreate = new Map();
        for (const subFolderPath of folders) {
            if (subFolderPath === folderPath) continue; // Skip the main folder

            // Get the relative path from the base folder
            const relativePath = subFolderPath.substring(folderPath.length);
            // Create new path with the new base folder name
            const newSubFolderPath = newFolderPath + relativePath;

            // Map old path to new path
            directoriesToCreate.set(subFolderPath, newSubFolderPath);
        }

        // Create all subdirectories in the new folder
        for (const [oldSubFolderPath, newSubFolderPath] of directoriesToCreate) {
            try {
                // Get relative path components
                const parts = newSubFolderPath.split('/');
                let currentPath = '';
                let currentDirHandle = newFolderHandle;

                // Start from index 1 to skip the empty string from the split
                for (let i = parts.length - 1; i > 0; i--) {
                    // Build the path incrementally and create directories
                    try {
                        currentDirHandle = await currentDirHandle.getDirectoryHandle(parts[i], { create: true });
                    } catch (error) {
                        console.warn(`Error creating subdirectory ${parts[i]}:`, error);
                    }
                }
            } catch (error) {
                console.error(`Failed to create directory ${newSubFolderPath}:`, error);
            }
        }

        // Copy all files to the new folder structure
        for (const oldFilePath of files) {
            try {
                // Get the relative path from the base folder
                const relativePath = oldFilePath.substring(folderPath.length + 1); // +1 to remove leading slash

                // Parse relative path to get directory components and filename
                const relativePathParts = relativePath.split('/');
                const fileName = relativePathParts.pop(); // Last part is the filename

                // Start at the new root folder
                let currentDirHandle = newFolderHandle;

                // Navigate to the correct subdirectory
                for (const dirPart of relativePathParts) {
                    currentDirHandle = await currentDirHandle.getDirectoryHandle(dirPart, { create: true });
                }

                // Get file handle and content
                const fileHandle = fileHandles.get(oldFilePath);
                if (fileHandle) {
                    const file = await fileHandle.getFile();
                    const content = await file.text();

                    // Create file in new location
                    const newFileHandle = await currentDirHandle.getFileHandle(fileName, { create: true });
                    const writable = await newFileHandle.createWritable();
                    await writable.write(content);
                    await writable.close();

                    // Add to file handles map
                    const newFilePath = newFolderPath + oldFilePath.substring(folderPath.length);
                    fileHandles.set(newFilePath, newFileHandle);
                }
            } catch (error) {
                console.error(`Failed to copy file ${oldFilePath}:`, error);
            }
        }

        // Store the new directory handle
        directoryHandles.set(newFolderPath, newFolderHandle);

        // Remember expanded state
        const wasExpanded = expandedFolders.has(folderPath);
        if (wasExpanded) {
            expandedFolders.delete(folderPath);
            expandedFolders.add(newFolderPath);
        }

        // If the folder was selected, update selection
        if (selectedFolder === folderPath) {
            selectedFolder = newFolderPath;
        }

        // Try to remove the old folder
        try {
            await parentDirHandle.removeEntry(oldName, { recursive: true });
        } catch (error) {
            console.warn('Could not remove old folder, file system API limitation:', error);
            // This is not critical as we've already copied everything to the new folder
        }

        // Clean up old references
        directoryHandles.delete(folderPath);

        // Clean up any file handles that referenced the old path
        for (const [path, handle] of fileHandles.entries()) {
            if (path.startsWith(folderPath + '/')) {
                fileHandles.delete(path);
            }
        }

        // Clean up any directory handles that referenced the old path
        for (const [path, handle] of directoryHandles.entries()) {
            if (path.startsWith(folderPath + '/') && path !== folderPath) {
                directoryHandles.delete(path);
            }
        }

        // Remove progress notification
        progressNotification.remove();

        // Refresh file tree
        await refreshFileTree();

        // Show success notification
        showNotification('文件夹重命名成功');
    } catch (error) {
        console.error('Error renaming folder:', error);
        showErrorDialog('重命名文件夹时出错: ' + error.message);
    }
}

/**
 * Show delete file dialog
 * @param {string} filePath - Path to the file
 */
function showDeleteFileDialog(filePath) {
    const fileName = filePath.split('/').pop();

    // Set file name and path
    $('#delete-filename').text(fileName);

    // Store file path
    $('#delete-confirm-dialog').data('path', filePath);
    $('#delete-confirm-dialog').data('isFolder', false);

    // Show dialog
    $('#delete-confirm-dialog').css('display', 'flex');

    // Handle buttons
    $('#delete-cancel').off('click').on('click', function () {
        $('#delete-confirm-dialog').css('display', 'none');
    });

    $('#delete-confirm').off('click').on('click', deleteItem);
}

/**
 * Show delete folder dialog
 * @param {string} folderPath - Path to the folder
 */
function showDeleteFolderDialog(folderPath) {
    const folderName = folderPath.split('/').pop();

    // Set folder name and generate security code
    $('#delete-foldername').text(folderName);

    // Generate a random security code
    const securityCode = generateSecurityCode();

    // Store the security code and folder path for verification
    $('#folder-delete-confirm-dialog').data('securityCode', securityCode);
    $('#folder-delete-confirm-dialog').data('folderPath', folderPath);

    // Display the security code
    $('#security-code-display').text(securityCode);

    // Clear previous input
    $('#security-code-input').val('');

    // Show dialog
    $('#folder-delete-confirm-dialog').css('display', 'flex');

    // Focus on input
    setTimeout(() => {
        $('#security-code-input').focus();
    }, 300);

    // Handle cancel button
    $('#folder-delete-cancel').off('click').on('click', function () {
        $('#folder-delete-confirm-dialog').css('display', 'none');
    });

    // Handle confirm button
    $('#folder-delete-confirm').off('click').on('click', function () {
        verifyAndDeleteFolder();
    });

    // Add keyboard event for enter key
    $('#security-code-input').off('keypress').on('keypress', function (e) {
        if (e.which === 13) {
            verifyAndDeleteFolder();
        }
    });
}

/**
 * Generate a random security code
 * @returns {string} Random security code
 */
function generateSecurityCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters
    let code = '';

    // Generate a 6-character code
    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
    }

    return code;
}

/**
 * Verify security code and delete folder if correct
 */
function verifyAndDeleteFolder() {
    const inputCode = $('#security-code-input').val().trim();
    const correctCode = $('#folder-delete-confirm-dialog').data('securityCode');
    const folderPath = $('#folder-delete-confirm-dialog').data('folderPath');

    if (inputCode === correctCode) {
        // Security code matches, show loading state
        const deleteButton = $('#folder-delete-confirm');
        deleteButton.prop('disabled', true);
        deleteButton.html('<i class="fas fa-spinner fa-spin"></i> 删除中...');

        // Close dialog
        $('#folder-delete-confirm-dialog').css('display', 'none');

        // Delete the folder
        deleteFolderRecursively(folderPath)
            .catch(error => {
                // Reset button state if error occurs
                deleteButton.prop('disabled', false);
                deleteButton.html('删除文件夹');

                // Show error
                showErrorDialog('删除文件夹时出错: ' + error.message);
            })
            .finally(() => {
                // Reset button state
                setTimeout(() => {
                    deleteButton.prop('disabled', false);
                    deleteButton.html('删除文件夹');
                }, 500);
            });
    } else {
        // Security code doesn't match, show error
        $('#security-code-input').addClass('is-invalid');

        // Add shake effect to the input
        shakeElement($('#security-code-input')[0]);

        // Clear input and focus again
        $('#security-code-input').val('');
        $('#security-code-input').focus();

        // Remove invalid class after a delay
        setTimeout(() => {
            $('#security-code-input').removeClass('is-invalid');
        }, 1500);
    }
}

/**
 * Apply shake animation to an element
 * @param {HTMLElement} element - Element to shake
 */
function shakeElement(element) {
    if (!element) return;

    const keyframes = [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(0)' }
    ];

    const options = {
        duration: 300,
        easing: 'ease-in-out'
    };

    element.animate(keyframes, options);
}

/**
 * Delete a folder recursively
 * @param {string} folderPath - Path to the folder
 */
async function deleteFolderRecursively(folderPath) {
    try {
        // Get folder handle
        const dirHandle = directoryHandles.get(folderPath);
        if (!dirHandle) {
            throw new Error('找不到文件夹句柄');
        }

        // Store the parent directory path
        const pathParts = folderPath.split('/');
        const folderName = pathParts.pop(); // Remove the folder name
        const parentPath = pathParts.join('/');

        // Get parent directory handle
        const parentDirHandle = directoryHandles.get(parentPath);
        if (!parentDirHandle) {
            throw new Error('找不到父文件夹句柄');
        }

        // Show progress notification
        const progressNotification = $(`
            <div class="alert alert-info" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
                <i class="fas fa-spinner fa-spin"></i> 正在删除文件夹和其内容...
            </div>
        `);
        $('body').append(progressNotification);

        // Close all tabs for files in this folder first
        await closeAllFilesInFolder(folderPath);

        // Wait a bit to ensure all file handles are released
        await new Promise(resolve => setTimeout(resolve, 100));

        // Clean up all file handles and directory handles for this folder
        // This ensures no handles are holding references to files/folders we're about to delete
        const pathsToClean = [];
        
        // Collect all paths that start with the folder path
        for (const [path, handle] of fileHandles.entries()) {
            if (path.startsWith(folderPath + '/')) {
                pathsToClean.push(path);
            }
        }
        
        for (const [path, handle] of directoryHandles.entries()) {
            if (path.startsWith(folderPath + '/')) {
                pathsToClean.push(path);
            }
        }

        // Remove all handles for files and folders in this directory
        for (const path of pathsToClean) {
            fileHandles.delete(path);
            directoryHandles.delete(path);
        }

        // Try to use the recursive delete option first (if supported)
        try {
            await parentDirHandle.removeEntry(folderName, { recursive: true });
            
            // Clean up our internal references
            directoryHandles.delete(folderPath);
            
            // Remove progress notification
            progressNotification.remove();

            // Refresh file tree
            await refreshFileTree();

            // Show success notification
            showNotification('文件夹删除成功');
            return;
        } catch (recursiveError) {
            //console.log('Recursive delete not supported or failed, trying manual deletion:', recursiveError);
            
            // If recursive delete fails, fall back to manual deletion
            try {
                await deleteDirectoryContentsManually(dirHandle, folderPath);
                
                // Now try to delete the empty folder
                await parentDirHandle.removeEntry(folderName);
                
                // Clean up our internal references
                directoryHandles.delete(folderPath);
                
                // Remove progress notification
                progressNotification.remove();

                // Refresh file tree
                await refreshFileTree();

                // Show success notification
                showNotification('文件夹删除成功');
                return;
            } catch (manualError) {
                console.error('Manual deletion also failed:', manualError);
                throw manualError;
            }
        }

    } catch (error) {
        console.error('Error deleting folder:', error);
        
        // Remove progress notification if it exists
        $('.alert:contains("正在删除文件夹")').remove();
        
        // Provide more specific error messages
        let errorMessage = '删除文件夹时出错: ';
        
        if (error.message.includes('The object can not be modified')) {
            errorMessage += '文件夹可能包含正在使用的文件，请关闭相关文件后重试';
        } else if (error.name === 'NotFoundError') {
            errorMessage += '文件夹不存在或已被删除';
            // Still refresh the tree in case it was actually deleted
            await refreshFileTree();
            showNotification('文件夹已删除');
            return;
        } else if (error.message.includes('permission') || error.message.includes('access')) {
            errorMessage += '权限不足，请检查文件夹权限';
        } else {
            errorMessage += error.message;
        }
        
        showErrorDialog(errorMessage);
    }
}

/**
 * Manually delete directory contents (fallback method)
 * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
 * @param {string} dirPath - Directory path
 */
async function deleteDirectoryContentsManually(dirHandle, dirPath) {
    const entriesToDelete = [];
    
    // Collect all entries first
    for await (const [name, entry] of dirHandle.entries()) {
        entriesToDelete.push({ name, entry, path: `${dirPath}/${name}` });
    }
    
    // Delete files first
    for (const { name, entry, path } of entriesToDelete) {
        if (entry.kind === 'file') {
            try {
                await dirHandle.removeEntry(name);
                fileHandles.delete(path);
            } catch (error) {
                if (error.name !== 'NotFoundError') {
                    console.warn(`Failed to delete file ${name}:`, error);
                }
            }
        }
    }
    
    // Then delete directories recursively
    for (const { name, entry, path } of entriesToDelete) {
        if (entry.kind === 'directory') {
            try {
                // Try recursive delete first
                await dirHandle.removeEntry(name, { recursive: true });
                directoryHandles.delete(path);
            } catch (error) {
                if (error.name !== 'NotFoundError') {
                    try {
                        // If recursive fails, try manual deletion
                        await deleteDirectoryContentsManually(entry, path);
                        await dirHandle.removeEntry(name);
                        directoryHandles.delete(path);
                    } catch (manualError) {
                        if (manualError.name !== 'NotFoundError') {
                            console.warn(`Failed to delete directory ${name}:`, manualError);
                        }
                    }
                }
            }
        }
    }
}

/**
 * Collect all files and folders recursively in a directory
 * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
 * @param {string} dirPath - Directory path
 * @returns {Promise<{files: string[], folders: string[]}>} List of file paths and folder paths
 */
async function collectFilesAndFolders(dirHandle, dirPath) {
    const files = [];
    const folders = [dirPath];

    async function processDir(handle, path) {
        // Iterate through all entries in the directory
        for await (const [name, entry] of handle.entries()) {
            const entryPath = `${path}/${name}`;

            if (entry.kind === 'file') {
                // Add file path to the list
                files.push(entryPath);
            } else if (entry.kind === 'directory') {
                // Add folder path to the list
                folders.push(entryPath);

                // Process subdirectory
                await processDir(entry, entryPath);
            }
        }
    }

    // Start processing from the root directory
    await processDir(dirHandle, dirPath);

    return { files, folders };
}

/**
 * Close all open tabs for files in a folder
 * @param {string} folderPath - Path to the folder
 */
async function closeAllFilesInFolder(folderPath) {
    // Get all open tabs that belong to the folder
    const tabsToClose = [];

    // Find tabs that belong to the folder
    for (const [filePath, tabElement] of openedTabs.entries()) {
        if (filePath.startsWith(folderPath + '/')) {
            tabsToClose.push(filePath);
        }
    }

    // If there are tabs to close, close them without prompting for unsaved changes
    // since we're deleting the folder anyway
    if (tabsToClose.length > 0) {
        //console.log(`Closing ${tabsToClose.length} tabs in folder: ${folderPath}`);
        
        // Close each tab forcefully (skip unsaved changes prompt)
        for (const filePath of tabsToClose) {
            try {
                // Remove from dirty files to avoid save prompts
                dirtyFiles.delete(filePath);
                
                // Get tab element and remove it
                const tab = openedTabs.get(filePath);
                if (tab) {
                    tab.remove();
                }
                openedTabs.delete(filePath);
                
                // If this was the current file, clear the editor
                if (currentOpenFile === filePath) {
                    if (editor) {
                        editor.setModel(null);
                    }
                    currentOpenFile = null;
                    window.currentOpenFile = null;
                }
                
                // Remove from original contents map
                originalContents.delete(filePath);
                
                //console.log(`Closed tab for: ${filePath}`);
            } catch (error) {
                console.warn(`Error closing tab for ${filePath}:`, error);
            }
        }
        
        // If no tabs are left, show placeholder
        if (openedTabs.size === 0) {
            if (editor) {
                editor.setModel(null);
            }
            $('#editor').hide();
            $('#editor-placeholder').show();
            currentOpenFile = null;
            window.currentOpenFile = null;
            $('#current-file-type').text('未选择文件');
            $('.file-type-indicator').attr('data-short-type', '--');
            
            // Reset cursor position and word count
            $('#cursor-line').text('0');
            $('#cursor-column').text('0');
            $('#word-count').text('0');
            $('#char-count').text('0');
            $('#line-count').text('0');
        } else {
            // If there are still tabs open, switch to the first available one
            const remainingTabs = Array.from(openedTabs.keys());
            if (remainingTabs.length > 0 && !currentOpenFile) {
                await openFile(remainingTabs[0]);
            }
        }
        
        // Update tabs markdown representation
        generateEditorTabsMarkdown();
        
        // Force garbage collection of Monaco models for deleted files
        if (typeof monaco !== 'undefined' && monaco.editor) {
            const models = monaco.editor.getModels();
            for (const model of models) {
                const modelPath = model.uri.path;
                if (modelPath.startsWith(folderPath + '/')) {
                    try {
                        model.dispose();
                        //console.log(`Disposed Monaco model for: ${modelPath}`);
                    } catch (error) {
                        console.warn(`Error disposing Monaco model for ${modelPath}:`, error);
                    }
                }
            }
        }
    }
}

/**
 * Delete file or folder
 */
async function deleteItem() {
    const path = $('#delete-confirm-dialog').data('path');
    const isFolder = $('#delete-confirm-dialog').data('isFolder');

    // Hide dialog
    $('#delete-confirm-dialog').css('display', 'none');

    try {
        if (isFolder) {
            // Show folder deletion security confirmation dialog
            showDeleteFolderDialog(path);
        } else {
            await deleteFile(path);
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        showErrorDialog(`删除失败: ${error.message}`);
    }
}

/**
 * Delete a file
 * @param {string} filePath - Path to the file
 */
async function deleteFile(filePath) {
    // Get directory path and file name
    const fileName = filePath.split('/').pop();
    const directory = filePath.substring(0, filePath.lastIndexOf('/'));

    // Get directory handle
    const dirHandle = directoryHandles.get(directory);
    if (!dirHandle) {
        throw new Error('目录句柄未找到');
    }

    try {
        // Show loading state on delete button
        const deleteButton = $('#delete-confirm');
        deleteButton.prop('disabled', true);
        deleteButton.html('<i class="fas fa-spinner fa-spin"></i> 删除中...');

        // Close the tab if it's open
        if (openedTabs.has(filePath)) {
            // If file has unsaved changes, ask for confirmation
            if (dirtyFiles.has(filePath)) {
                const shouldSave = await showUnsavedChangesDialog();

                if (shouldSave) {
                    // Save the file before deleting
                    await saveFile(filePath);
                }

                // Remove from dirty files
                dirtyFiles.delete(filePath);
            }

            // Close the tab
            await closeTab(filePath);
        }

        // Delete the file
        await dirHandle.removeEntry(fileName);

        // Remove file handle
        fileHandles.delete(filePath);

        // Refresh file tree
        await refreshFileTree();

        // Reset delete button state
        deleteButton.prop('disabled', false);
        deleteButton.html('删除');

        showNotification('文件删除成功');
    } catch (error) {
        console.error('Error deleting file:', error);

        // Reset delete button state
        $('#delete-confirm').prop('disabled', false);
        $('#delete-confirm').html('删除');

        throw error;
    }
}

// Add a new function to detect operating system
/**
 * Detect if the user is on macOS
 * @returns {boolean} true if the user is on macOS
 */
function isMacOS() {
    return navigator.platform.indexOf('Mac') !== -1 ||
        navigator.userAgent.indexOf('Mac') !== -1;
}

/**
 * Update the status bar with keyboard shortcut information
 */
function updateShortcutInfo() {
    const saveKey = isMacOS() ? 'Cmd+S' : 'Ctrl+S';
    const findKey = isMacOS() ? 'Cmd+F' : 'Ctrl+F';
    const previewKey = isMacOS() ? 'Cmd+P' : 'Ctrl+P';

    // Add cursor navigation buttons
    const navigationButtons = $(`
        <div class="status-bar-item cursor-navigation">
            <button id="cursor-back-btn" class="navigation-btn disabled" title="后退 (Alt+←)">
                <i class="fas fa-arrow-left"></i>
            </button>
            <button id="cursor-forward-btn" class="navigation-btn disabled" title="前进 (Alt+→)">
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `);
    $('.status-right').prepend(navigationButtons);

    // Add status bar items for shortcuts
    const shortcutInfo = $(`
        <div class="status-bar-item">
            <i class="fas fa-keyboard"></i> 保存: <span class="keyboard-shortcut">${saveKey}</span>
        </div>
        <div class="status-bar-item">
            <i class="fas fa-search"></i> 搜索: <span class="keyboard-shortcut">${findKey}</span>
        </div>
        <div class="status-bar-item" id="preview-shortcut" style="display: none;">
            <i class="fas fa-eye"></i> 预览: <span class="keyboard-shortcut">${previewKey}</span>
        </div>
    `);
    $('.status-right').append(shortcutInfo);

    // Add preview button (initially hidden)
    const previewButton = $(`
        <div class="status-bar-item" id="preview-container" style="display: none;">
            <button id="preview-toggle" class="theme-toggle-btn" title="预览HTML">
                <i class="fas fa-eye"></i>
            </button>
            <span id="preview-status">编辑模式</span>
        </div>
    `);
    $('.status-right').append(previewButton);

    // Add click handlers
    $('#cursor-back-btn').on('click', goBack);
    $('#cursor-forward-btn').on('click', goForward);
    $('#preview-toggle').on('click', togglePreview);
}

/**
 * Toggle the visibility of the preview button
 * @param {boolean} show - Whether to show the preview button
 */
function togglePreviewButton(show) {
    if (show) {
        $('#preview-container').show();
        $('#preview-shortcut').show();

        // Reset to editor mode when opening a new HTML file
        if (isPreviewMode) {
            isPreviewMode = false;
            $('#preview-frame').hide();
            $('#editor').show();
            $('#preview-toggle').html('<i class="fas fa-eye"></i>');
            $('#preview-toggle').attr('title', '预览HTML');
            $('#preview-status').text('编辑模式');

            // Revoke any existing blob URL
            if (previewFrame && previewFrame.data('blob-url')) {
                URL.revokeObjectURL(previewFrame.data('blob-url'));
            }
        }
    } else {
        $('#preview-container').hide();
        $('#preview-shortcut').hide();

        // If we're hiding the preview button and in preview mode,
        // switch back to editor mode
        if (isPreviewMode) {
            isPreviewMode = false;
            $('#preview-frame').hide();
            $('#editor').show();

            // Revoke any existing blob URL
            if (previewFrame && previewFrame.data('blob-url')) {
                URL.revokeObjectURL(previewFrame.data('blob-url'));
            }
        }
    }
}

/**
 * Update status bar with different states
 * @param {string} action - The action being performed
 */
function updateStatusBar(action) {
    const statusItem = $('.status-bar-item:contains("就绪")');

    switch (action) {
        case 'save':
            statusItem.html('<i class="fas fa-save"></i> 保存中...');

            // Set a timeout to revert the status after 1.5 seconds
            setTimeout(() => {
                statusItem.html('<i class="fas fa-check-circle"></i> 已保存');

                // Revert to Ready after another 3 seconds
                setTimeout(() => {
                    statusItem.html('<i class="fas fa-check-circle"></i> 就绪');
                }, 3000);
            }, 1500);
            break;

        default:
            statusItem.html('<i class="fas fa-check-circle"></i> 就绪');
    }
}

/**
 * Toggle the search functionality in the editor
 */
function toggleEditorSearch() {
    if (!editor || !isEditorReady) return;

    isSearchVisible = !isSearchVisible;

    if (isSearchVisible) {
        // Show the search widget
        editor.getAction('actions.find').run();
    } else {
        // Hide the search widget
        editor.trigger('keyboard', 'closeReplaceInEditor', null);
    }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    isDarkTheme = !isDarkTheme;

    if (isDarkTheme) {
        // Switch to dark theme
        $('body').removeClass('light-theme');
        $('.vibe-coding-container').removeClass('light-theme');
        $('.file-explorer').removeClass('light-theme');
        $('.ai-qa-panel').removeClass('light-theme');
        $('#theme-toggle i').removeClass('fa-sun').addClass('fa-moon');

        // Update editor theme if available
        if (editor && isEditorReady) {
            monaco.editor.setTheme('vibe-dark');
        }
    } else {
        // Switch to light theme
        $('body').addClass('light-theme');
        $('.vibe-coding-container').addClass('light-theme');
        $('.file-explorer').addClass('light-theme');
        $('.ai-qa-panel').addClass('light-theme');
        $('#theme-toggle i').removeClass('fa-moon').addClass('fa-sun');

        // Update editor theme if available
        if (editor && isEditorReady) {
            monaco.editor.setTheme('vibe-light');
        }
    }

    // Save theme preference in localStorage
    localStorage.setItem('vibeCodingTheme', isDarkTheme ? 'dark' : 'light');
}

/**
 * Load saved theme preference
 */
function loadThemePreference() {
    const savedTheme = localStorage.getItem('vibeCodingTheme');

    if (savedTheme === 'light' && isDarkTheme) {
        // If saved theme is light but current is dark, toggle to light
        toggleTheme();
    } else if (savedTheme === 'dark' && !isDarkTheme) {
        // If saved theme is dark but current is light, toggle to dark
        toggleTheme();
    } else if (savedTheme === 'light') {
        // 这是处理页面刷新时的情况，确保所有元素都应用了正确的样式
        $('body').addClass('light-theme');
        $('.vibe-coding-container').addClass('light-theme');
        $('.file-explorer').addClass('light-theme');
        $('.ai-qa-panel').addClass('light-theme');
        $('#theme-toggle i').removeClass('fa-moon').addClass('fa-sun');

        // 确保编辑器主题也正确设置
        if (editor && isEditorReady) {
            monaco.editor.setTheme('vibe-light');
        } else {
            // 如果编辑器还没准备好，设置一个标志
            isDarkTheme = false;
        }
    }
}

/**
 * Show new folder dialog
 * @param {string} [targetPath] - Optional target folder path
 */
function showNewFolderDialog(targetPath) {
    if (!openedFolderHandle) {
        showErrorDialog('请先打开一个文件夹');
        return;
    }

    // If no target folder is provided, use the selected folder or the root folder
    if (!targetPath) {
        targetPath = selectedFolder || ('/' + openedFolderHandle.name);
    }

    // Ensure targetPath is a string
    targetPath = String(targetPath);

    // Store the target folder on the dialog for later use
    $('#new-folder-dialog').data('targetPath', targetPath);

    // Update the dialog to show where the folder will be created
    const folderParts = targetPath.split('/');
    const folderName = folderParts.length > 0 ? folderParts[folderParts.length - 1] : '';

    // Show the full path in small text
    $('#new-folder-path').text(`路径: ${targetPath}`);

    // Clear input and show dialog
    $('#new-folder-name').val('');
    $('#new-folder-dialog').css('display', 'flex');

    // Focus input
    setTimeout(() => {
        $('#new-folder-name').focus();
    }, 100);
}

/**
 * Create a new folder
 */
async function createNewFolder() {
    try {
        const folderName = $('#new-folder-name').val().trim();

        if (!folderName) {
            showErrorDialog('请输入文件夹名称');
            return;
        }

        if (!openedFolderHandle) {
            showErrorDialog('请先打开一个文件夹');
            return;
        }

        // Disable the button and show loading state
        const createButton = $('#new-folder-create');
        createButton.prop('disabled', true);
        createButton.html('<i class="fas fa-spinner fa-spin"></i> 创建中...');

        // Get the target folder path from the dialog
        let targetPath = $('#new-folder-dialog').data('targetPath');

        // Ensure it's a string and provide a fallback
        targetPath = targetPath ? String(targetPath) : ('/' + openedFolderHandle.name);

        //console.log('Creating folder in path:', targetPath);

        // Get the directory handle for the target path
        const targetDirHandle = directoryHandles.get(targetPath);

        if (!targetDirHandle) {
            console.error('Target folder not found:', targetPath);
           // console.log('Available directory handles:', Array.from(directoryHandles.keys()));

            // Restore button state
            createButton.prop('disabled', false);
            createButton.html('创建');

            showErrorDialog('找不到目标文件夹。请重试或选择其他文件夹。');
            return;
        }

        // Create folder in the target folder
        const newFolderHandle = await targetDirHandle.getDirectoryHandle(folderName, { create: true });

        // Store directory handle
        const newFolderPath = targetPath + '/' + folderName;
        directoryHandles.set(newFolderPath, newFolderHandle);

        // Save expanded states before refresh
        saveExpandedStates();

        // Make sure the parent folder is expanded
        expandedFolders.add(targetPath);

        // Refresh file tree
        $('#file-tree').empty();
        await processDirectory(openedFolderHandle, $('#file-tree'), '', null, true); // Use lazy loading

        // Restore expanded states
        restoreExpandedStates();

        // Select the newly created folder
        $('.tree-item.tree-folder').each(function () {
            if ($(this).data('path') === newFolderPath) {
                $(this).addClass('folder-selected');
                selectedFolder = newFolderPath;
            }
        });

        // Restore button state
        createButton.prop('disabled', false);
        createButton.html('创建');

        // Hide dialog
        $('#new-folder-dialog').css('display', 'none');

        // Show success notification
        showNotification('文件夹创建成功');
    } catch (error) {
        console.error('Error creating folder:', error);

        // Restore button state
        $('#new-folder-create').prop('disabled', false);
        $('#new-folder-create').html('创建');

        showErrorDialog('创建文件夹时出错: ' + error.message);
    }
}

/**
 * Load available AI models from the server
 */
function loadAIModels() {
    $.ajax({
        url: '/Product/GetVibeCodingModels',
        type: 'GET',
        dataType: 'json',
        success: function (response) {
            if (response && response.success && response.data) {
                populateModelSelector(response.data);
            } else {
                console.error('Failed to load AI models:', response);
            }
        },
        error: function (xhr, status, error) {
            console.error('Error loading AI models:', error);
        }
    });
}

/**
 * Populate the model selector dropdown with available models
 * @param {Array} models - List of available models
 */
function populateModelSelector(models) {
    const selector = $('#ai-model-selector');
    const dropdownMenu = $('#ai-model-dropdown-menu');

    // Clear existing options
    selector.find('option:not(:first)').remove();
    dropdownMenu.empty();

    // Sort models by sequence if available
    if (models.length > 0 && models[0].seq !== undefined) {
        models.sort((a, b) => (a.seq || 999) - (b.seq || 999));
    }

    // Add models to hidden selector (for compatibility)
    models.forEach(model => {
        selector.append(`<option value="${model.id}" 
            data-name="${model.modelName || ''}" 
            data-nick="${model.modelNick || ''}"
            data-vision="${model.visionModel || false}">
            ${model.modelNick || model.modelName}
        </option>`);

        // Add items to dropdown menu
        dropdownMenu.append(`<a class="dropdown-item" href="#" data-model-id="${model.id}" 
            data-name="${model.modelName || ''}" 
            data-nick="${model.modelNick || ''}"
            data-vision="${model.visionModel || false}">
            ${model.modelNick || model.modelName}
        </a>`);
    });

    // Handle dropdown item click
    dropdownMenu.find('.dropdown-item').on('click', function (e) {
        e.preventDefault();
        const modelId = $(this).data('model-id');
        const modelName = $(this).data('name');
        const modelNick = $(this).data('nick');
        const visionModel = $(this).data('vision');

        // Update the selector value (for compatibility)
        selector.val(modelId).trigger('change');

        // Update the dropdown button text
        $('#selected-model-text').text($(this).text());

        // Set current model
        currentModel = {
            id: modelId,
            modelName: modelName,
            modelNick: modelNick,
            visionModel: visionModel
        };

        // Trigger the model changed event
        $(document).trigger('aiModelsLoaded', [currentModel]);
    });

    // Select first model if available
    if (models.length > 0) {
        // Update hidden selector
        selector.val(models[0].id);

        // Update dropdown button text
        $('#selected-model-text').text(models[0].modelNick || models[0].modelName);

        // Set current model
        currentModel = models[0];

        // Trigger event for components that need to know when models are loaded
        $(document).trigger('aiModelsLoaded', [currentModel]);
    }
}

/**
 * Toggle between code editor and HTML preview
 */
async function togglePreview() {
    if (!currentOpenFile || !currentOpenFile.toLowerCase().endsWith('.html')) {
        return; // Only works for HTML files
    }

    isPreviewMode = !isPreviewMode;

    if (isPreviewMode) {
        // Switch to preview mode
        // Hide editor and show preview
        $('#editor').hide();

        // Create preview frame if it doesn't exist
        if (!$('#preview-frame').length) {
            previewFrame = $('<iframe id="preview-frame" class="html-preview-frame"></iframe>');
            $('.editor-content').append(previewFrame);
        } else {
            previewFrame = $('#preview-frame');
        }

        // Get the current content from the editor
        let htmlContent = editor.getValue();

        // Show loading indicator
        const loadingNotification = showNotification('正在处理HTML预览...', 'info', false);

        try {
            // Process the HTML content to handle relative paths
            htmlContent = await processHtmlForPreview(htmlContent);

            // Show the preview frame
            previewFrame.show();

            // Update button icon and title
            $('#preview-toggle').html('<i class="fas fa-code"></i>');
            $('#preview-toggle').attr('title', '查看代码');

            // Create a blob URL for the HTML content
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);

            // Load the HTML content into the iframe
            previewFrame.attr('src', blobUrl);

            // Store the blob URL to revoke it later
            previewFrame.data('blob-url', blobUrl);

            // Update status bar
            $('#preview-status').text('预览模式');

            // Hide loading notification
            loadingNotification.removeClass('show');
            setTimeout(() => loadingNotification.remove(), 300);
        } catch (error) {
            console.error('Error creating preview:', error);

            // Hide loading notification and show error
            loadingNotification.removeClass('show');
            setTimeout(() => {
                loadingNotification.remove();
                showNotification('预览生成失败: ' + error.message, 'error');
            }, 300);

            // Switch back to editor mode
            isPreviewMode = false;
            $('#editor').show();
        }
    } else {
        // Switch back to editor mode
        // Hide preview and show editor
        $('#preview-frame').hide();
        $('#editor').show();

        // Update button icon and title
        $('#preview-toggle').html('<i class="fas fa-eye"></i>');
        $('#preview-toggle').attr('title', '预览HTML');

        // Revoke the blob URL to free up memory
        if (previewFrame && previewFrame.data('blob-url')) {
            URL.revokeObjectURL(previewFrame.data('blob-url'));
        }

        // Update status bar
        $('#preview-status').text('编辑模式');
    }
}

/**
 * Process HTML content for preview to handle relative paths
 * @param {string} htmlContent - The HTML content to process
 * @returns {string} Processed HTML content
 */
async function processHtmlForPreview(htmlContent) {
    try {
        // Get the current file directory path
        const currentDir = currentOpenFile.substring(0, currentOpenFile.lastIndexOf('/'));

        // Create a temporary DOM parser to manipulate the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Process CSS links
        const cssLinks = doc.querySelectorAll('link[rel="stylesheet"]');
        for (const link of cssLinks) {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('//')) {
                try {
                    // Resolve the path relative to the current file
                    const cssPath = href.startsWith('/')
                        ? href.substring(1) // Absolute path from root
                        : `${currentDir}/${href}`; // Relative path

                    // Try to get the CSS file content
                    const cssHandle = fileHandles.get(cssPath);
                    if (cssHandle) {
                        const cssFile = await cssHandle.getFile();
                        const cssContent = await cssFile.text();

                        // Replace the link with an inline style
                        const style = doc.createElement('style');
                        style.textContent = cssContent;
                        link.parentNode.replaceChild(style, link);
                    }
                } catch (error) {
                    console.warn(`Could not load CSS file: ${href}`, error);
                }
            }
        }

        // Process script tags
        const scripts = doc.querySelectorAll('script');
        for (const script of scripts) {
            const src = script.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('//')) {
                try {
                    // Resolve the path relative to the current file
                    const scriptPath = src.startsWith('/')
                        ? src.substring(1) // Absolute path from root
                        : `${currentDir}/${src}`; // Relative path

                    // Try to get the JS file content
                    const scriptHandle = fileHandles.get(scriptPath);
                    if (scriptHandle) {
                        const scriptFile = await scriptHandle.getFile();
                        const scriptContent = await scriptFile.text();

                        // Replace the src attribute with inline content
                        script.removeAttribute('src');
                        script.textContent = scriptContent;
                    }
                } catch (error) {
                    console.warn(`Could not load script file: ${src}`, error);
                }
            }
        }

        // Process image sources
        const images = doc.querySelectorAll('img');
        for (const img of images) {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('//') && !src.startsWith('data:')) {
                try {
                    // Resolve the path relative to the current file
                    const imgPath = src.startsWith('/')
                        ? src.substring(1) // Absolute path from root
                        : `${currentDir}/${src}`; // Relative path

                    // Try to get the image file
                    const imgHandle = fileHandles.get(imgPath);
                    if (imgHandle) {
                        const imgFile = await imgHandle.getFile();

                        // Create a data URL for the image
                        const reader = new FileReader();
                        const dataUrl = await new Promise((resolve) => {
                            reader.onload = () => resolve(reader.result);
                            reader.readAsDataURL(imgFile);
                        });

                        // Replace the src with the data URL
                        img.setAttribute('src', dataUrl);
                    }
                } catch (error) {
                    console.warn(`Could not load image file: ${src}`, error);
                }
            }
        }

        // Return the processed HTML
        return doc.documentElement.outerHTML;
    } catch (error) {
        console.error('Error processing HTML for preview:', error);
        return htmlContent; // Return original content if processing fails
    }
}

/**
 * Initialize drag and drop functionality for folders
 */
function initDragAndDropForFolders() {
    // Define the drop zone (the file explorer area)
    const dropZone = document.querySelector('.file-explorer-content');

    // Add the necessary event listeners
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Add visual feedback when a file is dragged over the drop zone
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();

        // Add a class to show this is a valid drop target
        dropZone.classList.add('drag-over');

        // Set the drop effect to 'copy' to indicate we're copying the folder
        e.dataTransfer.dropEffect = 'copy';
    }

    // Remove visual feedback when the file leaves the drop zone
    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove the visual feedback
        dropZone.classList.remove('drag-over');
    }

    // Handle the actual drop event
    async function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        // Remove the visual feedback
        dropZone.classList.remove('drag-over');

        // Check if the File System Access API is supported
        if (!('showDirectoryPicker' in window)) {
            showErrorDialog('您的浏览器不支持文件系统访问API。请使用Chrome或Edge浏览器。');
            return;
        }

        // Get the items from the drop event
        const items = e.dataTransfer.items;

        // Check if there are any items
        if (items.length === 0) {
            return;
        }

        // Try to get a directory handle from the dropped item
        try {
            // Look for a directory in the dropped items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // Use getAsFileSystemHandle API to get the handle
                if (item.kind === 'file' && 'getAsFileSystemHandle' in item) {
                    const handle = await item.getAsFileSystemHandle();

                    // Check if it's a directory
                    if (handle.kind === 'directory') {
                        // Show loading indicator
                        $('#loading-indicator').show();
                        $('#loading-progress').text("正在加载拖放的文件夹...");

                        // If there's a restore button, hide it
                        if ($('#restore-folder-btn').length > 0) {
                            restoreOriginalLayout();
                        }

                        // Process the dropped folder
                        await processOpenedFolder(handle);
                        return;
                    }
                }
            }

            // If we get here, no valid directory was found
            showNotification('请拖放一个文件夹而不是文件', 'warning');
        } catch (error) {
            $('#loading-indicator').hide();
            console.error('Error processing dropped folder:', error);

            if (error.name === 'SecurityError' || error.message.includes('permission')) {
                showErrorDialog('无法访问拖放的文件夹。请使用"打开文件夹"按钮选择文件夹。');
            } else {
                showErrorDialog('处理拖放的文件夹时出错: ' + error.message);
            }
        }
    }
}

/**
 * Add CSS styles for drag and drop functionality and cursor navigation
 */
function addDragAndDropStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .file-explorer-content.drag-over {
            background-color: rgba(218, 220, 223, 0.5);
            border: none;
            border-radius: 4px;
        }
        
        body.light-theme .file-explorer-content.drag-over {
            background-color: rgba(218, 220, 223, 0.5);
            border: none;
            border-radius: 4px;
        }
        
        /* Add a helper text that appears during drag */
        .file-explorer-content.drag-over::after {
            content: "释放文件夹以打开";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color:rgba(218, 220, 223, 0.5);
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            font-size: 14px;
            pointer-events: none;
        }
        
        body.light-theme .file-explorer-content.drag-over::after {
            background-color: rgba(218, 220, 223, 0.5);
            color: white;
        }

        /* Cursor navigation button styles */
        .cursor-navigation {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-right: 8px;
        }

        .navigation-btn {
            background: transparent;
            border: none;
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 24px;
            height: 20px;
            transition: all 0.2s ease;
        }

        .navigation-btn:hover:not(.disabled) {
            background-color: rgba(218, 220, 223, 0.5);
            border-color: none;
        }

        .navigation-btn:active:not(.disabled) {
            background-color: rgba(218, 220, 223, 0.5);
        }

        .navigation-btn.disabled {
            opacity: 0.4;
            cursor: not-allowed;
            color: #ffffff;
        }

        /* Light theme styles for navigation buttons */
        body.light-theme .navigation-btn {
            color: #ffffff;
        }

        body.light-theme .navigation-btn:hover:not(.disabled) {
            background-color: rgba(218, 220, 223, 0.5);
            color: #ffffff;
        }

        body.light-theme .navigation-btn:active:not(.disabled) {
            background-color:rgba(218, 220, 223, 0.5);
        }

        body.light-theme .navigation-btn.disabled {
            opacity: 0.4;
            color: #ffffff;
        }
    `;
    document.head.appendChild(styleElement);
}