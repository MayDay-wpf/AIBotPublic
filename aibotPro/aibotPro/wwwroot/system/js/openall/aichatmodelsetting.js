﻿$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#aichatmodel_aisystem_nav").addClass('active');
    getChatSetting();
});
function whatMyChatSetting() {
    var content = `<p>此处设置可自定义对话模型,如图所示位置：</p>
                   <p><img src="/system/images/chatsetting1.png" style="width:100%" /></p>`;
    showConfirmationModal("说明", content);
}
function addStLine() {
    var str = `<tr>
                 <td class="drag-handle"><i data-feather="align-justify"></i></td>
                 <td><input type="text" class="form-control" placeholder="模型昵称" /></td>
                 <td><input type="text" class="form-control" placeholder="模型名称(实际请求时使用)" /></td>
                 <td><input type="text" class="form-control" placeholder="Base URL"  /></td>
                 <td><input type="text" class="form-control" placeholder="API KEY"  /></td>
                 <td><input type="checkbox" class="form-control"></td>
                 <td><input type="text" class="form-control" placeholder="分组"  /></td>
                 <td><input type="number" class="form-control seq-input" placeholder="排序"  /></td>
                 <td><input type="number" class="form-control" placeholder="流延时(ms)"  /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
    $('#AddSt tr').each(function (index) {
        $(this).find('.seq-input').val(index + 1);
    });
}
function delLine() {
    $(event.target).closest('tr').remove();
    $('#AddSt tr').each(function (index) {
        $(this).find('.seq-input').val(index + 1);
    });
}
function saveChatSetting() {
    var formData = new FormData();
    var rows = $("#AddSt").find("tr");
    var issave = true;
    rows.each(function (index, row) {
        // 非空校验
        var nickname = $(row).find("input").eq(0).val();
        var name = $(row).find("input").eq(1).val();
        var baseUrl = $(row).find("input").eq(2).val();
        var apiKey = $(row).find("input").eq(3).val();
        var visionModel = $(row).find("input").eq(4).prop('checked');
        var group = $(row).find("input").eq(5).val();
        var seq = $(row).find("input").eq(6).val();
        var delay = $(row).find("input").eq(7).val() < 0 ? 0 : $(row).find("input").eq(7).val();
        if (!removeSpaces(nickname) || !removeSpaces(name) || !removeSpaces(baseUrl) || !removeSpaces(apiKey)) {
            balert('请将空的【自定义对话模型】输入行删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;
            return;
        } else {
            formData.append(`AImodel[${index}].ModelNick`, nickname);
            formData.append(`AImodel[${index}].ModelName`, name);
            formData.append(`AImodel[${index}].BaseURL`, baseUrl);
            formData.append(`AImodel[${index}].ApiKey`, apiKey);
            formData.append(`AImodel[${index}].VisionModel`, visionModel);
            formData.append(`AImodel[${index}].ModelGroup`, group);
            formData.append(`AImodel[${index}].Seq`, seq);
            formData.append(`AImodel[${index}].Delay`, delay);
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveAiChatSetting',
            processData: false,  // 告诉jQuery不要处理发送的数据
            contentType: false,  // 告诉jQuery不要设置contentType
            data: formData,
            success: function (res) {
                unloadingBtn('.save');
                if (res.success) {
                    balert(res.msg, 'success', false, 1500, 'top');
                } else {
                    balert(res.msg, 'danger', false, 1500, 'top');
                }
            },
            error: function (error) {
                unloadingBtn('.save');
                sendExceptionMsg(error);
                balert('保存失败，请稍后再试', 'danger', false, 1500, 'top');
            }
        });
    }
}

function getChatSetting() {
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/OpenAll/GetChatSetting',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                for (var i = 0; i < data.length; i++) {
                    var checkedAttr = data[i].visionModel ? 'checked' : '';
                    var str = `<tr>
                                <td class="drag-handle"><i data-feather="align-justify"></i></td>
                                <td><input type="text" class="form-control" placeholder="模型昵称" value="${data[i].modelNick}" /></td>
                                <td><input type="text" class="form-control" placeholder="模型名称(实际请求时使用)" value="${data[i].modelName}" /></td>
                                <td><input type="text" class="form-control" placeholder="Base URL" value="${data[i].baseUrl}" /></td>
                                <td><input type="text" class="form-control" placeholder="API KEY" value="${data[i].apiKey}" /></td>
                                <td><input type="checkbox" class="form-control" ${checkedAttr}></td>
                                <td><input type="text" class="form-control" placeholder="分组" value="${data[i].modelGroup}" /></td>
                                <td><input type="number" class="form-control seq-input" placeholder="排序" value="${data[i].seq}" /></td>
                                <td><input type="number" class="form-control" placeholder="流延时(ms)" value="${data[i].delay}" /></td>
                                <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
                    $("#AddSt").append(str);
                    feather.replace();
                    // 初始化拖动排序
                    $("#AddSt").sortable({
                        handle: '.drag-handle',
                        placeholder: 'drag-placeholder',
                        forcePlaceholderSize: true,
                        start: function (event, ui) {
                            ui.item.addClass('dragging');
                        },
                        stop: function (event, ui) {
                            ui.item.removeClass('dragging');
                        },
                        update: function (event, ui) {
                            // 更新排序文本框的值
                            $('#AddSt tr').each(function (index) {
                                $(this).find('.seq-input').val(index + 1);
                            });
                        }
                    }).disableSelection();
                }
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}