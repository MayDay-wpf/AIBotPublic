$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#files-main-menu").addClass('active');
    $("#files-main-menu").parent().toggleClass('show');
    $("#files-main-menu").parent().siblings().removeClass('show');
    $("#fileslibcloud-nav").addClass('active');
    // 初始化文件夹树
    initFolderTree();

    // 初始化文件列表
    loadFiles('root');

    // 视图切换事件
    $('#viewGrid').click(function () {
        $(this).addClass('active');
        $('#viewList').removeClass('active');
        $('#filesGrid').removeClass('d-none');
        $('#filesList').addClass('d-none');
    });

    $('#viewList').click(function () {
        $(this).addClass('active');
        $('#viewGrid').removeClass('active');
        $('#filesList').removeClass('d-none');
        $('#filesGrid').addClass('d-none');
    });

    // 全选/取消全选
    $('#selectAll').change(function () {
        const isChecked = $(this).prop('checked');

        // 根据当前视图模式选择要操作的复选框
        if ($('#filesGrid').hasClass('d-none')) {
            // 列表视图模式
            $('#filesList .file-checkbox').prop('checked', isChecked);
        } else {
            // 网格视图模式
            $('#filesGrid .file-checkbox').prop('checked', isChecked);
            if (isChecked) {
                $('.file-item').addClass('selected');
            } else {
                $('.file-item').removeClass('selected');
            }
        }
    });


    // 初始化feather图标
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});

// 初始化文件夹树
function initFolderTree() {
    // 从后端获取文件夹数据
    $.ajax({
        url: '/FilesAI/GetFoldersLibs',
        type: 'POST',
        dataType: 'json',
        success: function (response) {
            if (response.success) {
                // 构建树形结构数据
                let treeData = buildFolderTreeData(response.data);

                // 初始化jstree
                $('#folderTree').jstree({
                    'core': {
                        'data': treeData,
                        'check_callback': true
                    },
                    'plugins': ['types', 'dnd', 'wholerow'],
                    'types': {
                        'default': {
                            'icon': 'fas fa-folder'
                        },
                        'file': {
                            'icon': 'fas fa-file'
                        }
                    }
                }).on('select_node.jstree', function (e, data) {
                    loadFiles(data.node.id);
                    folderId = data.node.id;
                    updateBreadcrumb(data.node);
                });
            } else {
                console.error('获取文件夹列表失败');
            }
        },
        error: function (error) {
            console.error('获取文件夹列表请求失败', error);
        }
    });
}

// 构建文件夹树形结构数据
function buildFolderTreeData(foldersData) {
    // 创建根节点
    let rootNode = {
        "id": "root",
        "text": "我的网盘",
        "icon": "fas fa-hdd",
        "state": { "opened": true, "selected": true },
        "children": []
    };

    // 创建文件夹映射表，方便快速查找
    let folderMap = {
        "root": rootNode
    };

    // 首先找出所有顶级文件夹（parentCode为0或null的）
    let topFolders = foldersData.filter(folder => folder.parentCode === "0" || !folder.parentCode);

    // 处理顶级文件夹
    topFolders.forEach(folder => {
        let node = {
            "id": folder.folderCode,
            "text": folder.folderName,
            "icon": "fas fa-folder",
            "children": []
        };
        folderMap[folder.folderCode] = node;
        rootNode.children.push(node);
    });

    // 处理其他文件夹
    foldersData.forEach(folder => {
        if (folder.parentCode !== "0" && folder.parentCode) {
            let node = {
                "id": folder.folderCode,
                "text": folder.folderName,
                "icon": "fas fa-folder",
                "children": []
            };
            folderMap[folder.folderCode] = node;

            // 将节点添加到父节点的children中
            if (folderMap[folder.parentCode]) {
                folderMap[folder.parentCode].children.push(node);
            } else {
                // 如果找不到父节点，则添加到根节点
                rootNode.children.push(node);
            }
        }
    });

    return [rootNode];
}
// 定义分页变量
let page_fileslibcloud = 1;
let pageSize_fileslibcloud = 20; // 每页显示10条记录
let total_fileslibcloud = 0;
let currentFolder_fileslibcloud = 'root';
let folderId = '';
// 加载文件列表
function loadFiles(folderId, page = 1, name = '') {
    currentFolder_fileslibcloud = folderId;
    page_fileslibcloud = page;

    $.ajax({
        url: '/FilesAI/GetFilesLibClouds',
        type: 'POST',
        data: {
            page: page_fileslibcloud,
            pageSize: pageSize_fileslibcloud,
            name: name,
            folderCode: folderId
        },
        success: function (response) {
            if (response.success) {
                renderFiles(response.data);
                total_fileslibcloud = response.total;
                renderPagination();
            } else {
                console.error('获取文件列表失败');
            }
        },
        error: function (error) {
            console.error('获取文件列表请求失败', error);
        }
    });
}

