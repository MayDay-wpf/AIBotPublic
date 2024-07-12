var botType = 'Midjourney';
var referenceImgPath = '';
var showlog = false;
var intervalId;
let thisAiModel = 'gpt-3.5-turbo-0125';
let drawmodel = 'fast';
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('#dpSidebarBody .nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#midjourney-nav").addClass('active');

    $('#fileInput').val('');
    $('.custom-file-label').removeClass('selected').html('选择文件');
    $("#log").val('');
    $('#p1').css('width', '0%').attr('aria-valuenow', 0).text('0%');
    $('#p2').css('width', '0%').attr('aria-valuenow', 0).text('0%');
    hasMJtask();
    $('#fast').prop('checked', true);
})
$(document).ready(function () {
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
    $('#inputText').on('input', function () {
        updateCharCount();
    });
    $('#myTab .nav-link').on('click', function (e) {
        // 获取点击的 Tab 的文本
        var tabText = $(this).text().trim();

        // 根据 Tab 的文本来设置 botType 的值
        if (tabText === 'Mid-Journey') {
            botType = 'Midjourney';
            //获取提示词
            var prompt = $('#inputText').val().trim();
            //查询关键字 niji 是否存在
            if (prompt.indexOf('--niji 5') != -1) {
                //去除 niji
                prompt = prompt.replace('--niji 5', '');
                $('#inputText').val(prompt).trigger('input');
            }
        } else if (tabText === 'Niji-Journey') {
            botType = 'Midjourney';
            //获取提示词
            var prompt = $('#inputText').val().trim();
            //查询关键字 niji 是否存在
            if (prompt.indexOf('niji') == -1) {
                //不存在则添加
                prompt += ' --niji 5';
                $('#inputText').val(prompt).trigger('input');
            }
        }
    });

    $('.custom-file-input').on('change', function () {
        var fileName = $(this).val().split('\\').pop();
        $(this).siblings('.custom-file-label').addClass('selected').html(fileName);
    });

    $('#clearBtn').click(function () {
        $('#fileInput').val('');
        $('.custom-file-label').removeClass('selected').html('选择文件');
        $('#p1').css('width', '0%').attr('aria-valuenow', 0).text('0%');
        referenceImgPath = '';
        balert('参考图已清除', 'success', false, 1000, "center");
    });

    $('#createTaskBtn').click(function () {
        var prompt = $('#inputText').val().trim();
        if (prompt != "") {
            //禁用按钮
            loadingBtn('.createTask');
            //$("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
            //创建任务
            var formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('botType', botType);
            formData.append('referenceImgPath', referenceImgPath);
            formData.append('drawmodel', drawmodel);
            $.ajax({
                type: "Post",
                url: "/AIdraw/CreateMJTask",
                data: formData,
                contentType: false,
                processData: false,
                success: function (res) {
                    if (res.success) {
                        balert('任务创建成功,详情请查看日志', 'success', false, 2000, "center");
                        $('.cancelTask').show();
                        $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
                        writeDrawLog('信息：任务创建成功，TaskId：' + res.taskId + '——' + getCurrentDateTime());
                        // 开始查询任务状态
                        queryTaskStatus(res.taskId, "CREATE");
                    }
                    else {
                        balert(res.msg, 'danger', false, 2000, "center");
                        writeDrawLog('失败：' + res.msg + '——' + getCurrentDateTime());
                        //恢复按钮
                        unloadingBtn('.createTask');
                        //$("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        //进度条恢复0
                        $('#p2').css('width', '0%').attr('aria-valuenow', 0).text('0%');
                    }
                    $("#log").show();
                    $("#TaskLogTitle").html(`<b>任务日志</b> <i data-feather="chevron-down"></i>`);
                    feather.replace();
                    showlog = true;
                    $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
                }, error: function (e) {
                    unloadingBtn('.createTask');
                }
            });
        }
        else {
            balert('请输入绘画提示词', 'danger', false, 1000, "center");
            $('html, body').animate({ scrollTop: 0 }, 'slow');
            //输入框获得焦点
            $('#inputText').focus();
        }
    });

    $('#TaskLogTitle').click(function () {
        if (!showlog) {
            $("#log").show();
            $(this).html(`<b>任务日志</b> <i data-feather="chevron-down"></i>`);
            feather.replace();
            showlog = true;
            $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
        }
        else {
            $("#log").hide();
            $(this).html(`<b>任务日志</b> <i data-feather="chevron-right"></i>`);
            feather.replace();
            showlog = false;
        }
    });
    $('input[type=radio][name=customRadio]').change(function () {
        drawmodel = $(this).val();
    });
});
function writeDrawLog(str) {
    $("#log").val($("#log").val() + str + `\n`);
    $("#log").scrollTop($("#log")[0].scrollHeight); // 滚动到底部
}

