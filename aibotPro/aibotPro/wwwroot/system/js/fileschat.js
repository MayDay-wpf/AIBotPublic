var onfilearr = [];
var page_file = 1;
var pageSize_file = 10;
//调起素材库&上传文件
function showUploadFileMenu() {
    $("#uploadFileModel").modal('show');
    getFiles('init');
}
//文件上传
$('body').on('click', '.popup-item', function () {
    var type = $(this).data('type');
    if (type == "archive") {

    } else if (type == "uploadFile") {
        uploadFiles();
    }
});

async function uploadChunk(file, chunk, chunks, start, chunkSize, isManualUpload = false) {
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
        }
    });

    if (chunk < chunks) {
        await uploadChunk(file, chunk, chunks, end, chunkSize, isManualUpload);
    } else {
        // 在所有切片上传完成后触发
        $.ajax({
            url: '/FilesAI/MergeFiles',
            type: 'POST',
            data: JSON.stringify({ fileName: file.name, totalChunks: chunks }),
            contentType: 'application/json',
            success: function (response) {
                onfilearr.push({
                    fileName: response.fileName, path: response.path.replace('wwwroot', ''), onfile: true
                });
                updateFileRedDot(onfilearr.length);
                $('#onfilelist').show();
                $('#p1').text('上传完成');
                balert("上传成功，已为您自动存入素材库", "success", false, 1500, "top");
                $("#uploadFileModel").modal('hide');

                // 只在手动上传时移除文件输入框
                if (isManualUpload) {
                    var fileInput = document.getElementById('fileInput');
                    if (fileInput) {
                        fileInput.remove();
                    }
                }

                closeModal();
                loadOnfilelist();
            }
        });
    }
}

$('#fileslibsitem').scroll(function () {
    // 检查用户是否滚动到页面底部
    // 滚动高度 + 元素高度 >= 滚动容器的整体高度
    if ($('#fileslibsitem').scrollTop() + $('#fileslibsitem').outerHeight() >= $('#fileslibsitem')[0].scrollHeight) {
        getFiles('loadmore');
    }
});

function getFiles(type) {
    if (type == 'init') {
        page_file = 1;
        pageSize_file = 10;
    }
    if (type == 'loadmore') {
        page_file++;
    }
    var data = {
        name: '', page: page_file, pageSize: pageSize_file
    };
    $.ajax({
        type: 'Post',
        url: '/FilesAI/GetFilesLibs',
        data: data,
        success: function (res) {
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    var isChecked = onfilearr.findIndex(onitem => onitem.path === item.filePath) !== -1 ? 'checked' : '';
                    html += `<li class="list-group-item d-flex justify-content-between align-items-center">
                                <div>
                                    <input type="checkbox" value='${item.filePath}' data-filename='${item.fileName.length > 20 ? item.fileName.substring(0, 15) + '...' : item.fileName}' ${isChecked}>
                                    ${item.fileName.length > 20 ? item.fileName.substring(0, 15) + '...' : item.fileName}
                                </div>
                            </li>`;
                }
                if (type == 'loadmore') {
                    $('#fileslibsitem').append(html);
                    unloadingBtn("#loadMoreBtn");
                } else {
                    if (res.data.length <= 0) {
                        html = '<li>素材库暂无文件，请上传~</li>'
                    }
                    $('#fileslibsitem').html(html);
                }

                // Check if we need to show the "Load More" button
                if (res.total > page_file * pageSize_file) {
                    $('#loadMoreBtn').show();
                } else {
                    $('#loadMoreBtn').hide();
                }

                updateFileRedDot(onfilearr.length);
            }
        }
    });
}

// 当复选框状态改变时
$('#fileslibsitem').on('change', 'input[type="checkbox"]', function (e) {
    var path = $(this).val();
    var filename = $(this).data('filename');
    if ($(this).is(':checked')) {
        // 如果onfilearr已存在这个文件，则不添加
        if (onfilearr.findIndex(item => item.path === path) === -1) {
            // 添加到onfilearr
            onfilearr.push({
                fileName: filename, path: path, onfile: true
            });
        }
    } else {
        // 从onfilearr中移除
        onfilearr = onfilearr.filter(item => item.path !== path);
    }
    loadOnfilelist();
    if (onfilearr.length === 0) {
        $('#onfilelist').hide();
    } else {
        $('#onfilelist').show();
    }
    updateFileRedDot(onfilearr.length);
});

function loadOnfilelist() {
    var $onfilesitem = $('#onfilesitem');

    $onfilesitem.empty();

    for (var i = 0; i < onfilearr.length; i++) {
        var isChecked = onfilearr[i].onfile ? 'checked' : ''; // 根据onfile属性确定复选框是否选中

        var html = `<li class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <input type="checkbox" value='${onfilearr[i].path}' ${isChecked}>
                            ${onfilearr[i].fileName}
                        </div>
                        <div>
                            <i class="icon ion-close" style="cursor:pointer"></i>
                        </div>
                    </li>`;

        $onfilesitem.append(html);

        // 当复选框状态改变时
        $onfilesitem.find('input[type="checkbox"]').last().change(function (e) {
            var path = $(this).val();
            var index = onfilearr.findIndex(item => item.path === path);

            if ($(this).is(':checked')) {
                onfilearr[index].onfile = true;
            } else {
                onfilearr[index].onfile = false;
            }
            updateFileRedDot(onfilearr.length);
        });

        // 点击删除图标的动作
        $onfilesitem.find('.ion-close').last().click(function (e) {
            e.stopPropagation(); // 阻止事件冒泡
            var path = $(this).closest('li').find('input[type="checkbox"]').val();
            onfilearr = onfilearr.filter(item => item.path !== path);
            $onfilesitem.empty();
            updateFileRedDot(onfilearr.length);
            if (onfilearr.length == 0) {
                $('#onfilelist').hide();
            } else loadOnfilelist(); // 重新加载文件列表
        });
    }
}


async function uploadFiles(file = null, isManualUpload = true) {
    if (!file) {
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileInput';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // 添加事件监听器
        fileInput.addEventListener('change', function () {
            file = fileInput.files[0];
            processFile(file, isManualUpload);
        });

        // 触发 file input 元素点击事件
        fileInput.click();
    } else {
        processFile(file, isManualUpload);
    }
}

function processFile(file, isManualUpload) {
    if (!file) {
        balert('请选择文件', 'danger', true, 2000, "center");
        return;
    }
    if (file.size > 30 * 1024 * 1024) {
        balert('文件大小不能超过30兆', 'danger', true, 2000, "center");
        return;
    }
    var allowedExtensions = ['txt', 'pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'];
    var fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        balert('只允许上传TXT, PDF, PPT, WORD, EXCEL文件', 'danger', true, 2000, "top");
        return;
    }
    var chunkSize = 100 * 1024; // 100KB
    var chunks = Math.ceil(file.size / chunkSize);
    var chunk = 0;
    openModal('上传文件中，请稍候...', `<div class="progress ht-20">
                    <div id="p1" class="progress-bar wd-25p" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                </div>`);

    uploadChunk(file, chunk, chunks, 0, chunkSize, isManualUpload);
}

//更新红点数字或隐藏
function updateFileRedDot(num) {
    var fileCount = $("#fileCount");
    if (num > 0) {
        fileCount.text(num);
        fileCount.show();
    } else {
        fileCount.hide();
    }
}