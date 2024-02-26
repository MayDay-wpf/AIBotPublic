$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#chatsetting-nav").addClass('active');
    $("#useHistory").prop("checked", true);
    getChatSetting();
})

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

function whatMyChatSetting() {
    var content = `<p>此处设置可自定义对话模型,如图所示位置：</p>
                   <p><img src="/system/images/chatsetting1.png" style="width:100%" /></p>`;
    showConfirmationModal("说明", content);
}

function saveChatSetting() {
    var formData = new FormData();
    var rows = $("#AddSt").find("tr");
    var issave = true;
    // 获取dall设置,全部需要非空校验
    var dallBaseUrl = removeSpaces($("#dall-baseurl").val());
    var dallApiKey = removeSpaces($("#dall-apikey").val());
    if ((!dallBaseUrl && dallApiKey) || (dallBaseUrl && !dallApiKey)) {
        balert('请填写完整【DALL-E3 API 设置】', 'danger', false, 1500, 'top');
        return;
    }
    formData.append("MyDall.BaseURL", dallBaseUrl);
    formData.append("MyDall.ApiKey", dallApiKey);

    // 获取mj设置,全部需要非空校验
    var mjBaseUrl = removeSpaces($("#mj-baseurl").val());
    var mjApiKey = removeSpaces($("#mj-apikey").val());
    if ((!mjBaseUrl && mjApiKey) || (mjBaseUrl && !mjApiKey)) {
        balert('请填写完整【Midjourney API 设置】', 'danger', false, 1500, 'top');
        return;
    }
    formData.append("MyMidjourney.BaseURL", mjBaseUrl);
    formData.append("MyMidjourney.ApiKey", mjApiKey);
    //如果使用历史记录
    var useHistory = $("#useHistory").prop("checked") ? 1 : 0;
    formData.append("SystemSetting.UseHistory", useHistory);
    //历史记录数量
    var historyCount = $("#historyCount").val();
    if (!historyCount && useHistory == 1) {
        balert('请输入【历史记录数量】', 'danger', false, 1500, 'top');
        return;
    }
    formData.append("SystemSetting.HistoryCount", historyCount);
    //是否滚动
    var scrolling = $("#scrolling").prop("checked") ? 1 : 0;
    formData.append("SystemSetting.Scrolling", scrolling);
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
            formData.append(`MyChatModel[${index}].ChatNickName`, nickname);
            formData.append(`MyChatModel[${index}].ChatModel`, name);
            formData.append(`MyChatModel[${index}].ChatBaseURL`, baseUrl);
            formData.append(`MyChatModel[${index}].ChatApiKey`, apiKey);
        }
    });
    if (issave) {
        $.ajax({
            type: 'POST',
            url: '/Home/SaveChatSetting',
            processData: false,  // 告诉jQuery不要处理发送的数据
            contentType: false,  // 告诉jQuery不要设置contentType
            data: formData,
            success: function (res) {
                if (res.success) {
                    balert(res.msg, 'success', false, 1500, 'top');
                } else {
                    balert(res.msg, 'danger', false, 1500, 'top');
                }
            }
        });
    }
}
//清空设置
function clearChatSetting() {
    showConfirmationModal('清空设置', '确定要清空所有设置并保存吗？', function () {
        //删除所有行
        $("#AddSt").empty();
        //清空dall设置
        $("#dall-baseurl").val('');
        $("#dall-apikey").val('');
        //清空mj设置
        $("#mj-baseurl").val('');
        $("#mj-apikey").val('');
        //保存
        saveChatSetting();
    });
}

//获取对话设置
function getChatSetting() {
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/Home/GetChatSetting',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                if (data.myChatModel != null && data.myChatModel.length > 0) {
                    for (var i = 0; i < data.myChatModel.length; i++) {
                        var str = `<tr>
                                        <td><input type="text" class="form-control" maxlength="50" placeholder="模型昵称" value="${data.myChatModel[i].chatNickName}" /></td>
                                        <td><input type="text" class="form-control" maxlength="50" placeholder="模型名称(实际请求时使用)" value="${data.myChatModel[i].chatModel}" /></td>
                                        <td><input type="text" class="form-control" maxlength="500" placeholder="Base URL" value="${data.myChatModel[i].chatBaseURL}" /></td>
                                        <td><input type="text" class="form-control" maxlength="500" placeholder="API KEY" value="${data.myChatModel[i].chatApiKey}" /></td>
                                        <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
                        $("#AddSt").append(str);
                        feather.replace();

                    }
                }
                if (data.myDall != null) {
                    $("#dall-baseurl").val(data.myDall.baseURL);
                    $("#dall-apikey").val(data.myDall.apiKey);
                }
                if (data.myMidjourney != null) {
                    $("#mj-baseurl").val(data.myMidjourney.baseURL);
                    $("#mj-apikey").val(data.myMidjourney.apiKey);
                }
                if (data.systemSetting != null) {
                    if (data.systemSetting.useHistory == '1')
                        $("#useHistory").prop("checked", true);
                    else
                        $("#useHistory").prop("checked", false);
                    $("#historyCount").val(data.systemSetting.historyCount);
                    if (data.systemSetting.scrolling == '1')
                        $("#scrolling").prop("checked", true);
                    else
                        $("#scrolling").prop("checked", false);
                }
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}
$(document).ready(function () {
    $('#historyCount').on('input', function () {
        var inputValue = $(this).val();

        if (!/^[1-9]\d*$/.test(inputValue)) {
            $(this).val('');
        }
        if (inputValue > 99) {
            $(this).val(99);
        }
        if (inputValue < 1) {
            $(this).val(1);
        }
    });
});

