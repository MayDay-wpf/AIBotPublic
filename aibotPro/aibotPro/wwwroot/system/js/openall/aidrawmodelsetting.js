$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#aidrawmodel_aisystem_nav").addClass('active');
    getDrawSetting();
});
function getDrawSetting() {
    // 获取绘图模型设置
    $.ajax({
        url: '/OpenAll/GetDrawSetting',
        type: 'Post',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                for (var i = 0; i < data.length; i++) {
                    if (data[i].modelName == 'Midjourney') {
                        $('#mj-baseurl').val(data[i].baseUrl);
                        $('#mj-apikey').val(data[i].apiKey);
                    }
                    if (data[i].modelName == 'DALLE3') {
                        $('#dall-baseurl').val(data[i].baseUrl);
                        $('#dall-apikey').val(data[i].apiKey);
                    }
                    if (data[i].modelName == 'SD') {
                        $('#sd-baseurl').val(data[i].baseUrl);
                        $('#sd-apikey').val(data[i].apiKey);
                    }
                    if (data[i].modelName == 'Suno') {
                        $('#suno-baseurl').val(data[i].baseUrl);
                        $('#suno-apikey').val(data[i].apiKey);
                    }
                }
            }
        }
    });
}

function saveDrawSetting(type) {
    var baseUrl = '';
    var apiKey = '';
    var channel = '';
    if (type == 'Midjourney') {
        //非空验证
        if (removeSpaces($('#mj-baseurl').val()) == "" || removeSpaces($('#mj-apikey').val()) == "") {
            balert('请填写完整', 'danger', false, 1500, 'top');
            return;
        } else {
            baseUrl = $('#mj-baseurl').val();
            apiKey = $('#mj-apikey').val();
            channel = $('#mj-channel').val();
            loadingBtn('.savemj');
        }
    } if (type == 'DALLE3') {
        //非空验证
        if (removeSpaces($('#dall-baseurl').val()) == "" || removeSpaces($('#dall-apikey').val()) == "") {
            balert('请填写完整', 'danger', false, 1500, 'top');
            return;
        } else {
            baseUrl = $('#dall-baseurl').val();
            apiKey = $('#dall-apikey').val();
            channel = $('#dall-channel').val();
            loadingBtn('.saved3');
        }
    }
    if (type == 'SD') {
        //非空验证
        if (removeSpaces($('#sd-baseurl').val()) == "" || removeSpaces($('#sd-apikey').val()) == "") {
            balert('请填写完整', 'danger', false, 1500, 'top');
            return;
        } else {
            baseUrl = $('#sd-baseurl').val();
            apiKey = $('#sd-apikey').val();
            channel = $('#sd-channel').val();
            loadingBtn('.savesd');
        }
    }
    if (type == 'Suno') {
        //非空验证
        if (removeSpaces($('#suno-baseurl').val()) == "" || removeSpaces($('#suno-apikey').val()) == "") {
            balert('请填写完整', 'danger', false, 1500, 'top');
            return;
        } else {
            baseUrl = $('#suno-baseurl').val();
            apiKey = $('#suno-apikey').val();
            channel = $('#suno-channel').val();
            loadingBtn('.savesuno');
        }
    }
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/OpenAll/SaveDrawSetting',
        data: {
            type: type,
            baseUrl: baseUrl,
            apiKey: apiKey,
            channel: channel
        },
        success: function (res) {
            unloadingBtn('.btn');
            if (res.success) {
                balert(res.msg, 'success', false, 1500, 'top');
            } else {
                balert(res.msg, 'danger', false, 1500, 'top');
            }
        }
    });

}