let pageIndexbytype = 1;
let pageSizebytyp = 12;
let page = 1;
let pageSize = 12;
let thisTypeCode = '';
let knowledgecreatemodel = 'Fixedlength';
let fixedlength = 1000;
let checkFileCode = [];
let processFileCode = [];
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#knowledge-main-menu").addClass('active');
    $("#knowledge-main-menu").parent().toggleClass('show');
    $("#knowledge-main-menu").parent().siblings().removeClass('show');
    $("#milvus-knowledge-nav").addClass('active');
    getKnowledgeType('init');
});
$(document).keypress(function (e) {
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getKnowledgeType('init');
        }
    }
    if ($("#searchKey-knowledgefile").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getFiles("init", thisTypeCode);
        }
    }
});
function createKnowledgeType() {
    var html = `<div style="text-align:center">
                   <img src='/system/images/konwledges.png' style="width:80px;" /><br>
                   <h5><b>请输入需要创建的知识库类型名（例：离散数学真题库）</b></h5>
                </div>`;
    showPromptModal("新建知识库", html, function (value) {
        if (value != "") {
            $.ajax({
                type: 'Post',
                url: '/KnowledgeAI/CreateKnowledgeType',
                data: {
                    typeName: value
                },
                success: function (res) {
                    if (res.success) {
                        balert('创建成功', 'success', false, 1500, 'center');
                        getKnowledgeType('init');
                    }
                    else
                        balert(res.msg, "danger", false, 2000);
                }
            });
        } else {
            balert('知识库类型名不能为空', 'danger', false, 1000, 'center', function () {
                createKnowledgeType();
            });
        }

    });
}
function getKnowledgeType(type) {
    loadingOverlay.show();
    var name = $('#searchKey').val();
    if (type == 'init') {
        page = 1;
        pageSize = 12;
    }
    if (type == 'loadmore' && noMoreData) { // 加载更多但标志已表示没有更多数据
        loadingOverlay.hide();
        balert('没有更多了', "info", false, 1500, "center");
        return; // 直接返回，不再进行请求
    }
    if (type == 'loadmore') {
        page++;
    }
    var data = {
        name: name,
        page: page,
        pageSize: pageSize
    };
    $.ajax({
        type: 'Post',
        url: '/KnowledgeAI/GetKnowledgeType',
        data: data,
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    var avatarpath = '/system/images/konwledges.png';
                    html += '<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">';
                    html += '<div class="card h-100">';
                    html += '<img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;" src="' + avatarpath + '">';
                    html += '<div class="card-body">';
                    html += '<h5 class="card-title" style="max-height: 100px; overflow: auto;">' + item.typeName + '</h5>';
                    html += '<p class="card-text">' + isoStringToDateTime(item.createTime) + '</p>';
                    html += '<div class="d-flex justify-content-center">';
                    html += `<a href="#" class="btn btn-danger" style="margin-right:10px;" onclick="deleteFiles('','` + item.typeCode + `')">删除</a>`;
                    html += `<a href="#" class="btn btn-info" style="margin-right:10px;" onclick="getKnowledgeTypeInfo('` + item.typeCode + `')">详情</a>`;
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                if (type == 'loadmore') {
                    $('#masonry-layout').append(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                } else {
                    $('#masonry-layout').html(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                }
            }
        },
        error: function (res) {
            loadingOverlay.hide();
        }
    });
}
var timer;