// 渲染分页控件
function renderPagination() {
    const totalPages = Math.ceil(total_fileslibcloud / pageSize_fileslibcloud);
    let paginationHtml = '';

    // 只有当总页数大于1时才显示分页
    if (totalPages > 1) {
        paginationHtml = `
            <nav aria-label="文件列表分页">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${page_fileslibcloud === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="javascript:void(0)" onclick="changePage(${page_fileslibcloud - 1})" aria-label="上一页">
                            <span aria-hidden="true">&laquo;</span>
                        </a>
                    </li>`;

        // 显示页码
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 || // 第一页
                i === totalPages || // 最后一页
                (i >= page_fileslibcloud - 1 && i <= page_fileslibcloud + 1) // 当前页的前后一页
            ) {
                paginationHtml += `
                    <li class="page-item ${i === page_fileslibcloud ? 'active' : ''}">
                        <a class="page-link" href="javascript:void(0)" onclick="changePage(${i})">${i}</a>
                    </li>`;
            } else if (
                i === page_fileslibcloud - 2 ||
                i === page_fileslibcloud + 2
            ) {
                // 显示省略号
                paginationHtml += `
                    <li class="page-item disabled">
                        <a class="page-link" href="javascript:void(0)">...</a>
                    </li>`;
            }
        }

        paginationHtml += `
                    <li class="page-item ${page_fileslibcloud === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="javascript:void(0)" onclick="changePage(${page_fileslibcloud + 1})" aria-label="下一页">
                            <span aria-hidden="true">&raquo;</span>
                        </a>
                    </li>
                </ul>
            </nav>
            <div class="text-center mt-2">
                <small>共 ${total_fileslibcloud} 个文件，${totalPages} 页</small>
            </div>`;
    }

    // 将分页HTML添加到页面
    $('#pagination_container').html(paginationHtml);
}

// 切换页码
function changePage(page) {
    if (page < 1) page = 1;
    const totalPages = Math.ceil(total_fileslibcloud / pageSize_fileslibcloud);
    if (page > totalPages) page = totalPages;

    loadFiles(currentFolder_fileslibcloud, page);
}

