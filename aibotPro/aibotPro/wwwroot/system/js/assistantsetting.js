$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#assistant-main-menu").addClass('active');
    $("#assistant-main-menu").parent().toggleClass('show');
    $("#assistant-main-menu").parent().siblings().removeClass('show');
    $("#setting-assistant-nav").addClass('active');
    getAssistantModel();
    getAssistantGPTs();
})
let fileids = [];
$(document).ready(function () {
    // 定义一个函数来检查两个复选框是否都被选中
    function checkBothSelected() {
        if ($('#codeinterpreter').is(':checked') && $('#retrieval').is(':checked')) {
            $("#filegroup-assis").show();
        } else {
            $("#filegroup-assis").hide();
        }
    }

    // 监听第一个复选框的状态变化
    $('#codeinterpreter').change(function () {
        checkBothSelected(); // 检查是否都选中
    });

    // 监听第二个复选框的状态变化
    $('#retrieval').change(function () {
        checkBothSelected(); // 检查是否都选中
    });

    // 监听文件输入的变化
    $('#fileInput').change(function () {
        // 获取选择的文件
        var files = $(this).get(0).files;
        var formData = new FormData();
        // 将文件添加到FormData对象中
        $.each(files, function (i, file) {
            formData.append('files', file);
        });

        // AJAX上传文件
        loadingOverlay.show();
        $.ajax({
            url: '/AssistantGPT/UploadAssistantFiles',
            type: 'POST',
            data: formData,
            contentType: false, // 不设置内容类型
            processData: false, // 不处理数据
            success: function (data) {
                loadingOverlay.hide();
                if (data.success) {
                    // 上传成功后，显示文件列表
                    $.each(data.data, function (i, file) {
                        var filename = decodeBase64(file.file.filename.replace(/^=\?utf-8\?B\?/, '').replace(/\?=$/, ''));
                        $('#fileList').append(
                            '<li class="list-group-item d-flex justify-content-between align-items-center">' +
                            filename +
                            '<i style="cursor:pointer" class="delete-file" data-feather="x" data-fileid="' + file.file.id + '"></i>' +
                            '</li>'
                        );
                        addFileId(file.file.id, filename);
                    });
                    feather.replace();
                }
            },
            error: function () {
                loadingOverlay.hide();
                // 错误处理
                balert("文件上传失败", "danger", false, 1500, "center");
                sendExceptionMsg("助理上传文件失败" + error);
            }
        });
    });

    // 删除文件的处理
    $('#fileList').on('click', '.delete-file', function (e) {
        var $deleteButton = $(this); // 将 $(this) 的值保存到变量中
        showConfirmationModal('删除文件', '确认删除该文件吗？', function () {
            //发起请求
            e.preventDefault();
            var fileId = $deleteButton.data('fileid'); // 使用保存的变量
            var ids = [];
            ids.push(fileId);
            loadingOverlay.show();
            $.ajax({
                type: "POST",
                url: "/AssistantGPT/DelFileByGPT",
                data: {
                    fileids: JSON.stringify(ids)
                },
                success: function (res) {
                    loadingOverlay.hide();
                    if (res.success) {
                        balert("删除成功", "success", false, 1500, "center");
                        removeFileIdByKey(fileId);
                        $deleteButton.parent().remove(); // 删除前端列表项，使用保存的变量
                    } else {
                        balert("删除失败", "danger", false, 1500, "center");
                    }
                },
                error: function (error) {
                    loadingOverlay.hide();
                    balert("删除失败", "danger", false, 1500, "center");
                    sendExceptionMsg("删除失败" + error);
                }
            });
        });
    });
});
function addFileId(key, value) {
    var fileId = {};
    fileId[key] = value;
    fileids.push(fileId);
}
function removeFileIdByKey(key) {
    // 过滤掉那些具有指定key的对象
    fileids = fileids.filter(function (fileId) {
        return !fileId.hasOwnProperty(key);
    });
}
function getAssistantGPTs() {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        type: "POST",
        url: "/AssistantGPT/GetAssistantGPTs",
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data.length > 0) {
                    $("#assisId").val(data[0].assisId);
                    $("#assisName").val(data[0].assisName);
                    $("#assisSystemPrompt").val(data[0].assisSystemPrompt);
                    $("#assisModel").val(data[0].assisModel);
                    if (data[0].codeinterpreter == 1)
                        $("#codeinterpreter").prop("checked", true);
                    else
                        $("#codeinterpreter").prop("checked", false);
                    if (data[0].retrieval == 1)
                        $("#retrieval").prop("checked", true);
                    else
                        $("#retrieval").prop("checked", false);
                    if (data[0].codeinterpreter == 1 && data[0].retrieval == 1)
                        $("#filegroup-assis").show();
                    getFileList();
                }
            } else {
                loadingOverlay.hide();
                $("#codeinterpreter").prop("checked", false);
                $("#retrieval").prop("checked", false);
            }
        },
        error: function (error) {
            loadingOverlay.hide();
        }
    });
}
function getFileList() {
    $.ajax({
        type: "POST",
        url: "/AssistantGPT/GetFileList",
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                console.log(res);
                var data = res.data;
                if (data.length > 0) {

                    for (var i = 0; i < data.length; i++) {
                        $('#fileList').append(
                            '<li class="list-group-item d-flex justify-content-between align-items-center">' +
                            data[i].fileName +
                            '<i style="cursor:pointer" class="delete-file" data-feather="x" data-fileid="' + data[i].fileId + '"></i>' +
                            '</li>'
                        );
                        addFileId(data[i].fileId, data[i].fileName);
                    };
                    feather.replace();
                }
            } else {
                $("#codeinterpreter").prop("checked", false);
                $("#retrieval").prop("checked", false);
            }
        },
        error: function (error) {
            loadingOverlay.hide();
        }
    });
}
function getAssistantModel() {
    $.ajax({
        type: "POST",
        url: "/AssistantGPT/GetAssistantModel",
        success: function (res) {
            if (res.success) {
                var data = res.data;
                var html = "";
                for (var i = 0; i < data.length; i++) {
                    html += `<option value="${data[i].modelName}">${data[i].modelNick}</option>`
                }
                $("#assisModel").html(html);
            }
        },
        error: function (error) {
        }
    });
}


