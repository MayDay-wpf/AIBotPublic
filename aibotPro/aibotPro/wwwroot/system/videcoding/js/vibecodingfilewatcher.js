/**
 * VibeCoding File Watcher
 * 监听文件的外部修改并自动更新编辑器内容
 * 使用File System Access API的原生能力，无需轮询
 */

$(function () {
    // 初始化文件监听器
    initFileWatcher();
});

// 全局变量
let fileWatchers = new Map(); // 存储文件监听器
let isWatchingEnabled = true; // 是否启用文件监听

/**
 * 初始化文件监听器
 */
function initFileWatcher() {
    // 监听编辑器准备就绪事件
    $(document).on('editorReady', function(event, editor) {
        console.log('File watcher: Editor ready, initializing file watching');
        setupFileWatching();
    });

    // 监听文件夹打开事件
    $(document).on('folderOpened', function() {
        console.log('File watcher: Folder opened, setting up watchers for open files');
        setupWatchersForOpenFiles();
    });

    // 监听标签页变化事件
    $(document).on('tabOpened', function(event, filePath) {
        setupFileWatcher(filePath);
    });

    $(document).on('tabClosed', function(event, filePath) {
        removeFileWatcher(filePath);
    });

    // 监听页面卸载事件，清理资源
    $(window).on('beforeunload', function() {
        cleanupAllWatchers();
    });
}

/**
 * 设置文件监听
 */
function setupFileWatching() {
    // 如果浏览器不支持File System Access API，则退出
    if (!('showDirectoryPicker' in window)) {
        console.warn('File watcher: File System Access API not supported');
        return;
    }

    // 为当前打开的所有文件设置监听器
    setupWatchersForOpenFiles();
}

/**
 * 为所有打开的文件设置监听器
 */
function setupWatchersForOpenFiles() {
    if (!window.openedTabs || !window.fileHandles) {
        return;
    }

    // 为每个打开的文件设置监听器
    for (const filePath of window.openedTabs.keys()) {
        setupFileWatcher(filePath);
    }
}

/**
 * 为指定文件设置监听器
 * @param {string} filePath - 文件路径
 */
async function setupFileWatcher(filePath) {
    if (!isWatchingEnabled || !window.fileHandles) {
        return;
    }

    // 如果已经有监听器，先清理
    if (fileWatchers.has(filePath)) {
        removeFileWatcher(filePath);
    }

    try {
        const fileHandle = window.fileHandles.get(filePath);
        if (!fileHandle) {
            console.warn(`File watcher: No file handle found for ${filePath}`);
            return;
        }

        // 获取文件的初始修改时间
        const file = await fileHandle.getFile();
        const initialModTime = file.lastModified;

        // 创建监听器对象
        const watcher = {
            filePath: filePath,
            fileHandle: fileHandle,
            lastModified: initialModTime,
            isActive: true,
            checkInterval: null
        };

        // 使用requestIdleCallback进行高效的文件检查
        const checkFileModification = async () => {
            if (!watcher.isActive || !window.openedTabs.has(filePath)) {
                return;
            }

            try {
                const currentFile = await fileHandle.getFile();
                const currentModTime = currentFile.lastModified;

                // 检查文件是否被外部修改
                if (currentModTime > watcher.lastModified) {
                    console.log(`File watcher: External modification detected for ${filePath}`);
                    await handleFileModification(filePath, currentFile);
                    watcher.lastModified = currentModTime;
                }

                // 继续监听（使用requestIdleCallback优化性能）
                if (watcher.isActive) {
                    watcher.checkInterval = requestIdleCallback(() => {
                        setTimeout(checkFileModification, 1000); // 1秒检查一次
                    });
                }
            } catch (error) {
                // 文件可能被删除或移动，停止监听
                console.warn(`File watcher: Error checking file ${filePath}:`, error);
                removeFileWatcher(filePath);
            }
        };

        // 开始监听
        watcher.checkInterval = requestIdleCallback(() => {
            setTimeout(checkFileModification, 1000);
        });

        // 存储监听器
        fileWatchers.set(filePath, watcher);

        console.log(`File watcher: Started watching ${filePath}`);
    } catch (error) {
        console.error(`File watcher: Failed to setup watcher for ${filePath}:`, error);
    }
}

