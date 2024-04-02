$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#assistantmodel_aisystem_nav").addClass('active');
    getChatSetting();
});

function addStLine() {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="模型昵称" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="模型名称(实际请求时使用)" /></td>
                 <td><input type="text" class="form-control" maxlength="500" placeholder="Base URL"  /></td>
                 <td><input type="text" class="form-control" maxlength="500" placeholder="API KEY"  /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
}
function delLine() {
    $(event.target).closest('tr').remove();
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

        if (!removeSpaces(nickname) || !removeSpaces(name) || !removeSpaces(baseUrl) || !removeSpaces(apiKey)) {
            balert('请将空的【自定义对话模型】输入行删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;
            return;
        } else {
            formData.append(`assistantModelPrices[${index}].ModelNick`, nickname);
            formData.append(`assistantModelPrices[${index}].ModelName`, name);
            formData.append(`assistantModelPrices[${index}].BaseUrl`, baseUrl);
            formData.append(`assistantModelPrices[${index}].ApiKey`, apiKey);
            //formData.append(`AssistantModelPrice[${index}].InputPrice`, 0);
            //formData.append(`AssistantModelPrice[${index}].OutputPrice`, 0);
            //formData.append(`AssistantModelPrice[${index}].VipInputPrice`, 0);
            //formData.append(`AssistantModelPrice[${index}].VipOutputPrice`, 0);
            //formData.append(`AssistantModelPrice[${index}].Rebate`, 0);
            //formData.append(`AssistantModelPrice[${index}].VipRebate`, 0);
            //formData.append(`AssistantModelPrice[${index}].ConstantPrice`, 0);
            //formData.append(`AssistantModelPrice[${index}].VipConstant`, 0);
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveAssistantSetting',
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
        url: '/OpenAll/GetAssistantSetting',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                for (var i = 0; i < data.length; i++) {
                    var str = `<tr>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="模型昵称" value="${data[i].modelNick}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="模型名称(实际请求时使用)" value="${data[i].modelName}" /></td>
                                <td><input type="text" class="form-control" maxlength="500" placeholder="Base URL" value="${data[i].baseUrl}" /></td>
                                <td><input type="text" class="form-control" maxlength="500" placeholder="API KEY" value="${data[i].apiKey}" /></td>
                                <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
                    $("#AddSt").append(str);
                    feather.replace();

                }
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}