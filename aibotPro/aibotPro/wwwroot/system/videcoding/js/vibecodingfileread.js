/**
 * VibeCodeFile - Handles file reading operations for the Vibe Coding environment
 * This module provides functions for reading files from the file system
 */

/**
 * Get the content of a file by its path
 * @param {string} filePath - Path to the file to read
 * @param {number} startLine - Optional start line number (1-based, defaults to 0 which means read entire file)
 * @param {number} endLine - Optional end line number (1-based, defaults to 0 which means read entire file)
 * @param {boolean} readFullContentWithLines - Whether to read the complete file content with line numbers regardless of startLine/endLine (defaults to false)
 * @returns {Promise<string|string[]>} A promise that resolves with the file content, or an array of file paths if the path is a directory
 */
async function getFileContent(filePath, startLine = 0, endLine = 0, readFullContentWithLines = false) {
    try {
        // Check if fileHandles is available from vibecoding.js
        if (typeof fileHandles === 'undefined' || !fileHandles) {
            throw new Error('File system not initialized. Please open a folder first.');
        }
        //console.log(window.lastFolderHandle);
        // Get file handle from the map
        let fileHandle = fileHandles.get(filePath);
        if (!fileHandle) {
            fileHandle = directoryHandles.get(filePath);
        }

        // Check if the path is a directory
        if (fileHandle.kind && fileHandle.kind === 'directory') {
            // It's a directory, get the contained files (non-recursively)
            const files = [];
            for await (const entry of fileHandle.values()) {
                if (entry.kind && entry.kind === 'directory') {
                    files.push(filePath + '/' + entry.name);
                    directoryHandles.set(filePath + '/' + entry.name, entry);
                }
                if (entry.kind && entry.kind === 'file') {
                    files.push(filePath + '/' + entry.name);
                    fileHandles.set(filePath + '/' + entry.name, entry);
                }
            }
            return `# 这是 ${filePath} 的目录内容,如果无法解决问题，或未找到相关代码，你可以继续使用工具\n\n${files.join('\n')}`;
        }

        // It's a file, get the file and read its content
        const file = await fileHandle.getFile();
        const content = await file.text();

        // If readFullContentWithLines is true, return the entire file content with line numbers
        if (readFullContentWithLines) {
            const lines = content.split('\n');
            const numberedLines = lines.map((line, index) => {
                return `${index + 1}: ${line}`;
            }).join('\n');
            return numberedLines;
        } else if (startLine > 0 && endLine > 0) {
            // Get the content of the specified lines
            const lines = content.split('\n');
            const startIndex = Math.max(0, startLine - 1);
            const endIndex = Math.min(lines.length, endLine);
            const selectedLines = lines.slice(startIndex, endIndex);
            return selectedLines.join('\n');
        } else {
            return content;
        }
    } catch (error) {
        console.error('Error reading file:', error);
        throw error;
    }
}

/**
 * Get file symbols and references from the indexer
 * @param {string} filepath - Path to the file
 * @returns {Object} Object containing symbols and references information
 */