/**
 * 处理文件外部修改
 * @param {string} filePath - 文件路径
 * @param {File} file - 修改后的文件对象
 */
async function handleFileModification(filePath, file) {
    try {
        // 读取新的文件内容
        const newContent = await file.text();
        
        // 检查文件是否为脏文件（有未保存的更改）
        const isDirtyFile = window.dirtyFiles && window.dirtyFiles.has(filePath);
        
        // 检查当前是否是活动文件
        const isCurrentFile = window.currentOpenFile === filePath;

        if (isDirtyFile) {
            // 如果是脏文件，不自动更新，只标记为外部修改
            // 用户需要手动决定是保存当前更改还是加载外部更改
            markTabAsExternallyModified(filePath);
            console.log(`File watcher: File ${filePath} externally modified but has unsaved changes, marked for user attention`);
            
            // 更新原始内容记录，但不更新编辑器内容
            if (window.originalContents) {
                window.originalContents.set(filePath, newContent);
            }
            
            // 如果文件有对应的Monaco模型且不是当前活动文件，更新模型内容
            if (!isCurrentFile && window.monaco && window.monaco.editor) {
                const models = window.monaco.editor.getModels();
                const fileModel = models.find(model => model.uri.path === filePath);
                if (fileModel && fileModel.getValue() !== newContent) {
                    // 创建一个新的模型来保存外部更改的内容
                    // 但不替换当前的模型，因为用户有未保存的更改
                    console.log(`File watcher: External content differs from model for dirty file ${filePath}`);
                }
            }
            
            return;
        }

        // 如果不是脏文件，直接更新内容
        if (isCurrentFile && window.editor) {
            // 静默更新编辑器内容
            const currentPosition = window.editor.getPosition();
            const currentScrollTop = window.editor.getScrollTop();

            // 更新编辑器内容
            window.editor.setValue(newContent);

            // 恢复光标位置和滚动位置
            try {
                window.editor.setPosition(currentPosition);
                window.editor.setScrollTop(currentScrollTop);
            } catch (error) {
                // 如果恢复位置失败（可能因为文件内容变化太大），忽略错误
                console.warn('File watcher: Could not restore cursor position after external update');
            }

            console.log(`File watcher: Silently updated active file ${filePath}`);
        } else {
            // 如果不是当前活动文件，更新Monaco模型内容
            if (window.monaco && window.monaco.editor) {
                const models = window.monaco.editor.getModels();
                const fileModel = models.find(model => model.uri.path === filePath);
                if (fileModel) {
                    fileModel.setValue(newContent);
                }
            }

            console.log(`File watcher: Updated non-active file ${filePath} in background`);
        }

        // 更新原始内容记录
        if (window.originalContents) {
            window.originalContents.set(filePath, newContent);
        }

        // 确保文件不被标记为脏文件，因为外部修改已经保存到磁盘
        // 这是新的"原始状态"
        if (window.dirtyFiles && window.dirtyFiles.has(filePath)) {
            window.dirtyFiles.delete(filePath);
            // 更新标签页标题，移除脏标记
            updateTabTitle(filePath, false);
        }

        // 移除外部修改标记（如果有的话）
        removeExternalModificationMark(filePath);

    } catch (error) {
        console.error(`File watcher: Error handling file modification for ${filePath}:`, error);
    }
}

/**
 * 更新标签页标题
 * @param {string} filePath - 文件路径
 * @param {boolean} isDirty - 是否为脏文件
 */
