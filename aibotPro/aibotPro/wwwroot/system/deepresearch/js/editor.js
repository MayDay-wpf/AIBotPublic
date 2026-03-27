/**
 * 深度研究 - 编辑器工具类
 * 专门处理 Vditor 编辑器的初始化和功能
 */

// 编辑器工具类
class ResearchEditor {
    constructor() {
        this.vditorInstance = null;
        this.currentResearchId = null;
        this.isEditMode = false;
        this.autoSaveTimer = null;
        this.autoSaveInterval = 30000; // 30秒自动保存
        this.currentQuoteButton = null;
    }

    // 初始化编辑器
    initEditor(containerId, options = {}) {
        // 如果编辑器已经存在，先销毁
        this.destroyEditor();

        const defaultOptions = {
            height: '100%',
            mode: 'wysiwyg', // 所见即所得
            theme: 'classic',
            preview: {
                theme: {
                    current: 'light'
                },
                hljs: {
                    enable: true,
                    lineNumber: true
                },
                math: {
                    inlineDigit: true
                },
                delay: 300
            },
            value: options.content || '',
            placeholder: '请输入研究报告内容...',
            toolbar: [
                {
                    name: 'emoji',
                    tipPosition: 'w',
                    tip: '表情'
                },
                'headings',
                'bold',
                'italic',
                'strike',
                'link',
                '|',
                'list',
                'ordered-list',
                'check',
                'outdent',
                'indent',
                '|',
                'quote',
                'line',
                'code',
                'inline-code',
                'insert-before',
                'insert-after',
                '|',
                'table',
                '|',
                'undo',
                'redo',
                '|',
                'edit-mode',
                {
                    name: 'more',
                    toolbar: [
                        'both',
                        'code-theme',
                        'content-theme',
                        'export',
                        'outline',
                        'preview',
                        'devtools',
                        'info',
                        'help'
                    ]
                }
            ],
            cache: {
                enable: false
            },
            counter: {
                enable: true,
                type: 'text'
            },
            resize: {
                enable: true
            },
            outline: {
                enable: true
            },
            hint: {
                parse: false,
                emoji: {
                    '+1': '👍',
                    '-1': '👎',
                    'confused': '😕',
                    'eyes': '👀',
                    'heart': '❤️',
                    'rocket': '🚀',
                    'smile': '😄',
                    'tada': '🎉',
                    'clap': '👏',
                    'thumbsup': '👍',
                    'thumbsdown': '👎',
                    'fire': '🔥',
                    'star': '⭐',          // 普通星星
                    'star_struck': '🤩',   // 令人惊叹的星星
                    'star_with_face': '🌟', // 闪亮的星星
                    'sparkles': '✨',       // 闪闪发光
                    'glowing_star': '🌟',   // 星星
                    'dizzy': '💫',          // 星形飞散效果
                    'milky_way': '🌌',      // 银河
                    'shooting_star': '🌠',  // 流星
                    'comet': '☄️',          // 彗星
                    'sparkler': '🎇',       // 烟火棒
                    'balloon': '🎈',        // 气球（节日氛围）
                    'confetti': '🎊',       // 派对气氛
                    'milestone': '🏆',      // 成就、奖杯
                    'glitter': '💎',        // 闪耀的宝石
                    'night_sky': '🌃',      // 夜空
                    'cloud_with_stars': '🌌'// 带星的夜空
                }

            },
            upload: {
                accept: 'image/*,.pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls',
                multiple: false,
                filename: (name) => name.replace(/[^(a-zA-Z0-9\u4e00-\u9fa5\.)]/g, '').replace(/[\?\\/:|<>\*\[\]\(\)\$%\{\}@~]/g, '').replace('/\\s/g', ''),
                fieldName: 'file',
                url: '/DeepResearch/UploadEditorFile',
                headers: {
                    'Authorization': 'Bearer ' + (localStorage.getItem('aibotpro_userToken') || '')
                },
                withCredentials: false,
                success: (editor, msg) => {
                    try {
                        const response = JSON.parse(msg);
                        if (response.success && response.data) {
                            const { url, filename, type } = response.data;
                            // 对于图片文件，直接返回URL，Vditor会自动生成![](url)格式
                            if (type === 'image') {
                                researchEditor.insertContent(`![${filename}](${url})`);
                            } else {
                                researchEditor.insertContent(`[${filename}](${url})`);
                            }
                        }
                    } catch (e) {
                        console.error('解析上传响应失败:', e);
                    }
                    // 如果解析失败，返回null
                    return null;
                },
                error: (msg) => {
                    console.error('文件上传失败', msg);
                    try {
                        const response = JSON.parse(msg);
                        if (response.msg) {
                            this.showMessage(response.msg, 'error');
                        } else {
                            this.showMessage('文件上传失败', 'error');
                        }
                    } catch (e) {
                        this.showMessage('文件上传失败', 'error');
                    }
                }
            },
            after: () => {
                console.log('编辑器初始化完成');
                this.setupEventListeners();
            },
            input: (value) => {
                // 内容变化时的回调
                this.onContentChange(value);
            }
        };

        // 合并选项
        const finalOptions = { ...defaultOptions, ...options };

        // 初始化 Vditor 编辑器
        this.vditorInstance = new Vditor(containerId, finalOptions);

        return this.vditorInstance;
    }

    // 设置事件监听器（此方法在文件末尾重新定义）

    // 内容变化回调
    onContentChange(value) {
        if (this.currentResearchId) {
            // 重置自动保存计时器
            this.resetAutoSaveTimer();

            // 标记内容已修改
            this.markAsModified();
        }
    }

    // 标记内容已修改
    markAsModified() {
        // 内容已修改，可以在这里添加其他的修改状态指示
        // 例如在标题旁边显示未保存标识等
        console.log('内容已修改');
    }

