var d3imgsize = '1024x1024';
var quality = 'standard';
let thisAiModel = 'gpt-4.1-nano-openai';
// 上传图片的数据存储
let currentImage = null;
let currentMask = null;
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#dall-nav").addClass('active');
})
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
    $('#inputText').on('input', function () {
        updateCharCount();
    });

    $('#createTaskBtn').click(function () {
        var prompt = $('#inputText').val().trim();
        var drawModel = $('#modelSelect').val();
        if (prompt != "") {
            //禁用按钮
            $("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
            if (drawModel === 'dall-e-3') {
                //发起请求
                $("#resview").show();
                $("#resimgurl").attr("src", "/system/images/loading.gif");
                $('html, body').animate({scrollTop: $('.content-body').height()}, 1000);
                balert('发送任务创建请求成功', 'success', false, 1000, "center");
                $("#nt").text('绘图中，请勿刷新页面...');
                $.ajax({
                    type: "POST",
                    url: "/AIdraw/CreateDALLTask",
                    data: {
                        prompt: prompt,
                        imgSize: d3imgsize,
                        quality: quality
                    },
                    success: function (data) {
                        if (data.success) {
                            //显示图片
                            $("#nt").text('绘制完成');
                            $("#resimgurl").attr("src", data.imgurl);
                            $("#resimgurl-a").attr("href", data.imgurl);
                            //恢复按钮
                            $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                            //跳转到任务列表
                            $('html, body').animate({scrollTop: $('.content-body').height()}, 1000);
                            $('.image-popup').magnificPopup({
                                type: 'image',
                                gallery: {
                                    enabled: true
                                }
                            });
                        } else {
                            //恢复按钮
                            $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                            $("#resview").hide();
                            balert(data.msg, 'danger', false, 1000, "center");
                        }
                    },
                    error: function (xhr, status, error) {
                        //恢复按钮
                        $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        $("#resview").hide();
                        balert('任务创建失败', 'danger', false, 1000, "center");
                    }
                });
            } else if (drawModel === 'gpt-image-1') {
                //发起请求
                $("#resview").show();
                $("#resimgurl").attr("src", "/system/images/loading.gif");
                $('html, body').animate({scrollTop: $('.content-body').height()}, 1000);
                balert('发送任务创建请求成功', 'success', false, 1000, "center");
                $("#nt").text('绘图中，请勿刷新页面...');
                $.ajax({
                    type: "POST",
                    url: "/AIdraw/CreateGptImage1Task",
                    data: {
                        prompt: prompt,
                        action: $('#modelAction').val(),
                        imageSize: d3imgsize,
                        quality: quality,
                        // 传递图片的base64数据，移除data:image前缀
                        image: currentImage != null ? currentImage.replace(/^data:image\/(png|jpeg|jpg);base64,/, '') : null,
                        // 传递掩码的base64数据，移除data:image前缀
                        mask: currentMask != null ? currentMask.replace(/^data:image\/(png|jpeg|jpg);base64,/, '') : null
                    },
                    success: function (data) {
                        if (data.success) {
                            //显示图片
                            $("#nt").text('绘制完成');
                            $("#resimgurl").attr("src", data.imgurl);
                            $("#resimgurl-a").attr("href", data.imgurl);
                            //恢复按钮
                            $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                            //跳转到任务列表
                            $('html, body').animate({scrollTop: $('.content-body').height()}, 1000);
                            $('.image-popup').magnificPopup({
                                type: 'image',
                                gallery: {
                                    enabled: true
                                }
                            });
                        } else {
                            //恢复按钮
                            $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                            $("#resview").hide();
                            balert(data.msg, 'danger', false, 1000, "center");
                        }
                    },
                    error: function (xhr, status, error) {
                        //恢复按钮
                        $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        $("#resview").hide();
                        balert('任务创建失败', 'danger', false, 1000, "center");
                    }
                });
            }


        } else {
            balert('请输入绘画提示词', 'danger', false, 1000, "center");
            $('html, body').animate({scrollTop: 0}, 'slow');
            //输入框获得焦点
            $('#inputText').focus();
        }
    });

});

