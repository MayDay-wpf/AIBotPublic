/**
 * VibeCodeCreateFile - Handles file creation operations for the Vibe Coding environment
 * This module provides functions for creating files in the file system
 */

/**
 * Detect if the user is on macOS
 * @returns {boolean} true if the user is on macOS
 */
// Use the shared isMacOS function from vibecodingeditfile.js if available
if (typeof window.isMacOS !== 'function') {
    function isMacOS() {
        return navigator.platform.indexOf('Mac') !== -1 ||
            navigator.userAgent.indexOf('Mac') !== -1;
    }
    // Make it globally available
    window.isMacOS = isMacOS;
}

/**
 * Create a new file with the specified path and content
 * @param {string} filePath - Path where the file should be created
 * @param {string} fileContent - Content to write to the new file (defaults to empty string)
 * @param {boolean} skipConfirmation - Skip the confirmation dialog (defaults to false)
 * @returns {Promise<string>} A promise that resolves with the created file path
 */
async function createFile(filePath, fileContent = '', skipConfirmation = false) {
    try {
        // Check if fileHandles is available from vibecoding.js
        if (typeof fileHandles === 'undefined' || !fileHandles) {
            throw new Error('File system not initialized. Please open a folder first.');
        }

        // Parse the path to get directory and filename
        const lastSlashIndex = filePath.lastIndexOf('/');
        const directoryPath = lastSlashIndex > 0 ? filePath.substring(0, lastSlashIndex) : '/';
        const fileName = lastSlashIndex > 0 ? filePath.substring(lastSlashIndex + 1) : filePath;

        // Check if the directory exists
        const dirHandle = directoryHandles.get(directoryPath);
        if (!dirHandle) {
            throw new Error(`Directory not found: ${directoryPath}`);
        }

        // Check if file already exists
        let fileExists = false;
        let existingContent = '';
        let fileHandle;

        try {
            // Try to get the file handle without creating it
            fileHandle = await dirHandle.getFileHandle(fileName);
            fileExists = true;

            // Read existing content
            const file = await fileHandle.getFile();
            existingContent = await file.text();
        } catch (error) {
            // Check if this is a permissions error
            if (error.message && error.message.includes('User activation is required')) {
                // Use the shared permission request dialog
                await (window.showPermissionRequestDialog || showPermissionRequestDialog)();

                // Retry the operation after user activation
                return createFile(filePath, fileContent, skipConfirmation);
            }

            // File doesn't exist, we'll create it
            try {
                fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            } catch (createError) {
                // Handle permission error during creation
                if (createError.message && createError.message.includes('User activation is required')) {
                    // Use the shared permission request dialog
                    await (window.showPermissionRequestDialog || showPermissionRequestDialog)();

                    // Retry the operation after user activation
                    return createFile(filePath, fileContent, skipConfirmation);
                }
                // If it's another error, re-throw it
                throw createError;
            }
        }

        // If we should skip confirmation or file content is empty and it doesn't exist, just create/update it
        if (skipConfirmation || (!fileExists && fileContent.trim() === '')) {
            // Write content to the file
            try {
                const writable = await fileHandle.createWritable();
                await writable.write(fileContent);
                await writable.close();
            } catch (writeError) {
                // Handle permission error during write
                if (writeError.message && writeError.message.includes('User activation is required')) {
                    // Use the shared permission request dialog
                    await (window.showPermissionRequestDialog || showPermissionRequestDialog)();

                    // Retry the operation after user activation
                    return createFile(filePath, fileContent, skipConfirmation);
                }
                // If it's another error, re-throw it
                throw writeError;
            }

            // Add the file handle to the map
            fileHandles.set(filePath, fileHandle);

            // Refresh the file tree to show the new file
            if (typeof refreshFileTree === 'function') {
                refreshFileTree();
            }

            return filePath;
        }

        // Create file with empty content for new files (we'll update it later if confirmed)
        if (!fileExists) {
            try {
                const writable = await fileHandle.createWritable();
                await writable.close();
            } catch (writeError) {
                // Handle permission error during write
                if (writeError.message && writeError.message.includes('User activation is required')) {
                    // Use the shared permission request dialog
                    await (window.showPermissionRequestDialog || showPermissionRequestDialog)();

                    // Retry the operation after user activation
                    return createFile(filePath, fileContent, skipConfirmation);
                }
                // If it's another error, re-throw it
                throw writeError;
            }

            // Add the file handle to the map
            fileHandles.set(filePath, fileHandle);

            // Refresh the file tree to show the new file
            if (typeof refreshFileTree === 'function') {
                refreshFileTree();
            }
        }

        // If we need to show diff confirmation, open the file and show inline diff
        const confirmResult = await showCreateFileConfirmation(filePath, existingContent, fileContent, fileExists);

        if (!confirmResult.accepted) {
            // User rejected changes
            if (!fileExists) {
                // If it's a new file that was just created but rejected, delete it
                try {
                    // 首先删除文件
                    await dirHandle.removeEntry(fileName);

                    // Remove from file handles
                    fileHandles.delete(filePath);

                    // Refresh the file tree
                    if (typeof refreshFileTree === 'function') {
                        refreshFileTree();
                    }

                    // 然后关闭标签页
                    if (typeof currentOpenFile !== 'undefined' && currentOpenFile === filePath && typeof closeTab === 'function') {
                        // 关闭标签页
                        closeTab(filePath);
                    }
                } catch (e) {
                    console.warn('Failed to remove rejected new file:', e);
                }
            }
            throw new Error('File creation cancelled by user', { cause: { rejectionReason: confirmResult.rejectionReason } });
        }

        // User accepted changes, write the content to the file
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(fileContent);
            await writable.close();
        } catch (writeError) {
            // Handle permission error during final write
            if (writeError.message && writeError.message.includes('User activation is required')) {
                // Use the shared permission request dialog
                await (window.showPermissionRequestDialog || showPermissionRequestDialog)();

                // Retry the operation after user activation
                return createFile(filePath, fileContent, skipConfirmation);
            }
            // If it's another error, re-throw it
            throw writeError;
        }
        // Trigger folderOpened event for other components (like indexer)
        $(document).trigger('folderOpened');
        return filePath;
    } catch (error) {
        console.error('Error creating file:', error);
        throw error;
    }
}