function updateTabTitle(filePath, isDirty) {
    if (!window.openedTabs) return;

    const tab = window.openedTabs.get(filePath);
    if (tab) {
        const title = tab.find('.tab-title');
        const fileName = filePath.split('/').pop();

        if (isDirty) {
            // 如果文件是脏的，显示脏标记
            title.text(`${fileName} *`);
        } else {
            // 文件不是脏的，只显示文件名
            title.text(fileName);
        }

        // 如果有generateEditorTabsMarkdown函数，更新标签页markdown
        if (typeof window.generateEditorTabsMarkdown === 'function') {
            window.generateEditorTabsMarkdown();
        }
    }
}

/**
 * 标记标签页为外部修改
 * @param {string} filePath - 文件路径
 */
function markTabAsExternallyModified(filePath) {
    if (!window.openedTabs) return;

    const tab = window.openedTabs.get(filePath);
    if (tab) {
        tab.addClass('externally-modified');
        
        // 添加视觉指示器
        if (!tab.find('.external-modification-indicator').length) {
            const indicator = $('<span class="external-modification-indicator" title="文件已被外部修改">⚠</span>');
            tab.find('.tab-title').after(indicator);
        }
    }
}

/**
 * 移除外部修改标记
 * @param {string} filePath - 文件路径
 */
function removeExternalModificationMark(filePath) {
    if (!window.openedTabs) return;

    const tab = window.openedTabs.get(filePath);
    if (tab) {
        tab.removeClass('externally-modified');
        tab.find('.external-modification-indicator').remove();
    }
}

/**
 * 移除文件监听器
 * @param {string} filePath - 文件路径
 */
function removeFileWatcher(filePath) {
    const watcher = fileWatchers.get(filePath);
    if (watcher) {
        watcher.isActive = false;
        
        if (watcher.checkInterval) {
            cancelIdleCallback(watcher.checkInterval);
        }
        
        fileWatchers.delete(filePath);
        console.log(`File watcher: Stopped watching ${filePath}`);
    }
}

/**
 * 清理所有监听器
 */
function cleanupAllWatchers() {
    for (const [filePath, watcher] of fileWatchers) {
        watcher.isActive = false;
        if (watcher.checkInterval) {
            cancelIdleCallback(watcher.checkInterval);
        }
    }
    fileWatchers.clear();
    console.log('File watcher: Cleaned up all watchers');
}

/**
 * 启用/禁用文件监听
 * @param {boolean} enabled - 是否启用
 */
function setFileWatchingEnabled(enabled) {
    isWatchingEnabled = enabled;
    
    if (!enabled) {
        cleanupAllWatchers();
    } else if (window.openedTabs) {
        setupWatchersForOpenFiles();
    }
    
    console.log(`File watcher: ${enabled ? 'Enabled' : 'Disabled'} file watching`);
}

/**
 * 获取当前监听状态
 * @returns {boolean} 是否启用监听
 */
function isFileWatchingEnabled() {
    return isWatchingEnabled;
}

/**
 * 获取监听器统计信息
 * @returns {Object} 统计信息
 */
function getWatcherStats() {
    return {
        totalWatchers: fileWatchers.size,
        activeWatchers: Array.from(fileWatchers.values()).filter(w => w.isActive).length,
        watchedFiles: Array.from(fileWatchers.keys())
    };
}

/**
 * 处理用户点击外部修改的标签页
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} - 是否成功处理
 */
