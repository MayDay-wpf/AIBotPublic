$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#knowledge-main-menu").addClass('active');
    $("#knowledge-main-menu").parent().toggleClass('show');
    $("#knowledge-main-menu").parent().siblings().removeClass('show');
    $("#cuttest-knowledge-nav").addClass('active');
});

async function uploadChunk(file, chunk, chunks, start, chunkSize) {
    var end = Math.min(start + chunkSize, file.size);
    var chunkBlob = file.slice(start, end);
    var formData = new FormData();
    formData.append('file', chunkBlob);
    formData.append('chunkNumber', ++chunk);
    formData.append('fileName', file.name);

    await $.ajax({
        url: '/KnowledgeAI/UploadByTest',
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
        await uploadChunk(file, chunk, chunks, end, chunkSize);
    } else {
        // 在所有切片上传完成后触发
        $.ajax({
            url: '/KnowledgeAI/MergeFilesByTest',
            type: 'POST',
            data: JSON.stringify({ fileName: file.name, totalChunks: chunks }),
            contentType: 'application/json',
            success: function (response) {
                $('#p1').text('上传完成');
                $("#reviewTxt").val('');
                $("#reviewTxtBox").show();
                $("#reviewCutResult").hide();
                $("#reviewTxt").val(response.data);
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
        if (file.size > 30 * 1024 * 1024) {
            balert('文件大小不能超过30兆', 'danger', true, 2000, "center");
            return;
        }
        var allowedExtensions = ['txt', 'pdf', 'ppt', 'doc', 'docx', 'xls', 'xlsx'];
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

        uploadChunk(file, chunk, chunks, 0, chunkSize);
    });

    // 触发 file input 元素点击事件
    fileInput.click();
}
function clearTextarea() {
    $("#Regular").val('');
    $("#reviewTxt").val('');
    $("#reviewTxtBox").show();
    $("#reviewCutResult").hide();
}
function textRegular() {
    loadingBtn(".test");
    var text = $("#reviewTxt").val();
    var regular = $("#Regular").val();
    if (text == "") {
        balert('没有待处理的文本', 'warning', true, 2000, "center");
        unloadingBtn(".test");
        return;
    }
    if (regular == "") {
        balert('请输入正则表达式', 'warning', true, 2000, "center");
        unloadingBtn(".test");
        return;
    }
    $.ajax({
        url: '/KnowledgeAI/CutFile',
        type: 'POST',
        datatype: 'json',
        data: {
            text: text,
            regular: regular
        },
        success: function (response) {
            unloadingBtn(".test");
            var data = response.data;
            var html = ``;
            for (var i = 0; i < data.length; i++) {
                html += `<div class="form-control" readonly="readonly" style="padding:10px;">${data[i]}</div><p></p>`
            }
            $("#reviewCutResult").html(html);
            $("#reviewTxtBox").hide();
            $("#reviewCutResult").show();
        },
        error: function (e) {
            unloadingBtn(".test");
        }
    });
}