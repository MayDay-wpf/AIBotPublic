let selectedImages = [];
let convertedImages = [];

$(document).ready(function() {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#tools-main-menu").addClass('active');
    $("#tools-main-menu").parent().toggleClass('show');
    $("#tools-main-menu").parent().siblings().removeClass('show');
    $("#image-convert-tools-nav").addClass('active');
    initializeComponents();
    bindEvents();
});

function initializeComponents() {
    feather.replace();
    updateQualityVisibility();
}

function bindEvents() {
    // 文件选择按钮事件
    $('#selectImagesBtn').on('click', function(e) {
        e.stopPropagation();
        $('#imageInput').click();
    });

    // 拖拽区域点击事件
    $('#dropZone').on('click', function(e) {
        if (e.target === this || $(e.target).hasClass('drop-zone-content')) {
            $('#imageInput').click();
        }
    });

    // 文件输入变化事件
    $('#imageInput').on('change', function(e) {
        handleFiles(e.target.files);
    });

    // 拖拽事件
    $('#dropZone').on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('drag-over');
    });

    $('#dropZone').on('dragleave', function(e) {
        e.preventDefault();
        $(this).removeClass('drag-over');
    });

    $('#dropZone').on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('drag-over');
        handleFiles(e.originalEvent.dataTransfer.files);
    });

    // 目标格式变化事件
    $('#targetFormat').on('change', function() {
        updateQualityVisibility();
    });

    // 质量滑块事件
    $('#qualitySlider').on('input', function() {
        $('#qualityValue').text($(this).val());
    });
}

function updateQualityVisibility() {
    const targetFormat = $('#targetFormat').val();
    const qualityContainer = $('#qualitySlider').closest('.col-md-6');

    if (targetFormat === 'jpeg' || targetFormat === 'webp') {
        qualityContainer.show();
    } else {
        qualityContainer.hide();
    }
}

function handleFiles(files) {
    const fileArray = Array.from(files);

    if (fileArray.length === 0) return;

    // 检查文件数量限制
    if (selectedImages.length + fileArray.length > 50) {
        showAlert('最多只能选择50张图片', 'warning');
        return;
    }

    // 过滤支持的图片格式
    const validFiles = fileArray.filter(file => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        return validTypes.includes(file.type) && file.size <= 50 * 1024 * 1024;
    });

    if (validFiles.length === 0) {
        showAlert('请选择有效的图片文件（JPG、PNG、GIF、WebP，小于50MB）', 'warning');
        return;
    }

    // 添加到选中列表
    validFiles.forEach(file => {
        const imageInfo = {
            file: file,
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            status: 'waiting',
            preview: null
        };
        selectedImages.push(imageInfo);
    });

    // 生成预览
    generatePreviews();

    // 显示图片列表
    updateImageList();
    $('#imageListContainer').show();
}

function generatePreviews() {
    selectedImages.forEach(imageInfo => {
        if (imageInfo.preview) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            imageInfo.preview = e.target.result;
            updateImageItem(imageInfo);
        };
        reader.readAsDataURL(imageInfo.file);
    });
}

function updateImageList() {
    const imageList = $('#imageList');
    imageList.empty();

    selectedImages.forEach(imageInfo => {
        const imageItem = createImageItem(imageInfo);
        imageList.append(imageItem);
    });

    feather.replace();
}

function createImageItem(imageInfo) {
    const targetFormat = $('#targetFormat').val();
    const targetExtension = getFileExtensionFromFormat(targetFormat);
    const newFileName = imageInfo.name.replace(/\.[^/.]+$/, targetExtension);

    return `
        <div class="image-item" data-id="${imageInfo.id}">
            <img class="image-preview" src="${imageInfo.preview || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIGZpbGw9IiNkZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJtMTMgMi0yIDJIOXY2SDV2MTBoNHYyaDF2LTJoNXYtMkg5di02aDR2LTJoMXoiLz48L3N2Zz4='}" alt="预览">
            <div class="image-info">
                <p class="image-name">${imageInfo.name}</p>
                <p class="image-size">${formatFileSize(imageInfo.size)}</p>
                <p class="format-info">转换为: <span class="format-badge format-${targetFormat}">${targetFormat.toUpperCase()}</span> → ${newFileName}</p>
            </div>
            <div class="image-status">
                <span class="status-badge status-${imageInfo.status}">
                    ${getStatusText(imageInfo.status)}
                </span>
                <div class="image-progress" style="display: none;">
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                    </div>
                </div>
                <button class="remove-btn" onclick="removeImage('${imageInfo.id}')" title="移除">
                    <i data-feather="x"></i>
                </button>
            </div>
        </div>
    `;
}

