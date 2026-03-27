let selectedFiles = [];
let compressedResults = [];
const MAX_FILE_COUNT = 50;

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#tools-main-menu").addClass('active');
    $("#tools-main-menu").parent().toggleClass('show');
    $("#tools-main-menu").parent().siblings().removeClass('show');
    $("#image-compress-tools-nav").addClass('active');

    // 初始化事件
    initializeEvents();
    feather.replace();
});

function initializeEvents() {
    // 质量滑块事件
    $('#qualitySlider').on('input', function() {
        const value = $(this).val();
        $('#qualityValue').text(value);

        // 根据质量值显示不同的提示
        const $hint = $('#qualityHint');
        if (value < 40) {
            $hint.text('极高压缩率，画质大幅降低').removeClass().addClass('text-danger');
        } else if (value < 60) {
            $hint.text('高压缩率，画质适中降低').removeClass().addClass('text-warning');
        } else if (value < 80) {
            $hint.text('适中压缩率，画质轻微降低').removeClass().addClass('text-info');
        } else {
            $hint.text('低压缩率，保持较高画质').removeClass().addClass('text-success');
        }
    });

    // 文件选择事件
    $('#imageInput').on('change', function(e) {
        handleFileSelect(e.target.files);
    });

    // 选择图片按钮点击事件
    $('#selectImagesBtn').on('click', function(e) {
        e.stopPropagation(); // 防止事件冒泡
        $('#imageInput').click();
    });

    // 拖拽上传事件
    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        handleFileSelect(files);
    });

    // 移除拖拽区域的全局点击事件，只通过按钮触发文件选择
}

function handleFileSelect(files) {
    const newFiles = Array.from(files);

    // 检查文件数量限制
    if (selectedFiles.length + newFiles.length > MAX_FILE_COUNT) {
        showAlert(`最多只能选择${MAX_FILE_COUNT}张图片，当前已选择${selectedFiles.length}张`, 'warning');
        return;
    }

    // 验证文件格式
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = newFiles.filter(file => {
        if (!supportedFormats.includes(file.type)) {
            showAlert(`文件 ${file.name} 不是支持的图片格式`, 'warning');
            return false;
        }

        // 检查文件大小 (50MB)
        if (file.size > 50 * 1024 * 1024) {
            showAlert(`文件 ${file.name} 过大，请选择小于50MB的图片`, 'warning');
            return false;
        }

        return true;
    });

    if (validFiles.length === 0) return;

    // 添加到选中文件列表
    selectedFiles.push(...validFiles);

    // 更新UI
    updateImageList();
    showImageListContainer();

    showAlert(`已添加 ${validFiles.length} 张图片，总计 ${selectedFiles.length} 张`, 'success');
}

function updateImageList() {
    const imageList = $('#imageList');
    imageList.empty();

    selectedFiles.forEach((file, index) => {
        const imageItem = createImageItem(file, index);
        imageList.append(imageItem);
    });

    feather.replace();
}

function createImageItem(file, index) {
    const fileSizeKB = (file.size / 1024).toFixed(2);
    const fileName = file.name;

    // 创建预览图
    const reader = new FileReader();
    const previewId = `preview-${index}`;

    reader.onload = function(e) {
        $(`#${previewId}`).attr('src', e.target.result);
    };
    reader.readAsDataURL(file);

    return `
        <div class="image-item" data-index="${index}">
            <img id="${previewId}" class="image-preview" src="" alt="预览">
            <div class="image-info">
                <p class="image-name">${fileName}</p>
                <p class="image-size">大小: ${fileSizeKB} KB</p>
                <div class="image-progress" style="display: none;">
                    <div class="progress">
                        <div class="progress-bar" id="progress-${index}" style="width: 0%"></div>
                    </div>
                </div>
            </div>
            <div class="image-status">
                <span class="status-badge status-waiting" id="status-${index}">等待压缩</span>
                <button class="remove-btn" onclick="removeImage(${index})">
                    <i data-feather="x"></i>
                </button>
            </div>
        </div>
    `;
}