// 修改每页显示数量
function changePageSize(size) {
    pageSize_fileslibcloud = size;
    page_fileslibcloud = 1; // 重置为第一页
    loadFiles(currentFolder_fileslibcloud, page_fileslibcloud);
}
// 渲染文件列表
function renderFiles(files) {
    // 渲染网格视图
    let gridHtml = '';
    if (files.length === 0) {
        gridHtml = '<div class="text-center w-100 py-5"><p class="text-muted">当前文件夹为空</p></div>';
    } else {
        files.forEach(file => {
            let iconClass = getFileIconClass(file.fileType);
            gridHtml += `
                <div class="file-item" data-id="${file.fileCode}" onclick="selectFile(this)">
                    <div class="file-checkbox-container" onclick="event.stopPropagation()">
                        <input type="checkbox" class="file-checkbox" data-id="${file.fileCode}" onchange="updateSelectAllStatus()">
                    </div>
                    <div class="file-icon ${file.fileType}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="file-name" title="${file.fileName}">${file.fileName}</div>
                </div>
            `;
        });
    }
    $('#filesGrid').html(gridHtml);

    // 渲染列表视图
    let listHtml = '';
    if (files.length === 0) {
        listHtml = '<tr><td colspan="5" class="text-center py-4">当前文件夹为空</td></tr>';
    } else {
        files.forEach(file => {
            let iconClass = getFileIconClass(file.fileType);
            // 格式化文件大小
            let formattedSize = formatFileSize(file.fileSize);

            listHtml += `
                <tr>
                    <td><input type="checkbox" class="file-checkbox" data-id="${file.fileCode}" onclick="event.stopPropagation()" onchange="updateSelectAllStatus()"></td>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="${iconClass} mr-2" style="font-size: 18px;"></i>
                            <span>${file.fileName}</span>
                        </div>
                    </td>
                    <td>${formattedSize}</td>
                    <td>${file.createTime}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <a type="button" class="btn btn-outline-info" href="${file.filePath}" download>
                                <i data-feather="download"></i> 下载
                            </a>
                            <button type="button" class="btn btn-outline-info" onclick="shareFile('${file.fileCode}', event)">
                                <i data-feather="share-2"></i> 分享
                            </button>
                            <button type="button" class="btn btn-outline-info" onclick="moveFileToLib('${file.fileCode}', event)">
                                <i data-feather="git-commit"></i> 转存素材库
                            </button>
                            <button type="button" class="btn btn-outline-danger" onclick="deleteFile('${file.fileCode}', event)">
                                <i data-feather="trash-2"></i> 删除
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
    $('#filesListBody').html(listHtml);

    // 重新初始化feather图标
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}
// 格式化文件大小
function formatFileSize(sizeInKB) {
    if (sizeInKB < 1) {
        return '< 1KB';
    } else if (sizeInKB < 1024) {
        return Math.round(sizeInKB) + 'K';
    } else if (sizeInKB < 1024 * 1024) {
        return (sizeInKB / 1024).toFixed(2) + 'M';
    } else {
        return (sizeInKB / (1024 * 1024)).toFixed(2) + 'G';
    }
}
// 选择文件
function selectFile(element) {
    $(element).toggleClass('selected');
    // 同步复选框状态
    const checkbox = $(element).find('.file-checkbox');
    checkbox.prop('checked', !checkbox.prop('checked'));

    // 更新全选复选框状态
    updateSelectAllStatus();
}
function updateSelectAllStatus() {
    // 根据当前视图模式选择要检查的复选框
    let checkboxes;
    if ($('#filesGrid').hasClass('d-none')) {
        // 列表视图模式
        checkboxes = $('#filesList .file-checkbox');
    } else {
        // 网格视图模式
        checkboxes = $('#filesGrid .file-checkbox');
    }

    // 获取复选框总数和选中的复选框数量
    const totalCheckboxes = checkboxes.length;
    const checkedCheckboxes = checkboxes.filter(':checked').length;

    // 更新全选复选框状态
    $('#selectAll').prop('checked', totalCheckboxes > 0 && totalCheckboxes === checkedCheckboxes);
}

// 获取文件图标类
function getFileIconClass(type) {
    // 将类型转为小写以便统一处理
    const lowerType = type ? type.toLowerCase() : '';

    // 图片文件
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.tiff', '.ico'].includes(lowerType)) {
        return 'fas fa-file-image text-info';
    }
    // PDF文件单独处理
    else if (lowerType === '.pdf') {
        return 'fas fa-file-pdf text-danger';
    }
    // 文档文件
    else if (['.doc', '.docx', '.txt', '.odt', '.rtf', '.tex', '.wps', '.document'].includes(lowerType)) {
        return 'fas fa-file-alt text-primary';
    }
    // 表格文件
    else if (['.xls', '.xlsx', '.csv', '.ods', '.numbers'].includes(lowerType)) {
        return 'fas fa-file-excel text-success';
    }
    // 演示文件
    else if (['.ppt', '.pptx', '.pps', '.odp', '.key'].includes(lowerType)) {
        return 'fas fa-file-powerpoint text-danger';
    }
    // 视频文件
    else if (['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp'].includes(lowerType)) {
        return 'fas fa-file-video text-warning';
    }
    // 音频文件
    else if (['.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a'].includes(lowerType)) {
        return 'fas fa-file-audio text-info';
    }
    // 压缩文件
    else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso'].includes(lowerType)) {
        return 'fas fa-file-archive text-secondary';
    }
    // 代码文件
    else if (['.js', '.html', '.css', '.php', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rb', '.swift', '.ts'].includes(lowerType)) {
        return 'fas fa-file-code text-primary';
    }
    // 文件夹
    else if (lowerType === '.folder') {
        return 'fas fa-folder text-warning';
    }
    // 默认文件图标
    else {
        return 'fas fa-file text-muted';
    }
}
// 更新面包屑导航
function updateBreadcrumb(node) {
    let path = [];
    let current = node;

    // 构建路径
    while (current.id !== 'root') {
        path.unshift({
            id: current.id,
            text: current.text
        });
        current = $('#folderTree').jstree(true).get_node(current.parent);
    }

    // 渲染面包屑
    let breadcrumbHtml = '<li class="breadcrumb-item"><a href="#" onclick="navigateTo(\'root\')">根目录</a></li>';

    path.forEach((item, index) => {
        if (index === path.length - 1) {
            breadcrumbHtml += `<li class="breadcrumb-item active" aria-current="page">${item.text}</li>`;
        } else {
            breadcrumbHtml += `<li class="breadcrumb-item"><a href="#" onclick="navigateTo('${item.id}')">${item.text}</a></li>`;
        }
    });

    $('.breadcrumb').html(breadcrumbHtml);
}

// 导航到指定文件夹
function navigateTo(folderId) {
    $('#folderTree').jstree('select_node', folderId);
}

// 添加分片上传功能
async function uploadChunk(file, chunk, chunks, start, chunkSize, folderCode, fullFolderCode, fileInput) {
    var end = Math.min(start + chunkSize, file.size);
    var chunkBlob = file.slice(start, end);
    var formData = new FormData();
    formData.append('file', chunkBlob);
    formData.append('chunkNumber', ++chunk);
    formData.append('fileName', file.name);
    formData.append('folderCode', folderCode);

    await $.ajax({
        url: '/FilesAI/UploadCloud',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (data) {
            var progress = (chunk / chunks) * 100;
            $('#p1').css('width', progress + '%').attr('aria-valuenow', progress).text(Math.round(progress) + '%');
        },
        error: function (xhr, status, error) {
            balert(xhr.responseText, "danger", false, 1500, "top");
            closeModal();
            if (fileInput) fileInput.remove();
        }
    });

    if (chunk < chunks) {
        await uploadChunk(file, chunk, chunks, end, chunkSize, folderCode, fullFolderCode, fileInput);
    } else {
        // 在所有切片上传完成后触发
        $.ajax({
            url: '/FilesAI/MergeFilesCloud',
            type: 'POST',
            data: JSON.stringify({
                fileName: file.name,
                totalChunks: chunks,
                folderCode: folderCode,
                fullFolderCode: fullFolderCode
            }),
            contentType: 'application/json',
            success: function (response) {
                if (response.success) {
                    loadFiles(folderCode, page_fileslibcloud); // 刷新当前文件夹的文件列表，保持在当前页
                    $('#p1').text('上传完成');
                    balert('文件上传成功', "success", false, 1500, "top");
                } else {
                    balert('文件上传失败', "danger", false, 1500, "top");
                }
                // 移除文件框
                if (fileInput) fileInput.remove();
                closeModal();
            },
            error: function (xhr, status, error) {
                balert('文件合并失败', "danger", false, 1500, "top");
                closeModal();
                if (fileInput) fileInput.remove();
            }
        });
    }
}

// 上传文件函数
async function uploadFiles() {
    // 获取当前选中的文件夹节点
    let selectedNode = $('#folderTree').jstree('get_selected')[0];
    if (!selectedNode) {
        balert('请先选择一个文件夹', "warning", false, 1500, "top");
        return;
    }

    // 获取完整的文件夹路径编码
    let fullFolderCode = getFullFolderPath(selectedNode);

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.multiple = true; // 允许多文件选择
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // 添加事件监听器
    fileInput.addEventListener('change', async function () {
        var files = fileInput.files;
        if (!files || files.length === 0) {
            balert('请选择文件', 'danger', true, 2000, "center");
            fileInput.remove();
            return;
        }

        // 检查文件大小
        let oversizedFiles = [];
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > 300 * 1024 * 1024) { // 限制为300MB
                oversizedFiles.push(files[i].name);
            }
        }

        if (oversizedFiles.length > 0) {
            balert(`以下文件大小超过300MB限制：${oversizedFiles.join(', ')}`, 'danger', true, 3000, "center");
            fileInput.remove();
            return;
        }

        // 打开进度模态框
        openModal('上传文件中，请稍候...', `
            <div id="upload-progress-container">
                <div class="progress ht-20 mb-3">
                    <div id="total-progress" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                </div>
                <div id="file-progress-list"></div>
            </div>
        `);

        // 创建进度条列表
        let progressHtml = '';
        for (let i = 0; i < files.length; i++) {
            progressHtml += `
                <div class="mb-2">
                    <small>${files[i].name}</small>
                    <div class="progress ht-10">
                        <div id="file-progress-${i}" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <div class="d-flex justify-content-between">
                        <small id="local-status-${i}" class="text-muted font-weight-bold text-primary">本地上传中...</small>
                        <small id="cloud-status-${i}" class="text-muted">等待云端同步</small>
                    </div>
                </div>
            `;
        }
        $('#file-progress-list').html(progressHtml);

        // 逐个上传文件
        let completedFiles = 0;
        for (let i = 0; i < files.length; i++) {
            await uploadSingleFile(files[i], i, selectedNode, fullFolderCode, function (progress) {
                // 更新单个文件进度
                $(`#file-progress-${i}`).css('width', progress + '%').attr('aria-valuenow', progress);

                // 更新总体进度
                let totalProgress = ((completedFiles + (progress / 100)) / files.length) * 100;
                $('#total-progress').css('width', totalProgress + '%').attr('aria-valuenow', totalProgress).text(Math.round(totalProgress) + '%');

                // 如果单个文件完成
                if (progress === 100) {
                    completedFiles++;
                    $(`#file-progress-${i}`).addClass('bg-success');
                }

                // 显示阶段提示
                if (progress <= 50) {
                    $(`#local-status-${i}`).addClass('font-weight-bold text-primary').removeClass('text-muted');
                    $(`#cloud-status-${i}`).addClass('text-muted').removeClass('font-weight-bold text-primary');
                } else if (progress < 100) {
                    $(`#cloud-status-${i}`).text('云端同步中...');
                    $(`#local-status-${i}`).text('本地上传完成');
                    $(`#cloud-status-${i}`).addClass('font-weight-bold text-primary').removeClass('text-muted');
                    $(`#local-status-${i}`).addClass('text-muted').removeClass('font-weight-bold text-primary');
                } else {
                    $(`#cloud-status-${i}`).text('云端同步完成');
                }
            });
        }

        // 所有文件上传完成
        balert('所有文件上传成功', "success", false, 1500, "top");
        loadFiles(selectedNode, page_fileslibcloud); // 刷新当前文件夹的文件列表
        closeModal();
        fileInput.remove();
    });

    // 触发 file input 元素点击事件
    fileInput.click();
}

