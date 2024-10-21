$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#mall-main-menu").addClass('active');
    $("#mall-main-menu").parent().toggleClass('show');
    $("#mall-main-menu").parent().siblings().removeClass('show');
    $("#grounding_mall_nav").addClass('active');
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
    goodCode = getUrlParam('goodCode');
    if (goodCode) {
        getGood(goodCode);
    }
});
let goodCode = '';
let goodImage = '';
let payType = [];
let isUpdate = false;
function getGood(goodCode) {
    $.ajax({
        url: "/OpenAll/GetGood",
        type: "post",
        dataType: "json",//返回对象
        data: {
            goodCode: goodCode
        },
        success: function (res) {
            if (res.success) {
                $('#goodImg').attr('src', res.data.goodImage);
                goodImage = res.data.goodImage;
                $('#goodname').val(res.data.goodName);
                $('#goodinfo').val(res.data.goodInfo);
                $('#goodprice').val(res.data.goodPrice);
                $('#goodstock').val(res.data.goodStock);
                payType = res.data.goodPayType.split(',');
                $.each(payType, function (index, value) {
                    $('#' + value).prop('checked', true);
                });
                $('#viptype').val(res.data.vipType);
                $('#vipdays').val(res.data.vipDays);
                $('#balance').val(res.data.balance);
                isUpdate = true;
            } else
                balert("修改失败", "danger", false, 1000, "center");
        },
        error: function (e) {

        }
    })
}

// 处理选中状态的函数
function checkboxChecked(id) {
    payType.push(id);
}

// 处理未选中状态的函数
function checkboxUnchecked(id) {
    payType = payType.filter(item => item !== id);
}

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
            $('#goodImg').attr('src', e.target.result);
        }
        reader.readAsDataURL(input.files[0]);
        //上传图片
        var formData = new FormData();
        formData.append('file', input.files[0]);
        loadingOverlay.show();
        $.ajax({
            url: '/OpenAll/UploadGoodImage',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    goodImage = res.filePath.replace('wwwroot', '');
                }
                else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
}

function releaseGood() {
    var goodname = $('#goodname').val();
    var goodinfo = $('#goodinfo').val();
    var goodprice = $('#goodprice').val();
    var goodstock = $('#goodstock').val();
    var viptype = $('#viptype').val();
    var vipdays = $('#vipdays').val();
    var balance = $('#balance').val();
    //非空验证
    if (!goodname) {
        balert('商品名称不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (!goodinfo) {
        balert('商品信息不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (!goodprice) {
        balert('商品价格不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (!goodstock) {
        balert('商品库存不能为空', 'warning', false, 1500, 'center');
        return;
    }
    loadingBtn(".releaseGood");
    var formData = new FormData();
    formData.append("goodcode", goodCode);
    formData.append("goodname", goodname);
    formData.append("goodinfo", goodinfo);
    formData.append("goodprice", goodprice);
    formData.append("goodstock", goodstock);
    formData.append("viptype", viptype);
    formData.append("vipdays", vipdays);
    formData.append("balance", balance);
    formData.append("goodimage", goodImage);
    formData.append("isUpdate", isUpdate);
    payType.forEach(function (type) {
        formData.append("paytype", type);
    });

    $.ajax({
        url: '/OpenAll/ReleaseGood',
        type: 'post',
        data: formData,
        processData: false,  // 告诉 jQuery 不要处理发送的数据
        contentType: false,  // 告诉 jQuery 不要设置内容类型
        success: function (res) {
            unloadingBtn(".releaseGood");
            if (res.success) {
                balert('发布成功', 'success', false, 1500, 'center');
            }
            else {
                balert('发布失败', 'danger', false, 1500, 'center');
            }
        },
        error: function (e) {
            unloadingBtn(".releaseGood");
            sendExceptionMsg("good release error");
        }
    });
}