    // 重置自动保存计时器
    resetAutoSaveTimer() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(() => {
            this.autoSave();
        }, this.autoSaveInterval);
    }

    // 自动保存
    autoSave() {
        if (this.currentResearchId && this.vditorInstance) {
            const content = this.vditorInstance.getValue();
            const title = this.extractTitleFromContent(content);

            if (content.trim() && title && title !== '未命名研究') {
                console.log('自动保存中...');
                // 调用后端API进行自动保存
                this.saveToBackend(title, content, true);
            }
        }
    }

    // 从编辑器内容中提取标题
    extractTitleFromContent(content) {
        const lines = content.split('\n');
        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('# ')) {
                return line.substring(2).trim();
            }
        }
        return '未命名研究';
    }

    // 显示自动保存提示
    showAutoSaveMessage() {
        const message = $('<div class="auto-save-message">已自动保存</div>');
        message.css({
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: '#28a745',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: '14px',
            zIndex: 9999,
            opacity: 0
        });

        $('body').append(message);
        message.animate({ opacity: 1 }, 300);

        setTimeout(() => {
            message.animate({ opacity: 0 }, 300, function () {
                message.remove();
            });
        }, 2000);
    }

    // 保存到后端
    async saveToBackend(title, content, isAutoSave = false) {
        if (!this.currentResearchId) {
            console.warn('当前研究ID为空');
            return false;
        }

        try {
            const token = localStorage.getItem('aibotpro_userToken');
            if (!token) {
                if (!isAutoSave) {
                    this.showMessage('请先登录', 'warning');
                }
                return false;
            }

            const response = await fetch('/DeepResearch/SaveResearchReportContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Bearer ' + token
                },
                body: new URLSearchParams({
                    chatId: this.currentResearchId,
                    title: title,
                    content: content
                })
            });

            const result = await response.json();

            if (result.success) {
                if (isAutoSave) {
                    this.showAutoSaveMessage();
                } else {
                    this.showMessage('保存成功', 'success');
                }

                // 更新显示标题
                if (this.currentResearchId) {
                    $(`.research-item[data-id="${this.currentResearchId}"] h6`).text(title);
                }

                return true;
            } else {
                if (!isAutoSave) {
                    this.showMessage(result.msg || '保存失败', 'danger');
                }
                console.error('保存失败:', result.msg);
                return false;
            }
        } catch (error) {
            if (!isAutoSave) {
                this.showMessage('保存失败: ' + error.message, 'danger');
            }
            console.error('保存异常:', error);
            return false;
        }
    }

    // 销毁编辑器
    destroyEditor() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        // 清理引用按钮
        this.hideQuoteButton();

        if (this.vditorInstance) {
            this.vditorInstance.destroy();
            this.vditorInstance = null;
        }
    }

    // 保存内容
    async saveContent() {
        if (!this.vditorInstance) {
            console.warn('编辑器未初始化');
            return false;
        }

        const markdownContent = this.vditorInstance.getValue();
        const title = this.extractTitleFromContent(markdownContent);

        if (!title || title === '未命名研究') {
            if (typeof balert === 'function') {
                balert('请在编辑器内容开头添加标题（使用 # 标题名称）', 'warning');
            } else {
                alert('请在编辑器内容开头添加标题（使用 # 标题名称）');
            }
            return false;
        }

        if (!markdownContent.trim()) {
            if (typeof balert === 'function') {
                balert('请输入研究内容', 'warning');
            } else {
                alert('请输入研究内容');
            }
            return false;
        }

        try {
            // 调用后端API保存
            const result = await this.saveToBackend(title, markdownContent, false);
            return result;
        } catch (error) {
            console.error('保存失败:', error);
            if (typeof balert === 'function') {
                balert('保存失败: ' + error.message, 'danger');
            } else {
                alert('保存失败: ' + error.message);
            }
            return false;
        }
    }

    // 撤销
    undo() {
        if (this.vditorInstance) {
            this.vditorInstance.undo();
        }
    }

    // 重做
    redo() {
        if (this.vditorInstance) {
            this.vditorInstance.redo();
        }
    }

    // 切换编辑模式
    switchMode(mode) {
        if (this.vditorInstance) {
            // mode: 'wysiwyg' | 'ir' | 'sv'
            this.vditorInstance.setMode(mode);
            // 模式切换时隐藏引用按钮
            this.hideQuoteButton();
        }
    }

    // 获取当前模式
    getCurrentMode() {
        if (this.vditorInstance) {
            return this.vditorInstance.getCurrentMode();
        }
        return null;
    }

    // 导出为HTML
    exportAsHTML() {
        if (this.vditorInstance) {
            const html = this.vditorInstance.getHTML();
            const content = this.vditorInstance.getValue();
            const title = this.extractTitleFromContent(content);
            this.downloadFile(html, `${title}.html`, 'text/html');
        }
    }

    // 导出为Markdown
    exportAsMarkdown() {
        if (this.vditorInstance) {
            const markdown = this.vditorInstance.getValue();
            const title = this.extractTitleFromContent(markdown);
            this.downloadFile(markdown, `${title}.md`, 'text/markdown');
        }
    }

    // 导出为PDF (使用Vditor内置功能)
    exportAsPDF() {
        if (this.vditorInstance) {
            try {
                // 使用 Vditor 内置的导出功能
                // 首先尝试调用 Vditor 的 export 方法
                if (this.vditorInstance.export) {
                    this.vditorInstance.export('pdf');
                } else {
                    // 如果没有直接的 export 方法，尝试通过工具栏触发
                    const exportButton = document.querySelector('[data-type="export"]');
                    if (exportButton) {
                        exportButton.click();
                        // 等待导出菜单出现，然后点击PDF选项
                        setTimeout(() => {
                            const pdfOption = document.querySelector('[data-type="pdf"]');
                            if (pdfOption) {
                                pdfOption.click();
                            } else {
                                // 如果找不到PDF选项，回退到打印方式
                                this.fallbackToPrint();
                            }
                        }, 100);
                    } else {
                        // 如果找不到导出按钮，回退到打印方式
                        this.fallbackToPrint();
                    }
                }
            } catch (error) {
                console.error('使用Vditor内置导出功能失败:', error);
                // 出错时回退到打印方式
                this.fallbackToPrint();
            }
        }
    }

    // 回退到打印方式的PDF导出
    fallbackToPrint() {
        if (this.vditorInstance) {
            const html = this.vditorInstance.getHTML();
            const content = this.vditorInstance.getValue();
            const title = this.extractTitleFromContent(content);

            // 创建打印窗口
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${title}</title>
                    <meta charset="utf-8">
                    <style>
                        @media print {
                            body { margin: 0; }
                            .no-print { display: none !important; }
                        }
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            margin: 40px;
                        }
                        h1, h2, h3, h4, h5, h6 { color: #2c3e50; margin-top: 1.5em; margin-bottom: 0.5em; }
                        code { background: #f8f9fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
                        pre { background: #f8f9fa; padding: 16px; border-radius: 8px; overflow-x: auto; }
                        blockquote { border-left: 4px solid #3498db; margin: 1em 0; padding-left: 20px; color: #555; }
                        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        img { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    ${html}
                    <script>
                        window.onload = function() {
                            setTimeout(() => window.print(), 500);
                        };
                        window.onafterprint = function() {
                            window.close();
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    }

    // 下载文件的通用方法
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 插入内容到编辑器
    insertContent(content) {
        if (this.vditorInstance) {
            this.vditorInstance.insertValue(content);
        }
    }

    // 获取选中的文本
    getSelectedText() {
        if (this.vditorInstance) {
            return this.vditorInstance.getSelection();
        }
        return '';
    }

    // 设置编辑器主题
    setTheme(theme) {
        if (this.vditorInstance) {
            // theme: 'classic' | 'dark'
            this.vditorInstance.setTheme(theme);
        }
    }

    // 设置编辑器为只读模式
    setReadOnly(readonly = true) {
        if (this.vditorInstance) {
            if (readonly) {
                this.vditorInstance.disabled();
                this.isEditMode = false;
            } else {
                this.vditorInstance.enable();
                this.isEditMode = true;
            }
        }
    }

    // 启用编辑器
    enableEditor() {
        this.setReadOnly(false);
    }

    // 禁用编辑器（只读模式）
    disableEditor() {
        this.setReadOnly(true);
    }

    // 全屏切换
    toggleFullscreen() {
        if (this.vditorInstance) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                const container = document.getElementById('vditor');
                if (container.requestFullscreen) {
                    container.requestFullscreen();
                }
            }
        }
    }

    // 获取编辑器统计信息
    getStats() {
        if (this.vditorInstance) {
            const content = this.vditorInstance.getValue();
            const wordCount = content.replace(/\s+/g, ' ').split(' ').filter(word => word.length > 0).length;
            const charCount = content.length;
            const lineCount = content.split('\n').length;

            return {
                words: wordCount,
                characters: charCount,
                lines: lineCount
            };
        }
        return { words: 0, characters: 0, lines: 0 };
    }

    // 显示消息提示
    showMessage(message, type = 'info') {
        if (typeof balert === 'function') {
            balert(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            alert(message);
        }
    }

    // 设置粘贴文件上传处理
    setupPasteUpload() {
        if (!this.vditorInstance) return;

        // 监听粘贴事件
        document.addEventListener('paste', (e) => {
            // 检查是否在编辑器内
            const editorElement = document.getElementById('vditor');
            if (!editorElement || !editorElement.contains(e.target)) {
                return;
            }

            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) return;

            const items = clipboardData.items;
            if (!items) return;

            // 查找文件项
            for (let i = 0; i < items.length; i++) {
                const item = items[i];

                // 检查是否为文件
                if (item.kind === 'file') {
                    e.preventDefault(); // 阻止默认粘贴行为

                    const file = item.getAsFile();
                    if (file) {
                        this.uploadPastedFile(file);
                    }
                    break;
                }
            }
        });
    }

    // 上传粘贴的文件
    async uploadPastedFile(file) {
        // 检查文件类型
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/svg+xml',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/markdown', 'text/csv',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (!allowedTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg|pdf|doc|docx|txt|md|csv|xlsx|xls)$/i)) {
            this.showMessage('不支持的文件类型', 'warning');
            return;
        }

        // 检查文件大小 (20MB)
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showMessage('文件大小不能超过20MB', 'warning');
            return;
        }

        try {
            // 显示上传中的提示
            this.showMessage('正在上传文件...', 'info');

            // 创建FormData
            const formData = new FormData();
            formData.append('file', file);

            // 获取认证token
            const token = localStorage.getItem('aibotpro_userToken');
            if (!token) {
                this.showMessage('请先登录', 'warning');
                return;
            }

            // 发送请求
            const response = await fetch('/DeepResearch/UploadEditorFile', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: formData
            });

            const result = await response.json();

            if (result.success && result.data) {
                const { url, filename, type } = result.data;

                // 根据文件类型插入不同的Markdown
                let markdownContent;
                if (type === 'image') {
                    markdownContent = `![${filename}](${url})`;
                } else {
                    markdownContent = `[${filename}](${url})`;
                }

                // 插入到编辑器
                this.insertContent(markdownContent + '\n');
                this.showMessage('文件上传成功', 'success');
            } else {
                this.showMessage(result.msg || '文件上传失败', 'danger');
            }
        } catch (error) {
            console.error('文件上传错误:', error);
            this.showMessage('文件上传失败: ' + error.message, 'danger');
        }
    }

    // 重写设置事件监听器方法，添加粘贴文件处理
    setupEventListeners() {
        // 快捷键支持
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveContent();
                        break;
                    case 'z':
                        if (e.shiftKey) {
                            // Ctrl+Shift+Z 重做
                            e.preventDefault();
                            this.redo();
                        } else {
                            // Ctrl+Z 撤销
                            e.preventDefault();
                            this.undo();
                        }
                        break;
                }
            }
        });

        // 设置粘贴文件上传
        this.setupPasteUpload();
        
        // 设置文本选择监听
        this.setupTextSelectionListener();
    }

    // 设置文本选择监听器
    setupTextSelectionListener() {
        let selectionTimeout = null;
        let hideTimeout = null;

        // 监听鼠标抬起事件
        document.addEventListener('mouseup', (e) => {
            // 清除之前的定时器
            if (selectionTimeout) {
                clearTimeout(selectionTimeout);
            }
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }

            // 延迟检查选择，避免频繁触发
            selectionTimeout = setTimeout(() => {
                this.handleTextSelection(e);
            }, 150);
        });

        // 监听键盘事件（处理键盘选择）
        document.addEventListener('keyup', (e) => {
            // 只处理可能影响选择的按键
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
                e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
                e.key === 'Home' || e.key === 'End' ||
                (e.shiftKey && (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End'))) {
                
                if (selectionTimeout) {
                    clearTimeout(selectionTimeout);
                }
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                }

                selectionTimeout = setTimeout(() => {
                    this.handleTextSelection(e);
                }, 200);
            }
        });

        // 监听鼠标按下事件，立即隐藏按钮
        document.addEventListener('mousedown', (e) => {
            // 如果点击的不是引用按钮，则隐藏按钮
            if (!e.target.closest('.quote-button')) {
                // 延迟隐藏，给mouseup事件处理机会
                if (hideTimeout) {
                    clearTimeout(hideTimeout);
                }
                hideTimeout = setTimeout(() => {
                    this.hideQuoteButton();
                }, 50);
            }
        });

        // 监听滚动事件，隐藏引用按钮
        document.addEventListener('scroll', () => {
            this.hideQuoteButton();
        }, true);

        // 监听窗口大小变化，隐藏引用按钮
        window.addEventListener('resize', () => {
            this.hideQuoteButton();
        });

        // 监听编辑器失去焦点，隐藏引用按钮
        document.addEventListener('focusout', (e) => {
            // 延迟检查，确保不是在编辑器内部切换焦点
            setTimeout(() => {
                const editorElement = document.getElementById('vditor');
                if (editorElement && !editorElement.contains(document.activeElement)) {
                    this.hideQuoteButton();
                }
            }, 100);
        });
    }

    // 处理文本选择
    handleTextSelection(e) {
        try {
            // 检查是否在编辑器内
            const editorElement = document.getElementById('vditor');
            if (!editorElement) return;

            // 获取选择范围
            const selection = window.getSelection();
            if (!selection.rangeCount) {
                this.hideQuoteButton();
                return;
            }

            // 检查选择是否在编辑器内
            const range = selection.getRangeAt(0);
            const startContainer = range.startContainer;
            const endContainer = range.endContainer;
            
            // 检查选择的起始和结束容器是否都在编辑器内
            const isStartInEditor = editorElement.contains(startContainer.nodeType === Node.TEXT_NODE ? startContainer.parentNode : startContainer);
            const isEndInEditor = editorElement.contains(endContainer.nodeType === Node.TEXT_NODE ? endContainer.parentNode : endContainer);
            
            if (!isStartInEditor || !isEndInEditor) {
                this.hideQuoteButton();
                return;
            }

            // 获取选中的文本
            const selectedText = this.getSelectedText();
            
            if (!selectedText || selectedText.trim().length === 0) {
                this.hideQuoteButton();
                return;
            }

            // 检查选中文本长度，避免过短的选择
            if (selectedText.trim().length < 3) {
                this.hideQuoteButton();
                return;
            }

            const rect = range.getBoundingClientRect();

            // 检查rect是否有效
            if (rect.width === 0 && rect.height === 0) {
                this.hideQuoteButton();
                return;
            }

            // 显示引用按钮
            this.showQuoteButton(rect, selectedText);

        } catch (error) {
            console.error('处理文本选择时发生错误:', error);
            this.hideQuoteButton();
        }
    }

    // 显示引用按钮
    showQuoteButton(rect, selectedText) {
        // 移除现有的引用按钮
        this.hideQuoteButton();

        // 创建引用按钮
        const quoteButton = document.createElement('div');
        quoteButton.className = 'quote-button';
        
        // 根据文本长度显示不同的图标和提示
        const textLength = selectedText.trim().length;
        let icon = 'fas fa-quote-right';
        let title = '引用到AI对话';
        
        if (textLength > 500) {
            title += ` (${textLength}字，将自动截取)`;
        } else {
            title += ` (${textLength}字)`;
        }
        
        quoteButton.innerHTML = `<i class="${icon}"></i>`;
        quoteButton.title = title;

        // 设置按钮位置
        const buttonSize = 32;
        const margin = 8;
        
        // 获取视窗尺寸
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // 计算按钮位置（优先在选择区域的右上角）
        let left = rect.right + margin;
        let top = rect.top - buttonSize - margin;

        // 水平边界检查
        if (left + buttonSize > viewportWidth) {
            // 右侧空间不够，放在左侧
            left = rect.left - buttonSize - margin;
            if (left < 0) {
                // 左侧也不够，放在选择区域内部右侧
                left = Math.min(rect.right - buttonSize - margin, viewportWidth - buttonSize - margin);
                left = Math.max(left, margin);
            }
        }

        // 垂直边界检查
        if (top < scrollTop) {
            // 上方空间不够，放在下方
            top = rect.bottom + margin;
            if (top + buttonSize > scrollTop + viewportHeight) {
                // 下方也不够，放在选择区域中间
                top = rect.top + (rect.height - buttonSize) / 2;
                top = Math.max(top, scrollTop + margin);
                top = Math.min(top, scrollTop + viewportHeight - buttonSize - margin);
            }
        }

        quoteButton.style.left = left + 'px';
        quoteButton.style.top = top + 'px';

        // 添加点击事件
        quoteButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.insertQuoteToChat(selectedText);
            this.hideQuoteButton();
        });

        // 添加到页面
        document.body.appendChild(quoteButton);

        // 添加动画效果
        setTimeout(() => {
            quoteButton.classList.add('show');
        }, 10);

        // 保存引用按钮引用
        this.currentQuoteButton = quoteButton;
    }

    // 隐藏引用按钮
    hideQuoteButton() {
        if (this.currentQuoteButton) {
            this.currentQuoteButton.remove();
            this.currentQuoteButton = null;
        }
    }

    // 将引用插入到AI对话输入框
    insertQuoteToChat(selectedText) {
        try {
            // 获取AI对话输入框
            const chatInput = document.getElementById('chatInput');
            if (!chatInput) {
                console.warn('未找到AI对话输入框');
                return;
            }

            // 检查是否有选中的研究项目
            if (!window.currentResearchId) {
                if (typeof balert === 'function') {
                    balert('请先选择一个研究项目', 'warning');
                }
                return;
            }

            // 获取当前研究项目标题
            const currentResearchTitle = $(`.research-item[data-id="${window.currentResearchId}"] h6`).text() || '当前研究';

            // 格式化引用文本
            const quotedText = this.formatQuoteText(selectedText, currentResearchTitle);

            // 获取当前输入框内容
            const currentValue = chatInput.value.trim();

            // 插入引用文本
            let newValue;
            if (currentValue) {
                newValue = currentValue + '\n\n' + quotedText;
            } else {
                newValue = quotedText;
            }

            chatInput.value = newValue;

            // 触发输入事件（如果有相关处理）
            const inputEvent = new Event('input', { bubbles: true });
            chatInput.dispatchEvent(inputEvent);

            // 自动切换到AI对话tab
            this.switchToChatTab();

            // 聚焦到输入框并将光标移到末尾
            chatInput.focus();
            chatInput.setSelectionRange(newValue.length, newValue.length);

            // 显示成功提示
            if (typeof balert === 'function') {
                balert('引用内容已添加到AI对话输入框', 'success', false, 2000);
            }

        } catch (error) {
            console.error('插入引用到对话时发生错误:', error);
            if (typeof balert === 'function') {
                balert('插入引用失败', 'danger');
            }
        }
    }

    // 格式化引用文本
    formatQuoteText(selectedText, researchTitle) {
        // 清理选中的文本
        let cleanText = selectedText.trim();
        
        // 移除多余的空白字符，但保留段落结构
        cleanText = cleanText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n');
        
        // 限制引用文本长度
        const maxLength = 800;
        let quotedText = cleanText;
        if (quotedText.length > maxLength) {
            // 尝试在句号处截断
            const truncated = quotedText.substring(0, maxLength);
            const lastPeriod = truncated.lastIndexOf('。');
            const lastDot = truncated.lastIndexOf('.');
            const cutPoint = Math.max(lastPeriod, lastDot);
            
            if (cutPoint > maxLength * 0.7) {
                quotedText = truncated.substring(0, cutPoint + 1) + '...';
            } else {
                quotedText = truncated + '...';
            }
        }

        // 格式化引用 - 处理多行文本
        const lines = quotedText.split('\n');
        const quotedLines = lines.map(line => line.trim() ? `> ${line}` : '>').join('\n');
        
        // 添加引用标识和来源
        const timestamp = new Date().toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const reference = `\n\n**📄 引用来源：** ${researchTitle} *(${timestamp})*\n\n`;
        const prompt = '**💬 基于以上引用内容，请回答：**\n';
        
        return quotedLines + reference + prompt;
    }

    // 切换到AI对话tab
    switchToChatTab() {
        try {
            // 检查chat tab是否被禁用
            const chatTab = document.getElementById('chat-tab');
            if (chatTab && chatTab.classList.contains('disabled')) {
                // 如果被禁用，显示提示但仍然插入内容
                if (typeof balert === 'function') {
                    balert('引用内容已添加，请等待研究完成后进行对话', 'info', false, 3000);
                }
                return;
            }

            // 切换tab
            $('#chatTabs .nav-link').removeClass('active');
            $('.chat-panel-content .tab-pane').removeClass('active show');
            $('#chat-tab').addClass('active');
            $('#chatPanel').addClass('active show');

        } catch (error) {
            console.error('切换到对话tab时发生错误:', error);
        }
    }

    getContentByLines(startLine, endLine, options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        // 参数验证
        if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
            startLine < 1 || endLine < 1 || startLine > endLine) {
            console.error('行号参数无效');
            return null;
        }

        // 默认选项
        const defaultOptions = {
            showLineNumbers: true,
            lineNumberFormat: '{line}: ',
            lineNumberPadding: null
        };

        const config = { ...defaultOptions, ...options };

        try {
            const fullContent = this.vditorInstance.getValue();
            if (!fullContent) return '';

            const lines = fullContent.split('\n');

            if (startLine > lines.length) {
                console.warn(`开始行号超出范围`);
                return '';
            }

            const actualEndLine = Math.min(endLine, lines.length);
            const selectedLines = lines.slice(startLine - 1, actualEndLine);

            // 如果不显示行号，直接返回原内容
            if (!config.showLineNumbers) {
                return selectedLines.join('\n');
            }

            // 计算行号填充位数
            const padding = config.lineNumberPadding || actualEndLine.toString().length;

            // 为每行添加行号
            const linesWithNumbers = selectedLines.map((line, index) => {
                const currentLineNumber = startLine + index;
                const paddedLineNumber = currentLineNumber.toString().padStart(padding, ' ');
                const formattedLineNumber = config.lineNumberFormat.replace('{line}', paddedLineNumber);
                return formattedLineNumber + line;
            });

            return linesWithNumbers.join('\n');
        } catch (error) {
            console.error('获取内容时发生错误:', error);
            return null;
        }
    }

    /**
     * 获取总行数
     * @returns {number} - 总行数
     */
    getTotalLines() {
        if (!this.vditorInstance) return 0;

        try {
            const content = this.vditorInstance.getValue();
            return content ? content.split('\n').length : 0;
        } catch (error) {
            console.error('获取总行数时发生错误:', error);
            return 0;
        }
    }

    replaceContentByLines(startLine, endLine, newContent, options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return false;
        }

        // 参数验证
        if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
            startLine < 1 || endLine < 1 || startLine > endLine) {
            console.error('行号参数无效');
            return false;
        }

        if (typeof newContent !== 'string') {
            console.error('新内容必须是字符串');
            return false;
        }

        // 默认选项
        const defaultOptions = {
            preserveSelection: false,
            addToHistory: true
        };

        const config = { ...defaultOptions, ...options };

        try {
            const fullContent = this.vditorInstance.getValue();
            if (!fullContent && startLine > 1) {
                console.warn('编辑器内容为空，但指定的起始行号大于1');
                return false;
            }

            const lines = fullContent ? fullContent.split('\n') : [''];

            // 检查行号范围
            if (startLine > lines.length) {
                console.warn(`开始行号 ${startLine} 超出了内容总行数 ${lines.length}`);
                return false;
            }

            const actualEndLine = Math.min(endLine, lines.length);

            // 分割新内容为行数组
            const newLines = newContent.split('\n');

            // 构建新的完整内容
            const beforeLines = lines.slice(0, startLine - 1);
            const afterLines = lines.slice(actualEndLine);
            const updatedLines = [...beforeLines, ...newLines, ...afterLines];

            const updatedContent = updatedLines.join('\n');

            // 设置新内容
            this.vditorInstance.setValue(updatedContent);

            // 触发内容变化事件
            this.onContentChange(updatedContent);

            console.log(`成功替换第 ${startLine} 到第 ${actualEndLine} 行的内容`);
            return true;

        } catch (error) {
            console.error('替换内容时发生错误:', error);
            return false;
        }
    }

    /**
     * 在指定行号位置插入内容
     * @param {number} lineNumber - 行号（从1开始）
     * @param {string} content - 要插入的内容
     * @param {string} position - 插入位置：'before'(行前), 'after'(行后), 'replace'(替换)
     * @returns {boolean} - 操作是否成功
     */
    insertContentAtLine(lineNumber, content, position = 'after') {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return false;
        }

        if (!Number.isInteger(lineNumber) || lineNumber < 1) {
            console.error('行号参数无效');
            return false;
        }

        if (typeof content !== 'string') {
            console.error('内容必须是字符串');
            return false;
        }

        try {
            const fullContent = this.vditorInstance.getValue();
            const lines = fullContent ? fullContent.split('\n') : [''];

            let updatedLines;

            switch (position) {
                case 'before':
                    // 在指定行之前插入
                    if (lineNumber > lines.length) {
                        // 如果行号超出范围，在末尾添加
                        updatedLines = [...lines, ...content.split('\n')];
                    } else {
                        const beforeLines = lines.slice(0, lineNumber - 1);
                        const afterLines = lines.slice(lineNumber - 1);
                        updatedLines = [...beforeLines, ...content.split('\n'), ...afterLines];
                    }
                    break;

                case 'after':
                    // 在指定行之后插入
                    if (lineNumber > lines.length) {
                        // 如果行号超出范围，在末尾添加
                        updatedLines = [...lines, ...content.split('\n')];
                    } else {
                        const beforeLines = lines.slice(0, lineNumber);
                        const afterLines = lines.slice(lineNumber);
                        updatedLines = [...beforeLines, ...content.split('\n'), ...afterLines];
                    }
                    break;

                case 'replace':
                    // 替换指定行
                    return this.replaceContentByLines(lineNumber, lineNumber, content);

                default:
                    console.error('无效的插入位置参数');
                    return false;
            }

            const updatedContent = updatedLines.join('\n');
            this.vditorInstance.setValue(updatedContent);
            this.onContentChange(updatedContent);

            console.log(`成功在第 ${lineNumber} 行${position === 'before' ? '前' : '后'}插入内容`);
            return true;

        } catch (error) {
            console.error('插入内容时发生错误:', error);
            return false;
        }
    }

    /**
     * 删除指定行号范围的内容
     * @param {number} startLine - 开始行号（从1开始）
     * @param {number} endLine - 结束行号（从1开始，包含此行）
     * @returns {boolean} - 操作是否成功
     */
    deleteLinesByRange(startLine, endLine) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return false;
        }

        if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
            startLine < 1 || endLine < 1 || startLine > endLine) {
            console.error('行号参数无效');
            return false;
        }

        try {
            const fullContent = this.vditorInstance.getValue();
            if (!fullContent) {
                console.warn('编辑器内容为空');
                return false;
            }

            const lines = fullContent.split('\n');

            if (startLine > lines.length) {
                console.warn(`开始行号超出范围`);
                return false;
            }

            const actualEndLine = Math.min(endLine, lines.length);

            // 构建删除指定行后的内容
            const beforeLines = lines.slice(0, startLine - 1);
            const afterLines = lines.slice(actualEndLine);
            const updatedLines = [...beforeLines, ...afterLines];

            const updatedContent = updatedLines.join('\n');
            this.vditorInstance.setValue(updatedContent);
            this.onContentChange(updatedContent);

            console.log(`成功删除第 ${startLine} 到第 ${actualEndLine} 行`);
            return true;

        } catch (error) {
            console.error('删除行时发生错误:', error);
            return false;
        }
    }

    /**
     * 批量操作：对多个行范围进行不同的操作
     * @param {Array} operations - 操作数组，每个操作包含 {type, startLine, endLine, content}
     * @returns {boolean} - 所有操作是否成功
     */
    batchLineOperations(operations) {
        if (!Array.isArray(operations) || operations.length === 0) {
            console.error('操作数组无效');
            return false;
        }

        try {
            // 按行号倒序排序，避免行号偏移问题
            const sortedOps = operations.sort((a, b) => b.startLine - a.startLine);

            let success = true;
            for (const op of sortedOps) {
                let result = false;

                switch (op.type) {
                    case 'replace':
                        result = this.replaceContentByLines(op.startLine, op.endLine, op.content || '');
                        break;
                    case 'insert':
                        result = this.insertContentAtLine(op.startLine, op.content || '', op.position || 'after');
                        break;
                    case 'delete':
                        result = this.deleteLinesByRange(op.startLine, op.endLine);
                        break;
                    default:
                        console.error(`未知的操作类型: ${op.type}`);
                        result = false;
                }

                if (!result) {
                    success = false;
                    console.error(`操作失败: ${JSON.stringify(op)}`);
                }
            }

            return success;
        } catch (error) {
            console.error('批量操作时发生错误:', error);
            return false;
        }
    }

    /**
     * 根据标题获取该部分的完整内容（标题+内容）
     * @param {string} targetTitle - 目标标题文本
     * @param {Object} options - 选项配置
     * @param {boolean} options.exactMatch - 是否精确匹配标题，默认为false（模糊匹配）
     * @param {boolean} options.caseSensitive - 是否区分大小写，默认为false
     * @param {boolean} options.includeSubSections - 是否包含子章节，默认为true
     * @param {number} options.maxLevel - 最大标题级别限制，默认为6
     * @param {boolean} options.showLineNumbers - 是否显示行号，默认为false
     * @param {string} options.lineNumberFormat - 行号格式，默认为'{line}: '
     * @returns {Object|null} - 返回包含标题信息和内容的对象
     */
    getContentByTitle(targetTitle, options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        if (!targetTitle || typeof targetTitle !== 'string') {
            console.error('目标标题参数无效');
            return null;
        }

        // 默认选项
        const defaultOptions = {
            exactMatch: false,
            caseSensitive: false,
            includeSubSections: true,
            maxLevel: 6,
            showLineNumbers: false,
            lineNumberFormat: '{line}: '
        };

        const config = { ...defaultOptions, ...options };

        try {
            const fullContent = this.vditorInstance.getValue();
            if (!fullContent) {
                console.warn('编辑器内容为空');
                return null;
            }

            const lines = fullContent.split('\n');
            const outline = this._parseOutline(lines, config.maxLevel);

            // 查找目标标题
            const targetSection = this._findTargetSection(outline, targetTitle, config);

            if (!targetSection) {
                console.warn(`未找到标题: ${targetTitle}`);
                return null;
            }

            // 获取该部分的内容
            const sectionContent = this._extractSectionContent(lines, targetSection, config);

            return sectionContent;

        } catch (error) {
            console.error('获取标题内容时发生错误:', error);
            return null;
        }
    }

    /**
     * 解析文档大纲结构
     * @private
     * @param {Array} lines - 文档行数组
     * @param {number} maxLevel - 最大标题级别
     * @returns {Array} - 大纲结构数组
     */
    _parseOutline(lines, maxLevel = 6) {
        const outline = [];
        const headingRegex = /^(#{1,6})\s+(.+)$/;

        lines.forEach((line, index) => {
            const match = line.match(headingRegex);
            if (match) {
                const level = match[1].length;
                const title = match[2].trim();

                if (level <= maxLevel) {
                    outline.push({
                        level: level,
                        title: title,
                        originalTitle: match[2], // 保留原始标题（可能包含格式）
                        lineNumber: index + 1,
                        lineIndex: index,
                        fullLine: line
                    });
                }
            }
        });

        return outline;
    }

    /**
     * 查找目标标题部分
     * @private
     * @param {Array} outline - 大纲数组
     * @param {string} targetTitle - 目标标题
     * @param {Object} config - 配置选项
     * @returns {Object|null} - 找到的标题对象
     */
    _findTargetSection(outline, targetTitle, config) {
        const searchTitle = config.caseSensitive ? targetTitle : targetTitle.toLowerCase();

        for (const section of outline) {
            const sectionTitle = config.caseSensitive ? section.title : section.title.toLowerCase();

            let isMatch = false;
            if (config.exactMatch) {
                isMatch = sectionTitle === searchTitle;
            } else {
                isMatch = sectionTitle.includes(searchTitle) || searchTitle.includes(sectionTitle);
            }

            if (isMatch) {
                return section;
            }
        }

        return null;
    }

    /**
     * 提取章节内容
     * @private
     * @param {Array} lines - 文档行数组
     * @param {Object} targetSection - 目标章节对象
     * @param {Object} config - 配置选项
     * @returns {Object} - 章节内容对象
     */
    _extractSectionContent(lines, targetSection, config) {
        const startLine = targetSection.lineNumber;
        let endLine = lines.length;

        // 查找下一个同级或更高级别的标题
        if (config.includeSubSections) {
            // 包含子章节：查找同级或更高级别的标题
            for (let i = targetSection.lineIndex + 1; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(/^(#{1,6})\s+(.+)$/);
                if (match) {
                    const level = match[1].length;
                    if (level <= targetSection.level) {
                        endLine = i;
                        break;
                    }
                }
            }
        } else {
            // 不包含子章节：查找下一个标题（任意级别）
            for (let i = targetSection.lineIndex + 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.match(/^#{1,6}\s+.+$/)) {
                    endLine = i;
                    break;
                }
            }
        }

        // 提取内容
        const contentLines = lines.slice(targetSection.lineIndex, endLine);
        let content = contentLines.join('\n');

        // 添加行号（如果需要）
        if (config.showLineNumbers) {
            const padding = endLine.toString().length;
            const numberedLines = contentLines.map((line, index) => {
                const currentLineNumber = startLine + index;
                const paddedLineNumber = currentLineNumber.toString().padStart(padding, ' ');
                const formattedLineNumber = config.lineNumberFormat.replace('{line}', paddedLineNumber);
                return formattedLineNumber + line;
            });
            content = numberedLines.join('\n');
        }

        // 解析子章节
        const subSections = this._parseSubSections(contentLines, targetSection, startLine);

        return {
            title: targetSection.title,
            originalTitle: targetSection.originalTitle,
            level: targetSection.level,
            startLine: startLine,
            endLine: endLine,
            totalLines: endLine - startLine,
            content: content,
            rawContent: contentLines.join('\n'),
            subSections: subSections,
            hasSubSections: subSections.length > 0,
            wordCount: this._countWords(contentLines.join('\n')),
            characterCount: contentLines.join('\n').length
        };
    }

    /**
     * 解析子章节
     * @private
     * @param {Array} contentLines - 内容行数组
     * @param {Object} parentSection - 父章节对象
     * @param {number} baseLineNumber - 基础行号
     * @returns {Array} - 子章节数组
     */
    _parseSubSections(contentLines, parentSection, baseLineNumber) {
        const subSections = [];
        const headingRegex = /^(#{1,6})\s+(.+)$/;

        contentLines.forEach((line, index) => {
            if (index === 0) return; // 跳过标题行本身

            const match = line.match(headingRegex);
            if (match) {
                const level = match[1].length;
                const title = match[2].trim();

                if (level > parentSection.level) {
                    subSections.push({
                        level: level,
                        title: title,
                        originalTitle: match[2],
                        lineNumber: baseLineNumber + index,
                        relativeLineNumber: index + 1,
                        fullLine: line
                    });
                }
            }
        });

        return subSections;
    }

    /**
     * 统计字数（简单实现）
     * @private
     * @param {string} text - 文本内容
     * @returns {number} - 字数
     */
    _countWords(text) {
        // 移除 Markdown 语法
        const cleanText = text
            .replace(/#{1,6}\s+/g, '') // 移除标题标记
            .replace(/\*\*(.+?)\*\*/g, '$1') // 移除粗体标记
            .replace(/\*(.+?)\*/g, '$1') // 移除斜体标记
            .replace(/`(.+?)`/g, '$1') // 移除行内代码标记
            .replace(/\[(.+?)\]\(.+?\)/g, '$1') // 移除链接，保留文本
            .replace(/!\[.*?\]\(.+?\)/g, '') // 移除图片
            .replace(/```[\s\S]*?```/g, '') // 移除代码块
            .replace(/^\s*[-*+]\s+/gm, '') // 移除列表标记
            .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表标记
            .replace(/^\s*>\s+/gm, '') // 移除引用标记
            .trim();

        if (!cleanText) return 0;

        // 中英文混合字数统计
        const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishWords = cleanText.replace(/[\u4e00-\u9fa5]/g, '').match(/\b\w+\b/g);
        const englishWordCount = englishWords ? englishWords.length : 0;

        return chineseChars + englishWordCount;
    }

    /**
     * 获取文档的完整大纲
     * @param {Object} options - 选项配置
     * @param {number} options.maxLevel - 最大标题级别，默认为6
     * @param {boolean} options.showLineNumbers - 是否显示行号，默认为true
     * @param {boolean} options.includeWordCount - 是否包含字数统计，默认为false
     * @returns {Array|null} - 大纲数组
     */
    getDocumentOutline(options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        const defaultOptions = {
            maxLevel: 6,
            showLineNumbers: true,
            includeWordCount: false
        };

        const config = { ...defaultOptions, ...options };

        try {
            const fullContent = this.vditorInstance.getValue();
            if (!fullContent) return [];

            const lines = fullContent.split('\n');
            const outline = this._parseOutline(lines, config.maxLevel);

            if (config.includeWordCount) {
                // 为每个章节计算字数
                outline.forEach((section, index) => {
                    const nextSection = outline[index + 1];
                    const endLine = nextSection ? nextSection.lineIndex : lines.length;
                    const sectionLines = lines.slice(section.lineIndex, endLine);
                    section.wordCount = this._countWords(sectionLines.join('\n'));
                });
            }

            return outline;

        } catch (error) {
            console.error('获取文档大纲时发生错误:', error);
            return null;
        }
    }

    /**
     * 根据标题修改该部分的内容
     * @param {string} targetTitle - 目标标题
     * @param {string} newContent - 新内容
     * @param {Object} options - 选项配置
     * @param {boolean} options.replaceTitle - 是否替换标题，默认为false
     * @param {boolean} options.exactMatch - 是否精确匹配标题，默认为false
     * @param {boolean} options.caseSensitive - 是否区分大小写，默认为false
     * @returns {boolean} - 操作是否成功
     */
    replaceContentByTitle(targetTitle, newContent, options = {}) {
        const defaultOptions = {
            replaceTitle: false,
            exactMatch: false,
            caseSensitive: false
        };

        const config = { ...defaultOptions, ...options };

        // 先获取目标章节信息
        const sectionInfo = this.getContentByTitle(targetTitle, {
            exactMatch: config.exactMatch,
            caseSensitive: config.caseSensitive,
            includeSubSections: true
        });

        if (!sectionInfo) {
            console.error(`未找到标题: ${targetTitle}`);
            return false;
        }

        let finalContent = newContent;

        // 如果不替换标题，需要保留原标题
        if (!config.replaceTitle) {
            const titleLine = '#'.repeat(sectionInfo.level) + ' ' + sectionInfo.originalTitle;
            finalContent = titleLine + '\n' + newContent;
        }

        // 使用行号范围替换功能
        return this.replaceContentByLines(
            sectionInfo.startLine,
            sectionInfo.endLine - 1,
            finalContent
        );
    }

    /**
     * 获取当前编辑器视窗的内容
     * @param {Object} options - 选项配置
     * @param {boolean} options.showLineNumbers - 是否显示行号，默认为true
     * @param {string} options.lineNumberFormat - 行号格式，默认为'{line}: '
     * @param {number} options.extraLines - 额外包含的行数（上下各增加的行数），默认为0
     * @param {boolean} options.includePartialLines - 是否包含部分可见的行，默认为true
     * @returns {Object|null} - 返回视窗内容信息对象
     */
    getViewportContent(options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        // 默认选项
        const defaultOptions = {
            showLineNumbers: true,
            lineNumberFormat: '{line}: ',
            extraLines: 0,
            includePartialLines: true
        };

        const config = { ...defaultOptions, ...options };

        try {
            const fullContent = this.vditorInstance.getValue();
            if (!fullContent) {
                return {
                    startLine: 1,
                    endLine: 1,
                    totalLines: 0,
                    visibleLines: 0,
                    content: '',
                    rawContent: '',
                    isFullDocument: true
                };
            }

            const lines = fullContent.split('\n');
            const totalLines = lines.length;

            // 获取编辑器容器
            const editorContainer = document.getElementById('vditor');
            if (!editorContainer) {
                console.error('找不到编辑器容器');
                return null;
            }

            // 获取真正的滚动容器和内容区域
            const scrollContainerInfo = this._findScrollContainer(editorContainer);
            
            if (!scrollContainerInfo) {
                console.warn('无法找到滚动容器，返回全部内容');
                return this._getFullDocumentAsViewport(lines, config);
            }

            const { scrollContainer, contentArea, mode } = scrollContainerInfo;

            // 获取视窗信息
            const viewportInfo = this._calculateViewportLines(scrollContainer, contentArea, totalLines, config);
            
            if (!viewportInfo) {
                console.warn('无法计算视窗行数，返回全部内容');
                return this._getFullDocumentAsViewport(lines, config);
            }

            const { startLine, endLine } = viewportInfo;

            // 应用额外行数
            const actualStartLine = Math.max(1, startLine - config.extraLines);
            const actualEndLine = Math.min(totalLines, endLine + config.extraLines);

            // 提取视窗内容
            const viewportLines = lines.slice(actualStartLine - 1, actualEndLine);
            let content = viewportLines.join('\n');

            // 根据编辑器模式调整返回的内容
            const adjustedContent = this._adjustContentForMode(viewportLines, mode, actualStartLine, actualEndLine);

            // 添加行号（如果需要）
            if (config.showLineNumbers) {
                const padding = actualEndLine.toString().length;
                const numberedLines = adjustedContent.lines.map((line, index) => {
                    const currentLineNumber = actualStartLine + index;
                    const paddedLineNumber = currentLineNumber.toString().padStart(padding, ' ');
                    const formattedLineNumber = config.lineNumberFormat.replace('{line}', paddedLineNumber);
                    return formattedLineNumber + line;
                });
                content = numberedLines.join('\n');
            } else {
                content = adjustedContent.content;
            }

            return {
                startLine: actualStartLine,
                endLine: actualEndLine,
                originalStartLine: startLine,
                originalEndLine: endLine,
                totalLines: totalLines,
                visibleLines: actualEndLine - actualStartLine + 1,
                content: content,
                rawContent: viewportLines.join('\n'),
                sourceContent: viewportLines.join('\n'), // 始终保留源码内容
                isFullDocument: actualStartLine === 1 && actualEndLine === totalLines,
                scrollTop: scrollContainer.scrollTop,
                scrollHeight: scrollContainer.scrollHeight,
                clientHeight: scrollContainer.clientHeight,
                mode: mode,
                modeNote: adjustedContent.note,
                extraLinesApplied: config.extraLines,
                scrollPercentage: scrollContainer.scrollHeight > scrollContainer.clientHeight ? 
                    (scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight) * 100).toFixed(1) : 0,
                containerInfo: {
                    selector: scrollContainerInfo.selector,
                    hasScroll: scrollContainer.scrollHeight > scrollContainer.clientHeight,
                    scrollRatio: scrollContainer.scrollHeight > scrollContainer.clientHeight ? 
                        (scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight)).toFixed(3) : 0
                }
            };

        } catch (error) {
            console.error('获取视窗内容时发生错误:', error);
            return null;
        }
    }

    /**
     * 查找真正的滚动容器
     * @private
     * @param {Element} editorContainer - 编辑器容器
     * @returns {Object|null} - 滚动容器信息
     */
    _findScrollContainer(editorContainer) {
        try {
            // 检查当前编辑器模式
            const currentMode = this.getCurrentMode();
            
            // 根据模式定义对应的滚动容器选择器（这些才是真正的滚动容器）
            let modeSpecificSelectors = [];
            switch (currentMode) {
                case 'wysiwyg':
                    modeSpecificSelectors = [
                        '.vditor-wysiwyg',
                        '.vditor-wysiwyg .vditor-reset'
                    ];
                    break;
                case 'ir':
                    modeSpecificSelectors = [
                        '.vditor-ir',
                        '.vditor-ir .vditor-reset'
                    ];
                    break;
                case 'sv':
                    modeSpecificSelectors = [
                        '.vditor-sv',
                        '.vditor-sv .vditor-reset',
                        '.vditor-sv textarea'
                    ];
                    break;
                default:
                    // 如果模式未知，尝试所有可能的容器
                    modeSpecificSelectors = [
                        '.vditor-wysiwyg',
                        '.vditor-ir', 
                        '.vditor-sv'
                    ];
            }

            console.log(`当前模式: ${currentMode}, 查找滚动容器:`, modeSpecificSelectors);

            // 优先查找模式特定的滚动容器
            for (const selector of modeSpecificSelectors) {
                const element = editorContainer.querySelector(selector);
                if (element) {
                    const computedStyle = window.getComputedStyle(element);
                    const hasScroll = element.scrollHeight > element.clientHeight;
                    const overflowY = computedStyle.overflowY;
                    const overflowX = computedStyle.overflowX;
                    
                    console.log(`检查容器 ${selector}:`, {
                        scrollHeight: element.scrollHeight,
                        clientHeight: element.clientHeight,
                        hasScroll: hasScroll,
                        overflowY: overflowY,
                        overflowX: overflowX,
                        display: computedStyle.display,
                        position: computedStyle.position
                    });
                    
                    // 检查是否是可滚动容器
                    const isScrollable = hasScroll || 
                                       overflowY === 'auto' || 
                                       overflowY === 'scroll' ||
                                       overflowY === 'overlay';
                    
                    if (isScrollable) {
                        console.log(`✅ 找到滚动容器: ${selector}`);
                        
                        return {
                            scrollContainer: element,
                            contentArea: element,
                            mode: currentMode,
                            selector: selector
                        };
                    } else {
                        console.log(`❌ ${selector} 不可滚动`);
                    }
                }
            }

            // 如果模式特定容器不可滚动，检查是否有父级滚动容器
            console.log('模式特定容器不可滚动，检查父级容器...');
            
            const fallbackSelectors = [
                '.vditor-content',
                '.vditor',
                '.research-edit-body',
                '.research-content'
            ];

            for (const selector of fallbackSelectors) {
                const element = editorContainer.querySelector(selector) || 
                               editorContainer.closest(selector) || 
                               document.querySelector(selector);
                               
                if (element) {
                    const computedStyle = window.getComputedStyle(element);
                    const hasScroll = element.scrollHeight > element.clientHeight;
                    const overflowY = computedStyle.overflowY;
                    
                    console.log(`检查父级容器 ${selector}:`, {
                        scrollHeight: element.scrollHeight,
                        clientHeight: element.clientHeight,
                        hasScroll: hasScroll,
                        overflowY: overflowY
                    });
                    
                    if (hasScroll || overflowY === 'auto' || overflowY === 'scroll') {
                        console.log(`✅ 找到父级滚动容器: ${selector}`);
                        
                        // 找到内容区域
                        let contentArea = null;
                        for (const modeSelector of modeSpecificSelectors) {
                            contentArea = editorContainer.querySelector(modeSelector);
                            if (contentArea) break;
                        }
                        
                        return {
                            scrollContainer: element,
                            contentArea: contentArea || element,
                            mode: currentMode,
                            selector: selector
                        };
                    }
                }
            }

            console.warn('❌ 未找到任何可滚动容器');
            return null;

        } catch (error) {
            console.error('查找滚动容器时发生错误:', error);
            return null;
        }
    }

    /**
     * 计算视窗中可见的行范围
     * @private
     * @param {Element} scrollContainer - 滚动容器
     * @param {Element} contentArea - 内容区域
     * @param {number} totalLines - 总行数
     * @param {Object} config - 配置选项
     * @returns {Object|null} - 行范围信息
     */
    _calculateViewportLines(scrollContainer, contentArea, totalLines, config) {
        try {
            const scrollTop = scrollContainer.scrollTop;
            const clientHeight = scrollContainer.clientHeight;
            const scrollHeight = scrollContainer.scrollHeight;

            console.log('滚动信息:', {
                scrollTop,
                clientHeight,
                scrollHeight,
                totalLines
            });

            // 如果内容完全可见，返回全部内容
            if (scrollHeight <= clientHeight || scrollHeight === 0) {
                console.log('内容完全可见，返回全部内容');
                return {
                    startLine: 1,
                    endLine: totalLines
                };
            }

            // 估算行高
            const estimatedLineHeight = this._estimateLineHeight(contentArea);
            
            if (estimatedLineHeight <= 0) {
                console.warn('无法估算行高，使用默认值');
                // 使用默认行高继续计算
                const defaultLineHeight = 24;
                const currentMode = this.getCurrentMode();
                return this._calculateWithLineHeight(scrollTop, clientHeight, scrollHeight, totalLines, defaultLineHeight, config, currentMode, contentArea);
            }

            console.log('估算行高:', estimatedLineHeight);

            // 获取当前编辑器模式
            const currentMode = this.getCurrentMode();

            return this._calculateWithLineHeight(scrollTop, clientHeight, scrollHeight, totalLines, estimatedLineHeight, config, currentMode, contentArea);

        } catch (error) {
            console.error('计算视窗行数时发生错误:', error);
            return null;
        }
    }

    /**
     * 使用指定行高计算视窗行范围
     * @private
     * @param {number} scrollTop - 滚动位置
     * @param {number} clientHeight - 视窗高度
     * @param {number} scrollHeight - 总滚动高度
     * @param {number} totalLines - 总行数（Markdown源码行数）
     * @param {number} lineHeight - 行高
     * @param {Object} config - 配置选项
     * @param {string} mode - 编辑器模式
     * @param {Element} contentArea - 内容区域
     * @returns {Object} - 行范围信息
     */
    _calculateWithLineHeight(scrollTop, clientHeight, scrollHeight, totalLines, lineHeight, config, mode, contentArea) {
        // 根据编辑器模式调整计算策略
        if (mode === 'sv') {
            // 源码模式：直接基于行高计算，因为显示的就是原始文本
            return this._calculateForSourceMode(scrollTop, clientHeight, totalLines, lineHeight, config);
        } else {
            // WYSIWYG 和 IR 模式：需要考虑渲染后的视觉行数
            return this._calculateForRenderMode(scrollTop, clientHeight, scrollHeight, totalLines, lineHeight, config, mode, contentArea);
        }
    }

    /**
     * 源码模式下的行数计算
     * @private
     */
    _calculateForSourceMode(scrollTop, clientHeight, totalLines, lineHeight, config) {
        // 源码模式下，显示的行数就是 Markdown 的实际行数
        let startLine = Math.floor(scrollTop / lineHeight) + 1;
        let endLine = Math.ceil((scrollTop + clientHeight) / lineHeight);

        // 边界检查
        startLine = Math.max(1, startLine);
        endLine = Math.min(totalLines, endLine);

        // 如果包含部分可见行，稍微扩展范围
        if (config.includePartialLines) {
            startLine = Math.max(1, startLine - 1);
            endLine = Math.min(totalLines, endLine + 1);
        }

        console.log('源码模式计算结果:', { startLine, endLine, totalLines });

        return { startLine, endLine };
    }

    /**
     * 渲染模式下的行数计算（WYSIWYG/IR）
     * @private
     */
    _calculateForRenderMode(scrollTop, clientHeight, scrollHeight, totalLines, lineHeight, config, mode, contentArea) {
        try {
            // 方法1: 基于滚动比例映射到源码行数
            const scrollRatio = scrollTop / (scrollHeight - clientHeight);
            const visibleRatio = clientHeight / scrollHeight;
            
            let startLine1 = Math.floor(scrollRatio * totalLines) + 1;
            let endLine1 = Math.ceil((scrollRatio + visibleRatio) * totalLines);

            // 方法2: 尝试通过DOM元素映射到源码行数
            const domMapping = this._mapDOMToSourceLines(contentArea, scrollTop, clientHeight, totalLines, mode);
            
            let startLine, endLine;
            
            if (domMapping && domMapping.startLine && domMapping.endLine) {
                // 如果DOM映射成功，使用DOM映射结果
                startLine = domMapping.startLine;
                endLine = domMapping.endLine;
                console.log('使用DOM映射结果:', domMapping);
            } else {
                // 否则使用滚动比例方法
                startLine = startLine1;
                endLine = endLine1;
                console.log('使用滚动比例方法');
            }

            // 边界检查
            startLine = Math.max(1, startLine);
            endLine = Math.min(totalLines, endLine);

            // 确保至少有一些可见行
            if (endLine <= startLine) {
                endLine = Math.min(totalLines, startLine + 5); // 至少显示5行
            }

            // 如果包含部分可见行，稍微扩展范围
            if (config.includePartialLines) {
                startLine = Math.max(1, startLine - 2);
                endLine = Math.min(totalLines, endLine + 2);
            }

            console.log('渲染模式计算结果:', {
                mode,
                scrollRatio: scrollRatio.toFixed(3),
                visibleRatio: visibleRatio.toFixed(3),
                scrollMethod: { startLine: startLine1, endLine: endLine1 },
                domMapping,
                final: { startLine, endLine }
            });

            return { startLine, endLine };

        } catch (error) {
            console.error('渲染模式计算失败，回退到简单方法:', error);
            // 回退到简单的滚动比例计算
            const scrollRatio = scrollTop / (scrollHeight - clientHeight);
            const visibleRatio = clientHeight / scrollHeight;
            
            let startLine = Math.floor(scrollRatio * totalLines) + 1;
            let endLine = Math.ceil((scrollRatio + visibleRatio) * totalLines);
            
            startLine = Math.max(1, startLine);
            endLine = Math.min(totalLines, endLine);
            
            return { startLine, endLine };
        }
    }

    /**
     * 尝试将DOM元素映射到源码行数
     * @private
     */
    _mapDOMToSourceLines(contentArea, scrollTop, clientHeight, totalLines, mode) {
        try {
            // 获取视窗范围内的DOM元素
            const viewportElements = this._getElementsInViewport(contentArea, scrollTop, clientHeight);
            
            if (viewportElements.length === 0) {
                return null;
            }

            // 尝试从DOM元素中提取行号信息
            let startLine = null;
            let endLine = null;

            for (const element of viewportElements) {
                const lineInfo = this._extractLineInfoFromElement(element, mode);
                if (lineInfo) {
                    if (startLine === null || lineInfo.startLine < startLine) {
                        startLine = lineInfo.startLine;
                    }
                    if (endLine === null || lineInfo.endLine > endLine) {
                        endLine = lineInfo.endLine;
                    }
                }
            }

            // 如果无法从DOM获取行号，尝试估算
            if (startLine === null || endLine === null) {
                return this._estimateLineMapping(viewportElements, totalLines, scrollTop, clientHeight, contentArea);
            }

            return { startLine, endLine, method: 'dom_extraction' };

        } catch (error) {
            console.error('DOM映射失败:', error);
            return null;
        }
    }

    /**
     * 获取视窗范围内的DOM元素
     * @private
     */
    _getElementsInViewport(contentArea, scrollTop, clientHeight) {
        const elements = [];
        const containerRect = contentArea.getBoundingClientRect();
        const viewportTop = containerRect.top + scrollTop;
        const viewportBottom = viewportTop + clientHeight;

        // 查找可能包含内容的元素
        const selectors = [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'blockquote', 'pre',
            '[data-block]', '[data-line]', '.vditor-ir__node', '.vditor-wysiwyg__block'
        ];

        for (const selector of selectors) {
            const nodeList = contentArea.querySelectorAll(selector);
            for (const element of nodeList) {
                const rect = element.getBoundingClientRect();
                const elementTop = rect.top;
                const elementBottom = rect.bottom;

                // 检查元素是否在视窗范围内
                if (elementBottom >= viewportTop && elementTop <= viewportBottom) {
                    elements.push({
                        element,
                        rect,
                        selector
                    });
                }
            }
        }

        return elements;
    }

    /**
     * 从DOM元素中提取行号信息
     * @private
     */
    _extractLineInfoFromElement(elementInfo, mode) {
        const { element } = elementInfo;
        
        // 尝试从各种属性中获取行号
        const lineAttrs = ['data-line', 'data-line-start', 'data-line-end', 'data-source-line'];
        
        for (const attr of lineAttrs) {
            const lineValue = element.getAttribute(attr);
            if (lineValue) {
                const lineNum = parseInt(lineValue);
                if (!isNaN(lineNum)) {
                    return {
                        startLine: lineNum,
                        endLine: lineNum,
                        method: `attribute_${attr}`
                    };
                }
            }
        }

        // 尝试从元素内容推断行号（这是一个近似方法）
        return null;
    }

    /**
     * 估算行号映射
     * @private
     */
    _estimateLineMapping(viewportElements, totalLines, scrollTop, clientHeight, contentArea) {
        try {
            // 基于元素在容器中的位置估算对应的源码行数
            const containerHeight = contentArea.scrollHeight;
            const viewportStart = scrollTop / containerHeight;
            const viewportEnd = (scrollTop + clientHeight) / containerHeight;

            const startLine = Math.floor(viewportStart * totalLines) + 1;
            const endLine = Math.ceil(viewportEnd * totalLines);

            return {
                startLine: Math.max(1, startLine),
                endLine: Math.min(totalLines, endLine),
                method: 'position_estimation'
            };

        } catch (error) {
            console.error('估算行号映射失败:', error);
            return null;
        }
    }

    /**
     * 估算行高
     * @private
     * @param {Element} contentArea - 内容区域
     * @returns {number} - 估算的行高
     */
    _estimateLineHeight(contentArea) {
        try {
            // 方法1: 尝试找到实际的文本行元素
            const lineElements = this._findLineElements(contentArea);
            
            if (lineElements.length > 0) {
                let totalHeight = 0;
                let count = 0;
                
                for (const element of lineElements) {
                    const rect = element.getBoundingClientRect();
                    if (rect.height > 0 && rect.height < 100) { // 排除异常高的元素
                        totalHeight += rect.height;
                        count++;
                    }
                }
                
                if (count > 0) {
                    const avgHeight = totalHeight / count;
                    console.log(`通过实际元素估算行高: ${avgHeight.toFixed(2)}px (${count}个元素)`);
                    return avgHeight;
                }
            }

            // 方法2: 创建测试元素来测量行高
            const testLineHeight = this._measureLineHeightWithTestElement(contentArea);
            if (testLineHeight > 0) {
                console.log(`通过测试元素估算行高: ${testLineHeight}px`);
                return testLineHeight;
            }

            // 方法3: 使用计算样式
            const computedStyle = window.getComputedStyle(contentArea);
            const fontSize = parseFloat(computedStyle.fontSize) || 16;
            const lineHeight = computedStyle.lineHeight;
            
            if (lineHeight && lineHeight !== 'normal') {
                if (lineHeight.endsWith('px')) {
                    const height = parseFloat(lineHeight);
                    console.log(`通过CSS lineHeight估算: ${height}px`);
                    return height;
                } else if (!isNaN(parseFloat(lineHeight))) {
                    const height = fontSize * parseFloat(lineHeight);
                    console.log(`通过CSS lineHeight倍数估算: ${height}px`);
                    return height;
                }
            }

            // 最终回退：使用字体大小的1.5倍
            const fallbackHeight = fontSize * 1.5;
            console.log(`使用回退方案估算行高: ${fallbackHeight}px`);
            return fallbackHeight;

        } catch (error) {
            console.error('估算行高时发生错误:', error);
            return 24; // 默认行高
        }
    }

    /**
     * 查找可能代表文本行的元素
     * @private
     * @param {Element} contentArea - 内容区域
     * @returns {Array} - 行元素数组
     */
    _findLineElements(contentArea) {
        const lineElements = [];
        
        // 不同编辑器模式下的行元素选择器
        const selectors = [
            'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'li', 'blockquote', 'pre',
            '.vditor-ir__node', '.vditor-wysiwyg__block',
            '[data-block]', '[contenteditable] > *'
        ];

        for (const selector of selectors) {
            const elements = contentArea.querySelectorAll(selector);
            for (const element of elements) {
                // 过滤掉嵌套太深或者不可见的元素
                if (this._isValidLineElement(element)) {
                    lineElements.push(element);
                    if (lineElements.length >= 10) break; // 限制数量
                }
            }
            if (lineElements.length >= 10) break;
        }

        return lineElements;
    }

    /**
     * 检查元素是否是有效的行元素
     * @private
     * @param {Element} element - 要检查的元素
     * @returns {boolean} - 是否有效
     */
    _isValidLineElement(element) {
        try {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            return (
                rect.height > 0 && 
                rect.height < 200 && // 不要太高
                rect.width > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                element.offsetParent !== null // 确保元素可见
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * 通过创建测试元素来测量行高
     * @private
     * @param {Element} contentArea - 内容区域
     * @returns {number} - 测量的行高
     */
    _measureLineHeightWithTestElement(contentArea) {
        try {
            // 创建测试元素
            const testElement = document.createElement('div');
            testElement.style.cssText = `
                position: absolute;
                visibility: hidden;
                white-space: nowrap;
                font-family: inherit;
                font-size: inherit;
                line-height: inherit;
                padding: 0;
                margin: 0;
                border: 0;
            `;
            testElement.textContent = 'Ag'; // 使用包含上下伸展的字符

            // 复制样式
            const computedStyle = window.getComputedStyle(contentArea);
            testElement.style.fontFamily = computedStyle.fontFamily;
            testElement.style.fontSize = computedStyle.fontSize;
            testElement.style.lineHeight = computedStyle.lineHeight;

            contentArea.appendChild(testElement);
            const height = testElement.offsetHeight;
            contentArea.removeChild(testElement);

            return height > 0 ? height : 0;
        } catch (error) {
            console.error('测量行高时发生错误:', error);
            return 0;
        }
    }

    /**
     * 当无法获取视窗信息时，返回全文档内容
     * @private
     * @param {Array} lines - 文档行数组
     * @param {Object} config - 配置选项
     * @returns {Object} - 全文档内容对象
     */
    _getFullDocumentAsViewport(lines, config) {
        const totalLines = lines.length;
        let content = lines.join('\n');

        if (config.showLineNumbers) {
            const padding = totalLines.toString().length;
            const numberedLines = lines.map((line, index) => {
                const currentLineNumber = index + 1;
                const paddedLineNumber = currentLineNumber.toString().padStart(padding, ' ');
                const formattedLineNumber = config.lineNumberFormat.replace('{line}', paddedLineNumber);
                return formattedLineNumber + line;
            });
            content = numberedLines.join('\n');
        }

        const mode = this.getCurrentMode();
        const adjustedContent = this._adjustContentForMode(lines, mode, 1, totalLines);
        
        return {
            startLine: 1,
            endLine: totalLines,
            originalStartLine: 1,
            originalEndLine: totalLines,
            totalLines: totalLines,
            visibleLines: totalLines,
            content: content,
            rawContent: lines.join('\n'),
            sourceContent: lines.join('\n'),
            isFullDocument: true,
            scrollTop: 0,
            scrollHeight: 0,
            clientHeight: 0,
            mode: mode,
            modeNote: adjustedContent.note,
            extraLinesApplied: 0,
            containerInfo: {
                selector: 'full-document',
                hasScroll: false,
                scrollRatio: 0
            }
        };
    }

    /**
     * 滚动到指定行
     * @param {number} lineNumber - 目标行号（从1开始）
     * @param {Object} options - 选项配置
     * @param {string} options.behavior - 滚动行为：'auto', 'smooth'，默认为'smooth'
     * @param {string} options.block - 垂直对齐：'start', 'center', 'end', 'nearest'，默认为'center'
     * @returns {boolean} - 操作是否成功
     */
    scrollToLine(lineNumber, options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return false;
        }

        if (!Number.isInteger(lineNumber) || lineNumber < 1) {
            console.error('行号参数无效');
            return false;
        }

        const defaultOptions = {
            behavior: 'smooth',
            block: 'center'
        };

        const config = { ...defaultOptions, ...options };

        try {
            const totalLines = this.getTotalLines();
            if (lineNumber > totalLines) {
                console.warn(`行号 ${lineNumber} 超出总行数 ${totalLines}`);
                lineNumber = totalLines;
            }

            // 获取编辑器容器
            const editorContainer = document.getElementById('vditor');
            if (!editorContainer) {
                console.error('找不到编辑器容器');
                return false;
            }

            // 获取内容区域
            const currentMode = this.getCurrentMode();
            let contentArea = null;

            switch (currentMode) {
                case 'wysiwyg':
                    contentArea = editorContainer.querySelector('.vditor-wysiwyg');
                    break;
                case 'ir':
                    contentArea = editorContainer.querySelector('.vditor-ir');
                    break;
                case 'sv':
                    contentArea = editorContainer.querySelector('.vditor-sv');
                    break;
                default:
                    contentArea = editorContainer.querySelector('.vditor-content') || 
                                 editorContainer.querySelector('.vditor-wysiwyg');
            }

            if (!contentArea) {
                console.error('找不到编辑器内容区域');
                return false;
            }

            // 估算目标位置
            const estimatedLineHeight = this._estimateLineHeight(contentArea);
            const targetScrollTop = (lineNumber - 1) * estimatedLineHeight;

            // 执行滚动
            contentArea.scrollTo({
                top: targetScrollTop,
                behavior: config.behavior
            });

            console.log(`滚动到第 ${lineNumber} 行`);
            return true;

        } catch (error) {
            console.error('滚动到指定行时发生错误:', error);
            return false;
        }
    }

    /**
     * 获取当前光标所在行号
     * @returns {number|null} - 当前行号，如果无法获取则返回null
     */
    getCurrentCursorLine() {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        try {
            // 这个功能的实现取决于 Vditor 的具体 API
            // 由于 Vditor 可能没有直接的获取光标行号的方法，
            // 我们可以通过获取光标位置和内容来计算
            
            const selection = this.vditorInstance.getSelection();
            if (!selection) {
                return null;
            }

            const content = this.vditorInstance.getValue();
            const lines = content.split('\n');
            
            // 简单实现：通过选择的文本位置估算行号
            // 注意：这是一个近似实现，实际效果可能因编辑器模式而异
            let currentPos = 0;
            for (let i = 0; i < lines.length; i++) {
                currentPos += lines[i].length + 1; // +1 for newline
                if (currentPos >= selection.start) {
                    return i + 1;
                }
            }

            return lines.length;

        } catch (error) {
            console.error('获取当前光标行号时发生错误:', error);
            return null;
        }
    }

    /**
     * 调试视窗信息 - 输出详细的滚动和视窗状态
     * @returns {Object} - 调试信息对象
     */
    debugViewportInfo() {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        try {
            const editorContainer = document.getElementById('vditor');
            if (!editorContainer) {
                console.error('找不到编辑器容器');
                return null;
            }

            const scrollContainerInfo = this._findScrollContainer(editorContainer);
            const fullContent = this.vditorInstance.getValue();
            const lines = fullContent ? fullContent.split('\n') : [];
            
            const debugInfo = {
                totalLines: lines.length,
                contentLength: fullContent ? fullContent.length : 0,
                editorMode: this.getCurrentMode(),
                scrollContainerInfo: scrollContainerInfo,
                containers: {}
            };

            // 检查各种可能的容器
            const containerSelectors = [
                '#vditor',
                '.vditor',
                '.vditor-content',
                '.vditor-wysiwyg',
                '.vditor-wysiwyg .vditor-reset',
                '.vditor-ir',
                '.vditor-ir .vditor-reset',
                '.vditor-sv',
                '.vditor-sv .vditor-reset',
                '.vditor-sv textarea',
                '.research-edit-body',
                '.research-content'
            ];

            containerSelectors.forEach(selector => {
                const element = document.querySelector(selector);
                if (element) {
                    const computedStyle = window.getComputedStyle(element);
                    const hasScroll = element.scrollHeight > element.clientHeight;
                    const isScrollable = hasScroll || 
                                       computedStyle.overflowY === 'auto' || 
                                       computedStyle.overflowY === 'scroll' ||
                                       computedStyle.overflowY === 'overlay';
                    
                    debugInfo.containers[selector] = {
                        exists: true,
                        scrollTop: element.scrollTop,
                        scrollHeight: element.scrollHeight,
                        clientHeight: element.clientHeight,
                        offsetHeight: element.offsetHeight,
                        hasScroll: hasScroll,
                        isScrollable: isScrollable,
                        overflowY: computedStyle.overflowY,
                        overflowX: computedStyle.overflowX,
                        position: computedStyle.position,
                        display: computedStyle.display,
                        height: computedStyle.height,
                        maxHeight: computedStyle.maxHeight
                    };
                } else {
                    debugInfo.containers[selector] = { exists: false };
                }
            });

            // 如果找到了滚动容器，获取视窗信息
            if (scrollContainerInfo) {
                const viewport = this.getViewportContent({ showLineNumbers: false });
                debugInfo.viewport = viewport;
            }

            console.group('🔍 Vditor 视窗调试信息');
            console.log('📊 基本信息:', {
                totalLines: debugInfo.totalLines,
                contentLength: debugInfo.contentLength,
                editorMode: debugInfo.editorMode
            });
            
            console.log('📦 滚动容器信息:', debugInfo.scrollContainerInfo);
            
            console.log('🏗️ 所有容器状态:');
            Object.entries(debugInfo.containers).forEach(([selector, info]) => {
                if (info.exists) {
                    const status = info.isScrollable ? '✅ 可滚动' : '❌ 不可滚动';
                    console.log(`  ${selector} ${status}:`, info);
                }
            });
            
            // 显示滚动容器查找的优先级
            console.log('🎯 滚动容器查找优先级:');
            const currentMode = debugInfo.editorMode;
            let modeSpecific = [];
            switch (currentMode) {
                case 'wysiwyg':
                    modeSpecific = ['.vditor-wysiwyg', '.vditor-wysiwyg .vditor-reset'];
                    break;
                case 'ir':
                    modeSpecific = ['.vditor-ir', '.vditor-ir .vditor-reset'];
                    break;
                case 'sv':
                    modeSpecific = ['.vditor-sv', '.vditor-sv .vditor-reset', '.vditor-sv textarea'];
                    break;
            }
            console.log(`  1. 模式特定容器 (${currentMode}):`, modeSpecific);
            console.log('  2. 回退容器:', ['.vditor-content', '.vditor', '.research-edit-body', '.research-content']);

            if (debugInfo.viewport) {
                console.log('👁️ 当前视窗:', debugInfo.viewport);
                
                // 显示模式特定信息
                console.log('🎭 模式信息:', {
                    mode: debugInfo.viewport.mode,
                    note: debugInfo.viewport.modeNote,
                    containerSelector: debugInfo.viewport.containerInfo?.selector
                });
                
                // 如果是渲染模式，尝试获取实际显示内容
                if (debugInfo.viewport.mode !== 'sv') {
                    const actualContent = this.getActualViewportContent({ includeRendered: true });
                    if (actualContent && actualContent.hasRenderedContent) {
                        console.log('🎨 渲染内容预览:', {
                            textLength: actualContent.renderedContent.text.length,
                            htmlLength: actualContent.renderedContent.html.length,
                            note: actualContent.renderedContent.note
                        });
                    }
                }
            }
            
            console.groupEnd();

            return debugInfo;

        } catch (error) {
            console.error('调试视窗信息时发生错误:', error);
                         return null;
         }
     }

    /**
     * 根据编辑器模式调整内容显示
     * @private
     * @param {Array} sourceLines - 源码行数组
     * @param {string} mode - 编辑器模式
     * @param {number} startLine - 开始行号
     * @param {number} endLine - 结束行号
     * @returns {Object} - 调整后的内容
     */
    _adjustContentForMode(sourceLines, mode, startLine, endLine) {
        try {
            switch (mode) {
                case 'sv':
                    // 源码模式：直接返回原始 Markdown
                    return {
                        content: sourceLines.join('\n'),
                        lines: sourceLines,
                        mode: 'source',
                        note: '源码模式 - 显示原始 Markdown'
                    };

                case 'wysiwyg':
                    // 所见即所得模式：提供渲染提示
                    return {
                        content: sourceLines.join('\n'),
                        lines: sourceLines,
                        mode: 'wysiwyg',
                        note: 'WYSIWYG模式 - 对应的源码内容（实际显示为渲染后的HTML）'
                    };

                case 'ir':
                    // 即时渲染模式：提供混合提示
                    return {
                        content: sourceLines.join('\n'),
                        lines: sourceLines,
                        mode: 'ir',
                        note: 'IR模式 - 对应的源码内容（实际显示为即时渲染效果）'
                    };

                default:
                    return {
                        content: sourceLines.join('\n'),
                        lines: sourceLines,
                        mode: 'unknown',
                        note: '未知模式'
                    };
            }
        } catch (error) {
            console.error('调整内容模式时发生错误:', error);
            return {
                content: sourceLines.join('\n'),
                lines: sourceLines,
                mode: 'fallback',
                note: '回退模式'
            };
        }
    }

    /**
     * 获取当前模式下的实际显示内容（实验性功能）
     * @param {Object} options - 选项配置
     * @param {boolean} options.includeRendered - 是否尝试获取渲染后的内容
     * @returns {Object|null} - 实际显示内容
     */
    getActualViewportContent(options = {}) {
        if (!this.vditorInstance) {
            console.error('编辑器实例不存在');
            return null;
        }

        const defaultOptions = {
            includeRendered: true,
            showLineNumbers: true,
            lineNumberFormat: '{line}: '
        };

        const config = { ...defaultOptions, ...options };

        try {
            // 获取基础视窗信息
            const baseViewport = this.getViewportContent({
                showLineNumbers: false,
                extraLines: 0
            });

            if (!baseViewport) {
                return null;
            }

            const mode = this.getCurrentMode();
            const result = {
                ...baseViewport,
                actualMode: mode,
                sourceContent: baseViewport.content,
                displayNote: this._getModeDisplayNote(mode)
            };

            // 如果需要获取渲染后的内容
            if (config.includeRendered && (mode === 'wysiwyg' || mode === 'ir')) {
                const renderedContent = this._extractRenderedContent(baseViewport.startLine, baseViewport.endLine);
                if (renderedContent) {
                    result.renderedContent = renderedContent;
                    result.hasRenderedContent = true;
                }
            }

            return result;

        } catch (error) {
            console.error('获取实际视窗内容时发生错误:', error);
            return null;
        }
    }

    /**
     * 获取模式显示说明
     * @private
     */
    _getModeDisplayNote(mode) {
        const notes = {
            'sv': '源码模式：显示原始 Markdown 文本，行号与源码完全对应',
            'wysiwyg': 'WYSIWYG模式：显示渲染后的富文本，行号对应源码但视觉呈现不同',
            'ir': 'IR模式：显示即时渲染效果，行号对应源码但包含渲染元素'
        };
        return notes[mode] || '未知模式';
    }

    /**
     * 尝试提取渲染后的内容（实验性）
     * @private
     */
    _extractRenderedContent(startLine, endLine) {
        try {
            const editorContainer = document.getElementById('vditor');
            if (!editorContainer) return null;

            const mode = this.getCurrentMode();
            let contentSelector;

            switch (mode) {
                case 'wysiwyg':
                    contentSelector = '.vditor-wysiwyg';
                    break;
                case 'ir':
                    contentSelector = '.vditor-ir';
                    break;
                default:
                    return null;
            }

            const contentArea = editorContainer.querySelector(contentSelector);
            if (!contentArea) return null;

            // 尝试获取可见区域的HTML内容
            const htmlContent = contentArea.innerHTML;
            
            return {
                html: htmlContent,
                text: contentArea.textContent || contentArea.innerText,
                mode: mode,
                note: `${mode}模式下的渲染内容`
            };

        } catch (error) {
            console.error('提取渲染内容时发生错误:', error);
            return null;
        }
    }
}

// 创建全局编辑器实例
window.researchEditor = new ResearchEditor(); 