function getProcessFileCode() {
    if (checkFileCode.length === 0) {
        $(".deletefile").show();
        $(".processBox").hide();
        $(".stopBuild").hide();
        clearInterval(timer);
        timer = null;
        return;
    }

    $.ajax({
        type: 'POST',
        url: '/KnowledgeAI/GetProcess',
        data: {
            fileCodes: checkFileCode
        },
        success: function (res) {
            if (res.success) {
                var newProcessData = res.data;

                // 将新进度信息更新到 processFileCode 数组
                Object.keys(newProcessData).forEach(function (key) {
                    var index = processFileCode.findIndex(function (item) {
                        return item.key === key;
                    });
                    if (index !== -1) {
                        // 如果已经有此项，则更新其值
                        processFileCode[index].value = newProcessData[key];
                    } else {
                        // 否则添加新条目
                        processFileCode.push({ key: key, value: newProcessData[key] });
                    }
                });

                // 检查是否有任何条目从新数据中删除了，并且处理相应逻辑
                var removedItems = processFileCode.filter(function (item) {
                    return !(item.key in newProcessData);
                });
                for (var i = 0; i < removedItems.length; i++) {
                    $("." + removedItems[i].key).show();
                    $("#" + removedItems[i].key).hide();
                }

                // 移除已经不在新数据中的条目
                processFileCode = processFileCode.filter(function (item) {
                    return item.key in newProcessData;
                });
                console.log(processFileCode);
                if (processFileCode.length > 0) {
                    for (var i = 0; i < processFileCode.length; i++) {
                        var progressValue = processFileCode[i].value;
                        var progressBarId = processFileCode[i].key;
                        var progressBarSelector = '#' + progressBarId + ' .progress-bar';
                        var progressBar = $(progressBarSelector);

                        if (progressBar.length > 0) {
                            // 更新已存在的进度条
                            progressBar.css('width', progressValue + '%').attr('aria-valuenow', progressValue).text(progressValue + '%');
                        } else {
                            // 创建新的进度条并添加到页面中
                            var progressBarHtml =
                                `<a href="#" class="btn btn-danger ${processFileCode[i].key} stopBuild" style="margin-right:10px;" onclick="stopBuild('${processFileCode[i].key}')">停止构建</a><br>` +
                                '<div class="progress">' +
                                '<div class="progress-bar" role="progressbar" style="width: ' + progressValue + '%" aria-valuenow="' + progressValue + '" aria-valuemin="0" aria-valuemax="100">' +
                                progressValue + '%' +
                                '</div>' +
                                '</div>';
                            $("." + progressBarId).hide();
                            $('#' + progressBarId).html(progressBarHtml);
                        }
                    }
                } else {
                    checkFileCode = [];
                    $(".deletefile").show();
                    $(".processBox").hide();
                    $(".stopBuild").hide();
                }

            }
        },
        error: function (xhr, status, error) {
            console.error("Error occurred:", status, error);
        }
    });
}

// 设置定时器，每3秒调用一次getProcessFileCode函数
timer = setInterval(getProcessFileCode, 3000);

function getFiles(type, typeCode) {
    closeModal();
    $('#fileList').empty();
    $('#fileInput').val('');
    var name = $('#searchKey-knowledgefile').val();
    if (type == 'init') {
        thisTypeCode = typeCode;
        page = 1;
        pageSize = 12;
    }
    if (type == 'loadmore' && noMoreData) { // 加载更多但标志已表示没有更多数据
        loadingOverlay.hide();
        balert('没有更多了', "info", false, 1500, "center");
        return; // 直接返回，不再进行请求
    }
    if (type == 'loadmore') {
        page++;
    }
    var data = {
        name: name,
        page: page,
        pageSize: pageSize,
        typeCode: typeCode
    };
    $.ajax({
        type: 'Post',
        url: '/KnowledgeAI/GetKnowledgeFiles',
        data: data,
        success: function (res) {
            if (res.success) {
                var html = '';
                if (type != 'loadmore' && noMoreData)
                    checkFileCode = [];
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    checkFileCode.push(item.fileCode);
                    //获取文件类型
                    var fileType = item.fileName.substring(item.fileName.lastIndexOf('.')).toLowerCase();
                    var avatarpath = '';
                    if (fileType == ".txt")
                        avatarpath = '/static/image/TXTimg.png';
                    else if (fileType == ".pdf")
                        avatarpath = '/static/image/PDF.png';
                    else if (fileType == ".pptx")
                        avatarpath = '/static/image/PPT.png';
                    else if (fileType == ".doc" || fileType == ".docx")
                        avatarpath = '/static/image/DOC.png';
                    else if (fileType == ".xls" || fileType == ".xlsx")
                        avatarpath = '/static/image/XLS.png';
                    else
                        avatarpath = '';
                    html += '<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">';
                    html += '<div class="card h-100">';
                    html += '<img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;" src="' + avatarpath + '">';
                    html += '<div class="card-body">';
                    html += '<h5 class="card-title" style="max-height: 100px; overflow: auto;">' + item.fileName + '</h5>';
                    html += '<p class="card-text">' + isoStringToDateTime(item.createTime) + '</p>';
                    html += '<div class="d-flex justify-content-center">';
                    html += `<a href="#" class="btn btn-danger ${item.fileCode} deletefile" style="margin-right:10px;" onclick="deleteFiles('${item.fileCode}')">删除</a><br>`;
                    html += '</div>';
                    html += '</div>';
                    html += `<div id="${item.fileCode}" class="processBox">

                             </div>`;
                    html += '</div>';
                    html += '</div>';
                }
                if (type == 'loadmore') {
                    $('#masonry-layout-file').append(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                } else {
                    $('#masonry-layout-file').html(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                }
                getProcessFileCode();
            }
        },
        error: function (res) {
        }
    });
}
function deleteFiles(fileCode, typeCode) {
    showConfirmationModal('警告', '确认删除？', function () {
        //发送请求
        loadingOverlay.show();
        $.ajax({
            type: 'Post',
            url: '/KnowledgeAI/DeleteKnowledgeFilesByMilvus',
            data: {
                fileCode: fileCode,
                typeCode: typeCode
            },
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    balert('删除成功', "success", false, 1500);
                    if (typeof typeCode !== "undefined" && typeCode != "")
                        getKnowledgeType("init");
                    else
                        getFiles('init', thisTypeCode);
                } else {
                    balert('删除失败', "danger", false, 1500);
                }
            }
        });
    })
}