// 上传单个文件的函数
async function uploadSingleFile(file, fileIndex, folderCode, fullFolderCode, progressCallback) {
    var chunkSize = 1024 * 1024; // 1MB
    var chunks = Math.ceil(file.size / chunkSize);
    var fileCode = generateGUID(true);
    // 上传所有分片到本地服务器
    for (let chunk = 0; chunk < chunks; chunk++) {
        var start = chunk * chunkSize;
        var end = Math.min(start + chunkSize, file.size);
        var chunkBlob = file.slice(start, end);
        var formData = new FormData();
        formData.append('file', chunkBlob);
        formData.append('chunkNumber', chunk + 1);
        formData.append('fileName', file.name);
        formData.append('folderCode', folderCode);
        formData.append('fileCode', fileCode);

        try {
            await $.ajax({
                url: '/FilesAI/UploadCloud',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (data) {
                    // 本地上传进度占总进度的50%
                    var progress = ((chunk + 1) / chunks) * 50;
                    progressCallback(progress);
                },
                error: function (xhr, status, error) {
                    balert(xhr.responseText, "danger", false, 1500, "top");
                    throw new Error('上传分片失败');
                }
            });
        } catch (error) {
            console.error('上传分片失败:', error);
            return false;
        }
    }

    // 本地分片上传完成，显示50%进度，并改变进度条颜色表示阶段变化
    progressCallback(50);
    $(`#file-progress-${fileIndex}`).addClass('bg-info').removeClass('bg-primary');
    $(`#local-status-${fileIndex}`).text('本地上传完成');
    $(`#cloud-status-${fileIndex}`).addClass('font-weight-bold text-primary').removeClass('text-muted');
    $(`#cloud-status-${fileIndex}`).text('云端同步中...');

    // 创建一个轮询进度的函数
    let pollInterval = null;

    // 开始轮询云端同步进度
    function startPolling() {
        pollInterval = setInterval(async function () {
            try {
                let progressResponse = await $.ajax({
                    url: '/FilesAI/GetUploadProgress',
                    type: 'POST',
                    data: {
                        fileCode: fileCode,
                        fileName: file.name
                    }
                });

                if (progressResponse.success) {
                    // 计算总进度：本地上传50% + 云端同步50%
                    let cloudProgress = progressResponse.progress;
                    let totalProgress = 50 + (cloudProgress / 2);

                    // 更新进度条
                    progressCallback(Math.min(totalProgress, 100));

                    // 如果云端同步完成，停止轮询
                    if (cloudProgress >= 100) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                        $(`#file-progress-${fileIndex}`).addClass('bg-success').removeClass('bg-info');
                        $(`#cloud-status-${fileIndex}`).text('云端同步完成');
                    }
                } else {
                    console.error('获取云端同步进度失败:', progressResponse.message);
                }
            } catch (error) {
                console.error('轮询云端同步进度失败:', error);
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }, 1000); // 每秒轮询一次
    }

    // 立即开始轮询
    startPolling();

    // 设置超时，防止无限轮询
    setTimeout(function () {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
            progressCallback(100);
            $(`#file-progress-${fileIndex}`).addClass('bg-success').removeClass('bg-info');
            $(`#cloud-status-${fileIndex}`).text('云端同步完成');
        }
    }, 180000); // 最多轮询180秒

    // 合并文件并同步到COS
    try {
        let response = await $.ajax({
            url: '/FilesAI/MergeFilesCloudAndSyncToCOS',
            type: 'POST',
            data: JSON.stringify({
                fileName: file.name,
                totalChunks: chunks,
                folderCode: folderCode,
                fullFolderCode: fullFolderCode,
                fileCode: fileCode
            }),
            contentType: 'application/json'
        });

        if (!response.success) {
            // 如果合并失败，停止轮询
            if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
            balert(`文件 ${file.name} 合并或同步到COS失败: ${response.msg}`, "danger", false, 1500, "top");
            return false;
        }

        return true;
    } catch (error) {
        // 如果发生错误，停止轮询
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        console.error('合并文件或同步到COS失败:', error);
        balert(`文件 ${file.name} 合并或同步到COS失败`, "danger", false, 1500, "top");
        return false;
    }
}

