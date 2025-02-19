$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#uisetting-nav").addClass('active');
    getUISetting();
})

function getUISetting() {
    loadingOverlay.show();
    $.ajax({
        url: '/Home/GetUISetting',
        type: 'Post',
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                // if (res.data.systemName != null) {
                //     $('#systemName').val(res.data.systemName);
                //     $('.sidebar-logo span').text(res.data.systemName);
                // } else {
                //     $('#systemName').val('Mufasa');
                //     $('.sidebar-logo span').text('Mufasa');
                // }
                if (res.data.menuTransparency != null) {
                    $('#menuTransparency').val(res.data.menuTransparency);
                    $('#menuTransparencyValue').text(res.data.menuTransparency);
                    $('.sidebar').css('opacity', res.data.menuTransparency);
                } else {
                    $('#menuTransparency').val(1);
                    $('#menuTransparencyValue').text(1);
                    $('.sidebar').css('opacity', '1');
                }
                if (res.data.contentTransparency != null) {
                    $('#contentTransparency').val(res.data.contentTransparency);
                    $('#contentTransparencyValue').text(res.data.contentTransparency);
                    $('.content').css('opacity', res.data.contentTransparency);
                } else {
                    $('#contentTransparency').val(1);
                    $('#contentTransparencyValue').text(1);
                    $('.content').css('opacity', '1');
                }
                if (res.data.colorPicker != null) {
                    $('#colorPicker').val(res.data.colorPicker);
                    $('#selectedColor').text(res.data.colorPicker);
                    fontColor = res.data.colorPicker;
                } else {
                    $('#colorPicker').val('#000000');
                    $('#selectedColor').text('#000000');
                }
                if (res.data.shadowSize != null) {
                    $('#shadowSize').val(res.data.shadowSize);
                    $('#shadowValue').text(res.data.shadowSize);
                    if (res.data.shadowSize > 0)
                        $('body').css('text-shadow', `0 0 ${res.data.shadowSize}px ${fontColor}`);
                    else
                        $('body').css('text-shadow', 'none');
                } else {
                    $('#shadowSize').val(0);
                    $('#shadowValue').text(0);
                    $('body').css('text-shadow', 'none');
                }
                if (res.data.backgroundImg != null) {
                    $('body').css('background-image', `url(${res.data.backgroundImg})`);
                    $('#backImg').attr('src', res.data.backgroundImg);
                    backgroundImg = res.data.backgroundImg;
                } else {
                    $('body').css('background', `none`);
                    $('#backImg').attr('src', '/system/images/addflow.png');
                    backgroundImg = '';
                }
            } else {
                //balert(res.msg, 'danger', false, 1500, 'center');
            }
        }, errr: function () {
            loadingOverlay.hide();
        }
    });
}

$(document).ready(function () {
    $('#systemName').on('input', function () {
        $('.sidebar-logo span').text($(this).val());
    });
    $('#menuTransparency').on('input', function () {
        $('#menuTransparencyValue').text($(this).val());
        $('.sidebar').css('opacity', $(this).val());
    });
    $('#contentTransparency').on('input', function () {
        $('#contentTransparencyValue').text($(this).val());
        $('.content').css('opacity', $(this).val());
    });
    $('#colorPicker').on('input', function () {
        $('#selectedColor').text($(this).val());
    });
    $('#shadowSize').on('input', function () {
        $('#shadowValue').text($(this).val());
        if ($(this).val() > 0)
            $('body').css('text-shadow', `0 0 ${$('#shadowSize').val()}px ${$('#colorPicker').val()}`);
        else
            $('body').css('text-shadow', 'none');
    });
});

function loadImage(event) {
    var input = event.target;
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        //只允许上传图片
        if (!/image\/\w+/.test(input.files[0].type)) {
            balert('请确保文件为图像类型', 'warning', false, 1500, 'center');
            return;
        }
        //图片大小不大于10M
        if (input.files[0].size > 10 * 1024 * 1024) {
            balert('图片大小不得超过10M', 'warning', false, 1500, 'center');
            return;
        }
        reader.onload = function (e) {
            $('body').css('background-image', `url(${e.target.result})`);
            $('#backImg').attr('src', e.target.result);
            $('body').css('background-position', 'center center');
            $('body').css('background-repeat', 'no-repeat');
            $('body').css('background-attachment', 'fixed');
            $('body').css('background-size', 'cover');
        }
        reader.readAsDataURL(input.files[0]);
        //上传图片
        var formData = new FormData();
        formData.append('file', input.files[0]);
        loadingOverlay.show();
        $.ajax({
            url: '/Home/UploadBackground',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    backgroundImg = res.filePath.replace('wwwroot', '');
                } else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
}

function saveUISetting(type) {
    //var systemName = $('#systemName').val();
    var menuTransparency = $('#menuTransparency').val();
    var contentTransparency = $('#contentTransparency').val();
    var colorPicker = $('#colorPicker').val();
    var shadowSize = $('#shadowSize').val();
    var formData = new FormData();
    formData.append('SystemName', 'Mufasa');
    formData.append('MenuTransparency', menuTransparency);
    formData.append('ContentTransparency', contentTransparency);
    formData.append('ColorPicker', colorPicker);
    formData.append('ShadowSize', shadowSize);
    formData.append('BackgroundImg', backgroundImg);
    if (type == "default")
        loadingBtn('.defaultsetting');
    else
        loadingBtn('.savesetting');
    $.ajax({
        url: '/Home/SaveUISetting',
        type: 'post',
        processData: false,  // 告诉jQuery不要处理发送的数据
        contentType: false,  // 告诉jQuery不要设置contentType
        data: formData,
        success: function (res) {
            if (type == "default")
                unloadingBtn('.defaultsetting');
            else
                unloadingBtn('.savesetting');
            if (res.success) {
                balert('保存成功', 'success', false, 1500, 'center');
            } else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

function defaultUISetting() {
    // $('#systemName').val('Mufasa');
    $('.sidebar-logo span').text('Mufasa');
    $('#menuTransparency').val(1);
    $('#menuTransparencyValue').text(1);
    $('.sidebar').css('opacity', '1');
    $('#contentTransparency').val(1);
    $('#contentTransparencyValue').text(1);
    $('.content').css('opacity', '1');
    $('#colorPicker').val('#000000');
    $('#selectedColor').text('#000000');
    $('#shadowSize').val(0);
    $('#shadowValue').text(0);
    $('body').css('text-shadow', 'none');
    $('body').css('background', `none`);
    $('#backImg').attr('src', '/system/images/addflow.png');
    backgroundImg = '';
    saveUISetting('default');
}