/**
 * Display a permission request dialog to the user
 * @returns {Promise<void>} Promise that resolves when the dialog is closed
 */
// Use the shared showPermissionRequestDialog function from vibecodingeditfile.js if available
if (typeof window.showPermissionRequestDialog !== 'function') {
    async function showPermissionRequestDialog() {
        return new Promise((resolve) => {
            // Create the overlay container if it doesn't exist
            let permissionOverlay = $('#permission-request-overlay');
            if (permissionOverlay.length === 0) {
                permissionOverlay = $(`
                    <div id="permission-request-overlay" class="permission-overlay">
                        <div class="permission-dialog">
                            <div class="permission-header">
                                <i class="fas fa-exclamation-triangle"></i>
                                <h3>需要文件系统权限</h3>
                            </div>
                            <div class="permission-body">
                                <p>为了创建或修改文件，需要您的授权许可。</p>
                                <p>请点击下方按钮继续，然后在浏览器弹出的权限请求中选择"允许"。</p>
                            </div>
                            <div class="permission-footer">
                                <button id="confirm-permission" class="permission-button confirm-button">
                                    <i class="fas fa-check"></i> 授权并继续
                                </button>
                            </div>
                        </div>
                    </div>
                `);

                // Append to body
                $('body').append(permissionOverlay);
            }

            // Add CSS if not already added
            if ($('#permission-dialog-styles').length === 0) {
                $('head').append(`
                    <style id="permission-dialog-styles">
                        .permission-overlay {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: rgba(0, 0, 0, 0.5);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 9999;
                        }
                        .permission-dialog {
                            background-color: #fff;
                            border-radius: 8px;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                            width: 450px;
                            max-width: 90%;
                            padding: 20px;
                        }
                        .permission-header {
                            display: flex;
                            align-items: center;
                            margin-bottom: 15px;
                            color: #e67e22;
                        }
                        .permission-header i {
                            font-size: 24px;
                            margin-right: 10px;
                        }
                        .permission-header h3 {
                            margin: 0;
                            font-size: 18px;
                        }
                        .permission-body {
                            margin-bottom: 20px;
                        }
                        .permission-body p {
                            margin: 8px 0;
                            line-height: 1.5;
                        }
                        .permission-footer {
                            display: flex;
                            justify-content: flex-end;
                        }
                        .permission-button {
                            padding: 8px 16px;
                            border-radius: 4px;
                            border: none;
                            cursor: pointer;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                        }
                        .permission-button i {
                            margin-right: 6px;
                        }
                        .confirm-button {
                            background-color: #2ecc71;
                            color: white;
                        }
                        .confirm-button:hover {
                            background-color: #27ae60;
                        }
                    </style>
                `);
            }

            // Display the overlay
            permissionOverlay.show();

            // Handle confirm button
            $('#confirm-permission').off('click').on('click', function () {
                permissionOverlay.hide();
                resolve();
            });
        });
    }
    // Make it globally available
    window.showPermissionRequestDialog = showPermissionRequestDialog;
}

