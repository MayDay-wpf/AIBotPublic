$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#files-main-menu").addClass('active');
    $("#files-main-menu").parent().toggleClass('show');
    $("#files-main-menu").parent().siblings().removeClass('show');
    $("#lib-files-nav").addClass('active');
    getFiles(1); // Initial load, start at page 1
});

let pageSize = 10; // Default page size.  You can change this.
let totalPages = 0; // 全局变量，用于存储总页数

async function uploadChunk(file, chunk, chunks, start, chunkSize) {
    var end = Math.min(start + chunkSize, file.size);
    var chunkBlob = file.slice(start, end);
    var formData = new FormData();
    formData.append('file', chunkBlob);
    formData.append('chunkNumber', ++chunk);
    formData.append('fileName', file.name);

    await $.ajax({
        url: '/FilesAI/Upload',
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
        }
    });

    if (chunk < chunks) {
        await uploadChunk(file, chunk, chunks, end, chunkSize);
    } else {
        // 在所有切片上传完成后触发
        $.ajax({
            url: '/FilesAI/MergeFiles',
            type: 'POST',
            data: JSON.stringify({ fileName: file.name, totalChunks: chunks }),
            contentType: 'application/json',
            success: function (response) {
                getFiles(1); // Refresh the file list after upload
                $('#p1').text('上传完成');
                //移除文件框
                fileInput.remove();
                closeModal();
            }
        });
    }
}

async function uploadFiles() {
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // 添加事件监听器
    fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        if (!file) {
            balert('请选择文件', 'danger', true, 2000, "center");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {  // 限制为10MB
            balert('文件大小不能超过10MB', 'danger', true, 2000, "center");
            return;
        }

        var chunkSize = 100 * 1024; // 100KB
        var chunks = Math.ceil(file.size / chunkSize);
        var chunk = 0;
        openModal('上传文件中，请稍候...', `<div class="progress ht-20">
                        <div id="p1" class="progress-bar wd-25p" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                    </div>`);

        uploadChunk(file, chunk, chunks, 0, chunkSize);
    });

    // 触发 file input 元素点击事件
    fileInput.click();
}

function getFiles(page) {
    loadingOverlay.show();
    var name = $('#searchKey').val();
    var data = {
        name: name,
        page: page,
        pageSize: pageSize
    };

    $.ajax({
        type: 'Post',
        url: '/FilesAI/GetFilesLibs',
        data: data,
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                totalPages = Math.ceil(res.total / pageSize); // 从响应中获取总页数
                renderTable(res.data);
                renderPagination(page, totalPages); // Pass totalPages here
            }
        },
        error: function (res) {
            loadingOverlay.hide();
        }
    });
}

function renderTable(data) {
    var html = `
        <div class="table-responsive">
            <table class="table table-striped table-hover">
                <thead>
                    <tr>
                        <th></th>
                        <th>文件名</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        var fileType = item.fileType;
        var avatarpath = '';

        // Icon logic (CORRECTED!)
        if (fileType == ".txt") avatarpath = '/static/image/TXTimg.png'; else if (fileType == ".pdf") avatarpath = '/static/image/PDF.png'; else if (fileType == ".pptx") avatarpath = '/static/image/PPT.png'; else if (fileType == ".doc" || fileType == ".docx") avatarpath = '/static/image/DOC.png'; else if (fileType == ".xls" || fileType == ".xlsx") avatarpath = '/static/image/XLS.png'; else avatarpath = '/static/image/unknowfile.png';
        html += `
            <tr>
                <td><img src="${avatarpath}" style="width: 30px; height: 30px;" alt="${fileType} icon"></td> 
                <td>${item.fileName}</td>
                <td>${item.createTime}</td>
                <td>
                    <a href="javascript:void(0)" class="btn btn-danger btn-sm" onclick="deleteFiles('${item.fileCode}')"><i class="fas fa-trash-alt"></i> 删除</a>
                    <a href="${item.filePath}" class="btn btn-primary btn-sm" download="${item.fileName}"><i class="fas fa-cloud-download-alt"></i> 下载</a>
                    <a href="javascript:void(0)" class="btn btn-success btn-sm" onclick="saveToCloud('${item.fileCode}')"><i class="fas fa-cloud-upload-alt"></i> 转存到网盘</a>
                </td>
            </tr>
        `;
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    $('#file-table-container').html(html);
}
// 添加转存到网盘功能
function saveToCloud(fileCode) {
    // 打开选择文件夹的模态框
    showFolderSelectModal(fileCode);
}

// 显示文件夹选择模态框
function showFolderSelectModal(fileCode) {
    // 创建模态框HTML
    const modalHtml = `
        <div class="modal fade" id="folderSelectModal" tabindex="-1" role="dialog" aria-labelledby="folderSelectModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="folderSelectModalLabel">选择目标文件夹</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div id="cloudFolderTree"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="confirmSaveToCloud">确认转存</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 将模态框添加到页面
    $('body').append(modalHtml);

    // 显示模态框
    $('#folderSelectModal').modal('show');

    // 初始化文件夹树
    initCloudFolderTree(fileCode);

    // 模态框关闭时移除
    $('#folderSelectModal').on('hidden.bs.modal', function () {
        $(this).remove();
    });
}

