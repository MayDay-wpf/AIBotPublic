let thisAiModel = 'gpt-4o-mini';
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#sd-nav").addClass('active');
    $('#fixSeedCheckbox').prop('checked', false);
});
$(document).ready(function () {
    bindEnglishPromptTranslation("#inputText");
    bindOptimizePrompt("#inputText");

    // 更新字符计数的函数
    function updateCharCount() {
        var charCount = $('#inputText').val().length;
        $('#charCount').text(charCount);
    }

    // keyup 事件监听
    $('#inputText').keyup(function () {
        updateCharCount();
    });

    // keydown 事件监听，用于限制字符数量
    $('#inputText').keydown(function (e) {
        var maxChars = 3000;
        if ($(this).val().length === maxChars && e.keyCode !== 8) {
            e.preventDefault();
        }
    });

    // 当你通过代码设置输入值时也应该调用这个函数
    // 例如: $('#inputText').val('新内容').trigger('input');
    // 初始化 numberImages 滑块
    $('#numberImages').val(1);
    $('#numberImagesValue').text(1);

    // 初始化 inferenceSteps 滑块
    $('#inferenceSteps').val(25);
    $('#inferenceStepsValue').text(25);

    // 初始化 guidanceScale 滑块
    $('#guidanceScale').val(4.5);
    $('#guidanceScaleValue').text(4.5);

    $('#inputText').on('input', function () {
        updateCharCount();
    });

    $('#numberImages').on('input', function () {
        $('#numberImagesValue').text($(this).val());
    });

    $('#inferenceSteps').on('input', function () {
        $('#inferenceStepsValue').text($(this).val());
    });

    $('#guidanceScale').on('input', function () {
        $('#guidanceScaleValue').text(parseFloat($(this).val()).toFixed(1));
    });

    // 随机种子函数
    function getRandomSeed() {
        return Math.floor(Math.random() * 10000000000);
    }

    var randomSeed = getRandomSeed();
    $('#seedInput').val(randomSeed);
    // 为随机按钮添加点击事件
    $('#randomSeedBtn').click(function () {
        var randomSeed = getRandomSeed();
        $('#seedInput').val(randomSeed);
    });

    // 确保输入的种子值在有效范围内
    $('#seedInput').on('change', function () {
        var value = parseInt($(this).val());
        if (isNaN(value) || value < 0) {
            $(this).val(0);
        } else if (value > 9999999999) {
            $(this).val(9999999999);
        }
    });
    $('#createTaskBtn').click(function () {
        var prompt = $('#inputText').val().trim();
        if (prompt != "") {
            // 获取所有参数
            var model = $('#modelSelect').val();
            var imageSize = $('input[name="imageSize"]:checked').val();
            var numberImages = $('#numberImages').val();
            var seed = $('#seedInput').val();
            var inferenceSteps = $('#inferenceSteps').val();
            var guidanceScale = $('#guidanceScale').val();
            var negativePrompt = $('#negativePrompt').val().trim();

            //禁用按钮
            $("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
            //发起请求
            $("#resview").show();
            $("#resBox").empty();
            $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
            balert('发送任务创建请求成功', 'success', false, 1000, "center");
            $("#nt").text('绘图中，请勿刷新页面...');
            $.ajax({
                type: "POST", url: "/AIdraw/CreateSDTask", data: {
                    prompt: prompt,
                    model: model,
                    imageSize: imageSize,
                    numberImages: numberImages,
                    seed: seed,
                    inferenceSteps: inferenceSteps,
                    guidanceScale: guidanceScale,
                    negativePrompt: negativePrompt
                }, success: function (data) {
                    if (!$('#fixSeedCheckbox').is(':checked')) {
                        $('#seedInput').val(getRandomSeed());
                    }
                    if (data.success) {
                        //显示图片
                        $("#nt").text('绘制完成,点击图片查看大图');
                        // 创建两列布局
                        $("#resBox").empty(); // 清空之前的结果

                        // 创建一个容器来容纳所有图片
                        var container = $('<div class="d-flex justify-content-center w-100"></div>');
                        $("#resBox").append(container);

                        // 创建一个内部容器，最大宽度为两张图片的宽度
                        var innerContainer = $('<div style="max-width: 1024px;"></div>');
                        container.append(innerContainer);

                        var row;
                        for (var i = 0; i < data.imgurls.length; i++) {
                            if (i % 2 === 0) {
                                // 每两张图片创建一个新行
                                row = $('<div class="row no-gutters mb-3"></div>');
                                innerContainer.append(row);
                            }

                            var colClass = (data.imgurls.length === 1) ? 'col-12' : 'col-6';
                            var col = $('<div class="' + colClass + '"></div>');
                            var img = $('<img class="img-fluid w-100" src="' + data.imgurls[i] + '">');
                            var link = $('<a class="image-popup" href="' + data.imgurls[i] + '"></a>').append(img);
                            col.append(link);
                            row.append(col);
                        }

                        // 如果只有一张图片，确保它居中
                        if (data.imgurls.length === 1) {
                            row.addClass('justify-content-center');
                        }

                        //恢复按钮
                        $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        //跳转到任务列表
                        $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
                        $('.image-popup').magnificPopup({
                            type: 'image', gallery: {
                                enabled: true
                            }
                        });
                    } else {
                        //恢复按钮
                        $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        $("#resview").hide();
                        balert(data.msg, 'danger', false, 1000, "center");
                    }
                }, error: function (xhr, status, error) {
                    if (!$('#fixSeedCheckbox').is(':checked')) {
                        $('#seedInput').val(getRandomSeed());
                    }
                    //恢复按钮
                    $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                    $("#resview").hide();
                    balert('任务创建失败', 'danger', false, 1000, "center");
                }
            });
        } else {
            balert('请输入绘画提示词', 'danger', false, 1000, "center");
            $('html, body').animate({ scrollTop: 0 }, 'slow');
            //输入框获得焦点
            $('#inputText').focus();
        }
    });

    $('#modelSelect').change(function () {
        var selectedValue = $(this).val();  // 获取选中选项的值
        if (selectedValue === "black-forest-labs/FLUX.1-schnell") {
            $('.numberImagesValue').slideUp();
            $('.inferenceSteps').slideUp();
            $('.guidanceScale').slideUp();
            $('.negativePrompt').slideUp();
        } else {
            $('.numberImagesValue').slideDown();
            $('.inferenceSteps').slideDown();
            $('.guidanceScale').slideDown();
            $('.negativePrompt').slideDown();
        }
    });

});


function SDinfo() {
    var content = `<p>1、请按照步骤执行绘画任务</p>
                   <p>2、图片绘制完成前，请【切勿刷新页面】</p>
                   <p>3、图片绘制完成前如果刷新页面，图片将无法存入图库，请【切勿刷新页面】</p>`;
    showConfirmationModal("Stable Diffusion说明", content);
}

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

connection.onclose((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Disconnected);
    console.log(`由于错误"${error}"连接已关闭。尝试重新启动连接。`);
    // 这里您可以尝试再次启动连接，或者通知用户连接已丢失。
    connection.start();
});

