/**
 * VibeCodeEditFile - Handles file editing operations for the Vibe Coding environment
 * This module provides functions for editing files by replacing content between specified line ranges
 */

/**
 * Detect if the user is on macOS
 * @returns {boolean} true if the user is on macOS
 */
// Only define isMacOS if it doesn't already exist (may be defined in vibecodecreatefile.js)
if (typeof window.isMacOS !== 'function') {
    function isMacOS() {
        return navigator.platform.indexOf('Mac') !== -1 ||
            navigator.userAgent.indexOf('Mac') !== -1;
    }
    // Make it globally available
    window.isMacOS = isMacOS;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (text === undefined || text === null) return '';

    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Edit a file by replacing content between specified line ranges
 * @param {string} filePath - Path to the file to edit
 * @param {string} newContent - Content to replace with
 * @param {number} startLine - Start line for the replacement (1-indexed)
 * @param {number} endLine - End line for the replacement (1-indexed)
 * @param {boolean} skipConfirmation - Skip the confirmation dialog (defaults to false)
 * @param {boolean} skipBackup - Skip creating backup (defaults to false)
 * @returns {Promise<Object>} A promise that resolves with the edit result
 */
async function editFile(filePath, newContent = '', startLine = 1, endLine = 1, skipConfirmation = false, skipBackup = false) {
    try {
        // Check if fileHandles is available from vibecoding.js
        if (typeof fileHandles === 'undefined' || !fileHandles) {
            throw new Error('File system not initialized. Please open a folder first.');
        }

        // Validate line numbers
        if (startLine < 1) startLine = 1;
        if (endLine < startLine) endLine = startLine;

        // Get file handle
        const fileHandle = fileHandles.get(filePath);
        if (!fileHandle) {
            throw new Error(`File not found: ${filePath}`);
        }

        let existingContent;
        try {
            // Read existing content
            const file = await fileHandle.getFile();
            existingContent = await file.text();
        } catch (error) {
            // Check if this is a permissions error
            if (error.message && error.message.includes('User activation is required')) {
                // Show permission request dialog to the user
                await showPermissionRequestDialog();

                // Retry the operation after user activation
                return editFile(filePath, newContent, startLine, endLine, skipConfirmation, skipBackup);
            }
            // If it's another error, re-throw it
            throw error;
        }

        // Split content into lines
        const lines = existingContent.split('\n');

        // Validate line range
        if (startLine > lines.length) {
            startLine = lines.length + 1;
            endLine = startLine;
        }
        if (endLine > lines.length) {
            endLine = lines.length;
        }

        // Create updated content by replacing the specified lines
        const beforeLines = lines.slice(0, startLine - 1);
        const afterLines = lines.slice(endLine);

        // Split the new content into lines
        const newContentLines = newContent.split('\n');

        // Combine the lines
        const updatedLines = [
            ...beforeLines,
            ...newContentLines,
            ...afterLines
        ];

        // Join the lines back into a string
        const updatedContent = updatedLines.join('\n');

        // If skip confirmation is true, show diff but apply the edit immediately
        if (skipConfirmation) {
            try {
                // Save the updated content first to ensure the file is modified
                await saveUpdatedContent(fileHandle, updatedContent, skipBackup);
                
                // Show notification to user without modifying the editor display
                await showAutoAppliedDiff(filePath, existingContent, updatedContent, startLine, endLine, newContent);
                
                // If the file is currently open in the editor, update its content without scrolling to top
                if (currentOpenFile === filePath && editor) {
                    // Get current scroll position and cursor position
                    const scrollTop = editor.getScrollTop();
                    const scrollLeft = editor.getScrollLeft();
                    const position = editor.getPosition();
                    
                    // Update editor content
                    editor.setValue(updatedContent);
                    
                    // Restore scroll and cursor position
                    if (position) {
                        editor.setPosition(position);
                    }
                    editor.setScrollTop(scrollTop);
                    editor.setScrollLeft(scrollLeft);
                }
                
                return {
                    success: true,
                    filePath,
                    message: 'File edited successfully'
                };
            } catch (error) {
                // Check if this is a permissions error
                if (error.message && error.message.includes('User activation is required')) {
                    // Show permission request dialog to the user
                    await showPermissionRequestDialog();

                    // Retry the operation after user activation
                    return editFile(filePath, newContent, startLine, endLine, skipConfirmation, skipBackup);
                }
                // If it's another error, re-throw it
                throw error;
            }
        }

        // Create edit information for the confirmation dialog
        const editInfo = {
            filePath,
            oldContent: existingContent,
            newContent: updatedContent,
            lineRanges: [{
                startLine,
                endLine,
                oldContent: lines.slice(startLine - 1, endLine).join('\n'),
                newContent
            }]
        };

        // Show the confirmation dialog for the edit
        const confirmResult = await showEditConfirmation(editInfo);

        if (!confirmResult.accepted) {
            return {
                success: false,
                filePath,
                message: 'Edit cancelled by user',
                rejectionReason: confirmResult.rejectionReason
            };
        }

        // Apply accepted edits
        try {
            const resultContent = confirmResult.resultContent || updatedContent;
            await saveUpdatedContent(fileHandle, resultContent, skipBackup);
            await refreshFileTree();

            return {
                success: true,
                filePath,
                message: 'File edited successfully',
                partial: confirmResult.partial
            };
        } catch (error) {
            // Check if this is a permissions error
            if (error.message && error.message.includes('User activation is required')) {
                // Show permission request dialog to the user
                await showPermissionRequestDialog();

                // Retry the operation after user activation
                return editFile(filePath, newContent, startLine, endLine, skipConfirmation, skipBackup);
            }
            // If it's another error, re-throw it
            throw error;
        }
    } catch (error) {
        console.error('Error editing file:', error);
        throw error;
    }
}


/**
 * Create a backup of the file before saving changes
 * @param {string} filePath - Path to the file to backup
 * @param {string} content - Content to backup
 * @returns {Promise<string>} A promise that resolves with the backup file path
 */
async function createFileBackup(filePath, content) {
    try {
        // Create backup directory path
        const backupRootDir = '.vibecodebak';

        // Get current date and time for the backup filename
        const now = new Date();
        const timestamp = now.getFullYear() +
            '_' + String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            '_' + String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        // Extract filename and extension
        const lastSlashIndex = filePath.lastIndexOf('/');
        const filename = filePath.substring(lastSlashIndex + 1);
        const lastDotIndex = filename.lastIndexOf('.');

        let filenameWithoutExt = filename;
        let extension = '';

        if (lastDotIndex !== -1) {
            filenameWithoutExt = filename.substring(0, lastDotIndex);
            extension = filename.substring(lastDotIndex);
        }

        // Create backup filename
        const backupFilename = filenameWithoutExt + timestamp + extension;

        // Get the root directory handle from the first entry in directoryHandles
        let rootDirHandle;
        let rootPath = '';

        if (directoryHandles.size > 0) {
            // Get the first entry which should be the root directory
            const firstEntry = directoryHandles.entries().next().value;
            if (firstEntry) {
                rootPath = firstEntry[0];
                rootDirHandle = firstEntry[1];
            }
        }

        if (!rootDirHandle) {
            console.error('Root directory handle not found');
            return '';
        }

        try {
            // Create backup directory in root if it doesn't exist
            let backupDirHandle;
            try {
                // Try to get existing backup directory
                backupDirHandle = await rootDirHandle.getDirectoryHandle(backupRootDir);
            } catch (err) {
                // Backup directory doesn't exist, create it
                backupDirHandle = await rootDirHandle.getDirectoryHandle(backupRootDir, { create: true });
            }

            // Create the directory structure matching the original file path
            const fileDir = filePath.substring(0, lastSlashIndex);
            const pathSegments = fileDir.split('/').filter(Boolean);
            let currentDirHandle = backupDirHandle;

            // Create each directory in the path
            for (const segment of pathSegments) {
                try {
                    // Try to get existing directory
                    try {
                        currentDirHandle = await currentDirHandle.getDirectoryHandle(segment);
                    } catch (err) {
                        // Directory doesn't exist, create it
                        currentDirHandle = await currentDirHandle.getDirectoryHandle(segment, { create: true });
                    }
                } catch (dirError) {
                    console.error(`Error creating directory ${segment}:`, dirError);
                    throw dirError;
                }
            }

            // Create the backup file
            const backupFileHandle = await currentDirHandle.getFileHandle(backupFilename, { create: true });
            const writable = await backupFileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            // Construct the full backup path for logging
            const backupFilePath = `${rootPath}/${backupRootDir}${fileDir}/${backupFilename}`;
            return backupFilePath;

        } catch (fsError) {
            console.error('File system error during backup:', fsError);

            // Fallback to using fetch API to create backup on server
            try {
                const backupFilePath = `${rootPath}/${backupRootDir}${filePath.substring(0, lastSlashIndex + 1)}${backupFilename}`;
                const response = await fetch('/api/filesystem/backup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        filePath: backupFilePath,
                        content: content
                    })
                });

                if (response.ok) {
                    //console.log(`Server-side backup created: ${backupFilePath}`);
                    return backupFilePath;
                } else {
                    console.error('Server backup failed:', await response.text());
                    return '';
                }
            } catch (fetchError) {
                console.error('Fetch error during backup:', fetchError);
                return '';
            }
        }
    } catch (error) {
        console.error('Error creating file backup:', error);
        // Don't throw error - we want the save to continue even if backup fails
        return '';
    }
}