//查询任务状态
function queryTaskStatus(taskId, tasktype) {
    writeDrawLog('信息：请求查询绘制结果——' + getCurrentDateTime());
    if (taskId != "") {
        $.ajax({
            type: "Post",
            url: "/AIdraw/GetMJTaskResponse",
            data: { taskId: taskId },
            success: function (res) {
                if (res.success) {
                    //balert('任务状态查询成功', 'success', false, 1000, "center");
                    writeDrawLog('信息：[' + tasktype + ']任务状态查询成功，进度：' + res.taskResponse.progress + '——' + getCurrentDateTime());
                    //更新进度条#p2
                    var progress = res.taskResponse.progress.replace("%", "");
                    $('#p2').css('width', progress + '%').attr('aria-valuenow', progress).text(Math.round(progress) + '%');
                    if (res.taskResponse.status == "SUCCESS") {
                        clearInterval(intervalId); // 关闭定时器
                        writeDrawLog('图片绘制完成——' + getCurrentDateTime());
                        //恢复按钮
                        unloadingBtn('.createTask');
                        unloadingBtn('.cancelTask');
                        $('.cancelTask').hide();//隐藏停止按钮
                        //$("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        //进度条恢复0
                        $('#p2').css('width', '0%').attr('aria-valuenow', 0).text('0%');
                        //显示绘制结果
                        if (tasktype == "CREATE" || tasktype == "VARIATION") {
                            var html = `<div class="card">
                                            <div class="card-header">
                                                <h5>任务结果 ID： <span id="taskID">`+ taskId + `</span></h5>
                                            </div>
                                            <div class="card-body" style="text-align:center;">
                                                <div id="resBox">
                                                    <div class="text-center mb-3">
                                                        <a href="`+ res.taskResponse.imageUrl + `" id="resimgurl-a" class="image-popup">
                                                            <img src="`+ res.taskResponse.imageUrl + `" class="img-fluid" style="width:30%;min-width:300px;" alt="任务结果">
                                                        </a>
                                                    </div>
                                                    <div id="actionBtnlst">
                                                        <div class="text-center mt-3">
                                                            <button type="button" class="btn btn-primary mr-2" onclick="createActionTask('`+ taskId + `','UPSCALE','1')"><i data-feather="zoom-in"></i> 放大 图1</button>
                                                            <button type="button" class="btn btn-primary mr-2" onclick="createActionTask('`+ taskId + `','UPSCALE','2')"><i data-feather="zoom-in"></i> 放大 图2</button>
                                                        </div>
                                                        <div class="text-center mt-3">
                                                            <button type="button" class="btn btn-primary mr-2" onclick="createActionTask('`+ taskId + `','UPSCALE','3')"><i data-feather="zoom-in"></i> 放大 图3</button>
                                                            <button type="button" class="btn btn-primary mr-2" onclick="createActionTask('`+ taskId + `','UPSCALE','4')"><i data-feather="zoom-in"></i> 放大 图4</button>
                                                        </div>
                                                        <div class="text-center mt-3">
                                                            <button type="button" class="btn btn-info mr-2" onclick="createActionTask('`+ taskId + `','VARIATION','1')"><i data-feather="edit"></i> 改进 图1</button>
                                                            <button type="button" class="btn btn-info mr-2" onclick="createActionTask('`+ taskId + `','VARIATION','2')"><i data-feather="edit"></i> 改进 图2</button>
                                                        </div>
                                                        <div class="text-center mt-3">
                                                            <button type="button" class="btn btn-info mr-2" onclick="createActionTask('`+ taskId + `','VARIATION','3')"><i data-feather="edit"></i> 改进 图3</button>
                                                            <button type="button" class="btn btn-info mr-2" onclick="createActionTask('`+ taskId + `','VARIATION','4')"><i data-feather="edit"></i> 改进 图4</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p></p>`;
                            $("#STEP").append(html);
                            $('.image-popup').magnificPopup({ type: 'image' });
                        } else {
                            var html = `<div class="card">
                                            <div class="card-header">
                                                <h5>任务结果 ID： <span id="taskID">`+ taskId + `</span></h5>
                                            </div>
                                            <div class="card-body" style="text-align:center;">
                                                <div id="resBox">
                                                    <div class="text-center mb-3">
                                                    <a href="`+ res.taskResponse.imageUrl + `" id="resimgurl-a" class="image-popup">
                                                        <img src="`+ res.taskResponse.imageUrl + `" class="img-fluid" style="width:30%;min-width:300px;" alt="任务结果">
                                                    </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p></p>`;
                            $("#STEP").append(html);
                            $('.image-popup').magnificPopup({ type: 'image' });
                        }
                        $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
                        feather.replace();
                        return;
                    }
                    intervalId = setTimeout(function () {
                        queryTaskStatus(taskId, tasktype);
                    }, 3000);
                }
                else {
                    balert(res.msg, 'danger', false, 1000, "center");
                    writeDrawLog('失败：' + res.msg + '——' + getCurrentDateTime());
                }
            }
        });
    }
    else {
        balert('请输入任务ID', 'danger', false, 1000, "center");
        //恢复按钮
        unloadingBtn('.createTask');
        $('.cancelTask').hide();
    }
}

