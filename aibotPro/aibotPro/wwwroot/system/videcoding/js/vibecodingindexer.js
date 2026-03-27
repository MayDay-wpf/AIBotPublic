/**
 * VibeCoding File Indexer
 * 文件索引器，用于实现F12跳转功能
 * 异步加载完整文件树并建立符号索引
 */

// 添加高亮样式
const highlightStyles = `
.symbol-highlight {
    background-color: rgba(255, 230, 0, 0.15);
    border-left: 2px solid #f39c12;
}
.symbol-highlight-inline {
    background-color: rgba(255, 230, 0, 0.3);
    border-radius: 2px;
}
`;

// 添加样式到文档
(function () {
    const styleElement = document.createElement('style');
    styleElement.textContent = highlightStyles;
    document.head.appendChild(styleElement);
})();

// 全局索引器实例
let globalIndexer = null;

class VibeCodingIndexer {
    constructor() {
        // 防止重复初始化
        if (globalIndexer) {
            console.warn('VibeCodingIndexer already initialized, returning existing instance');
            return globalIndexer;
        }

        this.symbolIndex = new Map();       // 符号索引: name -> [{file, location, type, line, column}, ...]
        this.fileIndex = new Map();         // 文件索引: filePath -> fileContent (string)
        this.referenceIndex = new Map();    // 引用索引: file -> [{target, location, line, column}, ...]
        this.fileContentCache = new Map();  // 文件内容缓存: filePath -> {content, timestamp, hash}

        this.isIndexing = false;            // 是否正在索引
        this.totalFiles = 0;               // 总文件数
        this.processedFiles = 0;           // 已处理文件数
        this.monacoFeaturesRegistered = false; // Monaco功能是否已注册

        // 性能相关配置
        this.maxFileSize = 1024 * 1024;    // 最大文件大小 (1MB)
        this.maxFilesToProcess = 20000;    // 最大处理文件数量 (增加到20000)
        this.batchSize = 20;               // 批处理大小
        this.batchDelay = 0;               // 批处理延迟 (ms)
        this.useWebWorker = false;         // 是否使用Web Worker (默认关闭，仅当浏览器支持时才开启)
        this.indexingPriority = {          // 文件索引优先级
            'js': 10,
            'ts': 10,
            'jsx': 9,
            'tsx': 9,
            'vue': 8,
            'py': 7,
            'java': 6,
            'cs': 6,
            'php': 5,
            'go': 5,
            'html': 4,
            'css': 3,
            'json': 2
        };

        // 已处理文件的元数据 (用于增量索引)
        this.processedFileMeta = new Map(); // filePath -> {size, timestamp, hash}

        // 支持的文件扩展名
        this.supportedExtensions = new Set([
            'js', 'jsx', 'ts', 'tsx', 'vue', 'json', 'html', 'htm', 'css', 'scss', 'sass', 'less',
            'py', 'java', 'cs', 'php', 'go', 'rs', 'cpp', 'c', 'h', 'hpp',
            'rb', 'swift', 'kt', 'scala', 'dart', 'lua', 'r', 'pl', 'pm',
            'sh', 'bash', 'ps1', 'bat', 'cmd', 'yaml', 'yml', 'xml', 'sql'
        ]);

        // 设置全局实例
        globalIndexer = this;

        // Monaco注册标记
        this.editorActionRegistered = false;
        this.mouseHandlerRegistered = false;
        this.keyBindingRegistered = false;
        this.registeredProviders = null;

        // 事件监听器注册标记
        this.eventListenersAdded = false;
    }

    /**
     * 开始索引文件
     * 优化版本：支持增量索引
     * @param {boolean} forceReindex - 是否强制重新索引，默认为false
     */
    async startIndexing(forceReindex = false) {
        if (this.isIndexing) {
            //console.log('Indexing already in progress');
            return;
        }

        if (!openedFolderHandle) {
            //console.log('No folder opened for indexing');
            return;
        }

        // 获取开始时间
        const startTime = performance.now();

        // 判断是否执行完整索引或增量索引
        const isFullReindex = forceReindex || this.symbolIndex.size === 0;

        //console.log(`Starting ${isFullReindex ? 'full' : 'incremental'} file indexing...`);
        this.isIndexing = true;
        this.processedFiles = 0;
        this.totalFiles = 0;

        // 对于完整重建索引，清理所有数据
        if (isFullReindex) {
            this.cleanupIndexes();

            // 重置Monaco功能注册标记，允许重新注册
            this.monacoFeaturesRegistered = false;
        }

        try {
            this.showIndexingProgress();

            // 加载完整的文件树
            const basePath = '/' + openedFolderHandle.name;
            await this.loadCompleteFileTree(openedFolderHandle, basePath);

            // 处理所有文件
            await this.processAllFiles();

            // 显示完成状态
            this.showCompletedState();

            // 索引完成后注册Monaco功能
            if (window.monaco && window.monaco.editor) {
                setTimeout(() => {
                    this.registerMonacoFeatures();
                }, 300);
            }

            // 计算总耗时
            const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);

            // 清理长时间未使用的缓存
            this.cleanupUnusedCache();

            setTimeout(() => {
                this.hideIndexingProgress();
            }, 500);
        } catch (error) {
            this.hideIndexingProgress();
            console.error('Error during indexing:', error);

            if (typeof showNotification === 'function') {
                showNotification('索引过程中出错: ' + error.message, 'error');
            }
        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * 清理长时间未使用的缓存
     * 优化内存使用
     */
    cleanupUnusedCache() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30分钟

        // 清理文件内容缓存
        for (const [filePath, cacheInfo] of this.fileContentCache.entries()) {
            if (now - cacheInfo.timestamp > maxAge) {
                this.fileContentCache.delete(filePath);
            }
        }

        //console.log(`Cache cleanup completed, current cache size: ${this.fileContentCache.size} files`);
    }

    /**
     * 清理所有索引数据
     * 优化版本：支持选择性清理
     * @param {boolean} keepCache - 是否保留文件缓存，默认为false
     */
    cleanupIndexes(keepCache = false) {
        //console.log('Cleaning up indexes...');
        const startTime = performance.now();

        // 清空所有索引
        this.symbolIndex.clear();
        this.referenceIndex.clear();

        // 清理文件索引和缓存
        if (!keepCache) {
            this.fileIndex.clear();
            this.fileContentCache.clear();
            this.processedFileMeta.clear();
        }

        // 清理Monaco注册
        this.cleanupMonacoRegistrations();

        // 重置Monaco功能注册标记
        this.monacoFeaturesRegistered = false;

        // 释放内存
        this.releaseMemory();

        const cleanupTime = ((performance.now() - startTime) / 1000).toFixed(2);
        //console.log(`Indexes cleaned up successfully in ${cleanupTime}s`);
    }

    /**
     * 尝试释放内存
     */
    releaseMemory() {
        // 尝试手动触发垃圾回收
        if (window.gc) {
            window.gc();
        }

        // 在某些浏览器中可能有效的另一种方法
        if (window.performance && window.performance.memory) {
            try {
                let wastedMemory = new ArrayBuffer(1024 * 1024); // 分配1MB
                setTimeout(() => {
                    wastedMemory = null; // 立即释放
                }, 1);
            } catch (e) {
                // 忽略任何错误
            }
        }
    }

    /**
     * 异步加载完整文件树（非懒加载）
     * 优化版本，使用并行处理和扁平化结构
     */
    async loadCompleteFileTree(dirHandle, basePath) {
        try {
            // 存储目录扫描任务
            const directoryQueue = [{ dirHandle, path: basePath }];
            let fileCount = 0;

            // 获取开始时间
            const startTime = performance.now();

            // 使用迭代而非递归处理目录
            while (directoryQueue.length > 0 && fileCount < this.maxFilesToProcess) {
                // 从队列取出一个目录
                const { dirHandle: currentDir, path: currentPath } = directoryQueue.shift();

                // 使用 for await 语法迭代目录内容
                try {
                    const entries = [];

                    // 首先收集所有条目
                    for await (const [name, handle] of currentDir.entries()) {
                        entries.push({ name, handle });
                    }

                    // 处理收集的条目
                    for (const { name, handle } of entries) {
                        const fullPath = currentPath ? `${currentPath}/${name}` : name;

                        if (handle.kind === 'directory') {
                            // 跳过一些不需要索引的目录
                            if (this.shouldSkipDirectory(name)) {
                                continue;
                            }

                            // 将子目录添加到队列而不是立即处理
                            directoryQueue.push({ dirHandle: handle, path: fullPath });
                        } else if (handle.kind === 'file') {
                            // 检查文件扩展名
                            const extension = this.getFileExtension(name);
                            if (this.supportedExtensions.has(extension)) {
                                // 修复路径构建逻辑：fullPath已经包含完整路径，不需要再加项目名
                                const filePath = fullPath;

                                // 如果fileHandles中没有这个文件，添加进去
                                if (!fileHandles.has(filePath)) {
                                    fileHandles.set(filePath, handle);
                                }

                                fileCount++;

                                // 如果达到文件数限制，停止扫描
                                if (fileCount >= this.maxFilesToProcess) {
                                    console.warn(`达到最大文件数限制 (${this.maxFilesToProcess})，停止扫描`);
                                    break;
                                }
                            }
                        }
                    }
                } catch (dirError) {
                    console.error(`Error scanning directory ${currentPath}:`, dirError);
                }
            }

            this.totalFiles = fileCount;

            // 记录扫描耗时
            const scanTime = ((performance.now() - startTime) / 1000).toFixed(2);
            //console.log(`文件树扫描完成，发现 ${fileCount} 个文件，耗时 ${scanTime}s`);
        } catch (error) {
            console.error(`Error loading file tree:`, error);
        }
    }