function updateImageItem(imageInfo) {
    const item = $(`.image-item[data-id="${imageInfo.id}"]`);
    if (item.length === 0) return;

    // 更新预览图
    if (imageInfo.preview) {
        item.find('.image-preview').attr('src', imageInfo.preview);
    }

    // 更新状态
    const statusBadge = item.find('.status-badge');
    statusBadge.removeClass('status-waiting status-processing status-completed status-error')
              .addClass(`status-${imageInfo.status}`)
              .text(getStatusText(imageInfo.status));

    // 显示/隐藏进度条
    const progressContainer = item.find('.image-progress');
    if (imageInfo.status === 'processing') {
        progressContainer.show();
    } else {
        progressContainer.hide();
    }

    feather.replace();
}

function getStatusText(status) {
    const statusMap = {
        'waiting': '等待转换',
        'processing': '转换中',
        'completed': '转换完成',
        'error': '转换失败'
    };
    return statusMap[status] || status;
}

function getFileExtensionFromFormat(format) {
    const extensionMap = {
        'jpeg': '.jpg',
        'png': '.png',
        'webp': '.webp',
        'gif': '.gif',
        'bmp': '.bmp',
        'tiff': '.tiff',
        'ico': '.ico',
        'icns': '.icns'
    };
    return extensionMap[format] || '.jpg';
}

function removeImage(imageId) {
    selectedImages = selectedImages.filter(img => img.id != imageId);
    updateImageList();

    if (selectedImages.length === 0) {
        $('#imageListContainer').hide();
        $('#downloadContainer').hide();
        convertedImages = [];
    }
}

function clearAll() {
    selectedImages = [];
    convertedImages = [];
    $('#imageList').empty();
    $('#imageListContainer').hide();
    $('#downloadContainer').hide();
    $('#overallProgress').hide();
    showAlert('已清空所有图片', 'info');
}

async function convertAll() {
    if (selectedImages.length === 0) {
        showAlert('请先选择图片', 'warning');
        return;
    }

    const targetFormat = $('#targetFormat').val();
    const quality = parseInt($('#qualitySlider').val());

    // 重置状态
    convertedImages = [];
    selectedImages.forEach(img => img.status = 'waiting');
    updateImageList();

    // 显示总体进度
    $('#overallProgress').show();
    $('#totalImages').text(selectedImages.length);
    $('#currentProgress').text(0);
    $('#overallProgressBar').css('width', '0%');

    // 禁用转换按钮
    $('#convertAllBtn').prop('disabled', true).html('<i data-feather="loader" class="loading-spinner"></i> 转换中...');
    feather.replace();

    let completedCount = 0;
    let errorCount = 0;

    // 批量转换
    try {
        const formData = new FormData();
        selectedImages.forEach(imageInfo => {
            formData.append('files', imageInfo.file);
        });
        formData.append('targetFormat', targetFormat);
        formData.append('quality', quality);

        // 标记所有图片为处理中
        selectedImages.forEach(img => {
            img.status = 'processing';
            updateImageItem(img);
        });

        const response = await fetch('/Tools/ConvertBatch', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // 处理结果
            result.results.forEach((resultItem, index) => {
                const imageInfo = selectedImages[index];
                if (resultItem.success) {
                    imageInfo.status = 'completed';
                    imageInfo.convertedData = resultItem.data;
                    imageInfo.newFileName = resultItem.fileName;
                    imageInfo.contentType = resultItem.contentType;
                    convertedImages.push(imageInfo);
                    completedCount++;
                } else {
                    imageInfo.status = 'error';
                    imageInfo.error = resultItem.error;
                    errorCount++;
                }
                updateImageItem(imageInfo);
            });

            // 更新总体进度
            $('#currentProgress').text(completedCount);
            $('#overallProgressBar').css('width', '100%');

            // 显示结果
            if (completedCount > 0) {
                showDownloadArea(result.summary);
                scrollToDownloadArea();
            }

            showAlert(`转换完成！成功: ${completedCount}张，失败: ${errorCount}张`,
                     errorCount > 0 ? 'warning' : 'success');
        } else {
            showAlert('批量转换失败: ' + (result.error || '未知错误'), 'danger');
        }
    } catch (error) {
        console.error('转换失败:', error);
        showAlert('转换失败: ' + error.message, 'danger');

        // 重置所有图片状态
        selectedImages.forEach(img => {
            img.status = 'error';
            updateImageItem(img);
        });
    } finally {
        // 恢复转换按钮
        $('#convertAllBtn').prop('disabled', false).html('<i data-feather="refresh-cw"></i> 开始转换');
        feather.replace();

        // 隐藏进度条（延迟）
        setTimeout(() => {
            $('#overallProgress').hide();
        }, 2000);
    }
}

