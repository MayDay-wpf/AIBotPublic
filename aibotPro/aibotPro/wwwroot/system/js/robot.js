
$(function () {
    if (isMobile()) {
        $('.robot-container').hide();
        $('.robotSM').hide();
    } else {
        getBotSetting();
        getNotice();
    }
})
function getBotSetting() {
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/Home/GetChatSetting',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                if (data.systemSetting != null) {
                    if (data.systemSetting.goodHistory == '1') {
                        $('.robot-container').show();
                        var robotSMtimespan = localStorage.getItem('robotSMtimespan');
                        if (robotSMtimespan != null) {
                            if (getCurrentTimestamp() - robotSMtimespan > 86400000) {
                                localStorage.removeItem('robotSMtimespan');
                                localStorage.removeItem('robotSM');
                            } else {
                                $('.robotSM').show();
                                $('.robot-container').hide();
                            }
                        }
                    }
                    else
                        $('.robot-container').hide();
                }
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}
const robotContainer = document.querySelector('.robot-container');
const speechBubble = document.querySelector('.speech-bubble');
const chatWindow = document.querySelector('.bot-chat-window');
const chatHeader = document.querySelector('.bot-chat-header');
const closeBtn = document.querySelector('.bot-close-btn');
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

const initialXPositionPercentage = 55;
const initialYPositionPercentage = 5;

window.addEventListener('load', function () {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    var storedTimestamp = localStorage.getItem('timestamp');
    if (storedTimestamp != null && getCurrentTimestamp() - storedTimestamp > 86400000) {
        localStorage.removeItem('xPosition');
        localStorage.removeItem('yPosition');
        localStorage.removeItem('timestamp');
    }
    var xPositionLog = localStorage.getItem('xPosition');
    var yPositionLog = localStorage.getItem('yPosition');
    const initialXPosition = xPositionLog != null ? xPositionLog : (screenWidth * initialXPositionPercentage) / 100;
    const initialYPosition = yPositionLog != null ? yPositionLog : (screenHeight * initialYPositionPercentage) / 100;
    currentX = initialXPosition;
    currentY = initialYPosition;
    setTranslate(initialXPosition, initialYPosition, robotContainer);
    xOffset = initialXPosition;
    yOffset = initialYPosition;
});

robotContainer.addEventListener('mousedown', dragStart);
document.addEventListener('mouseup', dragEnd);
document.addEventListener('mousemove', drag);

chatHeader.addEventListener('mousedown', dragChatStart);
document.addEventListener('mouseup', dragChatEnd);
document.addEventListener('mousemove', dragChat);

function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === robotContainer) {
        isDragging = true;
        //speechBubble.style.display = 'block';
        speechBubble.innerHTML = '起飞咯,准备带我去哪？🛩️🛫🚀';
    }
}

function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    localStorage.setItem('xPosition', currentX);
    localStorage.setItem('yPosition', currentY);
    localStorage.setItem('timestamp', getCurrentTimestamp());
    isDragging = false;
    //speechBubble.style.display = 'none';
    speechBubble.innerHTML = '我是AIBot,右键最小化😘<br />双击我，可以跟我交流😉<br />在设置中可以关闭我🥺';
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, robotContainer);
    }
}

function dragChatStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;

    if (e.target === chatHeader) {
        isDragging = true;
    }
}

function dragChatEnd(e) {
    initialX = currentX;
    initialY = currentY;

    isDragging = false;
}

function dragChat(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, chatWindow);
    }
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

robotContainer.addEventListener('dblclick', function () {
    chatid_bot = "";
    $(".bot-chat-body").html(`<div class="bot-message">Hi~有什么我可以帮助你的？关于AIBot的问题，你可以随时问我😉</div>`);
    robotContainer.style.display = 'none';
    chatWindow.style.display = 'block';
    setTranslate(xOffset, yOffset, chatWindow);
});
robotContainer.addEventListener('contextmenu', function (event) {
    event.preventDefault();  // 阻止默认的右键菜单
    robotContainer.style.display = 'none';
    localStorage.setItem('xPosition', currentX);
    localStorage.setItem('yPosition', currentY);
    $('.robotSM').show();
    localStorage.setItem('robotSM', true);
    localStorage.setItem('robotSMtimespan', getCurrentTimestamp());
});

closeBtn.addEventListener('click', function () {
    chatWindow.style.display = 'none';
    robotContainer.style.display = 'block';
});

