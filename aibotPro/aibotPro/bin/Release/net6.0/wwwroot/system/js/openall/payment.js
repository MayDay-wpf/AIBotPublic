$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ordermanager-main-menu").addClass('active');
    $("#ordermanager-main-menu").parent().toggleClass('show');
    $("#ordermanager-main-menu").parent().siblings().removeClass('show');
    $("#payment_ordermanager_nav").addClass('active');
    getPayInfo();
});

function savePayment() {
    var shopId = $('#shopId').val();
    var apiKey = $('#apiKey').val();
    var submitUrl = $('#submitUrl').val();
    var checkPayUrl = $('#checkPayUrl').val();
    var notifyUrl = $('#notifyUrl').val();
    var returnUrl = $('#returnUrl').val();
    //所有项必填
    if (shopId == '' || apiKey == '' || submitUrl == '' || checkPayUrl == '' || notifyUrl == '' || returnUrl == '') {
        balert('所有项必填', 'danger', false, 1500, 'center');
        return;
    }
    loadingBtn('.save');
    $.ajax({
        url: '/OpenAll/SavePayment',
        type: 'Post',
        data: {
            shopId: shopId,
            apiKey: apiKey,
            submitUrl: submitUrl,
            checkPayUrl: checkPayUrl,
            notifyUrl: notifyUrl,
            returnUrl: returnUrl
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.save');
            if (response.success) {
                balert('保存成功', 'success', false, 1500, 'center');
                getPayInfo();
            } else {
                balert(response.msg, 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            balert('保存失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}

function getPayInfo() {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/OpenAll/GetPayInfo",
        type: "post",
        dataType: "json",
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var payInfo = response.data;
                $('#shopId').val(payInfo.shopId);
                $('#apiKey').val(payInfo.apiKey);
                $('#submitUrl').val(payInfo.submitUrl);
                $('#checkPayUrl').val(payInfo.checkPayUrl);
                $('#notifyUrl').val(payInfo.notifyUrl);
                $('#returnUrl').val(payInfo.returnUrl);
            }
        }
    });
}