/**
 * Save updated content to a file
 * @param {FileSystemFileHandle} fileHandle - File handle
 * @param {string} content - Content to write
 * @param {boolean} skipBackup - Skip creating backup (defaults to false)
 * @returns {Promise<void>}
 */
async function saveUpdatedContent(fileHandle, content, skipBackup = false) {
    // Find the file path for this handle
    const filePath = Array.from(fileHandles.entries())
        .find(entry => entry[1] === fileHandle)?.[0];

    if (filePath && !skipBackup) {
        // Create backup before saving
        try {
            // Get current file content for backup
            const file = await fileHandle.getFile();
            const currentContent = await file.text();

            // Create backup
            await createFileBackup(filePath, currentContent);
        } catch (backupError) {
            console.error('Error creating backup:', backupError);
            // Continue with save even if backup fails
        }
    }

    try {
        // Create writable stream
        const writable = await fileHandle.createWritable();

        // Write content
        await writable.write(content);

        // Close the stream
        await writable.close();

        // Update original content in the editor if the file is open
        if (filePath && originalContents) {
            originalContents.set(filePath, content);
        }

        // If the file is currently open in the editor, update its content
        if (filePath && currentOpenFile === filePath && editor) {
            // Get current cursor position and scroll position to restore it later
            const position = editor.getPosition();
            const scrollTop = editor.getScrollTop();
            const scrollLeft = editor.getScrollLeft();

            // Update editor content
            editor.setValue(content);

            // Restore cursor position and scroll position
            if (position) {
                editor.setPosition(position);
            }
            
            // Restore scroll position instead of centering the cursor position
            editor.setScrollTop(scrollTop);
            editor.setScrollLeft(scrollLeft);

            // Remove from dirty files since we just saved
            if (dirtyFiles && dirtyFiles.has(filePath)) {
                dirtyFiles.delete(filePath);
                if (typeof updateTabTitle === 'function') {
                    updateTabTitle(filePath, false);
                }
            }
        }

        // Signal success by returning the file path
        return filePath;
    } catch (error) {
        // Check if this is a permissions error
        if (error.message && error.message.includes('User activation is required')) {
            // Show permission request dialog to the user
            await showPermissionRequestDialog();

            // Retry the operation after user activation
            return saveUpdatedContent(fileHandle, content, skipBackup);
        }

        // Log the error for debugging
        console.error('Error saving file content:', error);

        // If it's another error, re-throw it
        throw error;
    }
}

/**
 * Display a permission request dialog to the user
 * @returns {Promise<void>} Promise that resolves when the dialog is closed
 */
// Only define showPermissionRequestDialog if it doesn't already exist (may be defined in vibecodecreatefile.js)
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
 * Show auto-applied diff for transparency during AI conversation
 * @param {string} filePath - Path to the file being edited
 * @param {string} oldContent - Original content
 * @param {string} newContent - New content after edit
 * @param {number} startLine - Start line of the edit
 * @param {number} endLine - End line of the edit
 * @param {string} editContent - The content that was inserted
 * @returns {Promise<void>}
 */
async function showAutoAppliedDiff(filePath, oldContent, newContent, startLine, endLine, editContent) {
    // First, open the file in the editor if it's not already open
    if (typeof openFile === 'function' && currentOpenFile !== filePath) {
        await openFile(filePath);
    }

    // Make sure we have an editor instance
    if (!editor) {
        console.warn('Editor instance not found for showing auto-applied diff');
        return;
    }

    // Remove existing overlay if it exists
    $('#editor-auto-diff-overlay').remove();

    // Create a temporary overlay to show the diff
    const diffOverlay = $(`
        <div id="editor-auto-diff-overlay" class="editor-diff-overlay auto-applied">
            <div class="diff-overlay-controls">
                <div class="diff-notification">
                    <i class="fas fa-robot"></i>
                    AI 自动应用修改 - 第 ${startLine} 到第 ${endLine} 行
                </div>
                <div class="diff-actions">
                    <div class="auto-apply-status">
                        <i class="fas fa-check-circle text-success"></i> 已自动应用
                    </div>
                </div>
            </div>
        </div>
    `);

    // Append to editor container
    $('#editor').parent().append(diffOverlay);

    // Save editor state and position before making changes
    const viewState = editor.saveViewState();
    const position = editor.getPosition();
    const scrollTop = editor.getScrollTop();
    const scrollLeft = editor.getScrollLeft();

    // Store the current editor content
    const currentEditorContent = editor.getValue();

    // Show notification overlay without changing editor content
    diffOverlay.show();

    // Auto-hide the overlay after a short delay
    setTimeout(() => {
        // Remove overlay
        diffOverlay.fadeOut(300, function () {
            $(this).remove();
        });
    }, 2000); // Show for 2 seconds
}

/**
 * Show confirmation dialog for file edits
 * @param {Object} editInfo - Information about the edits to show
 * @returns {Promise<Object>} A promise that resolves with the user's decision
 */
