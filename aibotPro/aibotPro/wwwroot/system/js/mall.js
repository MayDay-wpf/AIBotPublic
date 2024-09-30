$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#pay-main-menu").addClass('active');
    $("#pay-main-menu").parent().toggleClass('show');
    $("#pay-main-menu").parent().siblings().removeClass('show');
    $("#mall-pay-nav").addClass('active');
    getGoods();
});
let pageIndex = 1;
let pageSize = 999;

function getGoods() {
    //发起请求
    $.ajax({
        url: "/Pay/GetGoods",
        type: "post",
        dataType: "json",//返回对象
        data: {
            pageIndex: pageIndex,
            pageSize: pageSize,
            onShelves: true
        },
        success: function (res) {
            if (res.success) {
                if (res.data.length > 0) {
                    var data = res.data;
                    var html = "";
                    for (var i = 0; i < data.length; i++) {
                        var payTypes = data[i].goodPayType.split(','); // 将支付方式字符串分割成数组
                        var payBtns = ``;
                        var wechatPay = payTypes.includes('wxpay') ? ` <a href="#" onclick="payTo('wxpay','${data[i].goodCode}',${data[i].goodPrice})" class="btn btn-success"><img src="/system/images/wechatpay.png" class="payimg" /> 微信支付</a>` : '';
                        var alipay = payTypes.includes('alipay') ? ` <a href="#" onclick="payTo('alipay','${data[i].goodCode}',${data[i].goodPrice})" class="btn btn-primary"><img src="/system/images/alipay.png" class="payimg" /> 支付宝支付</a>` : '';
                        var balancePay = payTypes.includes('balancepay') ? ` <a href="#" onclick="payTo('balancepay','${data[i].goodCode}',${data[i].goodPrice})" class="btn btn-info"><i data-feather="dollar-sign"></i> 余额支付</a>` : '';
                        //商品已售罄
                        if (data[i].goodStock <= 0) {
                            payBtns = `<a href="#" class="btn btn-secondary disabled"><i data-feather="slash"></i> 已售罄</a>`;
                        } else {
                            payBtns = wechatPay + alipay + balancePay;
                        }
                        html += `<div class="col-md-3">
                                <div class="card">
                                    <img src="${data[i].goodImage}" class="card-img-top" alt="${data[i].goodName}">
                                        <div class="card-body">
                                            <p class="card-text goodName">${data[i].goodName}</p>
                                            <p class="card-text goodInfo">${data[i].goodInfo}</p>
                                            <h5 class="card-title price">¥ ${data[i].goodPrice}</h5>
                                            <p class="card-text"><small class="text-muted">库存：${data[i].goodStock}件</small></p>
                                            ${payBtns}
                                        </div>
                                </div> 
                                </div > `;
                    }
                    $("#goods").html(html);
                    feather.replace();
                } else
                    $("#goods").html(`<h4 style="margin:10% auto;background-color:rgb(14,179,227);color:white;padding:10px;border-radius:15px 5px 15px 5px;"> 暂无商品🫨</h4> `);
            }
        }
    })
}

function payTo(type, goodCode, money) {
    showConfirmationModal("确认订单", `确认支付【${money}】元吗？`, function () {
        loadingOverlay.show();
        if (type == 'balancepay') {
            // 余额支付
            $.ajax({
                url: "/Pay/BalancePay",
                type: "post",
                dataType: "json",//返回对象
                data: {
                    goodCode: goodCode,
                    type: type
                },
                success: function (res) {
                    loadingOverlay.hide();
                    if (res.success) {
                        localStorage.removeItem('vipStatus');
                        balert("支付成功", "success", false, 2000, "center");
                    } else
                        balert("支付失败", "danger", false, 2000, "center");
                },
                error: function (e) {
                    balert(e, "danger", false, 2000, "center", loadingOverlay.hide());
                    console.log("失败" + e);
                }
            });

        } else {
            // 微信支付或支付宝支付
            $.ajax({
                url: "/Pay/PayTo",
                type: "post",
                dataType: "json",//返回对象
                data: {
                    goodCode: goodCode,
                    type: type
                },
                success: function (res) {
                    if (res.success) {
                        localStorage.removeItem('vipStatus');
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
                    } else
                        balert("发起支付失败，请重试", "danger", false, 2000, "center", loadingOverlay.hide());
                },
                error: function (e) {
                    balert(e, "danger", false, 2000, "center", loadingOverlay.hide());
                    console.log("失败" + e);
                }
            });

        }
    });
}