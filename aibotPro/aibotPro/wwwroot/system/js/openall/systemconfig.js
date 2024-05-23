$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#system-main-menu").addClass('active');
    $("#system-main-menu").parent().toggleClass('show');
    $("#system-main-menu").parent().siblings().removeClass('show');
    $("#systemcfg_system_nav").addClass('active');
    getSystemConfig();
});
function addStLine() {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="名称" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="键" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="值" /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
}
function delLine() {
    $(event.target).closest('tr').remove();
}
function saveSystemConfig() {
    var formData = new FormData();
    var rows = $("#AddSt").find("tr");
    var issave = true;
    rows.each(function (index, row) {
        // 非空校验
        var cfgname = $(row).find("input").eq(0).val();
        var cfgcode = $(row).find("input").eq(1).val();
        var cfgkey = $(row).find("input").eq(1).val();
        var cfgvalue = $(row).find("input").eq(2).val();

        if (!removeSpaces(cfgcode) || !removeSpaces(cfgkey) || !removeSpaces(cfgvalue)) {
            balert('请将空的【自定义对话模型】输入行删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;
            return;
        } else {
            formData.append(`SystemCfg[${index}].CfgName`, cfgname);
            formData.append(`SystemCfg[${index}].CfgCode`, cfgkey);
            formData.append(`SystemCfg[${index}].CfgKey`, cfgkey);
            formData.append(`SystemCfg[${index}].CfgValue`, cfgvalue);
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveSystemConfig',
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

function getSystemConfig() {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        type: 'Post',
        url: '/OpenAll/GetSystemConfig',
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                for (var i = 0; i < data.length; i++) {
                    var str = `<tr>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="名称" value="${data[i].cfgName}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="键" value="${data[i].cfgKey}" /></td>
                                <td><input type="text" class="form-control" maxlength="500" placeholder="值" value="${data[i].cfgValue}" /></td>
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