// 获取完整的文件夹路径编码
async function uploadChunkLegacy(file, chunk, chunks, start, chunkSize, folderCode, fullFolderCode, fileInput) {
    // 保留原有实现，以防其他地方调用
    var end = Math.min(start + chunkSize, file.size);
    var chunkBlob = file.slice(start, end);
    var formData = new FormData();
    formData.append('file', chunkBlob);
    formData.append('chunkNumber', ++chunk);
    formData.append('fileName', file.name);
    formData.append('folderCode', folderCode);

    await $.ajax({
        url: '/FilesAI/UploadCloud',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function (data) {
            var progress = (chunk / chunks) * 100;
            $('#p1').css('width', progress + '%').attr('aria-valuenow', progress).text(Math.round(progress) + '%');
        },
        error: function (xhr, status, error) {
            balert(xhr.responseText, "danger", false, 1500, "top");
            closeModal();
            if (fileInput) fileInput.remove();
        }
    });

    if (chunk < chunks) {
        await uploadChunkLegacy(file, chunk, chunks, end, chunkSize, folderCode, fullFolderCode, fileInput);
    } else {
        // 在所有切片上传完成后触发
        $.ajax({
            url: '/FilesAI/MergeFilesCloud',
            type: 'POST',
            data: JSON.stringify({
                fileName: file.name,
                totalChunks: chunks,
                folderCode: folderCode,
                fullFolderCode: fullFolderCode
            }),
            contentType: 'application/json',
            success: function (response) {
                if (response.success) {
                    loadFiles(folderCode, page_fileslibcloud); // 刷新当前文件夹的文件列表，保持在当前页
                    $('#p1').text('上传完成');
                    balert('文件上传成功', "success", false, 1500, "top");
                } else {
                    balert('文件上传失败', "danger", false, 1500, "top");
                }
                // 移除文件框
                if (fileInput) fileInput.remove();
                closeModal();
            },
            error: function (xhr, status, error) {
                balert('文件合并失败', "danger", false, 1500, "top");
                closeModal();
                if (fileInput) fileInput.remove();
            }
        });
    }
}