    /**
     * 处理所有文件内容
     * 优化版本：批处理、优先级处理、并行处理
     */
    async processAllFiles() {
        // 获取开始时间
        const startTime = performance.now();

        // 获取所有支持的文件
        const files = Array.from(fileHandles.entries());
        const supportedFiles = files.filter(([path, handle]) => {
            const extension = this.getFileExtension(path);
            return this.supportedExtensions.has(extension);
        });

        // 按照文件类型优先级排序
        supportedFiles.sort((a, b) => {
            const extA = this.getFileExtension(a[0]);
            const extB = this.getFileExtension(b[0]);
            const priorityA = this.indexingPriority[extA] || 0;
            const priorityB = this.indexingPriority[extB] || 0;
            return priorityB - priorityA; // 高优先级先处理
        });

        // 如果超过最大文件数，截断
        const filesToProcess = supportedFiles.slice(0, this.maxFilesToProcess);
        this.totalFiles = filesToProcess.length;

        // 批处理文件
        for (let i = 0; i < filesToProcess.length; i += this.batchSize) {
            const batch = filesToProcess.slice(i, i + this.batchSize);

            // 并行处理当前批次的文件
            const promises = batch.map(([filePath, fileHandle]) => {
                return this.processFile(filePath, fileHandle)
                    .catch(error => {
                        console.warn(`Error processing file ${filePath}:`, error);
                    })
                    .finally(() => {
                        this.processedFiles++;
                        this.updateIndexingProgress();
                    });
            });

            // 等待当前批次完成
            await Promise.all(promises);

            // 添加延迟以避免阻塞UI
            if (this.batchDelay > 0 && i + this.batchSize < filesToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }

            // 允许用户取消
            if (!this.isIndexing) {
                //console.log('Indexing cancelled');
                break;
            }
        }

        // 记录处理耗时
        const processTime = ((performance.now() - startTime) / 1000).toFixed(2);
        //console.log(`文件处理完成，共处理 ${this.processedFiles} 个文件，耗时 ${processTime}s`);
    }

    /**
     * 处理单个文件
     * 优化版本：添加文件大小检查、内容哈希缓存
     */
    async processFile(filePath, fileHandle) {
        try {
            // 读取文件信息
            const file = await fileHandle.getFile();

            // 检查文件大小
            if (file.size > this.maxFileSize) {
                //console.log(`文件过大，跳过索引: ${filePath} (${(file.size / 1024).toFixed(1)} KB)`);
                return;
            }

            // 检查文件是否已经处理过（增量索引）
            const cachedInfo = this.processedFileMeta.get(filePath);
            if (cachedInfo && cachedInfo.size === file.size &&
                cachedInfo.lastModified === file.lastModified) {
                // 文件未变化，使用缓存结果
                if (this.fileContentCache.has(filePath)) {
                    return;
                }
            }

            // 读取文件内容
            const content = await file.text();

            // 如果文件过大，只索引部分内容（前10KB和后10KB）
            let indexContent = content;
            if (content.length > 50000) { // ~50KB
                const start = content.substring(0, 10000);
                const end = content.substring(content.length - 10000);
                indexContent = start + '\n...[content truncated]...\n' + end;
            }

            // 保存文件元数据（用于增量索引）
            this.processedFileMeta.set(filePath, {
                size: file.size,
                lastModified: file.lastModified
            });

            // 存储文件内容（用于引用查找）
            this.fileContentCache.set(filePath, {
                content: indexContent,
                timestamp: Date.now()
            });

            // 根据文件类型解析符号
            const extension = this.getFileExtension(filePath);
            await this.parseFileSymbols(filePath, indexContent, extension);

        } catch (error) {
            console.warn(`Failed to process file ${filePath}:`, error);
        }
    }

    /**
     * 解析文件符号
     */
    async parseFileSymbols(filePath, content, extension) {
        try {
            switch (extension) {
                // 前端语言
                case 'js':
                case 'ts':
                case 'jsx':
                case 'tsx':
                    this.parseJavaScriptSymbols(filePath, content);
                    break;
                case 'vue':
                    this.parseVueSymbols(filePath, content);
                    break;
                case 'json':
                    this.parseJsonSymbols(filePath, content);
                    break;
                case 'html':
                    this.parseHtmlSymbols(filePath, content);
                    break;
                case 'css':
                case 'scss':
                case 'less':
                    this.parseCssSymbols(filePath, content);
                    break;

                // 后端语言
                case 'py':
                    this.parsePythonSymbols(filePath, content);
                    break;
                case 'java':
                    this.parseJavaSymbols(filePath, content);
                    break;
                case 'cs':
                    this.parseCSharpSymbols(filePath, content);
                    break;
                case 'php':
                    this.parsePhpSymbols(filePath, content);
                    break;
                case 'go':
                    this.parseGoSymbols(filePath, content);
                    break;
                case 'rs':
                    this.parseRustSymbols(filePath, content);
                    break;
                case 'c':
                case 'cpp':
                case 'cc':
                case 'cxx':
                case 'h':
                case 'hpp':
                    this.parseCppSymbols(filePath, content);
                    break;
                case 'rb':
                    this.parseRubySymbols(filePath, content);
                    break;
                case 'swift':
                    this.parseSwiftSymbols(filePath, content);
                    break;
                case 'kt':
                    this.parseKotlinSymbols(filePath, content);
                    break;
                case 'scala':
                    this.parseScalaSymbols(filePath, content);
                    break;
                case 'dart':
                    this.parseDartSymbols(filePath, content);
                    break;

                // 脚本和配置文件
                case 'sh':
                case 'bash':
                    this.parseBashSymbols(filePath, content);
                    break;
                case 'ps1':
                    this.parsePowerShellSymbols(filePath, content);
                    break;
                case 'bat':
                case 'cmd':
                    this.parseBatchSymbols(filePath, content);
                    break;
                case 'yaml':
                case 'yml':
                    this.parseYamlSymbols(filePath, content);
                    break;
                case 'xml':
                    this.parseXmlSymbols(filePath, content);
                    break;
                case 'sql':
                    this.parseSqlSymbols(filePath, content);
                    break;

                // 其他语言
                case 'lua':
                    this.parseLuaSymbols(filePath, content);
                    break;
                case 'r':
                    this.parseRSymbols(filePath, content);
                    break;
                case 'pl':
                case 'pm':
                    this.parsePerlSymbols(filePath, content);
                    break;
            }
        } catch (error) {
            console.warn(`Error parsing symbols in ${filePath}:`, error);
        }
    }

    /**
     * 解析JavaScript/TypeScript符号（使用正则表达式）
     */
    parseJavaScriptSymbols(filePath, content) {
        try {
            const lines = content.split('\n');

            // 函数定义（包括箭头函数和普通函数）
            const functionMatches = [
                ...content.matchAll(/(?:^|\s)function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm),
                ...content.matchAll(/(?:^|\s)const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\(/gm),
                ...content.matchAll(/(?:^|\s)let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\(/gm),
                ...content.matchAll(/(?:^|\s)var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?\(/gm),
                ...content.matchAll(/(?:^|\s)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*(?:async\s+)?function/gm),
                ...content.matchAll(/(?:^|\s)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\([^)]*\)\s*=>/gm)
            ];

            for (const match of functionMatches) {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'function');
            }

            // 类定义
            const classMatches = content.matchAll(/(?:^|\s)class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm);
            for (const match of classMatches) {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'class');
            }

            // 方法定义（在类内部）
            const methodMatches = content.matchAll(/(?:^|\s)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/gm);
            for (const match of methodMatches) {
                // 排除一些明显不是方法的模式
                if (!['if', 'for', 'while', 'switch', 'catch', 'function'].includes(match[1])) {
                    this.addSymbol(match[1], filePath, {
                        line: this.getLineNumber(content, match.index),
                        column: this.getColumnNumber(content, match.index)
                    }, 'method');
                }
            }

            // 变量声明
            const varMatches = [
                ...content.matchAll(/(?:^|\s)const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm),
                ...content.matchAll(/(?:^|\s)let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm),
                ...content.matchAll(/(?:^|\s)var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm)
            ];

            for (const match of varMatches) {
                // 跳过已经作为函数处理的变量
                const line = this.getLineNumber(content, match.index);
                const lineText = lines[line - 1] || '';
                if (!lineText.includes('function') && !lineText.includes('=>')) {
                    this.addSymbol(match[1], filePath, {
                        line: line,
                        column: this.getColumnNumber(content, match.index)
                    }, 'variable');
                }
            }

            // TypeScript 接口
            const interfaceMatches = content.matchAll(/(?:^|\s)interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm);
            for (const match of interfaceMatches) {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'interface');
            }

            // TypeScript 类型别名
            const typeMatches = content.matchAll(/(?:^|\s)type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm);
            for (const match of typeMatches) {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'type');
            }

            // 导入语句
            const importMatches = content.matchAll(/import.*from\s+['"`]([^'"`]+)['"`]/gm);
            for (const match of importMatches) {
                this.addReference(filePath, match[1], {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                });
            }

        } catch (error) {
            console.warn(`Error parsing JavaScript symbols in ${filePath}:`, error);
        }
    }

    /**
     * 解析Vue文件符号
     */
    parseVueSymbols(filePath, content) {
        // 简单的Vue文件解析
        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
        if (scriptMatch) {
            this.parseJavaScriptSymbols(filePath, scriptMatch[1]);
        }

        // 提取template中的组件引用
        const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
        if (templateMatch) {
            this.parseVueTemplate(filePath, templateMatch[1]);
        }
    }

    /**
     * 解析Vue模板
     */
    parseVueTemplate(filePath, template) {
        // 提取组件标签
        const componentRegex = /<([A-Z][A-Za-z0-9-]*)/g;
        let match;
        while ((match = componentRegex.exec(template)) !== null) {
            this.addSymbol(match[1], filePath, null, 'component');
        }
    }

    /**
     * 解析JSON符号
     */
    parseJsonSymbols(filePath, content) {
        try {
            // 检查是否是有效的 JSON 格式
            if (!content.trim()) return;

            // 尝试解析 JSON，如果失败则跳过
            let parsed;
            try {
                parsed = JSON.parse(content);
            } catch (parseError) {
                console.warn(`Invalid JSON file skipped: ${filePath}`, parseError.message);
                return;
            }

            if (typeof parsed === 'object' && parsed !== null) {
                this.extractJsonKeys(parsed, filePath, '');
            }
        } catch (error) {
            console.warn(`Error parsing JSON in ${filePath}:`, error.message);
        }
    }

    /**
     * 提取JSON键
     */
    extractJsonKeys(obj, filePath, prefix) {
        if (typeof obj !== 'object' || obj === null) return;

        for (const key in obj) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            this.addSymbol(fullKey, filePath, null, 'property');

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.extractJsonKeys(obj[key], filePath, fullKey);
            }
        }
    }

    /**
     * 解析HTML符号
     */
    parseHtmlSymbols(filePath, content) {
        // 提取ID和类名
        const idRegex = /id\s*=\s*["']([^"']+)["']/g;
        const classRegex = /class\s*=\s*["']([^"']+)["']/g;

        let match;
        while ((match = idRegex.exec(content)) !== null) {
            this.addSymbol(`#${match[1]}`, filePath, null, 'id');
        }

        while ((match = classRegex.exec(content)) !== null) {
            const classes = match[1].split(/\s+/);
            classes.forEach(cls => {
                if (cls.trim()) {
                    this.addSymbol(`.${cls.trim()}`, filePath, null, 'class');
                }
            });
        }
    }