function stopBuild(fileCode) {
    showConfirmationModal('确认停止构建？', '停止构建会提前结束知识库创建，您需要手动删除已构建完成的部分内容并重新开始', function () {
        //发送请求
        loadingOverlay.show();
        $.ajax({
            type: 'Post',
            url: '/KnowledgeAI/StopBuild',
            data: {
                fileCode: fileCode
            },
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    $(".deletefile").show();
                    $(".processBox").hide();
                    $(".stopBuild").hide();
                    checkFileCode = checkFileCode.filter(value => value !== fileCode);
                    balert('停止成功', "success", false, 1500);
                }
            }
        })
    })
}
function getKnowledgeTypeInfo(typeCode) {
    $("#knowledge-types").hide();
    $("#knowledge-file").show();
    $(".newtype").hide();
    $(".newfile").show();
    $(".goback").show();
    getFiles("init", typeCode)
}
function goback() {
    $("#knowledge-types").show();
    $("#knowledge-file").hide();
    $(".newtype").show();
    $(".newfile").hide();
    $(".goback").hide();
    checkFileCode = [];
    processFileCode = [];
    thisTypeCode = '';
}
function regularInfo() {
    var content = `<p>为了提供更加灵活的文件切片方式，以达到最佳知识库生成效果，我们提供了<b>“正则表达式切片”</b></p>
                   <p><b>我们为您提供了一些使用示例如下</b></p>
                    <table border="1">
                      <tr>
                        <td>表达式</td>
                        <td>描述</td>
                      </tr>
                      <tr>
                        <td><b>([^。！？]+[。！？])</b></td>
                        <td>按结束标点符号切片（如句号、问号、感叹号）</td>
                      </tr>
                      <tr>
                        <td><b>((?:\r?\n){2,}.+?)</b></td>
                        <td>按段落切片（以双换行符为分隔）</td>
                      </tr>
                      <tr>
                        <td><b>([^。！？.!?]+[。！？.!?])</b></td>
                        <td>按句子切片（包括英文标点符号，如句号、问号和感叹号）</td>
                      </tr>
                      <tr>
                        <td><b>([^，,]+[，,])</b></td>
                        <td>按逗号切片（适用于需要根据逗号分割长文本的情况）</td>
                      </tr>
                      <tr>
                        <td><b>第\\s*(?:[一二三四五六七八九十]\\s*)*章\\s+.*?(?=第\\s*(?:[一二三四五六七八九十]\\s*)*章\\s+|$)</b></td>
                        <td>按章节（例如第*章分割，兼容空格阿拉伯数字和汉字）</td>
                      </tr>
                    </table>`;
    showConfirmationModal("正则表达式说明", content);
}
$(document).ready(function () {
    var MAX_CONCURRENT_UPLOADS = 3; // 最大并发上传数
    var CHUNK_SIZE = 100 * 1024; // 切片大小，例如100KB
    var uploadPaused = false; // 上传暂停标志

    $(document).on('change', '#fileInput', function () {
        var modelhtml = `<ul id="fileList" class="list-group"></ul>`;
        openModal('开始前检查', modelhtml);
        var fileList = $('#fileList');
        fileList.empty(); // 清空列表
        notifiedUnsupported = false; // 重置不支持的文件通知标志
        notifiedfilesOverCount = false;
        $.each(this.files, function (i, file) {
            var fileName = file.name;
            var validExtensions = [".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".pdf"];
            var fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
            if (!validExtensions.includes(fileExt)) {
                if (!notifiedUnsupported) {
                    // Remove the file from the input
                    //var input = document.getElementById('fileInput');
                    //input.value = '';
                    // Inform the user and set flag
                    balert('仅支持上传 Word、PPT、Excel、txt 和 PDF 文件，已为您移除不支持的文件', 'info', false, 2000, 'center');
                    notifiedUnsupported = true;
                }
                var fileInput = document.getElementById('fileInput');
                var newFiles = Array.from(fileInput.files).filter((_, index) => index !== i);

                // 创建一个新的 DataTransfer 对象
                var dataTransfer = new DataTransfer();
                newFiles.forEach(file => dataTransfer.items.add(file)); // 添加剩余文件

                // 替换文件输入的文件列表
                fileInput.files = dataTransfer.files;
            } else {
                if (document.getElementById('fileInput').files.length > 3 && !notifiedfilesOverCount) {
                    notifiedfilesOverCount = true;
                    closeModal();
                    $('#fileList').empty();
                    $('#fileInput').val('');
                    balert('最多同时创建3个文件的进程', 'info', false, 2000, 'center');
                }
                var fileSize = (file.size / 1024).toFixed(2) + ' KB';
                var listItem = $('<li class="list-group-item d-flex justify-content-between align-items-center" style="background: linear-gradient(90deg, rgba(13,110,253,0.5) 0%, rgba(255,255,255,0) 0%);">' +
                    '<div data-filename="' + fileName + '">' + truncateString(fileName, 20) + '</div>' +
                    '<div><small>大小: ' + fileSize + '</small> <button class="removeFile btn btn-danger btn-sm">移除</button></div>' +
                    '</li>').appendTo(fileList);

                // 开始上传文件
                //uploadFileInChunks(file, listItem);
                $('.removeFile', listItem).click(function () {
                    $(this).closest('li').remove();
                    var fileInput = $('#fileInput')[0];
                    var fileName = $(this).closest('li').find('div').first().data('filename');
                    var newFiles = Array.from(fileInput.files).filter(file => file.name !== fileName);
                    var dataTransfer = new DataTransfer();
                    newFiles.forEach(file => dataTransfer.items.add(file)); // 添加剩余文件
                    // 替换文件输入的文件列表
                    fileInput.files = dataTransfer.files;
                    if (dataTransfer.files.length == 0) {
                        closeModal();
                        $('#fileList').empty();
                        $('#fileInput').val('');
                    }
                });
            }
        });
        // 添加按钮来启动整个文件集合的上传
        var uploadButton = $('<button class="btn btn-primary btn-sm mt-2 starUpload">开始</button>');
        var cancelButton = $(' <button class="btn btn-secondary btn-sm mt-2 cancelUpload">取消</button>');
        var processType = $('<div style="margin-top: 15px;">' +
            '<h6 style="margin-bottom: 10px;"><b>选择知识库生成模式：</b></h6>' +
            '<select class="custom-select" id="processType">' +
            '<option value="Fixedlength">定长切片</option>' +
            '<option value="FixedlengthByJina">智能定长切片-JinaAI</option>' +
            '<option value="QA">Q/A清洗</option>' +
            '<option value="Newline">单换行符切片</option>' +
            '<option value="DoubleNewline">双换行符切片</option>' +
            '<option value="regex">正则表达式</option>' +
            '</select>' +
            '<div style="display: flex; align-items: center; margin-top: 10px;">' +
            '<input type="text" id="regular" placeholder="请输入正则表达式" class="form-control" style="display:none; width: auto; flex: 1; margin-right: 10px;" />' +
            '<a href="#" style="display:none;" onclick="regularInfo()"><i data-feather="help-circle"></i></a>' +
            '</div>' +
            '<div id="sliceSize" style="margin-top: 15px;">' +
            '<label for="sliceSizeRange">切片大小：<span id="sliceSizeValue">1000</span></label>' +
            '<input type="range" class="custom-range" id="sliceSizeRange" min="500" max="2000" step="100" value="1000">' +
            '</div>' +
            '</div>');

        processType.find('#processType').on('change', function () {
            var selectedValue = $(this).val();
            var regexInput = processType.find('#regular');
            var helpIcon = processType.find('a');
            var sliceSizeDiv = processType.find('#sliceSize');

            if (selectedValue === 'regex') {
                feather.replace();
                regexInput.show();
                helpIcon.css('display', 'inline-block');
                sliceSizeDiv.hide();
            } else if (selectedValue === 'Fixedlength' || selectedValue === 'FixedlengthByJina') {
                regexInput.hide();
                helpIcon.hide();
                sliceSizeDiv.show();
            } else {
                regexInput.hide();
                helpIcon.hide();
                sliceSizeDiv.hide();
            }
        });

        processType.find('#sliceSizeRange').on('input', function () {
            processType.find('#sliceSizeValue').text($(this).val());
        });
        function getSelectedValue() {
            var selectedValue = processType.find('#processType').val();
            if (selectedValue === 'regex') {
                var regexValue = processType.find('#regular').val();
                try {
                    if (regexValue.length < 3) {
                        return '';
                    }
                    new RegExp(regexValue);
                    return regexValue; // 正则表达式有效
                } catch (e) {
                    return ''; // 正则表达式无效
                }
            } else {
                return selectedValue;
            }
        }

        // 将 processType 插入到文档中的某个元素中
        $('#someContainer').append(processType);
        fileList.after(cancelButton);
        fileList.after(uploadButton);
        fileList.after(processType);

        uploadButton.click(function () {
            var selectedValue = getSelectedValue();
            if (selectedValue == '') {
                balert('正则表达式无效', 'danger', false, 2000, 'center');
                return;
            }
            $(".removeFile").remove();
            uploadButton.prop('disabled', true);
            uploadPaused = false;
            uploadButton.hide();
            knowledgecreatemodel = selectedValue;
            fixedlength = $('#sliceSizeRange').val();
            startUpload();
        });
        cancelButton.click(function () {
            closeModal();
            $('#fileList').empty();
            $('#fileInput').val('');
        });
    });
    function startUpload() {
        var files = $('#fileInput')[0].files;
        $.each(files, function (i, file) {
            var listItem = $('#fileList li').eq(i);
            uploadFileInChunks(file, listItem);
        });
    }

    function uploadFileInChunks(file, listItem) {
        var totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        var uploadPromises = [];
        var uploadedChunks = 0;

        for (let i = 0; i < totalChunks; i++) {
            let chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            uploadPromises.push(() => uploadChunk(chunk, i + 1, file.name, totalChunks));
        }

        // 控制并发
        (function uploadNextBatch() {
            var currentBatch = uploadPromises.splice(0, MAX_CONCURRENT_UPLOADS);
            if (currentBatch.length) {
                var batchPromises = currentBatch.map(upload => upload());
                Promise.all(batchPromises).then(() => {
                    uploadedChunks += currentBatch.length;
                    var progressPercent = (uploadedChunks / totalChunks) * 100;
                    listItem.css('background', `linear-gradient(90deg, rgba(13,110,253,0.5) ${progressPercent}%, rgba(255,255,255,0) ${progressPercent}%)`);
                    uploadNextBatch();
                });
            } else {
                // 所有切片上传完成，调用合并接口
                mergeFileChunks(file.name, totalChunks);
            }
        })();
    }

    function uploadChunk(chunk, chunkNumber, fileName, totalChunks) {
        var formData = new FormData();
        formData.append('file', chunk);
        formData.append('chunkNumber', chunkNumber);
        formData.append('fileName', fileName);

        return $.ajax({
            url: '/KnowledgeAI/UploadByMilvus',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false
        });
    }

    function mergeFileChunks(fileName, totalChunks) {
        $.ajax({
            url: '/KnowledgeAI/MergeFilesByMilvus',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                FileName: fileName,
                TotalChunks: totalChunks,
                ProcessType: knowledgecreatemodel,
                TypeCode: thisTypeCode,
                FixedLength: fixedlength
            }),
            success: function (response) {
                console.log('文件合并成功', response);
                getFiles("init", thisTypeCode);
                timer = setInterval(getProcessFileCode, 3000);
            }
        });
    }
});