// 获取完整的文件夹路径编码
function getFullFolderPath(nodeId) {
    if (nodeId === 'root') return 'root';

    let path = [];
    let current = $('#folderTree').jstree(true).get_node(nodeId);

    // 构建路径
    while (current.id !== 'root') {
        path.unshift(current.id);
        current = $('#folderTree').jstree(true).get_node(current.parent);
    }

    return path.join('/');
}

// 删除文件
function deleteFile(fileId, event) {
    event.stopPropagation();
    showConfirmationModal('警告', '确定要删除此文件吗？', function () {
        $.ajax({
            url: '/FilesAI/DeleteFilesLibCloud',
            type: 'POST',
            data: { fileCode: fileId },
            success: function (response) {
                if (response.success) {
                    balert('文件删除成功', "success", false, 1500, "top");
                    // 刷新文件列表，保持在当前页
                    let currentNode = $('#folderTree').jstree('get_selected')[0];
                    loadFiles(currentNode, page_fileslibcloud);
                } else {
                    balert('文件删除失败', "danger", false, 1500, "top");
                }
            },
            error: function (error) {
                balert('删除请求失败', "danger", false, 1500, "top");
            }
        });
    });
}

function createFolder() {
    // 获取当前选中的文件夹节点
    let selectedNode = $('#folderTree').jstree('get_selected')[0];
    if (!selectedNode) {
        balert('请先选择一个文件夹', "warning", false, 1500, "top");
        return;
    }

    // 显示创建文件夹模态框
    $('#createFolderModal').modal('show');
}