async function showEditConfirmation(editInfo) {
    return new Promise(async (resolve) => {
        let tabOpened = false;

        // First, open the file in the editor
        if (typeof openFile === 'function') {
            await openFile(editInfo.filePath);
            tabOpened = true;
        }

        // Make sure we have an editor instance
        if (!editor) {
            console.error('Editor instance not found');
            resolve({ accepted: false });
            return;
        }

        // Store original content before making changes
        const originalContent = editor.getValue();

        // Remove existing overlay if it exists to avoid conflicts with file creation functionality
        $('#editor-diff-overlay').remove();

        // Create the overlay container
        const diffOverlay = $(`
            <div id="editor-diff-overlay" class="editor-diff-overlay">
                <div class="diff-overlay-controls">
                    <div class="diff-notification">
                        <i class="fas fa-code-branch"></i>
                        ${editInfo.lineRanges.length} 修改${editInfo.lineRanges.length > 1 ? 's' : ''} 需要审核
                    </div>
                    <div class="diff-actions">
                        <div class="rejection-reason-container">
                            <input type="text" id="rejection-reason" placeholder="拒绝原因（选填）" />
                        </div>
                        <button class="diff-action-button reject-button" id="reject-changes">
                            <i class="fas fa-times"></i> 拒绝
                        </button>
                        <button class="diff-action-button accept-button" id="accept-changes">
                            <i class="fas fa-check"></i> 接受
                        </button>
                    </div>
                </div>
            </div>
        `);

        // Append to editor container
        $('#editor').parent().append(diffOverlay);

        // Display the overlay
        diffOverlay.show();

        // Create combined diff view content using the new GitHub-style diff
        const diffView = (window.createCombinedDiffView || createCombinedDiffView)(editInfo.oldContent, editInfo.newContent);

        // Set the editor content to show the diff view
        editor.setValue(diffView.content);

        // Apply diff decorations
        const decorationIds = editor.deltaDecorations([], diffView.decorations);

        // Remove any existing event handlers to prevent duplicates
        $('#accept-changes').off('click');
        $('#reject-changes').off('click');

        // Event handlers for buttons
        $('#accept-changes').on('click', function () {
            cleanupEditFIle(true);
        });

        $('#reject-changes').on('click', function () {
            cleanupEditFIle(false);
        });

        // Function to clean up and resolve
        function cleanupEditFIle(apply) {
            // Save current scroll position
            const scrollTop = editor ? editor.getScrollTop() : 0;
            const scrollLeft = editor ? editor.getScrollLeft() : 0;
            
            // Remove decorations and overlay
            if (editor) {
                editor.deltaDecorations(decorationIds, []);
            }

            // Make sure to hide and remove the overlay completely
            diffOverlay.hide();
            diffOverlay.remove(); // Completely remove the overlay from DOM

            // Remove event handlers to prevent memory leaks
            $('#accept-changes').off('click');
            $('#reject-changes').off('click');

            if (!apply) {
                // Get rejection reason if provided
                const rejectionReason = $('#rejection-reason').val();

                // Restore original content if not applying changes
                if (editor) {
                    editor.setValue(originalContent);
                    
                    // Restore scroll position
                    editor.setScrollTop(scrollTop);
                    editor.setScrollLeft(scrollLeft);
                }

                resolve({
                    accepted: false,
                    resultContent: editInfo.oldContent,
                    rejectionReason: rejectionReason || ''
                });
                return;
            }

            // Apply changes - set the new content without diff markers
            if (editor) {
                editor.setValue(editInfo.newContent);
                
                // Restore scroll position
                editor.setScrollTop(scrollTop);
                editor.setScrollLeft(scrollLeft);
            }

            // Trigger a custom event to notify that the edit was accepted
            const editAcceptedEvent = new CustomEvent('editAccepted', {
                detail: {
                    filePath: editInfo.filePath,
                    newContent: editInfo.newContent,
                    oldContent: editInfo.oldContent
                }
            });
            document.dispatchEvent(editAcceptedEvent);

            resolve({
                accepted: true,
                resultContent: editInfo.newContent,
                partial: false
            });
        }
    });
}

/**
 * Compute diff using LCS (Longest Common Subsequence) algorithm
 * @param {string[]} oldLines - Original content lines
 * @param {string[]} newLines - New content lines
 * @returns {Array} Array of diff operations
 */
function computeDiff(oldLines, newLines) {
    const n = oldLines.length;
    const m = newLines.length;

    // Dynamic programming table for LCS
    const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

    // Build the LCS table
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Reconstruct the diff sequence
    const diffOps = [];
    let i = n, j = m;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            // Lines are equal
            diffOps.unshift({ type: 'equal', oldIndex: i - 1, newIndex: j - 1 });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            // Line was inserted
            diffOps.unshift({ type: 'insert', oldIndex: -1, newIndex: j - 1 });
            j--;
        } else if (i > 0) {
            // Line was deleted
            diffOps.unshift({ type: 'delete', oldIndex: i - 1, newIndex: -1 });
            i--;
        }
    }

    return diffOps;
}

/**
 * Create a combined diff view content for Monaco editor
 * @param {string} oldContent - Original content
 * @param {string} newContent - New content
 * @returns {Object} Object containing combined content and decorations
 */
function createCombinedDiffView(oldContent, newContent) {
    if (!oldContent && !newContent) {
        return { content: '', decorations: [] };
    }

    // If it's a new file (no old content), mark all lines as added
    if (!oldContent) {
        const newLines = newContent.split('\n');
        const decorations = [];
        const contentLines = [];

        newLines.forEach((line, index) => {
            contentLines.push(`+ ${line}`);
            decorations.push({
                range: new monaco.Range(index + 1, 1, index + 1, line.length + 3),
                options: {
                    isWholeLine: true,
                    className: 'monaco-diff-added',
                    linesDecorationsClassName: 'monaco-diff-added-gutter',
                    minimap: {
                        color: 'rgba(44, 190, 78, 0.7)',
                        position: monaco.editor.MinimapPosition.Inline
                    },
                    overviewRuler: {
                        color: 'rgba(44, 190, 78, 0.7)',
                        position: monaco.editor.OverviewRulerLane.Full
                    }
                }
            });
        });

        return {
            content: contentLines.join('\n'),
            decorations: decorations
        };
    }

    // If new content is empty (file being deleted or cleared)
    if (!newContent) {
        const oldLines = oldContent.split('\n');
        const decorations = [];
        const contentLines = [];

        oldLines.forEach((line, index) => {
            contentLines.push(`- ${line}`);
            decorations.push({
                range: new monaco.Range(index + 1, 1, index + 1, line.length + 3),
                options: {
                    isWholeLine: true,
                    className: 'monaco-diff-removed',
                    linesDecorationsClassName: 'monaco-diff-removed-gutter',
                    minimap: {
                        color: 'rgba(203, 36, 49, 0.7)',
                        position: monaco.editor.MinimapPosition.Inline
                    },
                    overviewRuler: {
                        color: 'rgba(203, 36, 49, 0.7)',
                        position: monaco.editor.OverviewRulerLane.Full
                    }
                }
            });
        });

        return {
            content: contentLines.join('\n'),
            decorations: decorations
        };
    }

    // For modified files, use proper diff algorithm
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Compute diff using Myers algorithm
    const diffOps = computeDiff(oldLines, newLines);

    const contentLines = [];
    const decorations = [];
    let lineNumber = 1;

    for (const op of diffOps) {
        switch (op.type) {
            case 'equal':
                // Unchanged line
                const equalLine = `  ${oldLines[op.oldIndex]}`;
                contentLines.push(equalLine);
                lineNumber++;
                break;

            case 'delete':
                // Deleted line
                const deletedLine = `- ${oldLines[op.oldIndex]}`;
                contentLines.push(deletedLine);
                decorations.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, deletedLine.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-diff-removed',
                        linesDecorationsClassName: 'monaco-diff-removed-gutter',
                        minimap: {
                            color: 'rgba(203, 36, 49, 0.7)',
                            position: monaco.editor.MinimapPosition.Inline
                        },
                        overviewRuler: {
                            color: 'rgba(203, 36, 49, 0.7)',
                            position: monaco.editor.OverviewRulerLane.Full
                        }
                    }
                });
                lineNumber++;
                break;

            case 'insert':
                // Added line
                const addedLine = `+ ${newLines[op.newIndex]}`;
                contentLines.push(addedLine);
                decorations.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, addedLine.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-diff-added',
                        linesDecorationsClassName: 'monaco-diff-added-gutter',
                        minimap: {
                            color: 'rgba(44, 190, 78, 0.7)',
                            position: monaco.editor.MinimapPosition.Inline
                        },
                        overviewRuler: {
                            color: 'rgba(44, 190, 78, 0.7)',
                            position: monaco.editor.OverviewRulerLane.Full
                        }
                    }
                });
                lineNumber++;
                break;
        }
    }

    return {
        content: contentLines.join('\n'),
        decorations: decorations
    };
}

