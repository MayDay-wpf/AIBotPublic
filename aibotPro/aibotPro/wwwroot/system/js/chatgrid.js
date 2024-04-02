$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#product-main-menu").addClass('active');
    $("#product-main-menu").parent().toggleClass('show');
    $("#product-main-menu").parent().siblings().removeClass('show');
    $("#chatgrid-product-nav").addClass('active');
});
// websocket连接设置
var connection = new signalR.HubConnectionBuilder()
    .withUrl('/chatHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();

// 启动连接
connection.start()
    .then(function () {
        console.log('与服务器握手成功 :-)'); // 与服务器握手成功
    })
    .catch(function (error) {
        console.log('与服务器握手失败 :-( 原因: ' + error); // 与服务器握手失败
        sendExceptionMsg('与服务器握手失败 :-( 原因: ' + error);
        // 检查令牌是否过期，如果是，则跳转到登录页面
        if (isTokenExpiredError(error)) {
            window.location.href = "/Users/Login";
        }
    });

// 检查错误是否表示令牌过期的函数
// 注意：您需要根据实际的错误响应格式来调整此函数
function isTokenExpiredError(error) {
    // 这里的判断逻辑依赖于服务器返回的错误格式
    // 例如，如果服务器在令牌过期时返回特定的状态码或错误信息，您可以在这里检查
    var expiredTokenStatus = 401; // 假设401表示令牌过期
    return error.statusCode === expiredTokenStatus || error.message.includes("令牌过期");
}

// You can also handle the reconnection events if needed:
connection.onreconnecting((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Reconnecting);
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection.onreconnected((connectionId) => {
    console.assert(connection.state === signalR.HubConnectionState.Connected);
    console.log(`连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
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
        "chatid": `gridview${generateGUID()}`,
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
            //balert("您的登录令牌似乎已失效，我们将启动账号保护，请稍候，正在前往重新登录...", "danger", false, 3000, "center", function () {
            //    window.location.href = "/Users/Login";
            //});
        });
}