// 确认创建文件夹
function confirmCreateFolder() {
    let folderName = $('#folderName').val().trim();
    if (!folderName) {
        balert('请输入文件夹名称', "warning", false, 1500, "top");
        return;
    }

    // 获取当前选中的文件夹节点
    let selectedNode = $('#folderTree').jstree('get_selected')[0];

    $.ajax({
        url: '/FilesAI/CreateFolder',
        type: 'POST',
        data: {
            folderName: folderName,
            parentCode: selectedNode
        },
        success: function (response) {
            if (response.success) {
                balert('文件夹创建成功', "success", false, 1500, "top");
                // 关闭模态框
                $('#createFolderModal').modal('hide');
                // 清空输入框
                $('#folderName').val('');
                // 刷新文件夹树
                refreshFolderTree();
            } else {
                balert('文件夹创建失败', "danger", false, 1500, "top");
            }
        },
        error: function (error) {
            balert('创建文件夹请求失败', "danger", false, 1500, "top");
        }
    });
}

// 删除文件夹
function deleteFolder() {
    // 获取当前选中的文件夹节点
    let selectedNode = $('#folderTree').jstree('get_selected')[0];
    if (!selectedNode || selectedNode === 'root') {
        balert('请选择要删除的文件夹', "warning", false, 1500, "top");
        return;
    }
    showConfirmationModal('警告', '确定要删除此文件夹吗？此操作将删除文件夹内的所有文件和子文件夹，且不可恢复！', function () {
        $.ajax({
            url: '/FilesAI/DeleteFolderLib',
            type: 'POST',
            data: { folderCode: selectedNode },
            success: function (response) {
                if (response.success) {
                    balert('文件夹删除成功', "success", false, 1500, "top");
                    // 刷新文件夹树
                    refreshFolderTree();
                    // 加载根目录文件
                    loadFiles('root');
                    // 更新面包屑
                    $('.breadcrumb').html('<li class="breadcrumb-item"><a href="#" onclick="navigateTo(\'root\')">根目录</a></li><li class="breadcrumb-item active" aria-current="page">当前文件夹</li>');
                } else {
                    balert('文件夹删除失败', "danger", false, 1500, "top");
                }
            },
            error: function (error) {
                balert('删除文件夹请求失败', "danger", false, 1500, "top");
            }
        });
    });
}

// 刷新文件夹树
function refreshFolderTree() {
    $('#folderTree').jstree('destroy');
    initFolderTree();
}

// 刷新文件列表
function refreshFiles() {
    let selectedNode = $('#folderTree').jstree('get_selected')[0];
    loadFiles(selectedNode || 'root', 1); // 刷新时重置为第一页
}