/**
 * Generate Monaco editor decorations to visualize diffs (GitHub-style)
 * @param {string} oldContent - Original content
 * @param {string} newContent - New content
 * @returns {Array} Array of decoration objects for Monaco editor
 */
// Use the shared function if it exists, otherwise define it
if (typeof window.generateEditorDiffDecorations !== 'function') {
    function generateEditorDiffDecorations(oldContent, newContent) {
        const diffView = createCombinedDiffView(oldContent, newContent);
        return diffView.decorations;
    }
    // Make it globally available
    window.generateEditorDiffDecorations = generateEditorDiffDecorations;
}

// Make the combined diff view function available globally
if (typeof window.createCombinedDiffView !== 'function') {
    window.createCombinedDiffView = createCombinedDiffView;
}

/**
 * Generate inline edit decorations and action regions
 * @param {Object} editInfo - Information about the edits
 * @returns {Object} Object containing decorations and action regions
 */
function generateInlineEditDecorations(editInfo) {
    const decorations = [];
    const regions = [];

    // Add instruction overlay
    decorations.push({
        range: new monaco.Range(1, 1, 1, 1),
        options: {
            isWholeLine: true,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            className: 'editor-instruction-line',
            glyphMarginClassName: 'editor-instruction-glyph',
            marginClassName: 'editor-instruction-margin',
            overviewRuler: {
                color: 'rgba(255, 204, 0, 0.7)',
                position: monaco.editor.OverviewRulerLane.Full
            },
            after: {
                content: '请查看并接受或拒绝以下更改',
                inlineClassName: 'editor-instruction-text'
            }
        }
    });

    // Add global action buttons at the top
    decorations.push({
        range: new monaco.Range(2, 1, 2, 1),
        options: {
            isWholeLine: true,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            className: 'editor-global-actions',
        }
    });

    // Add position for global action buttons
    regions.push({
        type: 'global',
        line: 2,
        column: 1,
        editId: 'global'
    });

    // Add decorations for each edit
    editInfo.lineRanges.forEach((range, index) => {
        const editId = `edit-${index}`;
        const startLine = range.startLine;
        const endLine = range.endLine;
        const headerLine = startLine > 1 ? startLine - 1 : startLine;

        // Add header decoration
        decorations.push({
            range: new monaco.Range(headerLine, 1, headerLine, 1),
            options: {
                isWholeLine: true,
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                className: 'edit-header',
                after: {
                    content: `修改 #${index + 1} (行 ${startLine}-${endLine})`,
                    inlineClassName: 'edit-header-text'
                }
            }
        });

        // Add position for action buttons
        regions.push({
            type: 'edit',
            line: headerLine,
            column: 1,
            editId: editId
        });

        // Add decorations for the edit content
        const newContentLines = range.newContent.split('\n');

        for (let i = 0; i < newContentLines.length; i++) {
            const lineNumber = startLine + i;
            const lineContent = newContentLines[i];

            if (lineContent.length > 0) {
                decorations.push({
                    range: new monaco.Range(lineNumber, 1, lineNumber, lineContent.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'monaco-diff-added',
                        linesDecorationsClassName: 'monaco-diff-added-gutter',
                        minimap: {
                            color: 'rgba(44, 190, 78, 0.7)',
                            position: monaco.editor.MinimapPosition.Inline
                        },
                        overviewRuler: {
                            color: 'rgba(44, 190, 78, 0.7)',
                            position: monaco.editor.OverviewRulerLane.Full
                        }
                    }
                });
            }
        }
    });

    return { decorations, regions };
}

/**
 * Add inline action buttons for edits
 * @param {Object} editor - Monaco editor instance
 * @param {Array} regions - Regions where to add buttons
 * @returns {Array} Array of widget IDs
 */
function addInlineActionButtons(editor, regions) {
    const widgetIds = [];
    const contentWidgetContribution = editor.getContribution('editor.contrib.contentWidgets');

    if (!contentWidgetContribution || !contentWidgetContribution.addWidget) {
        console.error('Content widget contribution not found');
        return widgetIds;
    }

    // Create global action buttons
    const globalRegion = regions.find(r => r.type === 'global');
    if (globalRegion) {
        const globalActionWidget = {
            getId: function () { return 'global-actions-widget'; },
            getDomNode: function () {
                const container = document.createElement('div');
                container.className = 'inline-global-actions';

                const acceptAllBtn = document.createElement('button');
                acceptAllBtn.className = 'inline-action-button global-action-button inline-action-accept-all';
                acceptAllBtn.innerHTML = '<i class="fas fa-check-circle"></i> 接受全部';
                acceptAllBtn.setAttribute('data-action', 'accept-all');

                const rejectAllBtn = document.createElement('button');
                rejectAllBtn.className = 'inline-action-button global-action-button inline-action-reject-all';
                rejectAllBtn.innerHTML = '<i class="fas fa-times-circle"></i> 拒绝全部';
                rejectAllBtn.setAttribute('data-action', 'reject-all');

                const applyBtn = document.createElement('button');
                applyBtn.className = 'inline-action-button global-action-button inline-action-apply';
                applyBtn.innerHTML = '<i class="fas fa-check"></i> 应用更改';
                applyBtn.setAttribute('data-action', 'apply');

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'inline-action-button global-action-button inline-action-cancel';
                cancelBtn.innerHTML = '<i class="fas fa-times"></i> 取消';
                cancelBtn.setAttribute('data-action', 'cancel');

                container.appendChild(acceptAllBtn);
                container.appendChild(rejectAllBtn);
                container.appendChild(applyBtn);
                container.appendChild(cancelBtn);

                return container;
            },
            getPosition: function () {
                return {
                    position: { lineNumber: globalRegion.line, column: 1 },
                    preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
                };
            }
        };

        contentWidgetContribution.addWidget(globalActionWidget);
        widgetIds.push(globalActionWidget);
    }

    // Create action buttons for each edit
    regions.filter(r => r.type === 'edit').forEach(region => {
        const actionWidget = {
            getId: function () { return `edit-actions-widget-${region.editId}`; },
            getDomNode: function () {
                const container = document.createElement('div');
                container.className = 'inline-edit-actions';

                const acceptBtn = document.createElement('button');
                acceptBtn.className = 'inline-action-button inline-action-accept active';
                acceptBtn.innerHTML = '<i class="fas fa-check"></i>';
                acceptBtn.setAttribute('data-action', 'accept');
                acceptBtn.setAttribute('data-edit-id', region.editId);
                acceptBtn.title = '接受此更改';

                const rejectBtn = document.createElement('button');
                rejectBtn.className = 'inline-action-button inline-action-reject';
                rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
                rejectBtn.setAttribute('data-action', 'reject');
                rejectBtn.setAttribute('data-edit-id', region.editId);
                rejectBtn.title = '拒绝此更改';

                container.appendChild(acceptBtn);
                container.appendChild(rejectBtn);

                return container;
            },
            getPosition: function () {
                return {
                    position: { lineNumber: region.line, column: 1 },
                    preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
                };
            }
        };

        contentWidgetContribution.addWidget(actionWidget);
        widgetIds.push(actionWidget);
    });

    return widgetIds;
}