function showRobot() {
    robotContainer.style.display = 'block';
    chatWindow.style.display = 'none';
    $('.robotSM').hide();
    localStorage.removeItem('robotSM');
    localStorage.removeItem('robotSMtimespan');
}
let noticemsg = ""
function getNotice() {
    //发起请求
    $.ajax({
        url: "/Home/GetNotice",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                if (res.data != "") {
                    $("#notice-box").html(res.data);
                    $(".speech-bubble-left").html(res.data);
                    noticemsg = res.data;
                    var pathname = window.location.pathname;
                    pathname = pathname.toLowerCase();
                    if (pathname == "/openall/systemnotice") {
                        $("#content").val(noticemsg);
                    }
                }
                else {
                    noticemsg = "暂无公告";
                    $(".speech-bubble-left").hide();
                }
            }
        }
    });
}

var thisAiModel_bot = "gpt-3.5-turbo-0125-CYGF"; //当前AI模型
var processOver_bot = true; //是否处理完毕
var chatid_bot = "";
var assistansBoxId_bot = "";

// websocket连接设置
var connection_bot = new signalR.HubConnectionBuilder()
    .withUrl('/chatHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();

// 启动连接
connection_bot.start()
    .then(function () {
        console.log('Bot与服务器握手成功 :-)'); // 与服务器握手成功
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
connection_bot.onreconnecting((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Reconnecting);
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection_bot.onreconnected((connectionId) => {
    console.assert(connection.state === signalR.HubConnectionState.Connected);
    console.log(`连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
});

connection_bot.onclose((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Disconnected);
    console.log(`由于错误"${error}"连接已关闭。尝试重新启动连接。`);
    // 这里您可以尝试再次启动连接，或者通知用户连接已丢失。
    connection_bot.start();
});
$(document).keypress(function (e) {
    if ($("#botQ").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            sendMsg_bot();
        }
    }
});
//接收消息
var md_bot = window.markdownit();
var sysmsg_bot = "";
var jishuqi_bot = 0;
connection_bot.on('ReceiveWorkShopMessage_bot', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi_bot == 0) {
            chatid_bot = message.chatid;
        } else {
            if (message.message != null) {
                sysmsg_bot += message.message;
                $("#" + assistansBoxId_bot).html(md_bot.render(sysmsg_bot));
                $("#" + assistansBoxId_bot + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                $(".bot-chat-body").scrollTop($(".bot-chat-body")[0].scrollHeight);
            }

        }
        jishuqi_bot++;
    } else {
        processOver_bot = true;
        $("#" + assistansBoxId_bot).html(marked(sysmsg_bot));
        $("#" + assistansBoxId_bot + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        sysmsg_bot = "";
        jishuqi_bot = 0;
        $('.LDI').remove();
        $(".bot-chat-body").scrollTop($(".bot-chat-body")[0].scrollHeight);
    }
    if (message.jscode != null && message.jscode != "") {
        eval(message.jscode);
    }
});
function sendMsg_bot() {
    var msg = $("#botQ").val().trim();
    if (msg == "") {
        balert("请输入问题", "warning", false, 2000);
        return;
    }
    if (!processOver_bot) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    processOver_bot = false;
    var chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    assistansBoxId_bot = msgid_g;
    var data = {
        "msg": msg,
        "chatid": chatid_bot,
        "aiModel": thisAiModel_bot,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": "",
        "isbot": true,
        "system_prompt": `# 今天的公告是：${noticemsg}

                          # 硬性要求如下：
                          * 你只回答AIBot相关问题,或者与用户进行友善的闲聊,适当加入Emoji以营造轻松的氛围。
                          * 请你不要回答任何专业问题，例如：法律、医学、金融、编程、文学写作、化学、数学、物理、外语、艺术、绘画等。
                          * 你是【AIBot用户引导助手】,你只能在电脑端显示，因为你是一个悬浮窗，手机屏幕太小了。
                          * AIBot是一个人工智能对话系统，拥有ChatGPT,Claude,文心千帆,通义千问等海量模型。
                          # 以下知识,在你回答用户问题时可能会用到,请在适当的时候选用：
                          * AIBot拥有海量的AI对话模型，供用户使用，并且可以无感切换。
                          * 当需要AIBot提供服务时，用户需支付一定的费用，在页面的右下角【计费说明】中有详细描述。
                          * AIBot也提供免费模型，在模型切换时，拥有【🆓】这个emoji标签的代表免费使用，但是需注意，用户余额需要大于0才可以免费使用。
                          * AIBot有两项会员服务价格分别是【15元】和【90元】，两个会员拥有同样的会员权益，即会员折扣价和会员专属免费模型，在切换模型时，拥有【✨】这个emoji标签的代表是会员会员专属免费模型，15元会员和90元会员都可以免费使用。
                          * AIBot的创意工坊有免费模型，按照频率刷新次数，拥有【🕔】这个emoji标签的代表按频率刷新免费使用次数。
                          * 【15元会员详情】：1、享有免费模型 GPT-3.5等系列（详见模型列表：【VIP免费】模型）2、专项会员折扣3、专属会员功能4、客服优先处理5、无签到奖励6、无余额奖励。
                          * 【90元会员详情】：1、享有免费模型 GPT-3.5等系列（详见模型列表：【VIP免费】模型）2、专项会员折扣3、专属会员功能4、客服优先处理5、每日签到，随机抽取0.5~1余额6、获得90余额+10赠送余额=100余额。
                          * 15元和90元会员最大的区别在于90元会员可以获得100余额，且每天可以签到，随机抽取0.5~1余额，而15元会员没有这两项权限，其他都是一致的，包括折扣也是一致的。
                          * 会员充值链接：https://aibotpro.cn/Pay/VIP
                          * AIBot也可以单独充值余额，最低1元起充，充值链接：https://aibotpro.cn/Pay/Balance
                          * AIBot除了海量模型外，还有许多自研功能，例如：自定义插件(创意工坊)、自定义角色、文件助手、知识库创建、OpenAPI、AI中文图表绘制、营销号助手、无边记等，这些特色功能，请在左侧菜单中查看使用。
                          * AIBot的【图库】在左侧菜单的【个人中心】。
                          * 【个人中心】有清晰的使用数据统计，也可以在个人中心修改自己的头像。
                          * 关于【分享共盈】，入口也位于【个人中心】菜单。
                          *【分享合盈】当您使用分享链接邀请新用户注册时，将会获得奖励。
                            1、注册奖励，分享者获得0.3元，新用户获得3Mcoin，普通注册非邀请的新用户，仅可获得0.3Mcoin，非常利于分享者和新用户。
                            2、充值奖励示例，依次类推，用户充值110元，上级分享者获得15元，邀请人永久获利分享注册用户充值的15%（如未获得10奖励，请联系站长：QQ群主）。
                            注意：金额满10元即可提现，无法部分提现，仅可全部提现，我们对于恶意刷邀请行为，会给予能力范围内最严重的惩罚！！！
                          * AIBot的QQ群号是：833716234，入群链接是：https://qm.qq.com/q/l9I1bN2MaQ
                          * 关于文件处理或文件上传，AIBot在左侧菜单中有文件助手，AIBot所有模型都支持文件上传，但是请注意，文件的字数如果很大，建议使用知识库，或者gpt4-128k这样的大容量模型。
                          * 助理GPT，是调用OpenAI的Assistants 拥有很强的文件阅读能力，但是这个模型费用较高，消耗较大，不适合日常使用，只适合某些需要处理超大型文件的特定场景，助理GPT对话记录不会保存，所以需要谨慎刷新。
                          * AIBot 支持绘画，拥有的AI绘画模型有：DALL-E3、Midjourney、DALL-E2 等后续会持续加入更多绘画模型。
                          * 如果需要彻底或者永久关闭【AIBot用户引导助手】可以在左侧菜单中的【设置】，【系统偏好设置】中取消勾选【启用AIBot引导助手】，并保存设置即可。
                          * 引导助手悬浮窗可以【右键最小化】。
                          * AIBot 系统是开源的，开源地址为：https://github.com/MayDay-wpf/AIBotPublic`
    };
    $("#botQ").val("");
    $("#botQ").focus();
    var html = `<div class="user-message" id="` + msgid_u + `"></div>`;
    $(".bot-chat-body").append(html);
    $("#" + msgid_u).text(msg);
    var gpthtml = `<div class="bot-message">
                        <div id="`+ msgid_g + `"></div><svg width="30" height="30" class="LDI"><circle cx="15" cy="15" r="7.5" fill="black" class="blinking-dot" /></svg>
                   </div>`;
    $(".bot-chat-body").append(gpthtml);
    $(".bot-chat-body").scrollTop($(".bot-chat-body")[0].scrollHeight);
    connection_bot.invoke("SendWorkShopMessage", data, false, [])
        .then(function () {
        })
        .catch(function (err) {
            processOver = true;
        });
}




