$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#pay-main-menu").addClass('active');
    $("#pay-main-menu").parent().toggleClass('show');
    $("#pay-main-menu").parent().siblings().removeClass('show');
    $("#vip-pay-nav").addClass('active');
});

function Pay(payMoney, type, param) {
    showConfirmationModal("确认订单", `确认支付【${payMoney}】元吗？`, function () {
        if (payMoney != 15 && payMoney != 90) {
            balert("非法金额", "danger", false, 2000, "center");
            return;
        }
        loadingOverlay.show();
        $.ajax({
            url: "/Pay/PayInfo",
            type: "post",
            dataType: "json",//返回对象
            data: {
                money: payMoney,
                type: type,
                param: param
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
    });
}

function BalncePayVIP(mcoin) {
    //二次确认
    showConfirmationModal("确认支付", "确认使用余额支付吗？", function () {
        // 余额支付
        loadingOverlay.show();
        $.ajax({
            url: "/Pay/BalancePayVIP",
            type: "post",
            dataType: "json",//返回对象
            data: {
                mcoin: mcoin
            },
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    balert("支付成功", "success", false, 2000, "center");
                }
                else
                    balert(res.msg, "danger", false, 2000, "center");
            },
            error: function (e) {
                loadingOverlay.hide();
                console.log("失败" + e);
                sendExceptionMsg(e);
            }
        });
    });
}