function saveAssistant() {
    var assisId = $("#assisId").val();
    var assisName = $("#assisName").val();
    var assisSysPrompt = $("#assisSystemPrompt").val();
    var assisModel = $("#assisModel").val();
    var codeinterpreter = 0;
    var retrieval = 0;
    if (assisName == "" || assisSysPrompt == "" || assisModel == "") {
        balert("请填写完整所有必填项", "danger", false, 1500, "top");
        return;
    }
    if ($('#codeinterpreter').is(':checked'))
        codeinterpreter = 1;
    if ($('#retrieval').is(':checked'))
        retrieval = 1;
    loadingBtn('.save');
    $.ajax({
        type: "POST",
        url: "/AssistantGPT/SaveAssistant",
        data: {
            assisId: assisId,
            assisName, assisName,
            assisSysPrompt, assisSysPrompt,
            assisModel, assisModel,
            codeinterpreter: codeinterpreter,
            retrieval: retrieval,
            fileids: JSON.stringify(fileids)
        },
        success: function (res) {
            unloadingBtn('.save');
            if (res.success) {
                $("#assisId").val(res.data)
                balert("保存成功", "success", false, 1500, "center");
            } else
                balert("保存失败", "danger", false, 1500, "center");
        },
        error: function (error) {
            unloadingBtn('.save');
            balert("保存失败", "danger", false, 1500, "center");
            sendExceptionMsg("助理保存失败" + error);
        }
    });

}