/**
 * Format file edit result for AI responses
 * @param {Object} result - Result of the edit operation
 * @param {Object} editDetails - Optional edit details containing original and new content
 * @returns {string} Formatted response with edit result
 */
async function formatFileEditForAI(result, editDetails = null) {
    // If result is an error object
    if (result instanceof Error) {
        let message = `# 文件编辑失败\n\n${result.message}`;

        // Add special handling for permission errors
        if (result.message && result.message.includes('User activation is required')) {
            message = `# 需要文件权限\n\n编辑文件需要用户授权文件系统权限。请点击"授权并继续"按钮，然后在浏览器弹出的权限请求中选择"允许"。\n\n如果您没有看到权限请求对话框，请点击文件或文件夹后再尝试。`;
        }

        return message;
    }

    // Normal result handling
    if (!result.success) {
        let message = `# 文件编辑已取消\n\n用户拒绝了对文件 \`${result.filePath}\` 的更改。`;

        // Add rejection reason if provided
        if (result.rejectionReason) {
            message += `\n\n**拒绝原因：** ${result.rejectionReason}`;
        }

        return message;
    }

    if (result.partial) {
        return `# 文件部分编辑成功\n\n文件路径: ${result.filePath}\n\n用户选择性地接受了部分修改。`;
    }

    // For successful edits, show detailed modification information
    let message = `# 文件编辑成功\n\n文件路径: ${result.filePath}`;

    try {
        // Try to read the current file content to show what was actually modified
        if (typeof window.VibeFileReader !== 'undefined' && result.filePath) {
            const currentContent = await window.VibeFileReader.getFileContent(result.filePath);

            if (editDetails && editDetails.startLine && editDetails.endLine) {
                // Show the specific lines that were modified
                const lines = currentContent.split('\n');
                const startLine = editDetails.startLine;
                const endLine = Math.min(editDetails.endLine + (editDetails.newContent ? editDetails.newContent.split('\n').length - 1 : 0), lines.length);

                // Show a few lines before and after for context (up to 3 lines each)
                const contextBefore = Math.max(1, startLine - 10);
                const contextAfter = Math.min(lines.length, endLine + 10);

                message += `\n\n## 修改内容确认\n\n`;
                message += `**修改范围：** 第 ${startLine} 到第 ${endLine} 行\n\n`;
                message += `**当前文件内容（第 ${contextBefore} 到第 ${contextAfter} 行）：**\n\n`;
                message += '```\n';

                for (let i = contextBefore - 1; i < contextAfter; i++) {
                    const lineNumber = i + 1;
                    const lineContent = lines[i] || '';
                    const isModified = lineNumber >= startLine && lineNumber <= endLine;
                    const prefix = isModified ? '>' : ' ';
                    message += `${prefix} ${lineNumber}: ${lineContent}\n`;
                }

                message += '```\n\n';
                message += `带 ">" 标记的是刚修改的行。请确认修改是否正确。\n\n`;
                message += `**请确认：**\n`;
                message += `- ✅ 如果修改正确，请回复"修改确认无误，继续"或直接继续处理用户的其他需求\n`;
                message += `- 🔧 如果发现问题，请使用 edit_file 工具重新修改文件`;
            } else {
                // Show a summary if we don't have specific line details
                const totalLines = currentContent.split('\n').length;
                message += `\n\n文件已成功修改，当前共 ${totalLines} 行。\n\n`;
                message += `**请确认：**\n`;
                message += `- ✅ 如果修改正确，请回复"修改确认无误，继续"或直接继续处理用户的其他需求\n`;
                message += `- 🔧 如果需要进一步修改，请使用 edit_file 工具重新修改文件`;
            }
        }
    } catch (error) {
        // If we can't read the file content, just show basic success message
        message += `\n\n修改已应用，但无法读取当前内容进行确认。\n\n`;
        message += `**请确认：**\n`;
        message += `- ✅ 如果修改正确，请回复"修改确认无误，继续"或直接继续处理用户的其他需求\n`;
        message += `- 🔧 如果需要进一步修改，请使用 edit_file 工具重新修改文件`;
        console.warn('Failed to read file content for confirmation:', error);
    }

    return message;
}

/**
 * Create line-by-line diff display
 * @param {string[]} oldLines - Original content lines
 * @param {string[]} newLines - New content lines
 * @param {string} editId - ID of the edit this diff belongs to
 * @returns {string} HTML for the diff display
 */
function createLineDiffDisplay(oldLines, newLines, editId) {
    let diffHtml = '<div class="line-diff-container inline-view">';

    // Calculate the maximum number of lines to show
    const maxLines = Math.max(oldLines.length, newLines.length);

    // Generate line-by-line comparison
    for (let i = 0; i < maxLines; i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : '';
        const newLine = i < newLines.length ? newLines[i] : '';
        const hasOldLine = i < oldLines.length;
        const hasNewLine = i < newLines.length;

        // Determine line type: added, removed, or modified
        let lineType = 'unchanged';
        if (hasOldLine && !hasNewLine) {
            lineType = 'removed';
        } else if (!hasOldLine && hasNewLine) {
            lineType = 'added';
        } else if (oldLine !== newLine) {
            lineType = 'modified';
        }

        // Create line diff row
        diffHtml += `<div class="diff-line-row ${lineType}-line">`;

        // Line numbers
        diffHtml += `<div class="line-number old-line-number">${hasOldLine ? (i + 1) : ''}</div>`;
        diffHtml += `<div class="line-number new-line-number">${hasNewLine ? (i + 1) : ''}</div>`;

        // Line content - old content column
        if (hasOldLine) {
            diffHtml += `<div class="line-content old-line-content">${escapeHtml(oldLine)}</div>`;
        } else {
            diffHtml += `<div class="line-content old-line-content empty-line"></div>`;
        }

        // Line content - new content column
        if (hasNewLine) {
            diffHtml += `<div class="line-content new-line-content">${escapeHtml(newLine)}`;

            // Add toggle button for new/modified lines
            if (lineType === 'added' || lineType === 'modified') {
                diffHtml += `
                    <button class="line-toggle-btn btn-sm btn-success" 
                        data-edit-id="${editId}" 
                        data-line-index="${i}" 
                        title="接受/拒绝此行">
                        <i class="fas fa-check"></i>
                    </button>`;
            }

            diffHtml += `</div>`;
        } else {
            diffHtml += `<div class="line-content new-line-content empty-line"></div>`;
        }

        diffHtml += `</div>`;
    }

    diffHtml += '</div>';
    return diffHtml;
}

/**
 * Show file modification history for the current file
 * @param {string} filePath - Path to the file
 * @returns {Promise<void>}
 */