async function handleExternallyModifiedTabClick(filePath) {
    if (!window.dirtyFiles || !window.dirtyFiles.has(filePath)) {
        // 如果文件不是脏文件，直接移除外部修改标记
        removeExternalModificationMark(filePath);
        return true;
    }

    // 如果文件是脏文件，询问用户如何处理
    try {
        // 创建自定义对话框询问用户选择
        const userChoice = await showExternalModificationDialog(filePath);
        
        if (userChoice === 'load-external') {
            // 用户选择加载外部更改，丢弃当前更改
            await loadExternalChanges(filePath);
            return true;
        } else if (userChoice === 'keep-current') {
            // 用户选择保持当前更改，移除外部修改标记
            removeExternalModificationMark(filePath);
            return true;
        } else if (userChoice === 'save-first') {
            // 用户选择先保存当前更改，然后加载外部更改
            if (typeof window.saveFile === 'function') {
                await window.saveFile(filePath);
                await loadExternalChanges(filePath);
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error handling externally modified tab click:', error);
        return false;
    }
}

/**
 * 显示外部修改对话框
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} - 用户选择
 */
function showExternalModificationDialog(filePath) {
    return new Promise((resolve) => {
        const fileName = filePath.split('/').pop();
        
        // 创建对话框HTML
        const dialogHtml = `
            <div class="custom-dialog" id="external-modification-dialog" style="display: flex;">
                <div class="custom-dialog-content dialog-warning">
                    <div class="custom-dialog-header">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h4>文件外部修改冲突</h4>
                    </div>
                    <div class="custom-dialog-body">
                        <p>文件 <strong>${fileName}</strong> 已被外部修改，但您有未保存的更改。</p>
                        <p>请选择如何处理：</p>
                    </div>
                    <div class="custom-dialog-footer">
                        <button class="vibe-btn vibe-btn-secondary" id="keep-current-changes">保持当前更改</button>
                        <button class="vibe-btn vibe-btn-warning" id="save-then-load">先保存再加载</button>
                        <button class="vibe-btn vibe-btn-primary" id="load-external-changes">加载外部更改</button>
                    </div>
                </div>
            </div>
        `;
        
        // 添加对话框到页面
        $('body').append(dialogHtml);
        
        // 绑定按钮事件
        $('#keep-current-changes').on('click', function() {
            $('#external-modification-dialog').remove();
            resolve('keep-current');
        });
        
        $('#save-then-load').on('click', function() {
            $('#external-modification-dialog').remove();
            resolve('save-first');
        });
        
        $('#load-external-changes').on('click', function() {
            $('#external-modification-dialog').remove();
            resolve('load-external');
        });
    });
}

/**
 * 加载外部更改
 * @param {string} filePath - 文件路径
 */
async function loadExternalChanges(filePath) {
    try {
        const fileHandle = window.fileHandles.get(filePath);
        if (!fileHandle) {
            console.error('File handle not found for', filePath);
            return;
        }

        // 重新读取文件内容
        const file = await fileHandle.getFile();
        const newContent = await file.text();

        // 更新编辑器内容（如果是当前活动文件）
        const isCurrentFile = window.currentOpenFile === filePath;
        if (isCurrentFile && window.editor) {
            window.editor.setValue(newContent);
        }

        // 更新Monaco模型
        if (window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            const fileModel = models.find(model => model.uri.path === filePath);
            if (fileModel) {
                fileModel.setValue(newContent);
            }
        }

        // 更新原始内容记录
        if (window.originalContents) {
            window.originalContents.set(filePath, newContent);
        }

        // 清除脏文件标记
        if (window.dirtyFiles) {
            window.dirtyFiles.delete(filePath);
            updateTabTitle(filePath, false);
        }

        // 移除外部修改标记
        removeExternalModificationMark(filePath);

        console.log(`File watcher: Loaded external changes for ${filePath}`);
    } catch (error) {
        console.error('Error loading external changes:', error);
    }
}

// 导出新函数到全局作用域
window.fileWatcher = {
    setEnabled: setFileWatchingEnabled,
    isEnabled: isFileWatchingEnabled,
    getStats: getWatcherStats,
    setupWatcher: setupFileWatcher,
    removeWatcher: removeFileWatcher,
    cleanup: cleanupAllWatchers,
    handleExternallyModifiedTabClick: handleExternallyModifiedTabClick
};

// 在vibecoding.js中触发的事件
$(document).on('fileOpened', function(event, filePath) {
    setupFileWatcher(filePath);
});

$(document).on('fileClosed', function(event, filePath) {
    removeFileWatcher(filePath);
}); 