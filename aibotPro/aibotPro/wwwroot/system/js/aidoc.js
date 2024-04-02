$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#product-main-menu").addClass('active');
    $("#product-main-menu").parent().toggleClass('show');
    $("#product-main-menu").parent().siblings().removeClass('show');
    $("#aidoc-product-nav").addClass('active');
    if (isMobile()) {
        balert("请在电脑上使用本功能", "danger", false, 2000, 'center', function () {
            window.location.href = "/Home/Index"
        });
    }
});
function generateGUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return (
        s4() +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        s4() +
        s4()
    );
}
$(function () {
    function saveEdit() {
        if (editor) {
            console.log(editor.getHtml());
            //写入缓存，key常量：MayEditor
            localStorage.setItem("MayEditor", editor.getHtml());
        }
    }
    if (localStorage.getItem("MayEditor") == null)
        setInterval(saveEdit, 5000);
    else if (localStorage.getItem("MayEditor") != '<p><br></p>') {
        var data = localStorage.getItem("MayEditor");
        editor.setHtml(data);
        setInterval(saveEdit, 5000);
    }
    else
        setInterval(saveEdit, 5000);
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
var md = window.markdownit();
var sysmsg = "";
connection.start()
    .then(function () {
        console.log('Connected to SignalR hub');
    })
    .catch(function (error) {
        console.log('Error connecting to SignalR hub: ' + error);
    });
connection.on('ReceiveMessage', function (message) {
    console.log(message.message);
    if (!message.isfinish) {
        //const json = JSON.parse(response);
        if (message.message != null) {
            sysmsg += message.message;
            $("#chatbox").html(md.render(sysmsg));
            hljs.highlightAll();
        }
    }
    else {
        $("#chatbox").append("😊");
        $("#copyBtn").slideDown();
        $("#send").text("重试");
        $("#send").slideDown();
    }
});
function send(prompt, chatId) {
    var chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    var data = {
        "msg": prompt,
        "chatid": chatId,
        "aiModel": 'gpt-3.5-turbo-0125',
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": ''
    };
    connection.invoke('SendMessage', data)
        .then(function () {

        })
        .catch(function (error) {
            console.log('Error sending notification: ' + error);
        });
}