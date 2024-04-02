$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#cygf-main-menu").addClass('active');
    $("#cygf-main-menu").parent().addClass('show');
    $("#cygf-main-menu").parent().siblings().removeClass('show');
    $("#openapi-cygf-nav").addClass('active');
    getApiKey();
    getSystemPlugin();
    getAIModelList();
    // 绑定 checkbox 的点击事件
    $('.custom-control-input').change(function () {
        if ($(this).is(':checked')) {
            // Checkbox 被选中时的操作
            checkboxChecked($(this).attr('id'));
        } else {
            // Checkbox 被取消选中时的操作
            checkboxUnchecked($(this).attr('id'));
        }
    });
});
function getAIModelList() {
    $.ajax({
        type: "Post",
        url: "/WorkShop/GetWorkShopAImodel",
        dataType: "json",
        success: function (res) {
            var html = "";
            if (res.success) {
                for (var i = 0; i < res.data.length; i++) {
                    html += `${res.data[i].modelName}、`;
                }
                html = html.substring(0, html.length - 1);
                $('#canUseModel').html(html);
            }
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统未配置AI模型", "info", false, 2000, "center");

        }
    });
}
function createApiKey() {
    //二次确认
    showConfirmationModal('确认创建', '注意，如果您已存在API Key 本次创建将更新您的API Key', function () {
        //发起请求
        $.ajax({
            type: 'Post',
            url: '/OpenAPI/CreateApiKey',
            success: function (res) {
                $('#apikey').val(res.data);
            }
        });
    });
}
function getApiKey() {
    loadingOverlay.show();
    $.ajax({
        type: 'Post',
        url: '/OpenAPI/GetApiKey',
        success: function (res) {
            if (res.success)
                $('#apikey').val(res.data);
        },
        error: function () {
            loadingOverlay.hide();
        }
    });
}
// 处理选中状态的函数
function checkboxChecked(id) {
    $.ajax({
        type: 'Post',
        url: '/OpenAPI/UpdateSystemPlugin',
        data: {
            Pfunctionname: id,
            type: 'add'
        },
        success: function (res) {
            if (res.success)
                balert("更新成功", "success", false, 1500, "center");
            else
                balert(res.msg, "danger", false, 1500, "center");
        }
    });
}

// 处理未选中状态的函数
function checkboxUnchecked(id) {
    $.ajax({
        type: 'Post',
        url: '/OpenAPI/UpdateSystemPlugin',
        data: {
            Pfunctionname: id,
            type: 'remove'
        },
        success: function (res) {
            if (res.success)
                balert("更新成功", "success", false, 1500, "center");
            else
                balert(res.msg, "danger", false, 1500, "center");
        }
    });
}
//获取已选用的系统插件，用于初始化checkbox
function getSystemPlugin() {
    $.ajax({
        type: 'Post',
        url: '/OpenAPI/GetSystemPlugin',
        success: function (res) {
            loadingOverlay.hide();
            var data = res.data;
            for (var i = 0; i < data.length; i++) {
                $('#' + data[i].pfunctionname).prop('checked', true);
            }
        },
        error: function () {
            loadingOverlay.hide();
        }
    });
}