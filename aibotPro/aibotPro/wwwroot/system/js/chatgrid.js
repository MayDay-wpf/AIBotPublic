$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#product-main-menu").addClass('active');
    $("#product-main-menu").parent().toggleClass('show');
    $("#product-main-menu").parent().siblings().removeClass('show');
    $("#chatgrid-product-nav").addClass('active');
});
//websocket连接
var connection = new signalR.HubConnectionBuilder()
    .withUrl('/chatHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();
connection.start()
    .then(function () {
        console.log('与服务器握手成功 :-)');
    })
    .catch(function (error) {
        console.log('与服务器握手失败 :-( 原因: ' + error);
        sendExceptionMsg('与服务器握手失败 :-( 原因: ' + error);
    });
var sysmsg = "";
var jishuqi = 0;
var thisAiModel = 'gpt-3.5-turbo-0125';
connection.on('ReceiveMessage', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
        } else {
            if (message.message != null) {
                sysmsg += message.message;
                $("#log").text(sysmsg);
            }

        }
        jishuqi++;
    } else {
        unloadingBtn(".btnDraw");
        $("#log").text(sysmsg);
        sysmsg = "";
        jishuqi = 0;
        $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
    }
    if (message.jscode != null && message.jscode != "") {
        var result = '<div><div class="chat-message-text"><script src="/system/vega/js/vega@5.js"></script><script src="/system/vega/js/vega-lite@4.js"></script><script src="/system/vega/js/vega-embed@6.js"></script><div class="vis"></div></div></div>';
        $("#gridviewRes").html(result);
        $("#step3").show();
        eval(message.jscode);
    }
});


//发送消息
function sendMsg() {
    var msg = $("#prompt").val().trim();
    loadingBtn(".btnDraw");
    $("#step3").hide();
    $("#log").text('');
    if (msg == "") {
        balert("请输入绘制要求", "warning", false, 2000);
        unloadingBtn(".btnDraw");
        return;
    }
    var chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    assistansBoxId = msgid_g;
    var data = {
        "msg": msg,
        "chatid": 'gridview',
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": '',
        "system_prompt": "请根据要求,输出一个符合vega-lite规范的schema json文本 \n Rply:中文"
    };
    connection.invoke("SendMessage", data)
        .then(function () {
        })
        .catch(function (err) {
            processOver = true;
            sendExceptionMsg(err.toString());
            return console.error("发送消息时出现了一些未经处理的异常 :-( 原因：", err.toString());
        });
}