function getFileIndexInfo(filepath) {
    // Check if the global indexer is available
    if (!globalIndexer) {
        return { symbols: [], externalSymbols: [], hasIndexer: false };
    }

    const indexer = globalIndexer;
    if (!indexer || !indexer.symbolIndex) {
        return { symbols: [], externalSymbols: [], hasIndexer: false };
    }

    // 标准化文件路径，用于比较
    const normalizeFilePath = (path) => {
        if (!path) return '';
        // 处理路径格式问题
        let normalized = path.replace(/\\/g, '/').toLowerCase();
        // 移除重复的斜杠
        normalized = normalized.replace(/\/+/g, '/');
        // 移除重复的项目名称（如 /yahooapi//yahooapi/ -> /yahooapi/）
        const projectName = normalized.split('/')[1]; // 获取项目名称
        if (projectName) {
            const duplicatePattern = new RegExp(`/${projectName}/+${projectName}/`, 'g');
            normalized = normalized.replace(duplicatePattern, `/${projectName}/`);
        }
        return normalized;
    };

    const normalizedFilepath = normalizeFilePath(filepath);

    // 同时尝试多种路径匹配方式
    const possiblePaths = [
        filepath,
        normalizedFilepath,
        // 尝试添加重复项目名称的版本
        filepath.replace(/^\/([^\/]+)\//, '/$1//$1/'),
        // 尝试移除项目名称前缀
        filepath.replace(/^\/[^\/]+\//, '/')
    ];

    // Get all symbols defined in this file
    const fileSymbols = [];
    for (const [symbolName, definitions] of indexer.symbolIndex.entries()) {
        const fileDefinitions = definitions.filter(def => {
            const normalizedDefPath = normalizeFilePath(def.file);
            return possiblePaths.some(path => normalizeFilePath(path) === normalizedDefPath);
        });
        if (fileDefinitions.length > 0) {
            fileSymbols.push({
                name: symbolName,
                definitions: fileDefinitions
            });
        }
    }

    // Get external symbols used in this file (symbols defined in other files)
    const externalSymbols = [];

    // 获取当前文件内容，分析其中使用的符号
    // 注意：文件内容存储在fileContentCache中，而不是fileIndex中
    let fileContent = null;
    let foundPath = null;

    // 尝试从fileContentCache获取，使用多种路径匹配
    if (indexer.fileContentCache) {
        for (const [cachedPath, cacheInfo] of indexer.fileContentCache.entries()) {
            const normalizedCachedPath = normalizeFilePath(cachedPath);
            if (possiblePaths.some(path => normalizeFilePath(path) === normalizedCachedPath)) {
                fileContent = cacheInfo.content;
                foundPath = cachedPath;
                break;
            }
        }
    }

    // 如果fileContentCache中没有，尝试从fileIndex获取（备用）
    if (!fileContent && indexer.fileIndex) {
        for (const [cachedPath, content] of indexer.fileIndex.entries()) {
            const normalizedCachedPath = normalizeFilePath(cachedPath);
            if (possiblePaths.some(path => normalizeFilePath(path) === normalizedCachedPath)) {
                fileContent = content;
                foundPath = cachedPath;
                break;
            }
        }
    }

    if (fileContent) {
        // 遍历所有已索引的符号，查找在当前文件中使用但在其他文件中定义的符号
        for (const [symbolName, definitions] of indexer.symbolIndex.entries()) {
            // 过滤出在其他文件中定义的符号
            const externalDefinitions = definitions.filter(def => {
                const normalizedDefPath = normalizeFilePath(def.file);
                return !possiblePaths.some(path => normalizeFilePath(path) === normalizedDefPath);
            });

            if (externalDefinitions.length > 0) {
                // 检查当前文件是否使用了这个符号
                const symbolRegex = new RegExp(`\\b${symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
                const matches = fileContent.match(symbolRegex);

                if (matches && matches.length > 0) {
                    // 找到使用位置
                    const usagePositions = [];
                    const lines = fileContent.split('\n');
                    lines.forEach((line, lineIndex) => {
                        const lineMatches = line.matchAll(symbolRegex);
                        for (const match of lineMatches) {
                            usagePositions.push({
                                line: lineIndex + 1,
                                column: match.index + 1
                            });
                        }
                    });

                    externalSymbols.push({
                        name: symbolName,
                        definitions: externalDefinitions,
                        usageCount: matches.length,
                        usagePositions: usagePositions
                    });
                }
            }
        }
    }

    return {
        symbols: fileSymbols,
        externalSymbols: externalSymbols,
        hasIndexer: true
    };
}

/**
 * Format index information for AI responses
 * @param {Object} indexInfo - Index information object
 * @param {string} filepath - Path to the file
 * @returns {string} Formatted index information
 */
function formatIndexInfoForAI(indexInfo, filepath) {
    if (!indexInfo.hasIndexer) {
        return '\n## 索引信息\n\n索引器未初始化或不可用。\n';
    }

    let indexContent = '\n## 文件索引信息\n\n';

    // Format symbols in this file
    if (indexInfo.symbols.length > 0) {
        indexContent += '### 本文件中定义的符号\n\n';
        indexInfo.symbols.forEach(symbol => {
            indexContent += `- **${symbol.name}**`;
            symbol.definitions.forEach(def => {
                indexContent += ` (${def.type}, 行 ${def.line}:${def.column || 1})`;
            });
            indexContent += '\n';
        });
        indexContent += '\n';
    }

    // Format external symbols
    if (indexInfo.externalSymbols.length > 0) {
        indexContent += '### 本文件中使用的外部符号\n\n';
        indexInfo.externalSymbols.forEach(symbol => {
            indexContent += `- **${symbol.name}** (${symbol.usageCount} 次使用)\n`;

            // 显示符号的定义位置
            symbol.definitions.forEach(def => {
                indexContent += `  - 定义于: **${def.file}** (${def.type}, 行 ${def.line}:${def.column || 1})\n`;
            });

            // 显示在当前文件中的使用位置
            indexContent += `  - 使用位置:\n`;
            symbol.usagePositions.forEach(position => {
                indexContent += `    - 行 ${position.line}:${position.column}\n`;
            });
            indexContent += '\n';
        });
        indexContent += '\n';
    }

    // Summary statistics
    const totalSymbols = indexInfo.symbols.length;
    const totalExternalSymbols = indexInfo.externalSymbols.length;

    if (totalSymbols > 0 || totalExternalSymbols > 0) {
        indexContent += '### 统计信息\n\n';
        indexContent += `- 定义的符号: ${totalSymbols} 个\n`;
        indexContent += `- 外部符号: ${totalExternalSymbols} 个\n\n`;
    }

    // If no index information is available
    if (totalSymbols === 0 && totalExternalSymbols === 0) {
        indexContent += '该文件暂无索引信息。可能是因为：\n';
        indexContent += '- 文件类型不支持索引\n';
        indexContent += '- 文件内容为空或无有效符号\n';
        indexContent += '- 索引尚未完成\n\n';
    }

    return indexContent;
}

/**
 * Format file content for display in AI responses
 * @param {string} filepath - Path to the file that was read
 * @param {number} startLine - Start line number (1-based)
 * @param {number} endLine - End line number (1-based) 
 * @param {string} fileContent - The content of the file
 * @param {boolean} includeIndexInfo - Whether to include index information (default: true)
 * @returns {string} Formatted content with header
 */
function formatFileContentForAI(filepath, startLine, endLine, fileContent, includeIndexInfo = true) {
    // Add line numbers to each line of code
    const lines = fileContent.split('\n');
    const numberedLines = lines.map((line, index) => {
        const lineNumber = startLine + index;
        return `${lineNumber}: ${line}`;
    }).join('\n');

    let content = `# 这是文件 ${filepath} 的 ${startLine}-${endLine} 行的内容,如果无法解决问题，或未找到相关代码，你可以继续使用工具\n\n${numberedLines}`;

    // Add index information if requested
    if (includeIndexInfo) {
        const indexInfo = getFileIndexInfo(filepath);
        content += formatIndexInfoForAI(indexInfo, filepath);
    }

    return content;
}

// Export functions
window.VibeFileReader = {
    getFileContent,
    formatFileContentForAI,
    getFileIndexInfo,
    formatIndexInfoForAI
};