function createActionTask(taskId, changetype, changeindex) {
    //清空日志
    $("#log").val('');
    var element = document.getElementById("fileInput");
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    //禁用按钮
    loadingBtn('.createTask');
    //$("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
    //发起请求
    $.ajax({
        type: "Post",
        url: "/AIdraw/CreateMJChange",
        data: {
            action: changetype,
            index: changeindex,
            taskId: taskId,
            drawmodel: drawmodel

        },
        success: function (res) {
            if (res.success) {
                balert('任务创建成功,详情请查看日志', 'success', false, 2000, "center");
                writeDrawLog('信息：' + changetype + '任务创建成功，TaskId：' + res.taskId + '——' + getCurrentDateTime());
                $('.cancelTask').show();
                // 开始查询任务状态
                queryTaskStatus(res.taskId, changetype);
            }
            else {
                unloadingBtn('.createTask');
                balert(res.msg, 'danger', false, 2000, "center");
                writeDrawLog('失败：' + res.msg + '——' + getCurrentDateTime());
            }
            $("#log").show();
            $("#TaskLogTitle").html(`<b>任务日志</b> <i data-feather="chevron-down"></i>`);
            feather.replace();
            showlog = true;
        }, error: function (e) {
            unloadingBtn('.createTask');
        }
    });
}

function MJinfo() {
    var content = `<p>1、请按照步骤执行绘画任务</p>
                   <p>2、图片创建完成后可以进行放大和变化</p>
                   <p>3、Midjourney 是创作绘画，不能P图</p>
                   <p>4、图片绘制完成前，请【切勿刷新页面】</p>
                   <p>5、图片绘制完成前如果刷新页面，图片将无法存入图库，费用依旧会扣除，请【切勿刷新页面】</p>
                   <p><b>以下是一些常用参数，直接加在提示词后即可生效，例：一只可爱的猫 --ar 16:4</b></p>
                   <table border="1">
                      <tr>
                        <td>参数</td>
                        <td>功能</td>
                      </tr>
                      <tr>
                        <td><b>--ar n:m</b></td>
                        <td>控制图片尺寸比例，n是宽，m是高，例：--ar 16:4</td>
                      </tr>
                      <tr>
                        <td><b>--q</b></td>
                        <td>+数字 范围值：1-5，默认1，更高质量，耗时翻倍2，更强更久3、4、5</td>
                      </tr>
                      <tr>
                        <td><b>--v</b></td>
                        <td>+数字 范围值：1-6，算法选择，最新v6，图像的细节、构图上有了极大的提升</td>
                      </tr>
                      <tr>
                        <td><b>--chaos</b></td>
                        <td>+数字 范围值：0-100，生成四张风格迥异的图，数字越大，风格越不一致</td>
                      </tr>
                      <tr>
                        <td><b>--no</b></td>
                        <td>＋物品 后加具体物品，出图将不包含该物品，类似反向词</td>
                      </tr>
                      <tr>
                        <td><b>--iw</b></td>
                        <td>+数字 范围值：0.25-2，设置图片与参考图和描述文字的相似程度 （不支持V4版本）（V5,V6可以在喂图的时候改变图片比重）</td>
                      </tr>
                      <tr>
                        <td><b>::</b></td>
                        <td>+数字 权重数值0-5，可以有小数点；关键字数值越高越大</td>
                      </tr>
                    </table>`;
    showConfirmationModal("Midjourney说明", content);
}