function removeImage(index) {
    selectedFiles.splice(index, 1);

    // 从压缩结果中移除
    compressedResults = compressedResults.filter(result => result.originalIndex !== index);

    updateImageList();

    if (selectedFiles.length === 0) {
        hideImageListContainer();
        hideDownloadContainer();
    }

    showAlert('图片已移除', 'info');
}

function showImageListContainer() {
    $('#imageListContainer').show();
}

function hideImageListContainer() {
    $('#imageListContainer').hide();
}

function showDownloadContainer() {
    $('#downloadContainer').show();
}

function hideDownloadContainer() {
    $('#downloadContainer').hide();
}

function scrollToDownloadArea() {
    const downloadContainer = document.getElementById('downloadContainer');
    if (downloadContainer) {
        // 滚动到下载区域
        downloadContainer.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });

        // 添加简单的背景色高亮效果
        setTimeout(() => {
            $(downloadContainer).addClass('highlight');
            setTimeout(() => {
                $(downloadContainer).removeClass('highlight');
            }, 1500);
        }, 300);
    }
}

function clearAll() {
    selectedFiles = [];
    compressedResults = [];
    $('#imageList').empty();
    hideImageListContainer();
    hideDownloadContainer();
    showAlert('已清空所有图片', 'info');
}

async function compressAll() {
    if (selectedFiles.length === 0) {
        showAlert('请先选择图片', 'warning');
        return;
    }

    const quality = parseInt($('#qualitySlider').val());

    // 显示整体进度
    $('#overallProgress').show();
    $('#totalImages').text(selectedFiles.length);

    // 禁用压缩按钮
    $('#compressAllBtn').prop('disabled', true).html('<div class="loading-spinner"></div> 压缩中...');

    compressedResults = [];
    let completedCount = 0;

    try {
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            // 更新状态
            updateImageStatus(i, 'processing', '压缩中...');

            try {
                const result = await compressImage(file, quality, i);

                if (result.success) {
                    compressedResults.push({
                        ...result,
                        originalIndex: i
                    });
                    updateImageStatus(i, 'completed', `已压缩 (${result.compressionRatio}%)`);
                } else {
                    updateImageStatus(i, 'error', result.error || '压缩失败');
                }

            } catch (error) {
                console.error('压缩失败:', error);
                updateImageStatus(i, 'error', '压缩失败');
            }

            completedCount++;
            updateOverallProgress(completedCount);
        }

        if (compressedResults.length > 0) {
            showDownloadContainer();
            updateDownloadStats();
            showAlert(`压缩完成！成功压缩 ${compressedResults.length} 张图片`, 'success');

            // 自动滚动到下载区域
            setTimeout(() => {
                scrollToDownloadArea();
            }, 500);

            // 重置整体进度条（延迟一点让用户看到完成状态）
            setTimeout(() => {
                $('#overallProgress').hide();
                $('#overallProgressBar').css('width', '0%');
                $('#currentProgress').text('0');
            }, 2000);
        } else {
            showAlert('压缩失败，请检查图片格式和网络连接', 'error');
            // 失败时也隐藏进度条
            setTimeout(() => {
                $('#overallProgress').hide();
                $('#overallProgressBar').css('width', '0%');
                $('#currentProgress').text('0');
            }, 2000);
        }

    } finally {
        // 恢复按钮状态
        $('#compressAllBtn').prop('disabled', false).html('<i data-feather="zap"></i> 开始压缩');
        feather.replace();
    }
}

async function compressImage(file, quality, index) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', quality);

        $.ajax({
            url: '/Tools/CompressImage',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            xhr: function() {
                const xhr = new XMLHttpRequest();
                xhr.upload.addEventListener('progress', function(e) {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        updateImageProgress(index, percentComplete);
                    }
                }, false);
                return xhr;
            },
            success: function(response) {
                if (response.success) {
                    resolve(response);
                } else {
                    resolve({ success: false, error: response.error || '压缩失败' });
                }
            },
            error: function(xhr, status, error) {
                let errorMessage = '压缩失败';
                if (xhr.responseJSON && xhr.responseJSON.error) {
                    errorMessage = xhr.responseJSON.error;
                } else if (error) {
                    errorMessage = error;
                }
                resolve({ success: false, error: errorMessage });
            }
        });
    });
}