/**
 * Show inline diff in the editor for accepting/rejecting changes for file creation
 * @param {string} filePath - Path to the file
 * @param {string} oldContent - Original content
 * @param {string} newContent - New content
 * @param {boolean} isExistingFile - Whether this is updating an existing file
 * @returns {Promise<boolean>} A promise that resolves with true if accepted, false if rejected
 */
async function showCreateFileConfirmation(filePath, oldContent, newContent, isExistingFile) {
    return new Promise(async (resolve) => {
        let tabOpened = false;

        // First, open the file in the editor
        if (typeof openFile === 'function') {
            await openFile(filePath);
            tabOpened = true;
        }

        // Make sure we have an editor instance
        if (!editor) {
            console.error('Editor instance not found');
            resolve({ accepted: false });
            return;
        }

        // Remove existing overlay if it exists to avoid conflicts with edit file functionality
        $('#editor-diff-overlay').remove();

        // Create the overlay container
        const diffOverlay = $(`
            <div id="editor-diff-overlay" class="editor-diff-overlay">
                <div class="diff-overlay-controls">
                    <div class="diff-notification">
                        <i class="fas fa-exclamation-circle"></i>
                        <span class="diff-notification-text"></span>
                    </div>
                    <div class="diff-actions">
                        <div class="rejection-reason-container">
                            <input type="text" id="rejection-reason" placeholder="拒绝原因（选填）" />
                        </div>
                        <button id="reject-inline-diff" class="diff-action-button reject-button">
                            <i class="fas fa-times"></i> 拒绝
                        </button>
                        <button id="accept-inline-diff" class="diff-action-button accept-button">
                            <i class="fas fa-check"></i> 接受
                        </button>
                    </div>
                </div>
            </div>
        `);

        // Append to editor container
        $('#editor').parent().append(diffOverlay);

        // Update the notification text based on whether it's a new file or an update
        const notificationText = isExistingFile ?
            '文件内容变更，请检查并接受或拒绝更改' :
            '新文件创建，请检查并接受或拒绝文件内容';
        $('.diff-notification-text').text(notificationText);

        // Display the overlay
        diffOverlay.show();

        // Set the editor content to the new content to show what will be created/updated
        editor.setValue(newContent);

        // Apply inline diff decorations to visualize changes
        // Use the shared function if available, otherwise use the local one
        const decorations = (window.generateEditorDiffDecorations || generateEditorDiffDecorations)(oldContent, newContent);

        // Apply the decorations
        const decorationIds = editor.deltaDecorations([], decorations);

        // Function to clean up after user decision
        function cleanup(isAccepted) {
            // Remove decorations and overlay
            editor.deltaDecorations(decorationIds, []);
            diffOverlay.hide();
            diffOverlay.remove(); // Completely remove the overlay from DOM

            // Get rejection reason if not accepted
            const rejectionReason = !isAccepted ? $('#rejection-reason').val() || '' : '';

            // Reset content to original if it's an existing file and not accepted
            if (!isAccepted && isExistingFile) {
                editor.setValue(oldContent);
            }

            // 注意：这里我们直接返回用户的决定
            // 文件的删除和标签页的关闭将在createFile函数中处理
            // 这样可以确保先删除文件，再关闭标签页
            resolve({
                accepted: isAccepted,
                rejectionReason: rejectionReason
            });
        }

        // Handle accept button
        $('#accept-inline-diff').off('click').on('click', function () {
            // Reset editor content to what the user is accepting
            editor.setValue(newContent);
            cleanup(true);
        });

        // Handle reject button
        $('#reject-inline-diff').off('click').on('click', function () {
            cleanup(false);
        });
    });
}

/**
 * Generate Monaco editor decorations to visualize diffs
 * @param {string} oldContent - Original content
 * @param {string} newContent - New content
 * @returns {Array} Array of decoration objects for Monaco editor
 */
