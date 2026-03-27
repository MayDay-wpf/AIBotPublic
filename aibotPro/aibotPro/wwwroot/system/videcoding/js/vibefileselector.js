/**
 * VibeFileSelector - File selection component for Vibe Coding
 * Handles @ command in AI input box to select files from the file tree
 * Also supports drag and drop from file tree to input box
 * Supports image uploads via paste, drag and drop, and file selector
 */

(function() {
    // State variables
    let isSelectionActive = false;
    let selectionPopup = null;
    let selectedFiles = [];
    let uploadedImages = []; // Store uploaded image paths
    let fileTreeData = [];
    let inputElement = null;
    let inputWrapper = null;
    let triggerChar = '@';
    let currentQuery = '';
    let selectedIndex = 0;
    let selectedFileTags = [];
    let selectedImageTags = []; // Track image tags
    let dragTarget = null; // Element being dragged
    let thisAiModel = ''; // AI model for image upload

    /**
     * Initialize the file selector
     * @param {string} inputSelector - CSS selector for the input element
     * @param {string} aiModel - AI model identifier for image uploads
     */
    function init(inputSelector = '#ai-question', aiModel = '') {
        inputElement = $(inputSelector);
        thisAiModel = aiModel;
        
        if (!inputElement.length) {
            console.error('VibeFileSelector: Input element not found');
            return;
        }

        // Wrap the input element in a container for tags
        wrapInputElement();
        
        // Create selection popup element
        createSelectionPopup();
        
        // Attach event listeners
        attachEventListeners();
        
        // Initialize drag and drop
        initDragAndDrop();
        
        // Initialize image upload
        initImageUpload();
        
        console.log('VibeFileSelector initialized with drag and drop and image upload support');
    }

    /**
     * Wrap the input element in a container for tags
     */
    function wrapInputElement() {
        // Don't wrap if already wrapped
        if (inputElement.parent().hasClass('vibe-file-selector-input-wrapper')) {
            inputWrapper = inputElement.parent();
            return;
        }
        
        // Create wrapper
        inputElement.wrap('<div class="vibe-file-selector-input-wrapper"></div>');
        inputWrapper = inputElement.parent();
        
        // Create tags container
        const tagsContainer = $('<div class="vibe-file-selector-tags"></div>');
        
        // Create upload button
        const uploadButton = $(`
            <button class="vibe-image-upload-btn" title="上传图片">
                <i class="fas fa-image"></i>
            </button>
        `);
        
        // Add containers to wrapper
        inputWrapper.prepend(tagsContainer);
        inputWrapper.append(uploadButton);
        
        // Create hidden file input for image uploads
        const fileInput = $('<input type="file" class="vibe-hidden-file-input" accept="image/*" style="display:none;">');
        inputWrapper.append(fileInput);
    }

    /**
     * Create the selection popup element
     */
    function createSelectionPopup() {
        // Remove existing popup if any
        $('.vibe-file-selector-popup').remove();
        
        // Create new popup
        selectionPopup = $(`
            <div class="vibe-file-selector-popup">
                <div class="vibe-file-selector-header">
                    <div class="vibe-file-selector-title">
                        <span>选择文件</span>
                        <span class="vibe-file-selector-counter">0 个文件</span>
                    </div>
                    <button class="vibe-file-selector-close"><i class="fas fa-times"></i></button>
                </div>
                <div class="vibe-file-selector-search">
                    <input type="text" placeholder="搜索文件..." class="vibe-file-selector-search-input">
                </div>
                <div class="vibe-file-selector-list"></div>
            </div>
        `);
        
        // Add to body
        $('body').append(selectionPopup);
        
        // Add event listeners for popup
        selectionPopup.find('.vibe-file-selector-close').on('click', hideSelectionPopup);
        selectionPopup.find('.vibe-file-selector-search-input').on('input', handleSearchInput);
        
        // Initially hide the popup
        selectionPopup.hide();
    }

    /**
     * Attach event listeners to the input element
     */
    function attachEventListeners() {
        // Monitor input for @ character
        inputElement.on('input', function(e) {
            const text = $(this).val();
            const cursorPos = this.selectionStart;
            
            // Check if @ was just typed
            if (text[cursorPos - 1] === triggerChar && !isSelectionActive) {
                startSelection();
            } else if (isSelectionActive) {
                // Update search query if selection is active
                updateSearchQuery(text, cursorPos);
            }
        });
        
        // Handle keyboard navigation in popup
        inputElement.on('keydown', function(e) {
            if (!isSelectionActive) return;
            
            switch (e.which) {
                case 27: // Escape
                    e.preventDefault();
                    hideSelectionPopup();
                    break;
                case 38: // Arrow Up
                    e.preventDefault();
                    navigateSelection(-1);
                    break;
                case 40: // Arrow Down
                    e.preventDefault();
                    navigateSelection(1);
                    break;
                case 13: // Enter
                    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        selectCurrentItem();
                        // Don't hide popup after selection
                    }
                    break;
                case 9: // Tab
                    if (isSelectionActive) {
                        e.preventDefault();
                        selectCurrentItem();
                        // Don't hide popup after selection
                    }
                    break;
            }
        });
        
        // Close popup when clicking outside
        $(document).on('click', function(e) {
            if (isSelectionActive && 
                !$(e.target).closest('.vibe-file-selector-popup').length && 
                !$(e.target).closest('.vibe-file-selector-input-wrapper').length) {
                hideSelectionPopup();
            }
        });
        
        // Handle clicks on file tags
        inputWrapper.on('click', '.vibe-file-tag-remove', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tagElement = $(this).closest('.vibe-file-tag');
            const filePath = tagElement.data('path');
            
            // Remove file from selected files
            removeSelectedFile(filePath);
            
            // Remove tag element
            tagElement.remove();
            
            // Update counter if popup is visible
            if (isSelectionActive) {
                updateSelectionCounter();
                updateFileList();
            }
        });
        
        // Handle clicks on image tags
        inputWrapper.on('click', '.vibe-image-tag-remove', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const tagElement = $(this).closest('.vibe-image-tag');
            const imagePath = tagElement.data('path');
            
            // Remove image from uploaded images
            removeUploadedImage(imagePath);
            
            // Remove tag element
            tagElement.remove();
        });
        
        // Handle image upload button click
        inputWrapper.on('click', '.vibe-image-upload-btn', function(e) {
            e.preventDefault();
            // Trigger hidden file input
            inputWrapper.find('.vibe-hidden-file-input').click();
        });
        
        // Handle file selection for image upload - use event delegation
        inputWrapper.on('change', '.vibe-hidden-file-input', function(e) {
            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                uploadImage(file);
                // Clear the input to allow selecting the same file again
                $(this).val('');
            }
        });
    }

    /**
     * Start the file selection process
     */
    function startSelection() {
        isSelectionActive = true;
        currentQuery = '';
        selectedIndex = 0;
        
        // Get file tree data
        loadFileTreeData();
        
        // Show and position the popup
        showSelectionPopup();
        
        // Focus the search input
        setTimeout(() => {
            selectionPopup.find('.vibe-file-selector-search-input').focus();
        }, 100);
    }

    /**
     * Load file tree data from the DOM
     */
    function loadFileTreeData() {
        fileTreeData = [];
        
        // Get all file items from the file tree
        $('.tree-file').each(function() {
            const path = $(this).data('path');
            const name = $(this).text().trim();
            
            if (path) {
                fileTreeData.push({
                    path: path,
                    name: name,
                    type: 'file'
                });
            }
        });
        
        // Get all folder items from the file tree
        $('.tree-folder').each(function() {
            const path = $(this).data('path');
            const name = $(this).clone().children().remove().end().text().trim();
            
            if (path) {
                fileTreeData.push({
                    path: path,
                    name: name,
                    type: 'folder'
                });
            }
        });
        
        // Sort by name
        fileTreeData.sort((a, b) => {
            // Folders first, then files
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
    }

    /**
     * Show and position the selection popup
     */
    function showSelectionPopup() {
        if (!selectionPopup) return;
        
        // Position the popup relative to the input
        const inputPos = inputElement.offset();
        const inputHeight = inputElement.outerHeight();
        const popupHeight = 350; // Approximate height of popup
        
        // Position above the input instead of below
        selectionPopup.css({
            top: (inputPos.top - popupHeight) + 'px',
            left: inputPos.left + 'px',
            width: Math.max(300, inputElement.outerWidth()) + 'px'
        });
        
        // Clear the search input
        selectionPopup.find('.vibe-file-selector-search-input').val('');
        
        // Show the popup
        selectionPopup.show();
        
        // Update the file list
        updateFileList();
        
        // Update the selection counter
        updateSelectionCounter();
    }

    /**
     * Hide the selection popup
     */
    function hideSelectionPopup() {
        if (!selectionPopup) return;
        
        selectionPopup.hide();
        isSelectionActive = false;
        
        // Only remove the @ character if no files were selected
        if (selectedFiles.length === 0) {
            removeAtCharacter();
        }
    }
    
    /**
     * Remove the @ character from the input
     */
    function removeAtCharacter() {
        const text = inputElement.val();
        const cursorPos = inputElement[0].selectionStart;
        
        // Find the @ character
        let startPos = cursorPos - 1;
        while (startPos >= 0 && text[startPos] !== triggerChar) {
            startPos--;
        }
        
        if (startPos >= 0 && text[startPos] === triggerChar) {
            // Remove the @ character and any text after it up to cursor position
            const newText = text.substring(0, startPos) + text.substring(cursorPos);
            inputElement.val(newText);
            
            // Set cursor position
            const newCursorPos = startPos;
            inputElement[0].setSelectionRange(newCursorPos, newCursorPos);
        }
    }

    /**
     * Update the search query based on input text
     * @param {string} text - Current input text
     * @param {number} cursorPos - Current cursor position
     */
    function updateSearchQuery(text, cursorPos) {
        // Find the start of the current @ command
        let startPos = cursorPos - 1;
        while (startPos >= 0 && text[startPos] !== triggerChar) {
            startPos--;
        }
        
        if (startPos >= 0 && text[startPos] === triggerChar) {
            currentQuery = text.substring(startPos + 1, cursorPos).trim();
            selectionPopup.find('.vibe-file-selector-search-input').val(currentQuery);
            updateFileList();
        }
    }

    /**
     * Handle search input in the popup
     */
    function handleSearchInput() {
        currentQuery = $(this).val().trim();
        updateFileList();
    }

    /**
     * Update the file list based on the current search query
     */
    function updateFileList() {
        const listElement = selectionPopup.find('.vibe-file-selector-list');
        listElement.empty();
        
        // Filter files based on query
        const filteredFiles = fileTreeData.filter(file => {
            return file.name.toLowerCase().includes(currentQuery.toLowerCase()) ||
                   file.path.toLowerCase().includes(currentQuery.toLowerCase());
        });
        
        if (filteredFiles.length === 0) {
            listElement.append('<div class="vibe-file-selector-empty">没有找到匹配的文件</div>');
            return;
        }
        
        // Add files to list
        filteredFiles.forEach((file, index) => {
            const isSelected = selectedFiles.some(f => f.path === file.path);
            const itemClass = index === selectedIndex ? 'vibe-file-selector-item selected' : 'vibe-file-selector-item';
            const icon = file.type === 'folder' ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>';
            
            const item = $(`
                <div class="${itemClass}" data-path="${file.path}" data-type="${file.type}">
                    ${icon} <span class="vibe-file-selector-item-name">${file.name}</span>
                    <span class="vibe-file-selector-item-path">${file.path}</span>
                    <span class="vibe-file-selector-item-check">
                        <i class="fas ${isSelected ? 'fa-check-square' : 'fa-square'}"></i>
                    </span>
                </div>
            `);
            
            item.on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleFileSelection(file);
                return false; // Prevent event bubbling
            });
            
            listElement.append(item);
        });
    }

    /**
     * Navigate through the file list
     * @param {number} direction - Direction to navigate (1 for down, -1 for up)
     */
    function navigateSelection(direction) {
        const items = selectionPopup.find('.vibe-file-selector-item');
        
        // Update selected index
        selectedIndex += direction;
        
        // Handle wrapping
        if (selectedIndex < 0) {
            selectedIndex = items.length - 1;
        } else if (selectedIndex >= items.length) {
            selectedIndex = 0;
        }
        
        // Update UI
        items.removeClass('selected');
        items.eq(selectedIndex).addClass('selected');
        
        // Scroll to selected item if needed
        const selectedItem = items.eq(selectedIndex);
        const container = selectionPopup.find('.vibe-file-selector-list');
        
        const itemTop = selectedItem.position().top;
        const itemBottom = itemTop + selectedItem.outerHeight();
        const containerHeight = container.height();
        
        if (itemTop < 0) {
            container.scrollTop(container.scrollTop() + itemTop);
        } else if (itemBottom > containerHeight) {
            container.scrollTop(container.scrollTop() + itemBottom - containerHeight);
        }
    }

    /**
     * Select the currently highlighted item
     */
    function selectCurrentItem() {
        const items = selectionPopup.find('.vibe-file-selector-item');
        if (items.length === 0) return;
        
        const selectedItem = items.eq(selectedIndex);
        const path = selectedItem.data('path');
        const type = selectedItem.data('type');
        const name = selectedItem.find('.vibe-file-selector-item-name').text();
        
        toggleFileSelection({
            path: path,
            name: name,
            type: type
        });
    }

    /**
     * Toggle selection of a file
     * @param {Object} file - File object to toggle
     */
    function toggleFileSelection(file) {
        const index = selectedFiles.findIndex(f => f.path === file.path);
        
        if (index === -1) {
            // Add to selected files
            selectedFiles.push(file);
            addFileTag(file);
        } else {
            // Remove from selected files
            selectedFiles.splice(index, 1);
            removeFileTag(file.path);
        }
        
        // Update UI
        updateFileList();
        updateSelectionCounter();
        
        // Important: Do not hide the popup after selection
        // The popup should stay open to allow multiple selections
    }
    
    /**
     * Add a file tag to the input wrapper
     * @param {Object} file - File object to add
     */
    function addFileTag(file) {
        const tagsContainer = inputWrapper.find('.vibe-file-selector-tags');
        const icon = file.type === 'folder' ? '<i class="fas fa-folder"></i>' : '<i class="fas fa-file"></i>';
        
        const tag = $(`
            <div class="vibe-file-tag" data-path="${file.path}" data-type="${file.type}">
                ${icon} <span>${file.name}</span>
                <button class="vibe-file-tag-remove"><i class="fas fa-times"></i></button>
            </div>
        `);
        
        tagsContainer.append(tag);
        
        // Add to selected file tags array for tracking
        selectedFileTags.push({
            path: file.path,
            element: tag
        });
    }
    
    /**
     * Remove a file tag from the input wrapper
     * @param {string} filePath - Path of the file to remove
     */
    function removeFileTag(filePath) {
        const tagIndex = selectedFileTags.findIndex(tag => tag.path === filePath);
        
        if (tagIndex !== -1) {
            // Remove the DOM element
            selectedFileTags[tagIndex].element.remove();
            
            // Remove from tracking array
            selectedFileTags.splice(tagIndex, 1);
        }
    }
    
    /**
     * Remove a file from the selected files array
     * @param {string} filePath - Path of the file to remove
     */
    function removeSelectedFile(filePath) {
        const index = selectedFiles.findIndex(f => f.path === filePath);
        
        if (index !== -1) {
            selectedFiles.splice(index, 1);
        }
    }

    /**
     * Get the currently selected files
     * @returns {Array} Array of selected file objects
     */
    function getSelectedFiles() {
        return [...selectedFiles];
    }
    
    /**
     * Clear all selected files and tags
     */
    function clearSelectedFiles() {
        // Clear arrays
        selectedFiles = [];
        
        // Clear DOM elements
        selectedFileTags.forEach(tag => {
            tag.element.remove();
        });
        
        selectedFileTags = [];
    }

    /**
     * Update the selection counter in the popup header
     */
    function updateSelectionCounter() {
        if (!selectionPopup) return;
        
        const counter = selectionPopup.find('.vibe-file-selector-counter');
        counter.text(`${selectedFiles.length} 个文件`);
    }

    /**
     * Initialize drag and drop functionality
     */
    function initDragAndDrop() {
        // Make file tree items draggable
        makeDraggable();
        
        // Make AI input area a drop target
        makeDropTarget();
    }
    
    /**
     * Make file tree items draggable
     */
    function makeDraggable() {
        // Keep track of the original target to prevent multiple elements from being dragged
        let originalDragTarget = null;
        
        // Use event delegation for file tree items
        $('#file-tree').on('mousedown', '.tree-item', function(e) {
            // Only enable drag with left mouse button
            if (e.which !== 1) return;
            
            // If we already have a drag target, ignore this event
            if (originalDragTarget) return;
            
            // Store the original target to ensure only one element can be dragged at a time
            originalDragTarget = this;
            
            // Make sure the path attribute exists
            if (!$(this).data('path')) {
                console.warn('Tree item missing path attribute:', this);
                originalDragTarget = null;
                return;
            }
            
            // Stop event propagation to prevent parent elements from also starting a drag
            e.stopPropagation();
            
            // Store the target
            dragTarget = $(this);
            
            // Add draggable attributes
            dragTarget.attr('draggable', 'true');
            
            // Handle dragstart event
            dragTarget.on('dragstart', function(e) {
                // Prevent event bubbling to parent elements
                e.stopPropagation();
                handleDragStart.call(this, e);
            });
        });
        
        // Handle dragend globally to ensure cleanup
        $(document).on('dragend', function(e) {
            if (dragTarget) {
                // Remove draggable attribute from the drag target
                dragTarget.attr('draggable', 'false');
                
                // Remove event handlers
                dragTarget.off('dragstart');
                
                // Remove visual cue
                dragTarget.removeClass('dragging');
                
                // Clear targets
                dragTarget = null;
                originalDragTarget = null;
            }
        });
        
        // Handle mouseup to reset drag state if drag didn't start
        $(document).on('mouseup', function() {
            if (originalDragTarget && dragTarget) {
                // Remove draggable attribute
                dragTarget.attr('draggable', 'false');
                dragTarget.off('dragstart');
            }
            
            // Reset drag state
            originalDragTarget = null;
        });
        
        // Log available tree items for debugging
        console.log('Available file tree items:', $('.tree-item').length);
        console.log('File items:', $('.tree-file').length);
        console.log('Folder items:', $('.tree-folder').length);
    }
    
    /**
     * Handle drag start event
     * @param {Event} e - Drag event
     */
    function handleDragStart(e) {
        // Prevent event bubbling
        e.stopPropagation();
        
        // Clone the event to prevent any modifications
        const originalEvent = e.originalEvent;
        
        // Get the actual target element
        const target = $(e.currentTarget || this);
        
        // Get file info directly from the DOM element
        const path = target.data('path');
        
        // Get the correct name based on element type
        let name;
        if (target.hasClass('tree-folder')) {
            // For folders, remove child elements to get just the folder name text
            name = target.clone().children().remove().end().text().trim();
        } else {
            // For files, just get the text content, excluding any nested elements
            name = target.contents().filter(function() {
                return this.nodeType === 3; // Text nodes only
            }).text().trim();
            
            // If we didn't get a name, try getting it from the last part of the path
            if (!name && path) {
                const pathParts = path.split('/');
                name = pathParts[pathParts.length - 1];
            }
        }
        
        const type = target.hasClass('tree-folder') ? 'folder' : 'file';
        
        // Verify all data is present
        if (!path || !name) {
            console.error('Missing data for drag operation:', { path, name, type });
            // Cancel the drag operation
            e.preventDefault();
            return false;
        }
        
        // Log the data for debugging
        console.log('Starting drag for item:', { path, name, type, element: target[0] });
        
        // Create the transfer data
        const transferData = {
            path: path,
            name: name,
            type: type
        };
        
        try {
            // Set the drag data with serialized JSON
            originalEvent.dataTransfer.setData('application/json', JSON.stringify(transferData));
            
            // Add custom data to help identify this specific drag
            originalEvent.dataTransfer.setData('text/plain', path);
            
            // Set drag effect
            originalEvent.dataTransfer.effectAllowed = 'copy';
            
            // For Firefox compatibility, set the drag image
            if (originalEvent.dataTransfer.setDragImage) {
                // Create temp element for drag image
                const dragImage = target.clone()
                    .css({
                        'background-color': '#264f78',
                        'color': 'white',
                        'padding': '5px 10px',
                        'border-radius': '3px',
                        'max-width': '300px',
                        'white-space': 'nowrap',
                        'overflow': 'hidden',
                        'text-overflow': 'ellipsis'
                    })
                    .text(name)
                    .appendTo(document.body);
                
                // Set the drag image
                originalEvent.dataTransfer.setDragImage(dragImage[0], 10, 10);
                
                // Remove temp element after a moment
                setTimeout(() => {
                    dragImage.remove();
                }, 100);
            }
            
            // Add visual cue to original element
            target.addClass('dragging');
        } catch (error) {
            console.error('Error setting drag data:', error);
            return false;
        }
        
        return true;
    }
    
    /**
     * Make AI input area a drop target
     */
    function makeDropTarget() {
        // Create a drop indicator that follows the cursor
        const dropIndicator = $('<div class="vibe-file-drop-indicator">拖拽文件到输入框</div>');
        $('body').append(dropIndicator);
        dropIndicator.hide();
        
        // Create drop overlay for the AI input wrapper
        const dropOverlay = $('<div class="vibe-file-drop-overlay">将文件添加到上下文中</div>');
        inputWrapper.append(dropOverlay);
        dropOverlay.hide();
        
        // Handle dragover to allow dropping
        inputWrapper.on('dragover', function(e) {
            // Only allow drops if we have JSON data
            if (e.originalEvent.dataTransfer.types.includes('application/json')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show drop overlay
                dropOverlay.show();
                
                // Add highlighting
                inputWrapper.addClass('drag-over');
                
                // Set drop effect
                e.originalEvent.dataTransfer.dropEffect = 'copy';
            }
        });
        
        // Handle drag enter
        inputWrapper.on('dragenter', function(e) {
            // Only process if we have JSON data
            if (e.originalEvent.dataTransfer.types.includes('application/json')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show drop overlay
                dropOverlay.show();
                
                // Add highlighting
                inputWrapper.addClass('drag-over');
            }
        });
        
        // Handle drag leave
        inputWrapper.on('dragleave', function(e) {
            // Only consider leave if it's not entering a child element
            if (e.target === inputWrapper[0]) {
                // Hide overlay
                dropOverlay.hide();
                
                // Remove highlighting
                inputWrapper.removeClass('drag-over');
            }
        });
        
        // Handle drop with improved error handling
        inputWrapper.on('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Hide overlay
            dropOverlay.hide();
            
            // Remove highlighting
            inputWrapper.removeClass('drag-over');
            
            try {
                // Check if we have JSON data
                if (!e.originalEvent.dataTransfer.types.includes('application/json')) {
                    console.warn('Drop event does not contain JSON data');
                    return;
                }
                
                // Get file data from drag event
                const jsonData = e.originalEvent.dataTransfer.getData('application/json');
                console.log('Drop received in input with data:', jsonData);
                
                if (jsonData) {
                    try {
                        const fileData = JSON.parse(jsonData);
                        console.log('Parsed file data for input:', fileData);
                        
                        // Read the plain text version to double-check
                        const plainTextPath = e.originalEvent.dataTransfer.getData('text/plain');
                        console.log('Text version of path:', plainTextPath);
                        
                        // Use text version if JSON parsing somehow failed to get the path
                        if (!fileData.path && plainTextPath) {
                            fileData.path = plainTextPath;
                            const pathParts = plainTextPath.split('/');
                            fileData.name = pathParts[pathParts.length - 1];
                            fileData.type = fileData.name.includes('.') ? 'file' : 'folder';
                        }
                        
                        // Verify data is valid
                        if (!fileData.path) {
                            console.error('Dropped file missing path information');
                            return;
                        }
                        
                        // Add file to selection
                        addFileToSelection(fileData);

                    } catch (error) {
                        console.error('Error parsing drag data JSON for input:', error);
                    }
                } else {
                    console.warn('No JSON data received from drop in input');
                }
            } catch (error) {
                console.error('Error handling drop event in input:', error);
            }
        });
        
        // Handle document-level events to clean up
        $(document).on('dragend drop', function() {
            // Hide drop overlay
            dropOverlay.hide();
            
            // Remove highlighting
            inputWrapper.removeClass('drag-over');
            
            // Remove dragging class from all items
            $('.tree-item').removeClass('dragging');
            
            // Hide drop indicator
            dropIndicator.hide();
        });
        
        // Update drop indicator position during drag
        $(document).on('dragover', function(e) {
            e.preventDefault();
            
            // If we have a drag target and the dataTransfer contains our data type
            if (dragTarget && e.originalEvent.dataTransfer.types.includes('application/json')) {
                // Position drop indicator near cursor
                dropIndicator.css({
                    left: e.clientX + 15,
                    top: e.clientY + 15
                });
                
                // Show indicator
                dropIndicator.show();
            }
        });
    }
    
    /**
     * Add file to selection
     * @param {Object} fileData - File data object with path, name, and type
     */
    function addFileToSelection(fileData) {
        // Validate file data
        if (!fileData || !fileData.path) {
            console.error('Invalid file data for selection:', fileData);
            return;
        }
        
        // Log the file being added
        //console.log('Adding file to selection:', fileData);
        
        // Check if file is already selected
        const index = selectedFiles.findIndex(f => f.path === fileData.path);
        
        if (index === -1) {
            // If name is missing, extract it from path
            if (!fileData.name) {
                const pathParts = fileData.path.split('/');
                fileData.name = pathParts[pathParts.length - 1];
            }
            
            // Add to selected files
            selectedFiles.push(fileData);
            
            // Add tag to input
            addFileTag(fileData);
            
            // If selection popup is open, update it
            if (isSelectionActive) {
                updateFileList();
                updateSelectionCounter();
            }
        } else {
            console.log('File already selected, skipping:', fileData.path);
        }
    }
    /**
     * Initialize image upload functionality
     */
    function initImageUpload() {
        // Enable paste event for image uploads
        initPasteUpload();
        
        // Enable drag and drop for image files
        initImageDrop();
    }
    
    /**
     * Initialize paste upload functionality
     */
    function initPasteUpload() {
        // Listen for paste events on the input element
        inputElement.on('paste', function(e) {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            
            // Check if pasted content contains an image
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    // Prevent default paste behavior for images
                    e.preventDefault();
                    
                    // Get the image file
                    const file = items[i].getAsFile();
                    
                    // Upload the image
                    uploadImage(file);
                    
                    // Only handle the first image
                    break;
                }
            }
        });
    }
    
    /**
     * Initialize drag and drop for image files
     */
    function initImageDrop() {
        // Create drop overlay specifically for image files
        const imageDropOverlay = $('<div class="vibe-image-drop-overlay">放下图片以上传</div>');
        inputWrapper.append(imageDropOverlay);
        imageDropOverlay.hide();
        
        // Handle dragover for image files
        inputWrapper.on('dragover', function(e) {
            // Check if dataTransfer contains files (not just file tree items)
            if (e.originalEvent.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show image drop overlay
                imageDropOverlay.show();
                
                // Add highlighting
                inputWrapper.addClass('image-drag-over');
                
                // Set drop effect
                e.originalEvent.dataTransfer.dropEffect = 'copy';
            }
        });
        
        // Handle drag enter for image files
        inputWrapper.on('dragenter', function(e) {
            // Check if dataTransfer contains files
            if (e.originalEvent.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Show image drop overlay
                imageDropOverlay.show();
                
                // Add highlighting
                inputWrapper.addClass('image-drag-over');
            }
        });
        
        // Handle drag leave for image files
        inputWrapper.on('dragleave', function(e) {
            // Only consider leave if it's not entering a child element
            if (e.target === inputWrapper[0]) {
                // Hide image overlay
                imageDropOverlay.hide();
                
                // Remove highlighting
                inputWrapper.removeClass('image-drag-over');
            }
        });
        
        // Handle drop for image files
        inputWrapper.on('drop', function(e) {
            // Check if dataTransfer contains files
            if (e.originalEvent.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Hide image overlay
                imageDropOverlay.hide();
                
                // Remove highlighting
                inputWrapper.removeClass('image-drag-over');
                
                // Get dropped files
                const files = e.originalEvent.dataTransfer.files;
                
                // Check if files contain an image
                if (files && files.length > 0) {
                    const file = files[0];
                    
                    // Check if file is an image
                    if (file.type.startsWith('image/')) {
                        // Upload the image
                        uploadImage(file);
                    } else {
                        // Show error notification
                        showNotification('错误: 请上传图片文件', 'error');
                    }
                }
            }
        });
    }
    
    /**
     * Upload image file
     * @param {File} file - Image file to upload
     */
    function uploadImage(file) {
        // Check if we already have too many images
        if (uploadedImages.length >= 4) {
            showNotification('最多只能上传4张图片', 'warning');
            return;
        }
        
        // Validate file is an image
        if (!file.type.startsWith('image/')) {
            showNotification('请选择图片文件', 'warning');
            return;
        }
        
        // Validate file size
        if (file.size > 5 * 1024 * 1024) {
            showNotification('图片文件大小不能超过5M', 'warning');
            return;
        }
        
        // Show loading notification
        const loadingNotification = showNotification('正在上传图片...', 'info', false);
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('thisAiModel', thisAiModel);
        
        // Upload the image
        $.ajax({
            url: '/Home/SaveImg',
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            success: function(res) {
                // Remove loading notification
                loadingNotification.remove();
                
                if (res.success) {
                    // Check if image already exists
                    if (!uploadedImages.includes(res.data)) {
                        // Add image to uploaded images
                        uploadedImages.push(res.data);
                        
                        // Add image tag
                        addImageTag(res.data);
                        
                        // Show success notification
                        showNotification('图片上传成功', 'success');
                    }
                } else {
                    // Show error notification
                    showNotification('图片上传失败', 'error');
                }
            },
            error: function(e) {
                // Remove loading notification
                loadingNotification.remove();
                
                // Show error notification
                showNotification('图片上传失败: ' + e.statusText, 'error');
                console.error('图片上传失败', e);
            }
        });
    }
    
    /**
     * Add an image tag to the input wrapper
     * @param {string} imagePath - Path to the uploaded image
     */
    function addImageTag(imagePath) {
        const tagsContainer = inputWrapper.find('.vibe-file-selector-tags');
        
        // Create thumbnail URL
        const thumbnailUrl = imagePath; // Using the same path as thumbnail
        
        // Create image tag element
        const tag = $(`
            <div class="vibe-image-tag" data-path="${imagePath}">
                <div class="vibe-image-tag-thumbnail">
                    <img src="${thumbnailUrl}" alt="上传图片">
                </div>
                <button class="vibe-image-tag-remove" title="删除图片"><i class="fas fa-times"></i></button>
            </div>
        `);
        
        // Add to tags container
        tagsContainer.append(tag);
        
        // Add to tracking array
        selectedImageTags.push({
            path: imagePath,
            element: tag
        });
    }
    
    /**
     * Remove an uploaded image
     * @param {string} imagePath - Path to the image to remove
     */
    function removeUploadedImage(imagePath) {
        // Remove from uploaded images array
        const index = uploadedImages.indexOf(imagePath);
        if (index !== -1) {
            uploadedImages.splice(index, 1);
        }
        
        // Remove from tracking array
        const tagIndex = selectedImageTags.findIndex(tag => tag.path === imagePath);
        if (tagIndex !== -1) {
            selectedImageTags.splice(tagIndex, 1);
        }
    }
    
    /**
     * Get the currently uploaded images
     * @returns {Array} Array of image paths
     */
    function getUploadedImages() {
        return [...uploadedImages];
    }
    
    /**
     * Clear all uploaded images and tags
     */
    function clearUploadedImages() {
        // Clear array
        uploadedImages = [];
        
        // Clear DOM elements
        selectedImageTags.forEach(tag => {
            tag.element.remove();
        });
        
        selectedImageTags = [];
    }

    /**
     * Clear all selected files, images, and tags
     */
    function clearAll() {
        // Clear files
        clearSelectedFiles();
        
        // Clear images
        clearUploadedImages();
    }

    // Export public API
    window.VibeFileSelector = {
        init: init,
        getSelectedFiles: getSelectedFiles,
        getUploadedImages: getUploadedImages,
        clearSelectedFiles: clearSelectedFiles,
        clearUploadedImages: clearUploadedImages,
        clearAll: clearAll,
        
        /**
         * Add a code snippet to selection
         * @param {Object} codeFile - Code file object with path, name, type, and content
         * @returns {boolean} Success status
         */
        addCodeToSelection: function(codeFile) {
            // Validate required properties
            if (!codeFile || !codeFile.path || !codeFile.name) {
                console.error('Invalid code file data:', codeFile);
                return false;
            }
            
            // Set type to 'code' if not specified
            if (!codeFile.type) {
                codeFile.type = 'code';
            }
            
            // Check if file is already selected
            const index = selectedFiles.findIndex(f => f.path === codeFile.path);
            
            if (index === -1) {
                // Add to selected files
                selectedFiles.push(codeFile);
                
                // Create and add tag with code styling
                const tagsContainer = inputWrapper.find('.vibe-file-selector-tags');
                
                // Create tag with special code styling
                const tag = $(`
                    <div class="vibe-file-tag vibe-code-tag" data-path="${codeFile.path}" data-type="code">
                        <i class="fas fa-code"></i> <span>${codeFile.name}</span>
                        <button class="vibe-file-tag-remove"><i class="fas fa-times"></i></button>
                    </div>
                `);
                
                // Style code tags differently
                tag.css({
                    'background-color': '#2d2d6b',
                    'border-color': '#3e3e8e'
                });
                
                // Add to DOM
                tagsContainer.append(tag);
                
                // Add to tag tracking
                selectedFileTags.push({
                    path: codeFile.path,
                    element: tag
                });
                
                // If selection popup is open, update it
                if (isSelectionActive) {
                    updateFileList();
                    updateSelectionCounter();
                }
                
                return true;
            } else {
                console.log('Code snippet already selected, skipping:', codeFile.path);
                return false;
            }
        }
    };
})(); 