// 初始化云端文件夹树
function initCloudFolderTree(fileCode) {
    // 从后端获取文件夹数据
    $.ajax({
        url: '/FilesAI/GetFoldersLibs',
        type: 'POST',
        dataType: 'json',
        success: function (response) {
            if (response.success) {
                // 构建树形结构数据
                let treeData = buildCloudFolderTreeData(response.data);

                // 初始化jstree
                $('#cloudFolderTree').jstree({
                    'core': {
                        'data': treeData,
                        'check_callback': true
                    },
                    'plugins': ['types', 'wholerow'],
                    'types': {
                        'default': {
                            'icon': 'fas fa-folder'
                        }
                    }
                });

                // 绑定确认按钮事件
                $('#confirmSaveToCloud').click(function () {
                    const selectedNode = $('#cloudFolderTree').jstree('get_selected')[0];
                    if (!selectedNode) {
                        balert('请选择一个目标文件夹', "warning", false, 1500, "top");
                        return;
                    }

                    // 执行转存操作
                    saveFileToCloud(fileCode, selectedNode);
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

// 构建云端文件夹树形结构数据
function buildCloudFolderTreeData(foldersData) {
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

// 执行转存操作
function saveFileToCloud(fileCode, folderCode) {
    // 显示加载中提示
    var destroyAlert = balert('正在转存文件，请稍候...', "info", false, 0, "top");

    $.ajax({
        url: '/FilesAI/SaveFileToCloud',
        type: 'Post',
        data: {
            fileCode: fileCode,
            folderCode: folderCode
        },
        success: function (response) {
            destroyAlert();
            if (response.success) {
                balert('文件转存成功', "success", false, 1500, "top");
                // 关闭模态框
                $('#folderSelectModal').modal('hide');
                getFiles(1);
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

function renderPagination(currentPage, totalPages) {
    let paginationHtml = '<ul class="pagination">';

    // Previous Page
    if (currentPage > 1) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="javascript:void(0);" onclick="getFiles(${currentPage - 1})">上一页</a></li>`;
    } else {
        paginationHtml += `<li class="page-item disabled"><a class="page-link" href="javascript:void(0);">上一页</a></li>`;
    }

    // Page Numbers
    // 显示所有页码
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHtml += `<li class="page-item active"><a class="page-link" href="javascript:void(0);">${i}</a></li>`;
        } else {
            paginationHtml += `<li class="page-item"><a class="page-link" href="javascript:void(0);" onclick="getFiles(${i})">${i}</a></li>`;
        }
    }


    // Next Page
    if (currentPage < totalPages) {
        paginationHtml += `<li class="page-item"><a class="page-link" href="javascript:void(0);" onclick="getFiles(${currentPage + 1})">下一页</a></li>`;
    } else {
        paginationHtml += `<li class="page-item disabled"><a class="page-link" href="javascript:void(0);">下一页</a></li>`;
    }

    paginationHtml += '</ul>';
    $('#pagination-container').html(paginationHtml);
}

function deleteFiles(fileCode) {
    showConfirmationModal('警告', '确认删除文件？', function () {
        //发送请求
        $.ajax({
            type: 'Post',
            url: '/FilesAI/DeleteFilesLibs',
            data: { fileCode: fileCode },
            success: function (res) {
                if (res.success) {
                    balert('删除成功', "success", false, 1500);
                    getFiles(1); // Refresh file list, go back to page 1
                }
            }
        });
    })
}

$(document).keypress(function (e) {
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getFiles(1); // Go to page 1 on search
        }
    }
});