async function showFileModificationHistory(filePath) {
    try {
        if (!filePath) {
            showNotification('没有打开的文件', 'warning');
            return;
        }

        // Get root directory handle from the first entry in directoryHandles
        let rootDirHandle;
        let rootPath = '';

        if (directoryHandles.size > 0) {
            // Get the first entry which should be the root directory
            const firstEntry = directoryHandles.entries().next().value;
            if (firstEntry) {
                rootPath = firstEntry[0];
                rootDirHandle = firstEntry[1];
            }
        }

        if (!rootDirHandle) {
            showErrorDialog('无法访问根目录');
            return;
        }

        // Get backup directory handle
        const backupRootDir = '.vibecodebak';
        let backupDirHandle;

        try {
            backupDirHandle = await rootDirHandle.getDirectoryHandle(backupRootDir);
        } catch (err) {
            showNotification('没有找到备份历史', 'info');
            return;
        }

        // Extract file directory and name
        const lastSlashIndex = filePath.lastIndexOf('/');
        const fileDir = filePath.substring(0, lastSlashIndex);
        const fileName = filePath.substring(lastSlashIndex + 1);
        const fileNameWithoutExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
        const fileExt = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';

        // Navigate to the directory matching the file's path
        const pathSegments = fileDir.split('/').filter(Boolean);
        let currentDirHandle = backupDirHandle;

        try {
            for (const segment of pathSegments) {
                currentDirHandle = await currentDirHandle.getDirectoryHandle(segment);
            }
        } catch (err) {
            showNotification('该文件没有备份历史', 'info');
            return;
        }

        // Get all backup files for this file
        const backupFiles = [];

        for await (const entry of currentDirHandle.values()) {
            if (entry.kind === 'file' &&
                entry.name.startsWith(fileNameWithoutExt) &&
                entry.name.includes('_') &&
                entry.name.endsWith(fileExt)) {

                // Get file handle and file object
                const fileHandle = await currentDirHandle.getFileHandle(entry.name);
                const fileObj = await fileHandle.getFile();

                // Extract timestamp from filename
                // Find the position where the timestamp starts (right after the base filename)
                const timestampStartPos = fileNameWithoutExt.length;

                // Find where the extension starts
                const extensionStartPos = entry.name.lastIndexOf(fileExt);

                // Extract the timestamp string
                const timestampStr = entry.name.substring(timestampStartPos, extensionStartPos);

                // Parse timestamp
                let timestamp = '';
                let date = null;

                try {
                    // Match the timestamp pattern YYYY_MMDD_HHMMSS
                    const match = timestampStr.match(/(\d{4})_(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);

                    if (match) {
                        const year = match[1];
                        const month = match[2];
                        const day = match[3];
                        const hour = match[4];
                        const minute = match[5];
                        const second = match[6];

                        date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
                        timestamp = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                    } else {
                        // Fallback to displaying the raw timestamp string
                        timestamp = timestampStr;
                    }
                } catch (e) {
                    console.error('Error parsing timestamp:', e);
                    timestamp = timestampStr;
                }

                backupFiles.push({
                    name: entry.name,
                    path: `/${backupRootDir}${fileDir}/${entry.name}`,
                    timestamp: timestamp,
                    date: date,
                    size: fileObj.size,
                    handle: fileHandle
                });
            }
        }

        if (backupFiles.length === 0) {
            showNotification('该文件没有备份历史', 'info');
            return;
        }

        // Sort backups by date (newest first)
        backupFiles.sort((a, b) => {
            if (a.date && b.date) {
                return b.date - a.date;
            }
            return b.name.localeCompare(a.name);
        });

        // Create and show the history panel
        showHistoryPanel(filePath, backupFiles);

    } catch (error) {
        console.error('Error showing file history:', error);
        showErrorDialog('获取文件历史记录失败: ' + error.message);
    }
}

/**
 * Show the history panel with backup files
 * @param {string} currentFilePath - Path to the current file
 * @param {Array} backupFiles - Array of backup file objects
 */
function showHistoryPanel(currentFilePath, backupFiles) {
    // Remove existing panel if any
    $('#file-history-panel').remove();

    // Create panel
    const panel = $(`
        <div id="file-history-panel" class="file-history-panel">
            <div class="history-panel-header">
                <div class="history-title">
                    <i class="fas fa-history"></i> 文件修改历史
                </div>
                <div class="history-actions">
                    <button id="history-delete-all" class="history-action-btn" title="删除所有历史记录">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <button id="history-close" class="history-action-btn" title="关闭">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="history-panel-content">
                <div class="history-file-info">
                    <div class="current-file-name">${currentFilePath.split('/').pop()}</div>
                    <div class="current-file-path">${currentFilePath}</div>
                </div>
                <div class="history-list">
                    <div class="history-list-header">
                        <div class="history-date">备份时间</div>
                        <div class="history-size">大小</div>
                        <div class="history-actions">操作</div>
                    </div>
                    <div class="history-items">
                        <!-- History items will be added here -->
                    </div>
                </div>
            </div>
        </div>
    `);

    // Add history items
    const historyItems = panel.find('.history-items');

    backupFiles.forEach((file, index) => {
        const item = $(`
            <div class="history-item" data-path="${file.path}" data-index="${index}">
                <div class="history-date">
                    <i class="fas fa-clock"></i> ${file.timestamp}
                </div>
                <div class="history-size">
                    ${formatFileSize(file.size)}
                </div>
                <div class="history-item-actions">
                    <button class="history-preview-btn" title="预览">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="history-restore-btn" title="恢复">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="history-delete-btn" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `);

        // Add preview handler
        item.find('.history-preview-btn').on('click', async function () {
            try {
                // Read file content using the handle directly
                const fileObj = await file.handle.getFile();
                const content = await fileObj.text();

                // Show preview
                showHistoryPreview(currentFilePath, file.timestamp, content, file.handle, file.path);
            } catch (error) {
                console.error('Error previewing backup:', error);
                showErrorDialog('预览备份文件失败: ' + error.message);
            }
        });

        // Add restore handler
        item.find('.history-restore-btn').on('click', async function () {
            try {
                // Read file content using the handle directly
                const fileObj = await file.handle.getFile();
                const content = await fileObj.text();

                // Confirm restore
                const confirmResult = await showConfirmDialog(`确定要将文件恢复到 ${file.timestamp} 的版本吗？当前未保存的更改将丢失。`);

                if (confirmResult) {
                    // Get the current file handle
                    const fileHandle = fileHandles.get(currentFilePath);
                    if (!fileHandle) {
                        throw new Error('无法获取当前文件句柄');
                    }

                    // Create writable stream
                    const writable = await fileHandle.createWritable();

                    // Write content
                    await writable.write(content);
                    await writable.close();

                    // Update editor content if file is open
                    if (currentOpenFile === currentFilePath && editor) {
                        // Get current cursor position to restore it later
                        const position = editor.getPosition();

                        // Update editor content
                        editor.setValue(content);

                        // Restore cursor position if possible
                        if (position) {
                            editor.setPosition(position);
                            editor.revealPositionInCenter(position);
                        }

                        // Update original content
                        if (originalContents) {
                            originalContents.set(currentFilePath, content);
                        }

                        // Remove from dirty files
                        if (dirtyFiles && dirtyFiles.has(currentFilePath)) {
                            dirtyFiles.delete(currentFilePath);
                            updateTabTitle(currentFilePath, false);
                        }
                    }

                    // Close history panel
                    $('#file-history-panel').remove();

                    // Show success notification
                    showNotification('文件已恢复到历史版本');
                }
            } catch (error) {
                console.error('Error restoring backup:', error);
                showErrorDialog('恢复备份文件失败: ' + error.message);
            }
        });

        // Add delete handler
        item.find('.history-delete-btn').on('click', async function () {
            try {
                // Delete the backup file
                const deleted = await deleteHistoryFile(file.handle, file.path);

                if (deleted) {
                    // Remove the item from the UI
                    item.fadeOut(300, function () {
                        $(this).remove();

                        // If no more items, show a message
                        if ($('.history-item').length === 0) {
                            historyItems.html('<div class="no-history-message">没有更多历史记录</div>');
                        }
                    });
                }
            } catch (error) {
                console.error('Error deleting backup:', error);
                showErrorDialog('删除备份文件失败: ' + error.message);
            }
        });

        historyItems.append(item);
    });

    // Add delete all handler
    panel.find('#history-delete-all').on('click', async function () {
        try {
            // Delete all backup files
            const deleted = await deleteAllHistoryFiles(backupFiles, currentFilePath);

            if (deleted) {
                // Close the panel
                panel.remove();

                // Optionally refresh the history panel to show it's empty
                showFileModificationHistory(currentFilePath);
            }
        } catch (error) {
            console.error('Error deleting all backups:', error);
            showErrorDialog('删除所有备份文件失败: ' + error.message);
        }
    });

    // Add close handler
    panel.find('#history-close').on('click', function () {
        panel.remove();
    });

    // Add panel to the file explorer
    $('.file-explorer').append(panel);

    // Add keyboard shortcut to close panel with Escape key
    $(document).on('keydown.historyPanel', function (e) {
        if (e.key === 'Escape' && $('#file-history-panel').length > 0) {
            $('#file-history-panel').remove();
            $(document).off('keydown.historyPanel');
        }
    });
}

/**
 * Show preview of a backup file with diff comparison
 * @param {string} currentFilePath - Path to the current file
 * @param {string} timestamp - Timestamp of the backup
 * @param {string} historyContent - Content of the backup file
 * @param {FileSystemFileHandle} fileHandle - Handle to the backup file
 * @param {string} backupPath - Path of the backup file
 */
function showHistoryPreview(currentFilePath, timestamp, historyContent, fileHandle, backupPath) {
    // Remove existing preview if any
    $('#history-preview-overlay').remove();

    // Create preview overlay with diff layout
    const overlay = $(`
        <div id="history-preview-overlay" class="history-preview-overlay">
            <div class="history-preview-container">
                <div class="history-preview-header">
                    <div class="history-preview-title">
                        <i class="fas fa-history"></i> 历史版本对比: ${currentFilePath.split('/').pop()} (${timestamp})
                    </div>
                    <button class="history-preview-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="history-preview-content">
                    <div class="diff-container">
                        <div class="diff-editors">
                            <div class="diff-editor-current">
                                <div class="diff-editor-label">当前版本</div>
                                <div id="current-version-editor" class="diff-editor-instance"></div>
                            </div>
                            <div class="diff-editor-history">
                                <div class="diff-editor-label">历史版本 (${timestamp})</div>
                                <div id="history-version-editor" class="diff-editor-instance"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="history-preview-footer">
                    <button class="history-preview-restore">
                        <i class="fas fa-undo"></i> 恢复此版本
                    </button>
                    <button class="history-preview-delete">
                        <i class="fas fa-trash"></i> 删除此版本
                    </button>
                </div>
            </div>
        </div>
    `);

    // Add to body
    $('body').append(overlay);

    // Add keyboard shortcut to close preview with Escape key
    $(document).on('keydown.historyPreview', function (e) {
        if (e.key === 'Escape' && $('#history-preview-overlay').length > 0) {
            // If there are editor instances, dispose them
            if (window.currentVersionEditor) {
                window.currentVersionEditor.dispose();
                window.currentVersionEditor = null;
            }
            if (window.historyVersionEditor) {
                window.historyVersionEditor.dispose();
                window.historyVersionEditor = null;
            }

            // Remove overlay
            $('#history-preview-overlay').remove();

            // Remove event handler
            $(document).off('keydown.historyPreview');
        }
    });

    // Get current file content
    const getCurrentFileContent = async () => {
        try {
            // Get the current file handle
            const currentFileHandle = fileHandles.get(currentFilePath);
            if (!currentFileHandle) {
                throw new Error('无法获取当前文件句柄');
            }

            // Read current file content
            const file = await currentFileHandle.getFile();
            return await file.text();
        } catch (error) {
            console.error('Error reading current file:', error);
            showErrorDialog('读取当前文件失败: ' + error.message);
            return '';
        }
    };

    // Initialize editors with diff highlighting
    require(['vs/editor/editor.main'], async function () {
        // Get file extension for language
        const fileExt = currentFilePath.split('.').pop().toLowerCase();
        const language = getLanguageId(fileExt);

        // Get current file content
        const currentContent = await getCurrentFileContent();

        // Create common editor options
        const editorOptions = {
            language: language,
            theme: isDarkTheme ? 'vibe-dark' : 'vibe-light',
            readOnly: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'all',
            scrollbar: {
                verticalScrollbarSize: 14,
                horizontalScrollbarSize: 14
            }
        };

        // Create current version editor
        const currentVersionEditor = monaco.editor.create(
            document.getElementById('current-version-editor'),
            {
                ...editorOptions,
                value: currentContent
            }
        );

        // Create history version editor
        const historyVersionEditor = monaco.editor.create(
            document.getElementById('history-version-editor'),
            {
                ...editorOptions,
                value: historyContent
            }
        );

        // Store editor references
        window.currentVersionEditor = currentVersionEditor;
        window.historyVersionEditor = historyVersionEditor;

        // Apply diff decorations
        applyDiffDecorations(currentVersionEditor, historyVersionEditor, currentContent, historyContent);

        // Sync scrolling between editors
        currentVersionEditor.onDidScrollChange(e => {
            if (e.scrollTop !== undefined) {
                historyVersionEditor.setScrollTop(e.scrollTop);
            }
            if (e.scrollLeft !== undefined) {
                historyVersionEditor.setScrollLeft(e.scrollLeft);
            }
        });

        historyVersionEditor.onDidScrollChange(e => {
            if (e.scrollTop !== undefined) {
                currentVersionEditor.setScrollTop(e.scrollTop);
            }
            if (e.scrollLeft !== undefined) {
                currentVersionEditor.setScrollLeft(e.scrollLeft);
            }
        });

        // Handle window resize
        $(window).on('resize.diffEditors', function () {
            if (currentVersionEditor && historyVersionEditor) {
                currentVersionEditor.layout();
                historyVersionEditor.layout();
            }
        });

        // Handle close button
        overlay.find('.history-preview-close').on('click', function () {
            // Dispose editors
            currentVersionEditor.dispose();
            historyVersionEditor.dispose();
            window.currentVersionEditor = null;
            window.historyVersionEditor = null;

            // Remove resize handler
            $(window).off('resize.diffEditors');

            // Remove overlay
            overlay.remove();

            // Remove event handler
            $(document).off('keydown.historyPreview');
        });

        // Handle restore button
        overlay.find('.history-preview-restore').on('click', async function () {
            try {
                // Confirm restore
                const confirmResult = await showConfirmDialog(`确定要将文件恢复到此版本吗？当前未保存的更改将丢失。`);

                if (confirmResult) {
                    // Get the current file handle
                    const fileHandle = fileHandles.get(currentFilePath);
                    if (!fileHandle) {
                        throw new Error('无法获取当前文件句柄');
                    }

                    // Create writable stream
                    const writable = await fileHandle.createWritable();

                    // Write content
                    await writable.write(historyContent);
                    await writable.close();

                    // Update editor content if file is open
                    if (currentOpenFile === currentFilePath && editor) {
                        // Get current cursor position to restore it later
                        const position = editor.getPosition();

                        // Update editor content
                        editor.setValue(historyContent);

                        // Restore cursor position if possible
                        if (position) {
                            editor.setPosition(position);
                            editor.revealPositionInCenter(position);
                        }

                        // Update original content
                        if (originalContents) {
                            originalContents.set(currentFilePath, historyContent);
                        }

                        // Remove from dirty files
                        if (dirtyFiles && dirtyFiles.has(currentFilePath)) {
                            dirtyFiles.delete(currentFilePath);
                            updateTabTitle(currentFilePath, false);
                        }
                    }

                    // Dispose editors
                    currentVersionEditor.dispose();
                    historyVersionEditor.dispose();

                    // Remove overlay
                    overlay.remove();

                    // Close history panel
                    $('#file-history-panel').remove();

                    // Show success notification
                    showNotification('文件已恢复到历史版本');
                }
            } catch (error) {
                console.error('Error restoring backup:', error);
                showErrorDialog('恢复备份文件失败: ' + error.message);
            }
        });

        // Handle delete button
        overlay.find('.history-preview-delete').on('click', async function () {
            try {
                // Delete the backup file using the passed file handle
                const deleted = await deleteHistoryFile(fileHandle, backupPath);

                if (deleted) {
                    // Dispose editors
                    currentVersionEditor.dispose();
                    historyVersionEditor.dispose();

                    // Remove overlay
                    overlay.remove();

                    // Find and remove the item from the history panel
                    const historyItem = $(`.history-item[data-path="${backupPath}"]`);
                    if (historyItem.length > 0) {
                        historyItem.fadeOut(300, function () {
                            $(this).remove();

                            // If no more items, show a message
                            if ($('.history-item').length === 0) {
                                $('.history-items').html('<div class="no-history-message">没有更多历史记录</div>');
                            }
                        });
                    } else {
                        // Refresh the history panel if we can't find the item
                        $('#file-history-panel').remove();
                        showFileModificationHistory(currentFilePath);
                    }
                }
            } catch (error) {
                console.error('Error deleting backup:', error);
                showErrorDialog('删除备份文件失败: ' + error.message);
            }
        });
    });
}

/**
 * Apply diff decorations to compare two editor contents (GitHub-style)
 * @param {monaco.editor.IStandaloneCodeEditor} editorA - First editor instance (current)
 * @param {monaco.editor.IStandaloneCodeEditor} editorB - Second editor instance (history)
 * @param {string} contentA - Content of the first editor (current)
 * @param {string} contentB - Content of the second editor (history)
 */
function applyDiffDecorations(editorA, editorB, contentA, contentB) {
    // Create combined diff views for both editors
    const diffViewA = createCombinedDiffView(contentB, contentA); // Show what changed from history to current
    const diffViewB = createCombinedDiffView(contentA, contentB); // Show what changed from current to history

    // Set the diff content in both editors
    editorA.setValue(diffViewA.content);
    editorB.setValue(diffViewB.content);

    // Apply decorations
    editorA.deltaDecorations([], diffViewA.decorations);
    editorB.deltaDecorations([], diffViewB.decorations);
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Delete a backup history file
 * @param {FileSystemFileHandle} fileHandle - Handle to the backup file
 * @param {string} filePath - Path of the backup file
 * @returns {Promise<boolean>} A promise that resolves with the delete result
 */
async function deleteHistoryFile(fileHandle, filePath) {
    try {
        // Confirm deletion
        const confirmResult = await showConfirmDialog(`确定要删除此历史记录吗？此操作无法撤销。`);

        if (!confirmResult) {
            return false;
        }

        // Delete the file using the file handle
        await fileHandle.remove();

        // Show success notification
        showNotification('历史记录已删除', 'success');
        await refreshFileTree();
        return true;
    } catch (error) {
        console.error('Error deleting history file:', error);
        showErrorDialog('删除历史记录失败: ' + error.message);
        return false;
    }
}

/**
 * Delete all backup history files for a file
 * @param {Array} backupFiles - Array of backup file objects
 * @param {string} filePath - Path of the original file
 * @returns {Promise<boolean>} A promise that resolves with the delete result
 */
async function deleteAllHistoryFiles(backupFiles, filePath) {
    try {
        // Confirm deletion
        const confirmResult = await showConfirmDialog(`确定要删除 "${filePath.split('/').pop()}" 的所有历史记录吗？此操作无法撤销。`);

        if (!confirmResult) {
            return false;
        }

        // Keep track of deletion results
        let allDeleted = true;
        let deletedCount = 0;

        // Delete each backup file
        for (const file of backupFiles) {
            try {
                await file.handle.remove();
                deletedCount++;
            } catch (e) {
                console.error(`Error deleting backup file ${file.path}:`, e);
                allDeleted = false;
            }
        }

        // Show success notification
        if (deletedCount > 0) {
            showNotification(`已删除 ${deletedCount} 个历史记录`, 'success');
        }
        await refreshFileTree();
        return deletedCount > 0;
    } catch (error) {
        console.error('Error deleting all history files:', error);
        showErrorDialog('删除所有历史记录失败: ' + error.message);
        return false;
    }
}

// Add event listener for the file modification history menu item
$(document).ready(function () {
    $('#current_filemodification_record').on('click', function () {
        // Close the dropdown menu
        $('#editor-tabs-dropdown').removeClass('show');

        // Show file modification history for the current file
        showFileModificationHistory(currentOpenFile);
    });
});

// Export functions
window.VibeFileEditor = {
    editFile,
    formatFileEditForAI,
    showFileModificationHistory,
    deleteHistoryFile,
    deleteAllHistoryFiles,
    showEditConfirmation,
    showAutoAppliedDiff,
    createFileBackup,
    saveUpdatedContent
};

// Make sure escapeHtml is available globally if it's not already defined
if (typeof window.escapeHtml !== 'function') {
    window.escapeHtml = escapeHtml;
}

// Add CSS styles for Monaco editor diff decorations
$(document).ready(function () {
    // Only add styles if they don't already exist
    if ($('#monaco-diff-styles').length === 0) {
        $('head').append(`
            <style id="monaco-diff-styles">
                /* Monaco editor GitHub-style diff decorations */
                .monaco-diff-added {
                    background-color: rgba(46, 160, 67, 0.15) !important;
                    border-left: 3px solid #2ea043 !important;
                }
                
                .monaco-diff-removed {
                    background-color: rgba(248, 81, 73, 0.15) !important;
                    border-left: 3px solid #f85149 !important;
                }
                
                .monaco-diff-added-gutter::before {
                    content: '+';
                    color: #2ea043 !important;
                    font-weight: bold;
                    padding-right: 4px;
                }
                
                .monaco-diff-removed-gutter::before {
                    content: '-';
                    color: #f85149 !important;
                    font-weight: bold;
                    padding-right: 4px;
                }
                
                /* Ensure the diff prefix characters are properly styled */
                .monaco-editor .view-line span:first-child {
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                }
            </style>
        `);
    }
});