function hasMJtask() {
    $.ajax({
        type: "Post",
        url: "/AIdraw/HasMJTask",
        async: false,
        success: function (res) {
            if (res.success) {
                balert('有正在运行中的任务,详情请查看日志', 'success', false, 2000, "center");
                loadingBtn('.createTask');
                $('.cancelTask').show();
                //$("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
                var value = JSON.parse(res.data);
                $("#log").show();
                $("#TaskLogTitle").html(`<b>任务日志</b> <i data-feather="chevron-down"></i>`);
                feather.replace();
                showlog = true;
                $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
                // 开始查询任务状态
                queryTaskStatus(value.taskId, value.type);
            }
        }
    });
}

function cancelMJtask() {
    showConfirmationModal('提醒', '停止任务<b style="color:red">依旧会对本次绘画计费</b>，确认停止？', function () {
        loadingBtn('.cancelTask');
        $.ajax({
            type: "Post",
            url: "/AIdraw/CancelMJTask",
            success: function (res) {
                if (res.success) {
                    unloadingBtn('.cancelTask');
                    $('.cancelTask').hide();//隐藏停止按钮
                    clearInterval(intervalId); // 关闭定时器
                    unloadingBtn('.createTask');//恢复创建任务按钮
                    $('#p2').css('width', '0%').attr('aria-valuenow', 0).text('0%');//进度条复位
                    writeDrawLog('信息：任务已被终止，如果是程序问题导致的必须终止，请前往【个人中心->统计】撤销此笔计费' + '——' + getCurrentDateTime());
                }
            }
        });
    });
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
        "system_prompt": `As a prompt generator for a generative AI called "Midjourney", you will create image prompts for the AI to visualize. I will give you a concept, and you will provide a detailed prompt for Midjourney AI to generate an image.
                            
                            Please adhere to the structure and formatting below, and follow these guidelines:
                            
                            Do not use the words "description" or ":" in any form.
                            Do not place a comma between [ar] and [v].
                            Write each prompt in one line without using return.
                            Structure:
                            [1] = ${msg}
                            [2] = a detailed description of [1] with specific imagery details.
                            [3] = a detailed description of the scene's environment.
                            [4] = a detailed description of the compositions.
                            [5] = a detailed description of the scene's mood, feelings, and atmosphere.
                            [6] = A style (e.g. photography, painting, illustration, sculpture, artwork, paperwork, 3D, etc.) for [1].
                            [7] =  a detailed description of the scene's mood, feelings, and atmosphere.
                            [ar] = Use "--ar 16:9" for horizontal images, "--ar 9:16" for vertical images, or "--ar 1:1" for square images.
                            [v] = Use "--niji 5" for Japanese art style, or "--v 6" for other styles.
                            
                            
                            Formatting:
                            Follow this prompt structure: "[1], [2], [3], [4], [5], [6], [7], [ar] [v]".
                            
                            Your task: Create 1 distinct prompts for each concept [1], varying in details description, environment,compositions,atmosphere, and realization.
                            
                            Write your prompts in english.
                            Do not describe unreal concepts as "real" or "photographic".
                            Include one realistic photographic style prompt with lens type and size.
                            Separate different prompts with two new lines.
                            Example Prompts:
                            
                            cute dog, fluffy fur, wagging tail, playful expression, sitting on a grassy field, under a clear blue sky, with a colorful collar, in a natural and vibrant setting, by a lake, captured with a Nikon D750 camera, 50mm lens, shallow depth of field, composition focused on the dog's face, capturing its joyful spirit, in a style reminiscent of William Wegman's iconic dog portraits. --ar 1:1 --v 6`
    };
    $("#inputText").val("").trigger('input');
    $("#inputText").focus();
    connection.invoke("SendMessage", data)
        .then(function () {
        })
        .catch(function (err) {
            unloadingBtn('.greatePrompt');
            sendExceptionMsg("【Midjourney绘画提示词优化】发送消息时出现了一些未经处理的异常 :-( 原因：" + err);
            //balert("您的登录令牌似乎已失效，我们将启动账号保护，请稍候，正在前往重新登录...", "danger", false, 3000, "center", function () {
            //    window.location.href = "/Users/Login";
            //});
        });
}