function showDownloadArea(summary) {
    const stats = `
        <div class="stat-item">
            <span class="stat-number">${summary.total}</span>
            <span class="stat-label">总数</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${summary.success}</span>
            <span class="stat-label">成功</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${summary.error}</span>
            <span class="stat-label">失败</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${formatFileSize(summary.totalOriginalSize)}</span>
            <span class="stat-label">原始大小</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${formatFileSize(summary.totalConvertedSize)}</span>
            <span class="stat-label">转换后大小</span>
        </div>
        <div class="stat-item">
            <span class="stat-number">${summary.targetFormat.toUpperCase()}</span>
            <span class="stat-label">目标格式</span>
        </div>
    `;

    $('#downloadStats').html(stats);
    $('#downloadContainer').show();
}

function scrollToDownloadArea() {
    setTimeout(() => {
        const downloadContainer = $('#downloadContainer');
        downloadContainer.addClass('highlight');

        $('html, body').animate({
            scrollTop: downloadContainer.offset().top - 100
        }, 800);

        setTimeout(() => {
            downloadContainer.removeClass('highlight');
        }, 2000);
    }, 500);
}

async function downloadAll() {
    if (convertedImages.length === 0) {
        showAlert('没有可下载的转换图片', 'warning');
        return;
    }

    try {
        $('#downloadAllBtn').prop('disabled', true).html('<i data-feather="loader" class="loading-spinner"></i> 准备下载...');
        feather.replace();

        const downloadData = convertedImages.map(img => ({
            FileName: img.newFileName || img.name,
            Data: img.convertedData
        }));

        const response = await fetch('/Tools/DownloadConvertedImages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(downloadData)
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `converted_images_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showAlert('下载已开始', 'success');
        } else {
            const errorData = await response.json();
            showAlert('下载失败: ' + (errorData.error || '未知错误'), 'danger');
        }
    } catch (error) {
        console.error('下载失败:', error);
        showAlert('下载失败: ' + error.message, 'danger');
    } finally {
        $('#downloadAllBtn').prop('disabled', false).html('<i data-feather="download"></i> 下载所有转换图片');
        feather.replace();
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showAlert(message, type = 'info') {
    const alertClass = `alert-${type}`;
    const alertHtml = `
        <div class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="close" data-dismiss="alert">
                <span>&times;</span>
            </button>
        </div>
    `;

    // 移除现有的alert
    $('.alert').remove();

    // 添加新的alert到页面顶部
    $('.content-body').prepend(alertHtml);

    // 3秒后自动消失
    setTimeout(() => {
        $('.alert').fadeOut();
    }, 3000);
}