function updateImageStatus(index, status, text) {
    const statusElement = $(`#status-${index}`);
    statusElement.removeClass('status-waiting status-processing status-completed status-error');
    statusElement.addClass(`status-${status}`).text(text);

    const progressElement = $(`.image-item[data-index="${index}"] .image-progress`);

    if (status === 'processing') {
        progressElement.show();
    } else if (status === 'completed' || status === 'error') {
        // 压缩完成后隐藏进度条
        setTimeout(() => {
            progressElement.hide();
            $(`#progress-${index}`).css('width', '0%');
        }, 1000); // 1秒后隐藏，让用户能看到完成状态
    }
}

function updateImageProgress(index, percentage) {
    $(`#progress-${index}`).css('width', percentage + '%');
}

function updateOverallProgress(completedCount) {
    const percentage = (completedCount / selectedFiles.length) * 100;
    $('#overallProgressBar').css('width', percentage + '%');
    $('#currentProgress').text(completedCount);
}

function updateDownloadStats() {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    compressedResults.forEach(result => {
        totalOriginalSize += result.originalSize;
        totalCompressedSize += result.compressedSize;
    });

    const overallCompressionRatio = totalOriginalSize > 0
        ? ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(2)
        : 0;

    const stats = `
        <div class="stat-item">
            <span class="stat-number">${compressedResults.length}</span>
            <span class="stat-label">成功压缩</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${formatFileSize(totalOriginalSize)}</span>
            <span class="stat-label">原始大小</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${formatFileSize(totalCompressedSize)}</span>
            <span class="stat-label">压缩后大小</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${overallCompressionRatio}%</span>
            <span class="stat-label">节省空间</span>
        </div>
    `;

    $('#downloadStats').html(stats);
}

function downloadAll() {
    if (compressedResults.length === 0) {
        showAlert('没有可下载的图片', 'warning');
        return;
    }

    $('#downloadAllBtn').prop('disabled', true).html('<div class="loading-spinner"></div> 准备下载...');

    const downloadData = compressedResults.map(result => ({
        fileName: result.fileName,
        data: result.data
    }));

    $.ajax({
        url: '/Tools/DownloadCompressedImages',
        type: 'POST',
        data: JSON.stringify(downloadData),
        contentType: 'application/json',
        xhrFields: {
            responseType: 'blob'
        },
        success: function(data, status, xhr) {
            // 创建下载链接
            const blob = new Blob([data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `compressed_images_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            showAlert('下载已开始', 'success');
        },
        error: function(xhr, status, error) {
            console.error('下载失败:', error);
            showAlert('下载失败，请重试', 'error');
        },
        complete: function() {
            $('#downloadAllBtn').prop('disabled', false).html('<i data-feather="download"></i> 下载所有压缩图片');
            feather.replace();
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showAlert(message, type = 'info') {
    // 创建或更新alert元素
    let alertElement = $('#imageCompressAlert');

    if (alertElement.length === 0) {
        alertElement = $(`
            <div id="imageCompressAlert" class="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <span id="alertMessage"></span>
                <button type="button" class="close ml-3" onclick="$('#imageCompressAlert').fadeOut()">
                    <span>&times;</span>
                </button>
            </div>
        `);
        $('body').append(alertElement);
    }

    // 更新样式和消息
    alertElement.removeClass('alert-success alert-warning alert-danger alert-info')
                .addClass(`alert-${getBootstrapAlertClass(type)}`)
                .find('#alertMessage').text(message);

    // 显示并自动隐藏
    alertElement.fadeIn();

    setTimeout(() => {
        alertElement.fadeOut();
    }, type === 'error' ? 5000 : 3000);
}

function getBootstrapAlertClass(type) {
    const classMap = {
        'success': 'success',
        'warning': 'warning',
        'error': 'danger',
        'info': 'info'
    };
    return classMap[type] || 'info';
}