function TabD3ImgSize(size, cl) {
    $(".imgsize").css("border", "1px solid gray");
    $("." + cl).css("border", "2px solid orangered");
    d3imgsize = size;
}

function toggleQuality() {
    var qualityCheckbox = document.getElementById("qualityCheckbox");
    if (qualityCheckbox.checked) {
        // 执行高清操作
        quality = 'hd';
    } else {
        // 执行标清操作
        quality = 'standard';
    }
}

function DALLinfo() {
    var content = `<p>1、请按照步骤执行绘画任务</p>
                   <p>2、图片绘制完成前，请【切勿刷新页面】</p>
                   <p>3、图片绘制完成前如果刷新页面，图片将无法存入图库，费用依旧会扣除，请【切勿刷新页面】</p>`;
    showConfirmationModal("DALL·E3说明", content);
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
        "system_prompt": `As a prompt generator for a generative AI called "DALL-E3", you will create image prompts for the AI to visualize. I will give you a concept, and you will provide a detailed prompt for DALL-E3 to generate an image.
                            
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
            sendExceptionMsg("【DALL绘画提示词优化】发送消息时出现了一些未经处理的异常 :-( 原因：" + err);
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

// gpt-image-1
$('#modelSelect').change(function () {
    var selectedModel = $(this).val();
    if (selectedModel === 'gpt-image-1') {
        $('#modelAction').show();
        $('#modelAction').val('generations');
    } else {
        $('#modelAction').hide();
        $('.image-editor-container').hide();
        $('.image-variations-container').hide();
    }
});
$('#modelAction').change(function () {
    var selectedAction = $(this).val();
    if (selectedAction === 'edit') {
        $('.image-editor-container').show();
        $('.image-variations-container').hide();
    } else if (selectedAction === 'variations') {
        $('.image-editor-container').hide();
        $('.image-variations-container').show();
    } else {
        $('.image-editor-container').hide();
        $('.image-variations-container').hide();
    }
});
//画布
document.addEventListener('DOMContentLoaded', function () {
    // 获取DOM元素
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const imageUpload = document.getElementById('image-upload');
    const imageEditor = document.getElementById('image-editor');
    const originalCanvas = document.getElementById('original-canvas');
    const drawCanvas = document.getElementById('draw-canvas');
    const maskCanvas = document.getElementById('mask-canvas');
    const maskPlaceholder = document.getElementById('mask-placeholder');
    const maskDisplay = document.getElementById('mask-display');
    const brushControls = document.getElementById('brush-controls');
    const brushSize = document.getElementById('brush-size');
    const brushDecrease = document.getElementById('brush-decrease');
    const brushIncrease = document.getElementById('brush-increase');
    const clearMask = document.getElementById('clear-mask');
    const reupload = document.getElementById('reupload');
    const downloadMask = document.getElementById('download-mask');

    // 获取画布上下文
    const originalCtx = originalCanvas.getContext('2d');
    const drawCtx = drawCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d', {willReadFrequently: true});

    // 初始变量
    let isDrawing = false;
    let currentBrushSize = 10;
    let originalImage = null;
    currentImage = null;
    currentMask = null;

    // 上传图片事件处理
    uploadPlaceholder.addEventListener('click', function () {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    });

    // 拖放处理
    uploadPlaceholder.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.style.backgroundColor = '#f7f8fa';
        this.style.borderColor = '#a8b1bd';
    });

    uploadPlaceholder.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.style.backgroundColor = '';
        this.style.borderColor = '#dde1e6';
    });

    uploadPlaceholder.addEventListener('drop', function (e) {
        e.preventDefault();
        this.style.backgroundColor = '';
        this.style.borderColor = '#dde1e6';

        if (e.dataTransfer.files.length) {
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });

    // 处理图片上传
    function handleImageUpload(file) {
        if (!file.type.match('image.*')) {
            balert("请选择图片文件", "warning", false, 2000, "center");
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            originalImage = new Image();
            originalImage.onload = function () {
                // 确定图像尺寸
                let width = originalImage.width;
                let height = originalImage.height;

                // 调整尺寸以适应显示区域，最大宽度/高度为500px
                const maxDimension = 500;
                if (width > maxDimension || height > maxDimension) {
                    const ratio = Math.min(maxDimension / width, maxDimension / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }

                // 设置画布尺寸
                originalCanvas.width = width;
                originalCanvas.height = height;
                drawCanvas.width = width;
                drawCanvas.height = height;
                maskCanvas.width = width;
                maskCanvas.height = height;

                // 绘制原图
                originalCtx.clearRect(0, 0, width, height);
                originalCtx.drawImage(originalImage, 0, 0, width, height);

                // 初始化绘图和mask画布（透明背景）
                drawCtx.clearRect(0, 0, width, height);
                maskCtx.clearRect(0, 0, width, height);

                // 初始化mask画布为原图的复制，后续将在这个画布上创建透明区域
                maskCtx.drawImage(originalImage, 0, 0, width, height);

                // 显示图像编辑界面，隐藏上传界面
                uploadPlaceholder.style.display = 'none';
                imageEditor.style.display = 'flex';
                maskPlaceholder.style.display = 'none';
                maskDisplay.style.display = 'flex';
                brushControls.style.display = 'flex';
                downloadMask.style.display = 'block';

                // 调整绘图画布位置
                positionDrawCanvas();

                // 更新全局变量存储原始图像和初始mask
                currentImage = originalCanvas.toDataURL('image/png');
                currentMask = maskCanvas.toDataURL('image/png');
            };
            originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 调整绘图画布位置以匹配原始画布
    function positionDrawCanvas() {
        const rect = originalCanvas.getBoundingClientRect();
        drawCanvas.style.width = rect.width + 'px';
        drawCanvas.style.height = rect.height + 'px';
        drawCanvas.style.left = (originalCanvas.offsetLeft) + 'px';
        drawCanvas.style.top = (originalCanvas.offsetTop) + 'px';
    }

    // 窗口大小变化时重新定位绘图画布
    window.addEventListener('resize', function () {
        if (originalImage) {
            positionDrawCanvas();
        }
    });

    // 绘图相关事件
    drawCanvas.addEventListener('mousedown', startDrawing);
    drawCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDrawing);

    // 触摸支持
    drawCanvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        const touch = e.touches[0];
        startDrawing({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    });

    drawCanvas.addEventListener('touchmove', function (e) {
        e.preventDefault();
        const touch = e.touches[0];
        draw({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    });

    window.addEventListener('touchend', function (e) {
        stopDrawing();
    });

    // 开始绘图
    function startDrawing(e) {
        isDrawing = true;
        draw(e);
    }

    // 绘图函数
    function draw(e) {
        if (!isDrawing) return;

        const rect = drawCanvas.getBoundingClientRect();
        const scaleX = drawCanvas.width / rect.width;
        const scaleY = drawCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // 在绘图画布上绘制半透明红色来显示用户的绘制操作
        drawCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
        drawCtx.beginPath();
        drawCtx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
        drawCtx.fill();

        // 在mask画布上设置透明区域
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.beginPath();
        maskCtx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.globalCompositeOperation = 'source-over';
    }

    // 停止绘图
    function stopDrawing() {
        isDrawing = false;

        // 每次停止绘制后更新mask
        if (maskCanvas.width > 0 && maskCanvas.height > 0) {
            currentMask = maskCanvas.toDataURL('image/png');
        }
    }

    // 画笔大小控制
    brushDecrease.addEventListener('click', function () {
        currentBrushSize = Math.max(5, currentBrushSize - 5);
        updateBrushSizeText();
    });

    brushIncrease.addEventListener('click', function () {
        currentBrushSize = Math.min(50, currentBrushSize + 5);
        updateBrushSizeText();
    });

    function updateBrushSizeText() {
        brushSize.textContent = `画笔: ${currentBrushSize}px`;
    }

    // 初始化画笔大小显示
    updateBrushSizeText();

    // 清除涂抹时也要更新mask
    clearMask.addEventListener('click', function () {
        if (originalImage) {
            // 清除绘图画布
            drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

            // 重置mask画布为原图
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.drawImage(originalImage, 0, 0, maskCanvas.width, maskCanvas.height);

            // 更新mask数据
            currentMask = maskCanvas.toDataURL('image/png');
        }
    });

    // 重新上传时清除所有图像数据
    reupload.addEventListener('click', function () {
        // 重置状态并显示上传界面
        uploadPlaceholder.style.display = 'flex';
        imageEditor.style.display = 'none';
        maskPlaceholder.style.display = 'flex';
        maskDisplay.style.display = 'none';
        brushControls.style.display = 'none';
        downloadMask.style.display = 'none';

        // 清除画布
        originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

        // 重置全局变量
        originalImage = null;
        currentImage = null;
        currentMask = null;

        // 重置上传控件
        imageUpload.value = '';
    });

    // 下载mask图片
    downloadMask.addEventListener('click', function () {
        if (originalImage) {
            // 创建下载链接
            const link = document.createElement('a');
            link.download = 'mask.png';

            // 获取含透明区域的PNG
            link.href = maskCanvas.toDataURL('image/png');

            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
});


//图片变体

document.addEventListener('DOMContentLoaded', function () {
    // 获取DOM元素
    const variationsUpload = document.getElementById('variations-upload');
    const variationsFileInput = document.getElementById('variations-file-input');
    const uploadedImagesContainer = document.getElementById('uploaded-images-container');
    const imageGrid = document.getElementById('image-grid');
    const clearVariations = document.getElementById('clear-variations');
    const changeImage = document.getElementById('change-image');

    // 点击上传区域触发文件选择
    variationsUpload.addEventListener('click', function () {
        variationsFileInput.click();
    });

    // 监听文件选择变化
    variationsFileInput.addEventListener('change', function (e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // 拖放处理
    variationsUpload.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.style.backgroundColor = '#f1f3f5';
        this.style.borderColor = '#adb5bd';
    });

    variationsUpload.addEventListener('dragleave', function (e) {
        e.preventDefault();
        this.style.backgroundColor = '#f8f9fa';
        this.style.borderColor = '#dde1e6';
    });

    variationsUpload.addEventListener('drop', function (e) {
        e.preventDefault();
        this.style.backgroundColor = '#f8f9fa';
        this.style.borderColor = '#dde1e6';

        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // 处理上传的单个文件
    // 处理上传的单个文件
    function handleFile(file) {
        // 确保文件是图片
        if (!file.type.match('image.*')) {
            return;
        }

        // 读取文件
        const reader = new FileReader();
        reader.onload = function (e) {
            // 清除之前的图片
            imageGrid.innerHTML = '';

            // 创建唯一ID
            const imageId = 'img-' + Date.now();

            // 获取图片的base64数据
            const imageDataUrl = e.target.result;

            // 更新全局变量，存储图片数据
            currentImage = imageDataUrl;

            // 变体模式下不需要mask
            currentMask = null;

            // 创建预览元素
            createImagePreview(imageId, imageDataUrl);

            // 显示图片网格，隐藏上传区域
            uploadedImagesContainer.style.display = 'block';
            variationsUpload.style.display = 'none';
        };

        reader.readAsDataURL(file);

        // 重置文件输入，允许再次选择相同的文件
        variationsFileInput.value = '';
    }

    // 创建图片预览
    function createImagePreview(id, dataUrl) {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.id = id;

        // 创建图片元素
        const img = document.createElement('img');
        img.src = dataUrl;
        img.alt = '上传的图片';

        // 创建删除按钮
        const removeBtn = document.createElement('div');
        removeBtn.className = 'remove-image';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            clearImage();
        });

        // 添加到图片项
        imageItem.appendChild(img);
        imageItem.appendChild(removeBtn);

        // 添加到网格
        imageGrid.appendChild(imageItem);
    }

    // 清除图片
    // 清除图片
    function clearImage() {
        // 清空图片网格
        imageGrid.innerHTML = '';

        // 清除全局变量
        currentImage = null;
        currentMask = null;

        // 显示上传区域，隐藏图片网格
        uploadedImagesContainer.style.display = 'none';
        variationsUpload.style.display = 'flex';
    }

    // 清除图片按钮
    clearVariations.addEventListener('click', function () {
        clearImage();
    });

    // 更换图片按钮
    changeImage.addEventListener('click', function () {
        variationsFileInput.click();
    });
});