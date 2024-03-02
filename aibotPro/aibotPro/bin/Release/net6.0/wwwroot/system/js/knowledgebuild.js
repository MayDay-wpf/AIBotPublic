var intervalId; // 用于存储定时器ID

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#knowledge-main-menu").addClass('active');
    $("#knowledge-main-menu").parent().toggleClass('show');
    $("#knowledge-main-menu").parent().siblings().removeClass('show');
    $("#build-knowledge-nav").addClass('active');
    $("#log").val('');
})
var knowledgecreatemodel = 'unwash';
$(document).ready(function () {
    var MAX_CONCURRENT_UPLOADS = 3; // 最大并发上传数
    var CHUNK_SIZE = 100 * 1024; // 切片大小，例如100KB
    var uploadPaused = false; // 上传暂停标志

    $('#fileInput').change(function () {
        var fileList = $('#fileList');
        fileList.empty(); // 清空列表
        notifiedUnsupported = false; // 重置不支持的文件通知标志

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
                var fileInput = document.getElementById('fileInput'); // 或者使用 $('#fileInput')[0] 如果你喜欢jQuery
                var newFiles = Array.from(fileInput.files).filter((_, index) => index !== i);

                // 创建一个新的 DataTransfer 对象
                var dataTransfer = new DataTransfer();
                newFiles.forEach(file => dataTransfer.items.add(file)); // 添加剩余文件

                // 替换文件输入的文件列表
                fileInput.files = dataTransfer.files;
            } else {
                var fileSize = (file.size / 1024).toFixed(2) + ' KB';
                var listItem = $('<li class="list-group-item d-flex justify-content-between align-items-center" style="background: linear-gradient(90deg, rgba(13,110,253,0.5) 0%, rgba(255,255,255,0) 0%);">' +
                    '<div>' + fileName + '</div>' +
                    '<div><small>大小: ' + fileSize + '</small> <button class="removeFile btn btn-danger btn-sm">移除</button></div>' +
                    '</li>').appendTo(fileList);

                // 开始上传文件
                //uploadFileInChunks(file, listItem);
                $('.removeFile', listItem).click(function () {
                    $(this).closest('li').remove();
                    var fileInput = $('#fileInput')[0];
                    var fileName = $(this).closest('li').find('div').first().text();
                    var newFiles = Array.from(fileInput.files).filter(file => file.name !== fileName);
                    var dataTransfer = new DataTransfer();
                    newFiles.forEach(file => dataTransfer.items.add(file)); // 添加剩余文件
                    // 替换文件输入的文件列表
                    fileInput.files = dataTransfer.files;
                    if (dataTransfer.files.length == 0)
                        uploadButton.remove();
                });
            }
        });
        // 添加按钮来启动整个文件集合的上传
        var uploadButton = $('<button class="btn btn-primary btn-sm mt-2 starUpload">开始</button>');
        fileList.after(uploadButton);

        uploadButton.click(function () {
            $(".removeFile").remove();
            uploadButton.prop('disabled', true);
            uploadPaused = false;
            uploadButton.hide();
            startUpload();
            //启动日志记录器
            intervalId = setInterval(searchKnowledgeLog, 3000);
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
                writeKnowledgeLog('文件准备就绪，开始启动线程，请稍候...——' + getCurrentDateTime());
            }
        })();
    }

    function uploadChunk(chunk, chunkNumber, fileName, totalChunks) {
        var formData = new FormData();
        formData.append('file', chunk);
        formData.append('chunkNumber', chunkNumber);
        formData.append('fileName', fileName);

        return $.ajax({
            url: '/KnowledgeAI/Upload',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false
        });
    }

    function mergeFileChunks(fileName, totalChunks) {
        $.ajax({
            url: '/KnowledgeAI/MergeFiles',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ FileName: fileName, TotalChunks: totalChunks, ProcessType: knowledgecreatemodel }),
            success: function (response) {
                console.log('文件合并成功', response);

            }
        });
    }
});
function knowledgeCreateModel(type) {
    if (type == "wash") {
        showConfirmationModal("定长切片清洗", "清洗切片非常耗时，确定要进行切片清洗吗？<br/><b style='color:red'>注意：数据清洗并不一定能提升召回率，在一些特殊情况下，如超大型文本文件中，召回率反而会降低</b>", function () {
            $("#onmodel").text("定长切片清洗");
            knowledgecreatemodel = type;
            $("#step2").show();
        });
    }
    else {
        knowledgecreatemodel = type;
        $("#onmodel").text("定长切片不清洗");
        $("#step2").show();
    }
}
function writeKnowledgeLog(str) {
    $("#log").val($("#log").val() + str + `\n`);
    $("#log").scrollTop($("#log")[0].scrollHeight); // 滚动到底部
}
var errorCount = 0;
function searchKnowledgeLog() {
    //发起请求
    $.ajax({
        type: "Post",
        url: "/KnowledgeAI/SearchSchedule",
        success: function (res) {
            if (res.success) {
                writeKnowledgeLog('信息：' + res.data + '——' + getCurrentDateTime());
                errorCount = 0
            }
            else {
                if (intervalId != null) {
                    writeKnowledgeLog('处理中，请稍候...——' + getCurrentDateTime());
                    errorCount++;
                }
            }
        }
    });
    if (errorCount > 5) {
        clearInterval(intervalId);
        intervalId = null; // 将 intervalId 设置为 null
        writeKnowledgeLog('知识库配置完成（100%）——' + getCurrentDateTime());
    }
}