// Use the shared generateEditorDiffDecorations function from vibecodingeditfile.js if available
if (typeof window.generateEditorDiffDecorations !== 'function') {
    function generateEditorDiffDecorations(oldContent, newContent) {
        const decorations = [];

        // If it's a new file (no old content), mark all lines as added
        if (!oldContent) {
            const newLines = newContent.split('\n');
            newLines.forEach((line, index) => {
                decorations.push({
                    range: new monaco.Range(index + 1, 1, index + 1, line.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-diff-added',
                        linesDecorationsClassName: 'monaco-diff-added-gutter',
                        // 添加minimap装饰
                        minimap: {
                            color: 'rgba(44, 190, 78, 0.7)',
                            position: monaco.editor.MinimapPosition.Inline
                        },
                        // 添加覆盖标尺装饰
                        overviewRuler: {
                            color: 'rgba(44, 190, 78, 0.7)',
                            position: monaco.editor.OverviewRulerLane.Full
                        }
                    }
                });
            });
            return decorations;
        }

        // If new content is empty (file being deleted or cleared), mark all lines as removed
        if (!newContent) {
            const oldLines = oldContent.split('\n');
            oldLines.forEach((line, index) => {
                decorations.push({
                    range: new monaco.Range(index + 1, 1, index + 1, line.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-diff-removed',
                        linesDecorationsClassName: 'monaco-diff-removed-gutter',
                        // 添加minimap装饰
                        minimap: {
                            color: 'rgba(203, 36, 49, 0.7)',
                            position: monaco.editor.MinimapPosition.Inline
                        },
                        // 添加覆盖标尺装饰
                        overviewRuler: {
                            color: 'rgba(203, 36, 49, 0.7)',
                            position: monaco.editor.OverviewRulerLane.Full
                        }
                    }
                });
            });
            return decorations;
        }

        // For modified files, compare line by line
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');

        // Create a simple diff algorithm (this could be enhanced with a proper diff algorithm)
        // For this example, we'll just color lines that are different
        const maxLines = Math.max(oldLines.length, newLines.length);

        for (let i = 0; i < maxLines; i++) {
            const oldLine = i < oldLines.length ? oldLines[i] : '';
            const newLine = i < newLines.length ? newLines[i] : '';

            if (oldLine !== newLine) {
                // Line was changed - in Monaco, we only show the new content with appropriate decorations
                const isAdded = !oldLine;
                decorations.push({
                    range: new monaco.Range(i + 1, 1, i + 1, newLine.length + 1),
                    options: {
                        isWholeLine: true,
                        className: isAdded ? 'monaco-diff-added' : 'monaco-diff-changed',
                        linesDecorationsClassName: isAdded ? 'monaco-diff-added-gutter' : 'monaco-diff-changed-gutter',
                        // 添加minimap装饰，绿色表示新增，黄色表示修改
                        minimap: {
                            color: isAdded
                                ? 'rgba(44, 190, 78, 0.7)'  // 绿色 - 新增
                                : 'rgba(255, 171, 0, 0.7)', // 黄色 - 修改
                            position: monaco.editor.MinimapPosition.Inline
                        },
                        // 添加覆盖标尺装饰
                        overviewRuler: {
                            color: isAdded
                                ? 'rgba(44, 190, 78, 0.7)'  // 绿色 - 新增
                                : 'rgba(255, 171, 0, 0.7)', // 黄色 - 修改
                            position: monaco.editor.OverviewRulerLane.Full
                        }
                    }
                });
            }
        }

        return decorations;
    }
    // Make it globally available
    window.generateEditorDiffDecorations = generateEditorDiffDecorations;
}

/**
 * Format file creation result for AI responses
 * @param {string} filePath - Path to the file that was created
 * @returns {string} Formatted response with file path
 */
function formatFileCreationForAI(filePath) {
    return `# 文件已创建\n\n文件路径: ${filePath}`;
}

/**
 * Format file creation error for AI responses
 * @param {Error} error - Error object from file creation
 * @returns {string} Formatted response with error message
 */
function formatFileCreationErrorForAI(error) {
    let message = `# 文件创建失败\n\n${error.message}`;

    // Add rejection reason if available
    if (error.cause && error.cause.rejectionReason) {
        message += `\n\n**拒绝原因：** ${error.cause.rejectionReason}`;
    }

    // Add special handling for permission errors
    if (error.message && error.message.includes('User activation is required')) {
        message = `# 需要文件权限\n\n创建文件需要用户授权文件系统权限。请点击"授权并继续"按钮，然后在浏览器弹出的权限请求中选择"允许"。\n\n如果您没有看到权限请求对话框，请点击文件或文件夹后再尝试。`;
    }

    return message;
}

// Export functions
window.VibeFileCreator = {
    createFile,
    formatFileCreationForAI,
    formatFileCreationErrorForAI
};