function deleteSelectedFiles() {
    // 获取所有选中的文件ID，根据当前视图模式选择
    let selectedFiles;

    if ($('#filesGrid').hasClass('d-none')) {
        // 列表视图模式
        selectedFiles = $('#filesList .file-checkbox:checked').map(function () {
            return $(this).data('id');
        }).get();
    } else {
        // 网格视图模式
        selectedFiles = $('#filesGrid .file-checkbox:checked').map(function () {
            return $(this).data('id');
        }).get();
    }

    // 去重，确保没有重复的文件ID
    selectedFiles = [...new Set(selectedFiles)];

    if (selectedFiles.length === 0) {
        balert('请先选择要删除的文件', "warning", false, 1500, "top");
        return;
    }
    showConfirmationModal('警告', `确定要删除选中的 ${selectedFiles.length} 个文件吗？`, function () {
        // 将文件ID数组转换为逗号分隔的字符串
        const fileCodeString = selectedFiles.join(',');

        $.ajax({
            url: '/FilesAI/DeleteFilesLibCloud',
            type: 'POST',
            data: { fileCode: fileCodeString },
            success: function (response) {
                if (response.success) {
                    balert('文件删除成功', "success", false, 1500, "top");
                    // 刷新文件列表，保持在当前页
                    let currentNode = $('#folderTree').jstree('get_selected')[0];
                    loadFiles(currentNode, page_fileslibcloud);
                } else {
                    balert('文件删除失败', "danger", false, 1500, "top");
                }
            },
            error: function (error) {
                balert('删除请求失败', "danger", false, 1500, "top");
            }
        });
    });
}

function shareFile(fileCode, event) {
    if (event) {
        event.stopPropagation();
    }

    // 构建分享链接
    const shareLink = window.location.origin + '/FilesAI/Share?filecode=' + fileCode;

    // 检查是否已存在分享模态框，如果存在则移除
    if ($('#shareFileModal').length) {
        $('#shareFileModal').remove();
    }

    // 创建模态框HTML
    const modalHtml = `
        <div class="modal fade" id="shareFileModal" tabindex="-1" role="dialog" aria-labelledby="shareFileModalLabel" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="shareFileModalLabel">分享文件</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="share-link-container">
                            <div class="form-group">
                                <label for="shareLink">分享链接：</label>
                                <div class="input-group">
                                    <input type="text" class="form-control" id="shareLink" value="${shareLink}" readonly>
                                    <div class="input-group-append">
                                        <button class="btn btn-outline-secondary" type="button" onclick="copyShareLink()">
                                            <i data-feather="copy"></i> 复制
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="mt-3 text-center">
                                <small class="text-muted">复制链接后可以分享给他人</small>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 将模态框添加到页面
    $('body').append(modalHtml);

    // 显示模态框
    $('#shareFileModal').modal('show');

    // 模态框显示后初始化feather图标
    $('#shareFileModal').on('shown.bs.modal', function () {
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    });
}

// 复制分享链接到剪贴板
function copyShareLink() {
    var copyText = document.getElementById("shareLink");
    copyText.select();
    copyText.setSelectionRange(0, 99999); // 兼容移动设备
    document.execCommand("copy");

    // 显示复制成功提示
    balert('链接已复制到剪贴板', "success", false, 1500, "top");
}

function searchFiles() {
    var searchTerm = $('#searchFiles').val().trim();
    if (searchTerm === '') {
        // 如果搜索框为空，则重置为第一页
        loadFiles(folderId, 1);
    } else {
        // 如果搜索框不为空，则搜索文件
        loadFiles(folderId, 1, searchTerm);
    }
}
function moveFileToLib(fileCode) {
    // 显示加载中提示
    var destroyAlert = balert('正在转存文件到素材库，请稍候...', "info", false, 0, "top");

    $.ajax({
        url: '/FilesAI/MoveFileToLib',
        type: 'Post',
        data: {
            fileCode: fileCode
        },
        success: function (response) {
            destroyAlert();
            if (response.success) {
                balert('文件转存成功', "success", false, 1500, "top");
                // 关闭模态框
                loadFiles(folderId, 1);
            } else {
                balert('文件转存失败: ' + response.msg, "danger", false, 1500, "top");
            }
        },
        error: function (error) {
            destroyAlert();
            balert('文件转存请求失败', "danger", false, 1500, "top");
        }
    });
}