let jishuqi = 0;
var sysmsg = "";
connection.on('ReceiveMessage', function (message) {
    if (!message.isfinish) {
        if (jishuqi == 0) {
        } else {
            if (message.message != null) {
                sysmsg += message.message;
                $("#inputText").val(sysmsg).trigger('input');
            }
        }
        jishuqi++;
    } else {
        $("#inputText").val(sysmsg).trigger('input');
        sysmsg = "";
        unloadingBtn('.greatePrompt');
    }
});


//发送消息
function sendMsg() {
    var msg = $("#inputText").val().trim();
    if (msg == "") {
        balert("请输入待优化的绘画提示词", "warning", false, 2000);
        return;
    }
    loadingBtn('.greatePrompt');
    var chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    var chatid = '';
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": '',
        "system_prompt": `As a prompt generator for a generative AI called "Stable Diffusion", you will create image prompts for the AI to visualize. I will give you a concept, and you will provide a detailed prompt for DALL-E3 to generate an image.
                            
                            Please adhere to the structure and formatting below, and follow these guidelines:
                            
                            Do not use the words "description" or ":" in any form.
                            Write each prompt in one line without using return.
                            Structure:
                            [1] = ${msg}
                            [x] = a detailed description of [1] with specific imagery details.
                            [x] = scene's environment.
                            [x] = compositions.
                            [x] = scene's mood, feelings, and atmosphere.
                            [x] = A style (e.g. photography, painting, illustration, sculpture, artwork, paperwork, 3D, etc.) for [1].
                            [x] =  a detailed description of the scene's mood, feelings, and atmosphere.

                            Then sum it up into a Prompt unique paragraph only one

                            Your task: Create 1 distinct prompts for each concept [1], varying in details description, environment,compositions,atmosphere, and realization.
                            
                            Write your prompts in english.
                            Do not describe unreal concepts as "real" or "photographic".
                            Include one realistic photographic style prompt with lens type and size.
                            Separate different prompts with two new lines.
                            Example Prompts:
                            
                            cute dog, fluffy fur, wagging tail, playful expression, sitting on a grassy field, under a clear blue sky, with a colorful collar, in a natural and vibrant setting, by a lake, captured with a Nikon D750 camera, 50mm lens, shallow depth of field, composition focused on the dog's face, capturing its joyful spirit, in a style reminiscent of William Wegman's iconic dog portraits.`
    };
    $("#inputText").val("").trigger('input');
    $("#inputText").focus();
    connection.invoke("SendMessage", data)
        .then(function () {
        })
        .catch(function (err) {
            unloadingBtn('.greatePrompt');
            sendExceptionMsg("【SD绘画提示词优化】发送消息时出现了一些未经处理的异常 :-( 原因：" + err);
            //balert("您的登录令牌似乎已失效，我们将启动账号保护，请稍候，正在前往重新登录...", "danger", false, 3000, "center", function () {
            //    window.location.href = "/Users/Login";
            //});
        });
}

//转英语提示词
function englishPrompt() {
    var msg = $("#inputText").val().trim();
    if (msg === "") {
        balert("请输入待转换的绘画提示词", "warning", false, 2000);
        return;
    }
    loadingBtn('.englishPrompt');
    $.ajax({
        type: "POST",
        url: "/AIdraw/EnglishPrompt",
        dataType: "json",
        data: {
            "prompt": msg,
        },
        success: function (data) {
            unloadingBtn('.englishPrompt');
            if (data.success) {
                $("#inputText").val(data.data)
            } else {
                balert("转换失败，请重试", "danger", false, 2000);
            }
        },
        error: function (err) {
            unloadingBtn('.englishPrompt');
            balert("转换失败，请重试", "danger", false, 2000);
            sendExceptionMsg("【/AIdraw/EnglishPrompt】出现了一些未经处理的异常 :-( 原因：" + err);
        }
    })

}