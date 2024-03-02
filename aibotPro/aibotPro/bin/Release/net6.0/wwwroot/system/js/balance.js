$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#pay-main-menu").addClass('active');
    $("#pay-main-menu").parent().toggleClass('show');
    $("#pay-main-menu").parent().siblings().removeClass('show');
    $("#balance-pay-nav").addClass('active');
});
function setCustomAmount(amount) {
    // 将选定的金额填入自定义金额输入框
    $('#customAmount').val(amount);
}
$(document).ready(function () {
    $('#customAmount').on('input', function () {
        var inputValue = $(this).val();

        if (!/^[1-9]\d*$/.test(inputValue)) {
            $(this).val('');
        }
    });
});
function Pay(type) {
    var payMoney = $('#customAmount').val();
    // 如果自定义金额为空，则提示用户输入金额
    if (payMoney == "") {
        balert("请输入金额", "danger", false, 1500, "center");
        return;
    }
    if (payMoney <= 0) {
        balert("金额需要大于0", "danger", false, 1500, "center");
        return;
    }
    loadingOverlay.show();
    $.ajax({
        url: "/Pay/PayInfo",
        type: "post",
        dataType: "json",//返回对象
        data: {
            money: payMoney,
            type: type
        },
        success: function (res) {
            if (res.success) {
                res = res.data;
                // 创建一个隐藏的表单
                var $form = $('<form>', {
                    id: 'hiddenForm',
                    method: 'post',
                    action: res.payurl, // 你的后端处理脚本路径
                    style: 'display:none;' // 隐藏表单
                }).appendTo('body');

                // 添加固定值的表单字段
                $('<input>').attr({
                    type: 'hidden',
                    name: 'pid',
                    value: res.pid
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'type',
                    value: type
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'out_trade_no',
                    value: res.out_trade_no
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'notify_url',
                    value: res.notify_url
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'return_url',
                    value: res.return_url
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'name',
                    value: res.name
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'money',
                    value: res.money
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'param',
                    value: res.param
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    name: 'sign',
                    value: res.sign
                }).appendTo($form);

                $('<input>').attr({
                    type: 'hidden',
                    value: 'MD5'
                }).appendTo($form);
                $form.submit();
            }
            else
                balert("发起支付失败，请重试", "danger", false, 2000, "center");
        },
        error: function (e) {
            console.log("失败" + e);
        }
    });
}