    /**
     * 解析CSS符号
     */
    parseCssSymbols(filePath, content) {
        // CSS类和ID选择器
        const classMatches = content.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)\s*\{/g);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'css-class');
        }

        const idMatches = content.matchAll(/#([a-zA-Z_-][a-zA-Z0-9_-]*)\s*\{/g);
        for (const match of idMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'css-id');
        }
    }

    /**
     * 解析Python符号
     */
    parsePythonSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 变量赋值
        const varMatches = content.matchAll(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm);
        for (const match of varMatches) {
            // 跳过在函数或类内部的变量
            const line = this.getLineNumber(content, match.index);
            const lineText = content.split('\n')[line - 1];
            if (!lineText.match(/^[ \t]{4,}/) && !lineText.match(/^\s*$/)) {
                this.addSymbol(match[1], filePath, {
                    line: line,
                    column: this.getColumnNumber(content, match.index)
                }, 'variable');
            }
        }
    }

    /**
     * 解析Java符号
     */
    parseJavaSymbols(filePath, content) {
        // 包声明
        const packageMatches = content.matchAll(/^[ \t]*package\s+([a-zA-Z_][a-zA-Z0-9_.]*);/gm);
        for (const match of packageMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'package');
        }

        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:static\s+|final\s+|abstract\s+)*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 接口定义
        const interfaceMatches = content.matchAll(/^[ \t]*(?:public\s+|private\s+|protected\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of interfaceMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'interface');
        }

        // 方法定义
        const methodMatches = content.matchAll(/^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:static\s+|final\s+|abstract\s+|synchronized\s+)*(?:[a-zA-Z_][a-zA-Z0-9_<>]*\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm);
        for (const match of methodMatches) {
            if (match[1] !== 'if' && match[1] !== 'while' && match[1] !== 'for' && match[1] !== 'switch') {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'method');
            }
        }
    }

    /**
     * 解析C#符号
     */
    parseCSharpSymbols(filePath, content) {
        try {
            const lines = content.split('\n');

            // 已处理的符号集合，避免重复处理
            const processedSymbols = new Set();

            // 解析命名空间
            const namespacePattern = /^\s*namespace\s+([A-Za-z_][\w.]*)/;
            // 解析类 - 更严格的模式
            const classPattern = /^\s*(?:public|private|protected|internal)?\s*(?:static|abstract|sealed)?\s*class\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?(?:\s*:\s*[^{]*)?/;
            // 解析接口
            const interfacePattern = /^\s*(?:public|private|protected|internal)?\s*interface\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/;
            // 解析枚举
            const enumPattern = /^\s*(?:public|private|protected|internal)?\s*enum\s+([A-Za-z_]\w*)/;
            // 解析结构
            const structPattern = /^\s*(?:public|private|protected|internal)?\s*(?:readonly\s+)?struct\s+([A-Za-z_]\w*)(?:\s*<[^>]*>)?/;
            // 解析方法 - 更严格的模式，排除属性访问器
            const methodPattern = /^\s*(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract|async)?\s*(?:\w+\s+)+([A-Za-z_]\w*)\s*\([^)]*\)\s*(?:{|;)/;
            // 解析属性
            const propertyPattern = /^\s*(?:public|private|protected|internal)?\s*(?:static|virtual|override|abstract)?\s*\w+\s+([A-Za-z_]\w*)\s*{\s*(?:get|set)/;
            // 解析字段 - 更严格的模式
            const fieldPattern = /^\s*(?:public|private|protected|internal)?\s*(?:static|readonly|const)?\s*\w+\s+([A-Za-z_]\w*)\s*[;=]/;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lineNumber = i + 1;

                // 跳过注释行和空行
                if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim() === '') {
                    continue;
                }

                let match;

                // 创建安全的位置对象
                const createLocation = (line, column = 1) => ({
                    line: line,
                    column: column
                });

                // 生成唯一键以避免重复
                const generateKey = (name, line, type) => `${name}|${line}|${type}|${filePath}`;

                if ((match = line.match(namespacePattern))) {
                    const key = generateKey(match[1], lineNumber, 'namespace');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'namespace');
                    }
                }

                if ((match = line.match(classPattern))) {
                    const key = generateKey(match[1], lineNumber, 'class');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'class');
                    }
                }

                if ((match = line.match(interfacePattern))) {
                    const key = generateKey(match[1], lineNumber, 'interface');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'interface');
                    }
                }

                if ((match = line.match(enumPattern))) {
                    const key = generateKey(match[1], lineNumber, 'enum');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'enum');
                    }
                }

                if ((match = line.match(structPattern))) {
                    const key = generateKey(match[1], lineNumber, 'struct');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'struct');
                    }
                }

                if ((match = line.match(methodPattern))) {
                    // 排除关键字和常见非方法模式
                    const name = match[1];
                    if (!['if', 'for', 'while', 'switch', 'catch', 'using', 'return', 'new', 'get', 'set', 'add', 'remove'].includes(name)) {
                        const key = generateKey(name, lineNumber, 'method');
                        if (!processedSymbols.has(key)) {
                            processedSymbols.add(key);
                            this.addSymbol(name, filePath, createLocation(lineNumber), 'method');
                        }
                    }
                }

                if ((match = line.match(propertyPattern))) {
                    const key = generateKey(match[1], lineNumber, 'property');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'property');
                    }
                }

                if ((match = line.match(fieldPattern))) {
                    const key = generateKey(match[1], lineNumber, 'field');
                    if (!processedSymbols.has(key)) {
                        processedSymbols.add(key);
                        this.addSymbol(match[1], filePath, createLocation(lineNumber), 'field');
                    }
                }
            }
        } catch (error) {
            console.warn(`Error parsing C# symbols in ${filePath}:`, error.message);
        }
    }

    /**
     * 解析PHP符号
     */
    parsePhpSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:abstract\s+|final\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*function\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 方法定义
        const methodMatches = content.matchAll(/^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of methodMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'method');
        }

        // 常量定义
        const defineMatches = content.matchAll(/define\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/gm);
        for (const match of defineMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'constant');
        }
    }

    /**
     * 解析Go符号
     */
    parseGoSymbols(filePath, content) {
        // 包声明
        const packageMatches = content.matchAll(/^[ \t]*package\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of packageMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'package');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*func\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 结构体定义
        const structMatches = content.matchAll(/^[ \t]*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct/gm);
        for (const match of structMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'struct');
        }

        // 接口定义
        const interfaceMatches = content.matchAll(/^[ \t]*type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+interface/gm);
        for (const match of interfaceMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'interface');
        }

        // 常量定义
        const constMatches = content.matchAll(/^[ \t]*const\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of constMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'constant');
        }

        // 变量定义
        const varMatches = content.matchAll(/^[ \t]*var\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of varMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'variable');
        }
    }

    /**
     * 解析Rust符号
     */
    parseRustSymbols(filePath, content) {
        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:pub\s+)?fn\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 结构体定义
        const structMatches = content.matchAll(/^[ \t]*(?:pub\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of structMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'struct');
        }

        // 枚举定义
        const enumMatches = content.matchAll(/^[ \t]*(?:pub\s+)?enum\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of enumMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'enum');
        }

        // trait定义
        const traitMatches = content.matchAll(/^[ \t]*(?:pub\s+)?trait\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of traitMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'trait');
        }

        // impl块
        const implMatches = content.matchAll(/^[ \t]*impl\s+(?:.*\s+for\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of implMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'impl');
        }
    }

    /**
     * 解析C/C++符号
     */
    parseCppSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:template\s*<[^>]*>\s*)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 结构体定义
        const structMatches = content.matchAll(/^[ \t]*(?:typedef\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of structMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'struct');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:[a-zA-Z_][a-zA-Z0-9_]*\s+)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:\{|;)/gm);
        for (const match of functionMatches) {
            if (match[1] !== 'if' && match[1] !== 'while' && match[1] !== 'for' && match[1] !== 'switch' && match[1] !== 'return') {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'function');
            }
        }

        // 宏定义
        const macroMatches = content.matchAll(/^[ \t]*#define\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of macroMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'macro');
        }
    }

    /**
     * 解析Ruby符号
     */
    parseRubySymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 模块定义
        const moduleMatches = content.matchAll(/^[ \t]*module\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of moduleMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'module');
        }

        // 方法定义
        const methodMatches = content.matchAll(/^[ \t]*def\s+([a-zA-Z_][a-zA-Z0-9_?!]*)/gm);
        for (const match of methodMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'method');
        }
    }

    /**
     * 解析Swift符号
     */
    parseSwiftSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:open\s+|public\s+|internal\s+|fileprivate\s+|private\s+)?(?:final\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 结构体定义
        const structMatches = content.matchAll(/^[ \t]*(?:public\s+|internal\s+|fileprivate\s+|private\s+)?struct\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of structMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'struct');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:open\s+|public\s+|internal\s+|fileprivate\s+|private\s+)?func\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 协议定义
        const protocolMatches = content.matchAll(/^[ \t]*(?:public\s+|internal\s+|fileprivate\s+|private\s+)?protocol\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of protocolMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'protocol');
        }
    }

    /**
     * 解析Kotlin符号
     */
    parseKotlinSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:open\s+|public\s+|internal\s+|private\s+)?(?:data\s+|sealed\s+|abstract\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:open\s+|public\s+|internal\s+|private\s+)?(?:suspend\s+)?fun\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 接口定义
        const interfaceMatches = content.matchAll(/^[ \t]*(?:public\s+|internal\s+|private\s+)?interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of interfaceMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'interface');
        }
    }

    /**
     * 解析Scala符号
     */
    parseScalaSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:sealed\s+|abstract\s+|final\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 对象定义
        const objectMatches = content.matchAll(/^[ \t]*object\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of objectMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'object');
        }

        // 方法定义
        const methodMatches = content.matchAll(/^[ \t]*def\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of methodMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'method');
        }
    }

    /**
     * 解析Dart符号
     */
    parseDartSymbols(filePath, content) {
        // 类定义
        const classMatches = content.matchAll(/^[ \t]*(?:abstract\s+)?class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of classMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'class');
        }

        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:[a-zA-Z_][a-zA-Z0-9_<>]*\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)\s*(?:\{|=>)/gm);
        for (const match of functionMatches) {
            if (match[1] !== 'if' && match[1] !== 'while' && match[1] !== 'for' && match[1] !== 'switch') {
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'function');
            }
        }
    }

    /**
     * 解析Bash符号
     */
    parseBashSymbols(filePath, content) {
        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*\)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 变量定义
        const varMatches = content.matchAll(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm);
        for (const match of varMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'variable');
        }
    }

    /**
     * 解析PowerShell符号
     */
    parsePowerShellSymbols(filePath, content) {
        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*function\s+([a-zA-Z_][a-zA-Z0-9_-]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 变量定义
        const varMatches = content.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm);
        for (const match of varMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'variable');
        }
    }

    /**
     * 解析批处理符号
     */
    parseBatchSymbols(filePath, content) {
        // 标签定义
        const labelMatches = content.matchAll(/^[ \t]*:([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of labelMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'label');
        }

        // 变量定义
        const varMatches = content.matchAll(/set\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/gm);
        for (const match of varMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'variable');
        }
    }

    /**
     * 解析YAML符号
     */
    parseYamlSymbols(filePath, content) {
        // 顶级键
        const keyMatches = content.matchAll(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm);
        for (const match of keyMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'key');
        }
    }

    /**
     * 解析XML符号
     */
    parseXmlSymbols(filePath, content) {
        // 元素标签
        const elementMatches = content.matchAll(/<([a-zA-Z_][a-zA-Z0-9_-]*)/g);
        const uniqueElements = new Set();
        for (const match of elementMatches) {
            if (!uniqueElements.has(match[1])) {
                uniqueElements.add(match[1]);
                this.addSymbol(match[1], filePath, {
                    line: this.getLineNumber(content, match.index),
                    column: this.getColumnNumber(content, match.index)
                }, 'element');
            }
        }

        // ID属性
        const idMatches = content.matchAll(/id\s*=\s*["']([^"']+)["']/g);
        for (const match of idMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'id');
        }
    }

    /**
     * 解析SQL符号
     */
    parseSqlSymbols(filePath, content) {
        // 表定义
        const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi);
        for (const match of tableMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'table');
        }

        // 视图定义
        const viewMatches = content.matchAll(/CREATE\s+VIEW\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
        for (const match of viewMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'view');
        }

        // 存储过程定义
        const procedureMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
        for (const match of procedureMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'procedure');
        }

        // 函数定义
        const functionMatches = content.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }
    }

    /**
     * 解析Lua符号
     */
    parseLuaSymbols(filePath, content) {
        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*(?:local\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 局部变量定义
        const localMatches = content.matchAll(/^[ \t]*local\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of localMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'variable');
        }
    }

    /**
     * 解析R符号
     */
    parseRSymbols(filePath, content) {
        // 函数定义
        const functionMatches = content.matchAll(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_.]*)\s*<-\s*function/gm);
        for (const match of functionMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'function');
        }

        // 变量赋值
        const varMatches = content.matchAll(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_.]*)\s*<-/gm);
        for (const match of varMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'variable');
        }
    }

    /**
     * 解析Perl符号
     */
    parsePerlSymbols(filePath, content) {
        // 子程序定义
        const subMatches = content.matchAll(/^[ \t]*sub\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
        for (const match of subMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'subroutine');
        }

        // 包定义
        const packageMatches = content.matchAll(/^[ \t]*package\s+([a-zA-Z_][a-zA-Z0-9_:]*)/gm);
        for (const match of packageMatches) {
            this.addSymbol(match[1], filePath, {
                line: this.getLineNumber(content, match.index),
                column: this.getColumnNumber(content, match.index)
            }, 'package');
        }
    }

    /**
     * 添加符号到索引
     */
    addSymbol(name, filePath, location, type) {
        if (!name || !filePath) return;

        if (!this.symbolIndex.has(name)) {
            this.symbolIndex.set(name, []);
        }

        // 确保 location 对象的安全性
        let safeLocation = { line: 1, column: 1 };
        if (location) {
            if (location.start) {
                safeLocation.line = location.start.line || 1;
                safeLocation.column = location.start.column || 1;
            } else if (location.line !== undefined) {
                safeLocation.line = location.line;
                safeLocation.column = location.column || 1;
            }
        }

        const symbolDef = {
            file: filePath,
            location: location,
            type: type,
            line: safeLocation.line,
            column: safeLocation.column
        };

        // 更严格的重复检查：检查文件、行号、列号和类型是否完全相同
        const existingDefinitions = this.symbolIndex.get(name);

        // 生成唯一标识符用于更精确的去重
        const uniqueId = `${symbolDef.file}|${symbolDef.line}|${symbolDef.column}|${symbolDef.type}`;

        const isDuplicate = existingDefinitions.some(def => {
            const existingId = `${def.file}|${def.line}|${def.column}|${def.type}`;
            return existingId === uniqueId;
        });

        // 只有不重复的定义才添加
        if (!isDuplicate) {
            this.symbolIndex.get(name).push(symbolDef);
        } else {
            // 调试信息：记录被跳过的重复符号
            console.debug(`Skipped duplicate symbol: ${name} at ${filePath}:${safeLocation.line}:${safeLocation.column} (${type})`);
        }
    }

    /**
     * 添加引用关系
     */
    addReference(fromFile, toFile, location) {
        if (!this.referenceIndex.has(fromFile)) {
            this.referenceIndex.set(fromFile, []);
        }

        // 确保 location 对象的安全性
        let safeLocation = { line: 1, column: 1 };
        if (location) {
            if (location.start) {
                safeLocation.line = location.start.line || 1;
                safeLocation.column = location.start.column || 1;
            } else if (location.line !== undefined) {
                safeLocation.line = location.line;
                safeLocation.column = location.column || 1;
            }
        }

        this.referenceIndex.get(fromFile).push({
            target: toFile,
            location: location,
            line: safeLocation.line,
            column: safeLocation.column
        });
    }

    /**
     * 调试方法：检查编辑器状态
     */
    debugEditorStatus() {
        //console.log('=== Editor Debug Info ===');
        //console.log('window.monaco:', !!window.monaco);
        //console.log('window.monaco.editor:', !!(window.monaco && window.monaco.editor));
        //console.log('window.monaco.editor.addEditorAction:', !!(window.monaco && window.monaco.editor && window.monaco.editor.addEditorAction));
        //console.log('window.editor:', !!window.editor);
        //console.log('global editor:', typeof editor !== 'undefined' ? !!editor : 'undefined');

        // 检查编辑器实例
        const editorInstance = window.editor || (typeof editor !== 'undefined' ? editor : null);
        if (editorInstance) {
            //console.log('Editor instance found:', typeof editorInstance);
            //console.log('Available methods:', Object.getOwnPropertyNames(editorInstance).filter(name =>
            //    typeof editorInstance[name] === 'function'
            //).slice(0, 15));

            // 检查关键方法
            const keyMethods = ['setPosition', 'getPosition', 'getModel', 'revealLineInCenter', 'focus', 'onMouseDown'];
            keyMethods.forEach(method => {
                //console.log(`${method}:`, typeof editorInstance[method]);
            });
        } else {
            //console.log('No editor instance found');
        }

        //console.log('Symbol index size:', this.symbolIndex.size);
        //console.log('File index size:', this.fileIndex.size);
        //console.log('=========================');
    }

    /**
     * 注册Monaco编辑器功能
     */
    registerMonacoFeatures() {
        // 检查Monaco是否可用
        if (!window.monaco || !window.monaco.editor) {
            console.warn('Monaco editor not available, retrying in 1 second...');
            setTimeout(() => this.registerMonacoFeatures(), 1000);
            return;
        }

        // 检查编辑器实例是否存在
        const editorInstance = window.editor || (typeof editor !== 'undefined' ? editor : null);
        if (!editorInstance) {
            console.warn('Editor instance not ready, retrying in 1 second...');
            setTimeout(() => this.registerMonacoFeatures(), 1000);
            return;
        }

        // 检查是否已经注册过，避免重复注册
        if (this.monacoFeaturesRegistered) {
            //console.log('Monaco features already registered, skipping...');
            return;
        }

        try {
            // 为所有支持的语言注册功能
            const supportedLanguages = [
                'javascript', 'typescript', 'vue', 'json', 'html', 'css', 'scss', 'less',
                'python', 'java', 'csharp', 'php', 'go', 'rust', 'cpp', 'c',
                'ruby', 'swift', 'kotlin', 'scala', 'dart', 'shell', 'powershell',
                'yaml', 'xml', 'sql', 'lua', 'r', 'perl'
            ];

            // 存储provider引用以便后续清理
            if (!this.registeredProviders) {
                this.registeredProviders = {
                    definition: null,
                    reference: null,
                    hover: null,
                    action: null,
                    mouseHandler: null
                };
            }

            // 清理之前的注册（如果存在）
            this.cleanupMonacoRegistrations();

            // 注册定义提供者
            this.registeredProviders.definition = monaco.languages.registerDefinitionProvider(supportedLanguages, {
                provideDefinition: (model, position) => {
                    return this.provideDefinition(model, position);
                }
            });

            // 添加定义处理命令
            // 添加自定义命令处理器，用于拦截跳转到定义的请求
            monaco.editor.registerCommand('editor.action.revealDefinition', async (_accessor, ...args) => {
                const editorInst = window.editor || (typeof editor !== 'undefined' ? editor : null);
                if (!editorInst) return false;

                const position = editorInst.getPosition();
                if (!position) return false;

                const model = editorInst.getModel();
                if (!model) return false;

                const word = model.getWordAtPosition(position);
                if (!word) return false;

                const symbolName = word.word;
                const definitions = this.symbolIndex.get(symbolName);

                if (!definitions || definitions.length === 0) {
                    return false; // 让Monaco继续默认行为
                }

                // 如果有多个定义，显示选择列表
                if (definitions.length > 1) {
                    this.showDefinitionSelector(definitions, symbolName);
                    return true; // 已处理
                } else {
                    // 直接跳转到唯一定义
                    const def = definitions[0];
                    await jumpToSymbol(def.file, def.line, def.column);
                    return true; // 已处理
                }
            });

            // 注册引用提供者
            this.registeredProviders.reference = monaco.languages.registerReferenceProvider(supportedLanguages, {
                provideReferences: (model, position, context) => {
                    return this.provideReferences(model, position, context);
                }
            });

            // 注册悬停提供者
            this.registeredProviders.hover = monaco.languages.registerHoverProvider(supportedLanguages, {
                provideHover: (model, position) => {
                    return this.provideHover(model, position);
                }
            });

            // 注册编辑器动作 - 检查是否已经注册过
            this.registeredProviders.action = window.monaco.editor.addEditorAction({
                id: 'custom-go-to-definition',
                label: '跳转到定义',
                keybindings: [monaco.KeyCode.F12],
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.5,
                run: async (currentEditor) => {
                    const position = currentEditor.getPosition();
                    const model = currentEditor.getModel();

                    if (!position || !model) return;

                    const word = model.getWordAtPosition(position);
                    if (!word) return;

                    const symbolName = word.word;
                    const definitions = this.symbolIndex.get(symbolName);

                    if (!definitions || definitions.length === 0) {
                        if (typeof showNotification === 'function') {
                            showNotification(`未找到符号 "${symbolName}" 的定义`, 'warning');
                        } else {
                            //console.log(`未找到符号 "${symbolName}" 的定义`);
                        }
                        return;
                    }

                    // 如果有多个定义，显示选择列表
                    if (definitions.length > 1) {
                        this.showDefinitionSelector(definitions, symbolName);
                    } else {
                        // 直接跳转到唯一定义
                        const def = definitions[0];
                        await jumpToSymbol(def.file, def.line, def.column);
                    }
                }
            });

            // 注册Ctrl+Click跳转功能 - 检查是否已经注册过
            this.registeredProviders.mouseHandler = editorInstance.onMouseDown(async (e) => {
                if (e.event.ctrlKey && e.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT) {
                    const position = e.target.position;
                    if (!position) return;

                    const word = editorInstance.getModel().getWordAtPosition(position);
                    if (!word) return;

                    const symbolName = word.word;
                    const definitions = this.symbolIndex.get(symbolName);

                    if (definitions && definitions.length > 0) {
                        e.event.preventDefault();

                        if (definitions.length > 1) {
                            this.showDefinitionSelector(definitions, symbolName);
                        } else {
                            const def = definitions[0];
                            await jumpToSymbol(def.file, def.line, def.column);
                        }
                    }
                }
            });

            window.monaco.editor.addKeybindingRule({
                keybinding: monaco.KeyCode.F12,
                command: 'custom-go-to-definition'
            });

            // 标记为已注册
            this.monacoFeaturesRegistered = true;
            //console.log('Monaco editor features registered successfully');
        } catch (error) {
            console.error('Error registering Monaco features:', error);
        }
    }

    /**
     * 清理Monaco注册
     */
    cleanupMonacoRegistrations() {
        if (this.registeredProviders) {
            // 清理定义提供者
            if (this.registeredProviders.definition) {
                this.registeredProviders.definition.dispose();
                this.registeredProviders.definition = null;
            }

            // 清理引用提供者
            if (this.registeredProviders.reference) {
                this.registeredProviders.reference.dispose();
                this.registeredProviders.reference = null;
            }

            // 清理悬停提供者
            if (this.registeredProviders.hover) {
                this.registeredProviders.hover.dispose();
                this.registeredProviders.hover = null;
            }

            // 清理鼠标处理器
            if (this.registeredProviders.mouseHandler) {
                this.registeredProviders.mouseHandler.dispose();
                this.registeredProviders.mouseHandler = null;
            }
        }

        // 重置注册标记
        this.editorActionRegistered = false;
        this.mouseHandlerRegistered = false;
        this.keyBindingRegistered = false;

        //console.log('Monaco registrations cleaned up');
    }

    /**
     * 显示定义选择器
     */
    showDefinitionSelector(definitions, symbolName) {
        const selectorHtml = `
            <div id="definition-selector" class="definition-selector-overlay">
                <div class="definition-selector-content">
                    <div class="definition-selector-header">
                        <div class="definition-selector-title">
                            <i class="fas fa-code"></i> 选择 "${symbolName}" 的定义
                        </div>
                        <button class="definition-selector-close" id="definition-selector-close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="definition-selector-list">
                        ${definitions.map((def, index) => {
            const fileName = def.file.split('/').pop();
            const typeIcon = getSymbolTypeIcon(def.type);
            return `
                                <div class="definition-selector-item" data-index="${index}">
                                    <div class="definition-selector-item-icon">${typeIcon}</div>
                                    <div class="definition-selector-item-info">
                                        <div class="definition-selector-item-name">${symbolName}</div>
                                        <div class="definition-selector-item-location">${fileName}:${def.line}</div>
                                    </div>
                                    <div class="definition-selector-item-type">${def.type}</div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `;

        $('body').append(selectorHtml);

        // 绑定事件
        $('#definition-selector-close').on('click', () => {
            $('#definition-selector').remove();
        });

        $('.definition-selector-item').on('click', async function () {
            const index = parseInt($(this).data('index'));
            const def = definitions[index];
            await jumpToSymbol(def.file, def.line, def.column);
            $('#definition-selector').remove();
        });

        // ESC键关闭
        $(document).on('keydown.definition-selector', function (e) {
            if (e.key === 'Escape') {
                $('#definition-selector').remove();
                $(document).off('keydown.definition-selector');
            }
        });
    }

    /**
     * 提供定义跳转
     */
    provideDefinition(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const symbolName = word.word;
        const definitions = this.symbolIndex.get(symbolName);

        if (!definitions || definitions.length === 0) {
            return null;
        }

        // 如果有多个定义，优先选择当前文件外的定义
        const currentUri = model.uri.toString();
        const externalDefinitions = definitions.filter(def =>
            !currentUri.endsWith(def.file.replace(/^\//, ''))
        );

        const targetDefinitions = externalDefinitions.length > 0 ? externalDefinitions : definitions;

        // 在返回定义之前，确保文件存在
        const validDefinitions = targetDefinitions.filter(def => {
            // 检查文件是否存在于fileHandles中
            return fileHandles.has(def.file);
        });

        if (validDefinitions.length === 0) {
            return null;
        }

        return validDefinitions.map(def => {
            // 为了避免"Model not found"错误，改用自定义跳转处理
            // 不再依赖Monaco自动打开文件
            return {
                uri: model.uri, // 使用当前模型的URI，避免Monaco尝试打开不存在的文件
                range: new monaco.Range(
                    def.line,
                    def.column,
                    def.line,
                    def.column + symbolName.length
                ),
                _customJump: true,
                _targetFile: def.file,
                _targetLine: def.line,
                _targetColumn: def.column
            };
        });
    }

    /**
     * 提供引用查找
     */
    provideReferences(model, position, context) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const symbolName = word.word;
        const references = [];

        // 查找符号定义
        const definitions = this.symbolIndex.get(symbolName);
        if (definitions) {
            references.push(...definitions.map(def => ({
                uri: monaco.Uri.file(def.file),
                range: new monaco.Range(
                    def.line,
                    def.column,
                    def.line,
                    def.column + symbolName.length
                )
            })));
        }

        // 搜索所有文件中的引用
        for (const [filePath, content] of this.fileIndex.entries()) {
            const lines = content.split('\n');
            lines.forEach((line, lineIndex) => {
                const regex = new RegExp(`\\b${symbolName}\\b`, 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    references.push({
                        uri: monaco.Uri.file(filePath),
                        range: new monaco.Range(
                            lineIndex + 1,
                            match.index + 1,
                            lineIndex + 1,
                            match.index + 1 + symbolName.length
                        )
                    });
                }
            });
        }

        return references;
    }

    /**
     * 提供悬停信息
     */
    provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const symbolName = word.word;
        const definitions = this.symbolIndex.get(symbolName);

        if (!definitions || definitions.length === 0) {
            return null;
        }

        // 使用Map来确保唯一性，键为完整的标识符
        const uniqueDefinitions = new Map();

        definitions.forEach(def => {
            // 创建完整的唯一标识符，包括文件路径、行号、列号和类型
            const uniqueKey = `${def.file}|${def.line}|${def.column || 1}|${def.type}`;

            // 只有当这个唯一标识符不存在时才添加
            if (!uniqueDefinitions.has(uniqueKey)) {
                uniqueDefinitions.set(uniqueKey, def);
            }
        });

        // 转换为数组并生成悬停内容
        const uniqueArray = Array.from(uniqueDefinitions.values());

        if (uniqueArray.length === 0) {
            return null;
        }

        // 生成悬停内容，再次确保内容不重复
        const contentMap = new Map();

        uniqueArray.forEach(def => {
            const fileName = def.file.split('/').pop();
            const relativePath = def.file.length > 50 ? '...' + def.file.slice(-47) : def.file;

            // 生成悬停内容
            const content = `**${def.type}** \`${symbolName}\`\n\n📁 ${relativePath}:${def.line}${def.column && def.column > 1 ? `:${def.column}` : ''}`;

            // 使用内容本身作为键来避免重复的显示内容
            const contentKey = `${def.type}|${fileName}|${def.line}|${def.column || 1}`;

            if (!contentMap.has(contentKey)) {
                contentMap.set(contentKey, {
                    value: content
                });
            }
        });

        const hoverContents = Array.from(contentMap.values());

        // 如果没有有效内容，返回null
        if (hoverContents.length === 0) {
            return null;
        }

        // 限制显示的定义数量，避免悬停框过大
        const maxContents = 3;
        const contents = hoverContents.slice(0, maxContents);

        // 如果有更多定义，添加提示
        if (hoverContents.length > maxContents) {
            contents.push({
                value: `\n*...还有 ${hoverContents.length - maxContents} 个定义，按 F12 查看全部*`
            });
        }

        return {
            range: new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn
            ),
            contents: contents
        };
    }

    /**
     * 搜索符号
     */
    searchSymbol(query) {
        const results = [];
        const lowerQuery = query.toLowerCase();

        for (const [symbolName, definitions] of this.symbolIndex.entries()) {
            if (symbolName.toLowerCase().includes(lowerQuery)) {
                results.push(...definitions.map(def => ({
                    name: symbolName,
                    ...def
                })));
            }
        }

        return results.sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * 获取文件扩展名
     */
    getFileExtension(filePath) {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot > 0 ? filePath.substring(lastDot + 1).toLowerCase() : '';
    }

    /**
     * 是否跳过目录
     * 优化版本：更全面的跳过目录列表
     */
    shouldSkipDirectory(dirName) {
        // 通用跳过目录
        const skipDirs = [
            // 依赖管理
            'node_modules', 'vendor', 'bower_components', 'jspm_packages', 'packages',
            // 版本控制
            '.git', '.svn', '.hg', '.bzr', 'CVS',
            // 构建目录
            'dist', 'build', 'out', 'target', 'output', 'bin', 'obj',
            // Web框架
            '.next', '.nuxt', '.vuepress', 'public', '.netlify',
            // 缓存
            '.cache', '.temp', 'tmp', 'temp', 'cache',
            // IDE和配置
            '.vscode', '.idea', '.vs', '.settings', '.project', '.classpath',
            // 测试和覆盖率
            'coverage', '.nyc_output', 'test_results', '__tests__', 'tests',
            // 虚拟环境
            '__pycache__', 'venv', 'env', '.env', 'virtualenv', '.venv', 'site-packages',
            // 日志和临时文件
            'logs', 'log', 'var', 'storage',
            // 其他
            'assets', 'images', 'img', 'fonts', 'videos', 'audio',
            'docs', 'documentation', 'locales', 'i18n', 'l10n',
            'migrations', 'fixtures', 'uploads'
        ];

        // 缩短的目录名也跳过 (如 dist => d, build => b 等)
        const shortSkipDirs = ['d', 'b', 'o', 't'];

        // 正则匹配的目录
        const regexMatches = [
            /^\d+$/, // 纯数字
            /^deps-[\w-]+$/, // deps-开头
            /^[a-f0-9]{32}$/, // MD5哈希
            /^[a-f0-9]{40}$/, // SHA1哈希
            /^[\w-]+\-bundle$/, // bundle结尾
            /^[\w-]+\-cache$/, // cache结尾
            /^[\w-]+\-temp$/, // temp结尾
            /^[\w-]+\-tmp$/, // tmp结尾
            /^[\w-]+\-logs?$/ // log/logs结尾
        ];

        // 检查目录名是否符合跳过条件
        if (skipDirs.includes(dirName)) return true;
        if (shortSkipDirs.includes(dirName)) return true;
        if (dirName.startsWith('.')) return true;
        if (regexMatches.some(regex => regex.test(dirName))) return true;

        // 额外的跳过条件：长度太短的目录
        if (dirName.length <= 1) return true;

        return false;
    }

    /**
     * 显示索引进度
     */
    showIndexingProgress() {
        if ($('#indexing-progress').length === 0) {
            const progressHtml = `
                <div id="indexing-progress" class="indexing-progress-overlay">
                    <div class="indexing-progress-content">
                        <div class="indexing-progress-header">
                            <i class="fas fa-sync-alt"></i> 正在建立文件索引
                        </div>
                        <div class="indexing-progress-bar-container">
                            <div class="indexing-progress-bar">
                                <div class="indexing-progress-fill" id="indexing-progress-fill"></div>
                            </div>
                            <div class="indexing-progress-text" id="indexing-progress-text">
                                准备中...
                            </div>
                        </div>
                        <button class="indexing-progress-close" id="indexing-progress-close" title="隐藏进度">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
            $('body').append(progressHtml);

            // 绑定关闭按钮事件
            $('#indexing-progress-close').on('click', () => {
                this.hideIndexingProgress();
            });
        }
        $('#indexing-progress').addClass('show');
        $('body').addClass('indexing-active');
    }

    /**
     * 更新索引进度
     */
    updateIndexingProgress() {
        if (this.totalFiles > 0) {
            const progress = Math.round((this.processedFiles / this.totalFiles) * 100);
            $('#indexing-progress-fill').css('width', `${progress}%`);
            $('#indexing-progress-text').text(`${this.processedFiles}/${this.totalFiles} 个文件 (${progress}%)`);
        }
    }

    /**
     * 显示完成状态
     */
    showCompletedState() {
        const progressElement = $('#indexing-progress');
        if (progressElement.length > 0) {
            progressElement.addClass('completed');
            $('#indexing-progress-fill').css('width', '100%');
            $('#indexing-progress-text').text(`完成! ${this.symbolIndex.size} 个符号`);

            // 更新图标和文本
            const header = progressElement.find('.indexing-progress-header');
            header.html('<i class="fas fa-check"></i> 索引完成');
        }
    }

    /**
     * 隐藏索引进度
     */
    hideIndexingProgress() {
        $('#indexing-progress').removeClass('show');
        $('body').removeClass('indexing-active');
        // 延迟删除元素，等待动画完成
        setTimeout(() => {
            $('#indexing-progress').remove();
        }, 100);
    }

    /**
     * 获取索引统计信息
     */
    getIndexStats() {
        return {
            totalFiles: this.processedFiles,
            totalSymbols: this.symbolIndex.size,
            symbolsByType: this.getSymbolsByType()
        };
    }

    /**
     * 按类型分组符号统计
     */
    getSymbolsByType() {
        const stats = {};
        for (const definitions of this.symbolIndex.values()) {
            for (const def of definitions) {
                stats[def.type] = (stats[def.type] || 0) + 1;
            }
        }
        return stats;
    }

    /**
     * 调试函数：检查符号重复
     */
    checkForDuplicates() {
        //console.log('=== Checking for duplicate symbols ===');

        let totalDuplicates = 0;
        const duplicateReport = {};

        for (const [symbolName, definitions] of this.symbolIndex.entries()) {
            if (definitions.length > 1) {
                // 检查是否是真正的重复（完全相同的定义）
                const uniqueSignatures = new Set();
                const duplicates = [];

                definitions.forEach((def, index) => {
                    const signature = `${def.file}|${def.line}|${def.column}|${def.type}`;
                    if (uniqueSignatures.has(signature)) {
                        duplicates.push({ index, def, signature });
                        totalDuplicates++;
                    } else {
                        uniqueSignatures.add(signature);
                    }
                });

                if (duplicates.length > 0) {
                    duplicateReport[symbolName] = {
                        total: definitions.length,
                        unique: uniqueSignatures.size,
                        duplicates: duplicates
                    };
                }
            }
        }

        if (totalDuplicates > 0) {
            console.warn(`Found ${totalDuplicates} duplicate symbols:`, duplicateReport);
        } else {
            //console.log('No duplicate symbols found.');
        }

        return {
            totalDuplicates,
            duplicateReport
        };
    }

    /**
     * 根据字符索引获取行号
     * @param {string} content - 文件内容
     * @param {number} index - 字符索引
     * @returns {number} 行号（从1开始）
     */
    getLineNumber(content, index) {
        if (index <= 0) return 1;

        let lineNumber = 1;
        for (let i = 0; i < index && i < content.length; i++) {
            if (content[i] === '\n') {
                lineNumber++;
            }
        }
        return lineNumber;
    }

    /**
     * 根据字符索引获取列号
     * @param {string} content - 文件内容
     * @param {number} index - 字符索引
     * @returns {number} 列号（从1开始）
     */
    getColumnNumber(content, index) {
        if (index <= 0) return 1;

        let column = 1;
        for (let i = index - 1; i >= 0; i--) {
            if (content[i] === '\n') {
                break;
            }
            column++;
        }
        return column;
    }
}

/**
 * 添加索引器状态栏按钮和配置选项
 */
function addIndexerStatusBarButtons() {
    // 检查是否已经添加过按钮，避免重复
    if ($('.indexer-buttons').length > 0) {
        return;
    }

    const buttonsHtml = `
        <div class="indexer-buttons">
            <button class="indexer-btn" id="manual-index-btn" title="重新索引当前文件夹">
                <i class="fas fa-sync"></i> 索引
            </button>
            <button class="indexer-btn" id="indexer-config-btn" title="索引器配置">
                <i class="fas fa-cog"></i>
            </button>
        </div>
    `;

    // 在状态栏右侧添加按钮
    $('.status-right').prepend(buttonsHtml);

    // 绑定事件处理器
    $('#manual-index-btn').off('click.indexer').on('click.indexer', function () {
        if (globalIndexer && !globalIndexer.isIndexing) {
            globalIndexer.startIndexing();
        }
    });

    // 添加配置面板按钮事件
    $('#indexer-config-btn').off('click.indexer').on('click.indexer', function () {
        showIndexerConfigPanel();
    });
}

/**
 * 显示索引器配置面板
 */
function showIndexerConfigPanel() {
    if (!globalIndexer) return;

    // 创建配置面板HTML
    const configPanelHtml = `
        <div id="indexer-config-panel" class="indexer-config-panel">
            <div class="indexer-config-header">
                <div class="indexer-config-title">索引器配置</div>
                <button id="indexer-config-close" class="indexer-config-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="indexer-config-content">
                <div class="indexer-config-section">
                    <h3>性能设置</h3>
                    <div class="indexer-config-item">
                        <label for="indexer-max-files">最大文件数量:</label>
                        <input type="number" id="indexer-max-files" min="100" max="50000" value="${globalIndexer.maxFilesToProcess}">
                    </div>
                    <div class="indexer-config-item">
                        <label for="indexer-max-filesize">最大文件大小 (KB):</label>
                        <input type="number" id="indexer-max-filesize" min="10" max="10000" value="${Math.floor(globalIndexer.maxFileSize / 1024)}">
                    </div>
                    <div class="indexer-config-item">
                        <label for="indexer-batch-size">批处理大小:</label>
                        <input type="number" id="indexer-batch-size" min="1" max="100" value="${globalIndexer.batchSize}">
                    </div>
                    <div class="indexer-config-item">
                        <label for="indexer-batch-delay">批处理延迟 (ms):</label>
                        <input type="number" id="indexer-batch-delay" min="0" max="1000" value="${globalIndexer.batchDelay}">
                    </div>
                </div>
                <div class="indexer-config-section">
                    <h3>操作</h3>
                    <div class="indexer-config-actions">
                        <button id="indexer-incremental" class="indexer-action-btn"><i class="fas fa-sync"></i> 增量索引</button>
                        <button id="indexer-full-reindex" class="indexer-action-btn"><i class="fas fa-sync-alt"></i> 完全重建索引</button>
                        <button id="indexer-clear-cache" class="indexer-action-btn"><i class="fas fa-trash"></i> 清理缓存</button>
                    </div>
                </div>
                <div class="indexer-config-section">
                    <h3>状态</h3>
                    <div class="indexer-config-status">
                        <div>已索引文件: <span id="indexer-stat-files">${globalIndexer.processedFiles}</span></div>
                        <div>符号数量: <span id="indexer-stat-symbols">${globalIndexer.symbolIndex.size}</span></div>
                        <div>缓存大小: <span id="indexer-stat-cache">${globalIndexer.fileContentCache.size}</span> 个文件</div>
                    </div>
                </div>
            </div>
            <div class="indexer-config-footer">
                <button id="indexer-config-save" class="indexer-config-save-btn">保存配置</button>
            </div>
        </div>
    `;

    // 添加面板到DOM
    if ($('#indexer-config-panel').length === 0) {
        $('body').append(configPanelHtml);

        // 绑定关闭按钮
        $('#indexer-config-close').on('click', function () {
            $('#indexer-config-panel').remove();
        });

        // 绑定保存按钮
        $('#indexer-config-save').on('click', function () {
            saveIndexerConfig();
            $('#indexer-config-panel').remove();
        });

        // 绑定操作按钮
        $('#indexer-incremental').on('click', function () {
            if (globalIndexer && !globalIndexer.isIndexing) {
                $('#indexer-config-panel').remove();
                globalIndexer.startIndexing(false); // 增量索引
            }
        });

        $('#indexer-full-reindex').on('click', function () {
            if (globalIndexer && !globalIndexer.isIndexing) {
                $('#indexer-config-panel').remove();
                globalIndexer.startIndexing(true); // 完全重建索引
            }
        });

        $('#indexer-clear-cache').on('click', function () {
            if (globalIndexer) {
                globalIndexer.fileContentCache.clear();
                globalIndexer.processedFileMeta.clear();
                $('#indexer-stat-cache').text('0');

                if (typeof showNotification === 'function') {
                    showNotification('索引缓存已清理', 'info');
                }
            }
        });
    }
}

/**
 * 保存索引器配置
 */
function saveIndexerConfig() {
    if (!globalIndexer) return;

    const maxFiles = parseInt($('#indexer-max-files').val(), 10);
    const maxFileSize = parseInt($('#indexer-max-filesize').val(), 10) * 1024; // 转换为字节
    const batchSize = parseInt($('#indexer-batch-size').val(), 10);
    const batchDelay = parseInt($('#indexer-batch-delay').val(), 10);

    // 验证并更新配置
    if (maxFiles >= 100 && maxFiles <= 50000) {
        globalIndexer.maxFilesToProcess = maxFiles;
    }

    if (maxFileSize >= 10 * 1024 && maxFileSize <= 10000 * 1024) {
        globalIndexer.maxFileSize = maxFileSize;
    }

    if (batchSize >= 1 && batchSize <= 100) {
        globalIndexer.batchSize = batchSize;
    }

    if (batchDelay >= 0 && batchDelay <= 1000) {
        globalIndexer.batchDelay = batchDelay;
    }

    // 尝试保存配置到localStorage
    try {
        localStorage.setItem('vibeIndexerConfig', JSON.stringify({
            maxFilesToProcess: globalIndexer.maxFilesToProcess,
            maxFileSize: globalIndexer.maxFileSize,
            batchSize: globalIndexer.batchSize,
            batchDelay: globalIndexer.batchDelay
        }));
    } catch (e) {
        console.error('Failed to save indexer config:', e);
    }

    if (typeof showNotification === 'function') {
        showNotification('索引器配置已保存', 'success');
    }
}
/**
 * 隐藏符号搜索面板
 */
function hideSymbolSearchPanel() {
    $('#symbol-search-overlay').fadeOut(200);
}

// 全局索引器实例
let vibeCodingIndexer = null;

/**
 * 初始化索引器
 */
function initializeIndexer() {
    // 如果已经有全局索引器实例，直接返回
    if (globalIndexer) {
        //console.log('Using existing indexer instance');
        return globalIndexer;
    }

    //console.log('Initializing VibeCoding Indexer...');

    // 创建索引器实例
    const indexer = new VibeCodingIndexer();

    // 防止重复绑定事件监听器
    if (!indexer.eventListenersAdded) {
        // 文件夹打开事件 - 使用命名空间防止重复绑定
        $(document).off('folderOpened.indexer').on('folderOpened.indexer', function () {
            //console.log('Folder opened event received, starting indexing...');
            //setTimeout(() => {
            indexer.startIndexing();
            //}, 2000); // 延迟2秒等待文件树加载完成
        });

        // 编辑器准备就绪事件 - 使用命名空间防止重复绑定
        $(document).off('editorReady.indexer').on('editorReady.indexer', function (event, editor) {
            //console.log('Editor ready event received, registering Monaco features...');
            setTimeout(() => {
                indexer.registerMonacoFeatures();
            }, 500);
        });

        // 标记事件监听器已添加
        indexer.eventListenersAdded = true;
        //console.log('Event listeners registered with namespaces to prevent duplicates');
    }

    // 创建符号搜索面板
    createSymbolSearchPanel();

    // 添加状态栏按钮
    addIndexerStatusBarButtons();

    // 添加键盘快捷键 - 使用命名空间防止重复绑定
    $(document).off('keydown.symbolSearch').on('keydown.symbolSearch', function (e) {
        // Ctrl+Shift+O 打开符号搜索
        if (e.ctrlKey && e.shiftKey && e.which === 79) {
            e.preventDefault();
            showSymbolSearchPanel();
        }
    });

    //console.log('VibeCoding Indexer initialized successfully');
    return indexer;
}

// 监听文件夹打开事件
$(document).on('folderOpened', function () {
    //console.log('Folder opened, starting indexer...');
    if (vibeCodingIndexer) {
        vibeCodingIndexer.startIndexing();
    }
});

// 监听编辑器准备事件
$(document).on('editorReady', function (event, editorInstance) {
    //console.log('Editor ready event received, initializing indexer...');

    // 确保编辑器实例可以全局访问
    if (editorInstance) {
        window.editor = editorInstance;
        //console.log('Editor instance saved to window.editor');
    }

    initializeIndexer();

    // 调试编辑器状态
    if (vibeCodingIndexer) {
        vibeCodingIndexer.debugEditorStatus();
    }

    // 等待编辑器完全加载后再注册功能
    setTimeout(() => {
        if (vibeCodingIndexer) {
            //console.log('Registering Monaco features after editorReady event...');
            vibeCodingIndexer.registerMonacoFeatures();
        }
    }, 1500);
});

// 如果页面已经加载完成，立即初始化
$(document).ready(function () {
    //initializeIndexer();

    // 加载保存的配置
    loadIndexerConfig();

    // 延迟启动索引，让UI先加载完成
    setTimeout(() => {
        if (globalIndexer && !globalIndexer.isIndexing) {
            globalIndexer.startIndexing();
        }
    }, 1000);
});

// 添加缺失的函数

/**
 * 获取符号类型对应的图标
 * @param {string} type - 符号类型
 * @returns {string} HTML图标字符串
 */
function getSymbolTypeIcon(type) {
    const iconMap = {
        // 通用符号
        'function': '<i class="fas fa-code" style="color: #61dafb;"></i>',
        'class': '<i class="fas fa-cube" style="color: #f39c12;"></i>',
        'method': '<i class="fas fa-cog" style="color: #9b59b6;"></i>',
        'variable': '<i class="fas fa-tag" style="color: #2ecc71;"></i>',
        'property': '<i class="fas fa-key" style="color: #e74c3c;"></i>',
        'component': '<i class="fab fa-vuejs" style="color: #41b883;"></i>',
        'selector': '<i class="fas fa-paint-brush" style="color: #3498db;"></i>',
        'id': '<i class="fas fa-hashtag" style="color: #e67e22;"></i>',

        // Java/C# 符号
        'package': '<i class="fas fa-folder" style="color: #8e44ad;"></i>',
        'namespace': '<i class="fas fa-layer-group" style="color: #8e44ad;"></i>',
        'interface': '<i class="fas fa-plug" style="color: #e74c3c;"></i>',

        // Go 符号
        'struct': '<i class="fas fa-building" style="color: #00add8;"></i>',

        // Rust 符号
        'enum': '<i class="fas fa-list" style="color: #ce422b;"></i>',
        'trait': '<i class="fas fa-handshake" style="color: #ce422b;"></i>',
        'impl': '<i class="fas fa-tools" style="color: #ce422b;"></i>',

        // Ruby 符号
        'module': '<i class="fas fa-puzzle-piece" style="color: #cc342d;"></i>',

        // Swift 符号
        'protocol': '<i class="fas fa-contract" style="color: #fa7343;"></i>',

        // Scala 符号
        'object': '<i class="fas fa-circle" style="color: #dc322f;"></i>',

        // C/C++ 符号
        'macro': '<i class="fas fa-magic" style="color: #659ad2;"></i>',

        // PHP 符号
        'constant': '<i class="fas fa-lock" style="color: #777bb4;"></i>',

        // CSS 符号
        'css-class': '<i class="fas fa-paint-brush" style="color: #1572b6;"></i>',
        'css-id': '<i class="fas fa-hashtag" style="color: #1572b6;"></i>',

        // 脚本符号
        'label': '<i class="fas fa-bookmark" style="color: #f39c12;"></i>',
        'subroutine': '<i class="fas fa-code-branch" style="color: #39457a;"></i>',

        // 配置文件符号
        'key': '<i class="fas fa-key" style="color: #e74c3c;"></i>',
        'element': '<i class="fas fa-tag" style="color: #f39c12;"></i>',

        // SQL 符号
        'table': '<i class="fas fa-table" style="color: #336791;"></i>',
        'view': '<i class="fas fa-eye" style="color: #336791;"></i>',
        'procedure': '<i class="fas fa-play" style="color: #336791;"></i>'
    };

    return iconMap[type] || '<i class="fas fa-circle" style="color: #95a5a6;"></i>';
}

/**
 * 跳转到指定符号位置
 * @param {string} filePath - 文件路径
 * @param {number} line - 行号
 * @param {number} column - 列号
 */
async function jumpToSymbol(filePath, line, column) {
    try {
        // 首先验证文件路径是否在fileHandles中
        if (!fileHandles.has(filePath)) {
            console.warn(`File not found in fileHandles: ${filePath}`);
            if (typeof showNotification === 'function') {
                showNotification(`文件不存在: ${filePath}`, 'error');
            }
            return;
        }

        // 显示加载指示器
        if (typeof showLoadingIndicator === 'function') {
            showLoadingIndicator(true);
        }

        // 如果文件还没有打开，先打开它
        if (!openedTabs.has(filePath)) {
            await openFile(filePath);
        } else {
            // 如果文件已经打开，切换到该标签
            $('.editor-tab').removeClass('active');
            const tabElement = openedTabs.get(filePath);
            tabElement.addClass('active');

            // 切换编辑器内容
            await openFile(filePath);
        }

        // 等待一小段时间确保编辑器已经更新
        await new Promise(resolve => setTimeout(resolve, 200));

        // 获取正确的编辑器实例 - 从全局变量 editor 获取
        let editorInstance = null;

        // 尝试多种方式获取编辑器实例
        if (typeof window.editor !== 'undefined' && window.editor) {
            editorInstance = window.editor;
        } else if (typeof editor !== 'undefined' && editor) {
            editorInstance = editor;
        } else if (window.monaco && window.monaco.editor) {
            // 如果有 monaco 实例，尝试获取所有编辑器实例
            const editors = window.monaco.editor.getEditors();
            if (editors && editors.length > 0) {
                editorInstance = editors[0]; // 取第一个编辑器实例
            }
        }

        if (editorInstance && typeof editorInstance.setPosition === 'function') {
            try {
                // 确保行号和列号是有效的数字
                const validLine = parseInt(line) || 1;
                const validColumn = parseInt(column) || 1;

                // 跳转到指定行列
                editorInstance.setPosition({ lineNumber: validLine, column: validColumn });

                // 滚动到视图中心
                if (typeof editorInstance.revealLineInCenter === 'function') {
                    editorInstance.revealLineInCenter(validLine);
                } else if (typeof editorInstance.revealLine === 'function') {
                    editorInstance.revealLine(validLine);
                }

                // 聚焦编辑器
                if (typeof editorInstance.focus === 'function') {
                    editorInstance.focus();
                }

                // 添加一个短暂的高亮效果
                try {
                    const decorations = editorInstance.deltaDecorations([], [
                        {
                            range: new monaco.Range(validLine, validColumn, validLine, validColumn + 20),
                            options: {
                                className: 'symbol-highlight',
                                isWholeLine: true,
                                inlineClassName: 'symbol-highlight-inline'
                            }
                        }
                    ]);

                    // 2秒后移除高亮
                    setTimeout(() => {
                        editorInstance.deltaDecorations(decorations, []);
                    }, 2000);
                } catch (decorationError) {
                    console.warn('Failed to add highlight decoration:', decorationError);
                }

                //console.log(`Jumped to ${filePath}:${validLine}:${validColumn}`);
            } catch (positionError) {
                console.error('Error setting editor position:', positionError);
            }
        } else {
            console.warn('Editor instance not available or setPosition method not found', {
                editorInstance: !!editorInstance,
                setPosition: editorInstance && typeof editorInstance.setPosition,
                editorType: typeof editorInstance,
                windowEditor: typeof window.editor,
                globalEditor: typeof editor
            });
        }
    } catch (error) {
        console.error('Error jumping to symbol:', error);
        if (typeof showNotification === 'function') {
            showNotification(`跳转失败: ${error.message}`, 'error');
        }
    } finally {
        // 隐藏加载指示器
        if (typeof showLoadingIndicator === 'function') {
            showLoadingIndicator(false);
        }
    }
}

/**
 * 创建符号搜索面板
 */
function createSymbolSearchPanel() {
    const searchPanelHtml = `
        <div id="symbol-search-panel" class="symbol-search-panel" style="display: none;">
            <div class="symbol-search-header">
                <div class="symbol-search-title">
                    <i class="fas fa-search"></i> 符号搜索
                </div>
                <button class="symbol-search-close" id="symbol-search-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="symbol-search-input-container">
                <input type="text" id="symbol-search-input" placeholder="输入符号名称搜索..." />
            </div>
            <div class="symbol-search-results" id="symbol-search-results">
                <div class="symbol-search-empty">输入内容开始搜索符号</div>
            </div>
        </div>
        <div id="symbol-search-overlay" class="symbol-search-overlay" style="display: none;"></div>
    `;

    $('body').append(searchPanelHtml);

    // 绑定事件
    $('#symbol-search-close, #symbol-search-overlay').on('click', function () {
        hideSymbolSearchPanel();
    });

    // 搜索输入事件
    $('#symbol-search-input').on('input', function () {
        const query = $(this).val().trim();
        if (query.length >= 2) {
            performSymbolSearch(query);
        } else {
            $('#symbol-search-results').html('<div class="symbol-search-empty">输入至少2个字符开始搜索</div>');
        }
    });

    // 键盘事件
    $('#symbol-search-input').on('keydown', function (e) {
        const results = $('#symbol-search-results .symbol-search-item');
        const current = $('#symbol-search-results .symbol-search-item.selected');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (current.length === 0) {
                results.first().addClass('selected');
            } else {
                current.removeClass('selected');
                const next = current.next('.symbol-search-item');
                if (next.length > 0) {
                    next.addClass('selected');
                } else {
                    results.first().addClass('selected');
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (current.length === 0) {
                results.last().addClass('selected');
            } else {
                current.removeClass('selected');
                const prev = current.prev('.symbol-search-item');
                if (prev.length > 0) {
                    prev.addClass('selected');
                } else {
                    results.last().addClass('selected');
                }
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (current.length > 0) {
                current.click();
            }
        } else if (e.key === 'Escape') {
            hideSymbolSearchPanel();
        }
    });
}

/**
 * 执行符号搜索
 * @param {string} query - 搜索查询
 */
function performSymbolSearch(query) {
    if (!window.vibeCodingIndexer) {
        $('#symbol-search-results').html('<div class="symbol-search-empty">索引器未初始化</div>');
        return;
    }

    const results = window.vibeCodingIndexer.searchSymbol(query);

    if (results.length === 0) {
        $('#symbol-search-results').html('<div class="symbol-search-empty">未找到匹配的符号</div>');
        return;
    }

    const resultHtml = results.map(result => {
        const fileName = result.file.split('/').pop();
        const typeIcon = getSymbolTypeIcon(result.type);

        return `
            <div class="symbol-search-item" data-file="${result.file}" data-line="${result.line}" data-column="${result.column}">
                <div class="symbol-search-item-icon">
                    ${typeIcon}
                </div>
                <div class="symbol-search-item-info">
                    <div class="symbol-search-item-name">${result.name}</div>
                    <div class="symbol-search-item-location">${fileName}:${result.line}</div>
                </div>
                <div class="symbol-search-item-type">${result.type}</div>
            </div>
        `;
    }).join('');

    $('#symbol-search-results').html(resultHtml);

    // 绑定点击事件
    $('.symbol-search-item').on('click', function () {
        const filePath = $(this).data('file');
        const line = $(this).data('line');
        const column = $(this).data('column');

        jumpToSymbol(filePath, line, column);
        hideSymbolSearchPanel();
    });
}

/**
 * 显示符号搜索面板
 */
function showSymbolSearchPanel() {
    $('#symbol-search-panel').show();
    $('#symbol-search-overlay').show();
    $('#symbol-search-input').focus();
}

/**
 * 从localStorage加载索引器配置
 */
function loadIndexerConfig() {
    if (!globalIndexer) return;

    try {
        const savedConfig = localStorage.getItem('vibeIndexerConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);

            // 更新配置
            if (config.maxFilesToProcess) {
                globalIndexer.maxFilesToProcess = config.maxFilesToProcess;
            }

            if (config.maxFileSize) {
                globalIndexer.maxFileSize = config.maxFileSize;
            }

            if (config.batchSize) {
                globalIndexer.batchSize = config.batchSize;
            }

            if (config.batchDelay !== undefined) {
                globalIndexer.batchDelay = config.batchDelay;
            }

            //console.log('Loaded indexer configuration from localStorage');
        }
    } catch (e) {
        console.error('Failed to load indexer config:', e);
    }
}