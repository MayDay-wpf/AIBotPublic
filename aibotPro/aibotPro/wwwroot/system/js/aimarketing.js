$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#product-main-menu").addClass('active');
    $("#product-main-menu").parent().toggleClass('show');
    $("#product-main-menu").parent().siblings().removeClass('show');
    $("#aimarketing-product-nav").addClass('active');
    $("#alloy").prop("checked", true);
});
let textArr_tmp = [];
let voice = 'alloy';
let mp3Arr = [];
let combinedMp3 = '';
let imglist = [];
let model = 'gpt-4o-mini';
let d3imgsize = '1024x1024';

$(document).ready(function () {
    $('input[type=radio][name=voice]').change(function () {
        voice = $(this).val();
    });
    $('#aiModelSelect').change(function () {
        // 更新变量model的值为下拉框当前选中的值
        model = $(this).val();
        // 可以在这里添加其他你希望在模型改变时执行的代码
        console.log('当前选中的AI模型:', model);
    });
});
function toStep(index) {
    if (index == 2) {
        var text = $("#text").val();
        if (text == "") {
            balert("请输入文本", "warning", false, 1500, "center");
            return;
        }
        //text根据换行符分割成数组
        var textArr = text.split('\n');
        //去掉空行
        var textArr = textArr.filter(function (s) {
            return s && s.trim();
        });
        textArr_tmp = textArr;
        //遍历生成textarea html放入step2 #sections
        var html = "";
        for (var i = 0; i < textArr.length; i++) {
            html += `<textarea class="form-control section" style="height:120px;">${textArr[i]}</textarea>`;
        }
        $("#sections").html(html);
        $("#step2").show();
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
    }
    else if (index == 3) {
        $("#step3").show();
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
    }
    else if (index == 4) {
        $("#step4").show();
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
    }
    else if (index == 5) {
        $("#step5").show();
        $("html, body").animate({ scrollTop: $(document).height() }, "slow");
        lensWork();
    }
}
async function createMP3() {
    if (textArr_tmp.length > 0) {
        $("#logview").html('');
        loadingBtn('.btnTTS');
        // 遍历textArr_tmp 获得后台生成的MP3文件名
        writelogview(`信息：开始转换音频：0/${textArr_tmp.length}`);

        for (let i = 0; i < textArr_tmp.length; i++) { // 使用let保证每次循环i的值都是块级作用域
            try {
                const res = await createSingleMP3(textArr_tmp[i], voice, i + 1, textArr_tmp.length);
                if (res == "") {
                    writelogview(`错误：转换音频第：${i + 1}片生成失败，停止操作，建议重新开始`);
                    unloadingBtn('.btnTTS');
                    return; // 或者 throw new Error('转换音频失败');
                } else {
                    mp3Arr.push(res);
                    writelogview(`信息：开始转换音频：${i + 1}/${textArr_tmp.length}`);
                }
            } catch (error) {
                writelogview(`错误：转换音频第：${i + 1}片时发生错误，停止操作，建议重新开始。错误信息：${error}`);
                unloadingBtn('.btnTTS');
                return; // 或者 throw error;
            }
        }
        combinedTrack();
    } else {
        balert("请先输入文本", "warning", false, 1500, "center");
    }
}

// 单独创建一个函数，用于发送AJAX请求并返回Promise对象
function createSingleMP3(text, voice, index, total) {
    return new Promise((resolve, reject) => {
        $.ajax({
            type: "POST",
            url: "/Product/CreateTTSMP3",
            data: {
                text: text,
                voice: voice
            },
            success: function (res) {
                resolve(res.data);
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}
function combinedTrack() {
    // 合并音频
    if (mp3Arr.length > 0) {
        writelogview(`信息：开始合并音频`);
        $.ajax({
            type: "post",
            url: "/Product/CombineMP3",
            contentType: "application/json", // 设置内容类型为 JSON
            data: JSON.stringify({ pathlist: mp3Arr }), // 将数组转为 JSON 字符串
            success: function (res) {
                if (res.success) {
                    writelogview(`信息：合并音频成功（100%）`);
                    // 首先移除已存在的下载链接
                    $("#step3 .download-link").remove();

                    //创建一个下载链接追加到页面
                    var a = document.createElement('a');
                    a.classList.add('btn', 'btn-primary', 'download-link');
                    combinedMp3 = res.data.replace("/wwwroot", "");
                    a.href = combinedMp3;
                    a.download = '合成音频.mp3';
                    a.innerHTML = '<i class="fas fa-download"></i> 点击下载合成音频';
                    //加入到页面中
                    $("#step3").append(a);
                    unloadingBtn('.btnTTS');
                    $("html, body").animate({ scrollTop: $(document).height() }, "slow");
                    //$("#toStep4").show();
                }
            },
            error: function (error) {
                writelogview(`信息：合并音频时发生错误`);
            }
        });
    } else {
        balert("请先生成音频", "warning", false, 1500, "center");
    }

}

function createLens() {
    var text = $("#text").val();
    if (text == "") {
        balert("请输入文本", "warning", false, 1500, "center");
        return;
    }
    var systemPrompt = `你是一个有用的视频分镜AI图片生成机器人，请你根据文本内容生成分镜图片的AI绘画提示词，描述详细精准，并以JSON格式输出，格式示例：{SB:[{'storyboard':'分镜1'},{'storyboard':'分镜2'},{'storyboard':'分镜3'}}]}`;
    loadingBtn('.btnLens');
    //发起ajax请求
    $.ajax({
        type: "POST",
        url: "/Product/CreateLens",
        data: {
            model: model,
            text: text,
            systemPrompt: systemPrompt
        },
        success: function (res) {
            if (res.success) {
                res = res.data.sb;
                //console.log(res);
                var html = "";
                for (var i = 0; i < res.length; i++) {
                    html += `<textarea class="form-control lens" style="height:120px;">${res[i].storyboard}</textarea>`;
                }
                $("#lens").html(html);
                unloadingBtn('.btnLens');
                $("html, body").animate({ scrollTop: $(document).height() }, "slow");
                $("#toStep5").show();
            } else {
                balert(res.data, "danger", false, 1500, "center");
                unloadingBtn('.btnLens');
            }
        },
        error: function (error) {
            unloadingBtn('.btnLens');
            balert("生成失败", "danger", false, 1500, "center");
        }
    });
}

function lensWork() {
    var html = ``;
    var count = 1;
    $('#lens .lens').each(function () {
        var value = $(this).val(); // 获取当前元素的值
        html += `<div class="col-lg-3 col-md-4 col-sm-6 col-12 mb-4" id="card${count}">
                    <div class="card h-100">
                        <div class="card-header">
                            <div class="form-group">
                                <textarea class="form-control" rows="2" id="drawPrompt${count}">${value}</textarea>
                            </div>
                        </div>
                        <a href="" id="a-drawPrompt${count}" class="image-popup">
                            <img src="" id="img-drawPrompt${count}" class="card-img-top img-fluid" alt="图片显示区" style="aspect-ratio: 1 / 1; object-fit: cover;">
                        </a>
                        <div class="card-body text-center">
                            <button class="btn btn-primary drawPrompt${count}" onclick="drawAction('drawPrompt${count}')">绘制</button>
                            <!-- 这里添加了删除按钮 -->
                            <button class="btn btn-danger delete-btn" data-target="#card${count}">删除</button>
                        </div>
                    </div>
                </div>`;
        count++;
    });
    $("#draw").html(html);

    // 给删除按钮添加事件监听
    $('.delete-btn').click(function () {
        var target = $(this).data('target'); // 获取该按钮对应的卡片的选择器
        var cardId = target.replace("#card", ""); // 假设卡片的ID是 "card1", "card2" 等, 提取出数字部分。

        // 找到并移除imglist中对应的图片对象
        imglist = imglist.filter(item => item.id !== 'drawPrompt' + cardId);

        $(target).remove(); // 移除目标卡片
    });
}
let drawControl = true;
function drawAction(id) {
    var prompt = $("#" + id).val();
    var quality = 'standard';
    if (drawControl) {
        drawControl = false;
        loadingBtn('.' + id);
        $.ajax({
            type: "POST",
            url: "/AIdraw/CreateDALLTask",
            data: {
                prompt: prompt,
                imgSize: d3imgsize,
                quality: quality
            },
            success: function (data) {
                drawControl = true;
                unloadingBtn('.' + id);
                if (data.success) {
                    //显示图片
                    $("#img-" + id).attr("src", data.imgurl);
                    $("#a-" + id).attr("href", data.imgurl);
                    var drawimgres = {
                        id: id,
                        path: data.localhosturl
                    };
                    // 查找数组中是否存在具有相同id的对象
                    var existingIndex = imglist.findIndex(item => item.id === id);

                    if (existingIndex !== -1) {
                        // 如果找到，替换该对象
                        imglist[existingIndex] = drawimgres;
                    } else {
                        // 如果未找到，将新对象push到数组中
                        imglist.push(drawimgres);
                    }
                    $('.image-popup').magnificPopup({
                        type: 'image'
                    });
                } else {
                    drawControl = true;
                    //恢复按钮
                    balert(data.msg, 'danger', false, 1000, "center");
                }
            },
            error: function (xhr, status, error) {
                drawControl = true;
                //恢复按钮
                unloadingBtn('.' + id);
                balert('任务创建失败', 'danger', false, 1000, "center");
            }
        });
    } else {
        balert('为保证视频生成的稳定性，请等待上一个任务完成', 'warning', false, 2000, "center");
    }
}
function createVideo() {
    //if (combinedMp3 == "") {
    //    balert("请先合成音频", "warning", false, 1500, "center");
    //    return;
    //}
    //if (imglist.length == 0) {
    //    balert("请先生成图片", "warning", false, 1500, "center");
    //    return;
    //}
    imglist = sortImgListByID(imglist);

    // 显示模态框并设置为不可关闭
    $('#waitingModal').modal({
        backdrop: 'static', // 设置点击遮罩不关闭模态窗
        keyboard: false     // 设置按Esc键不关闭模态窗
    });

    // 开始30秒倒计时
    let counter = 30;
    const intervalId = setInterval(() => {
        $('#countdownText').text(--counter + '秒后继续...');
        if (counter === 0) {
            clearInterval(intervalId);
            $('#waitingModal').modal('hide');
            proceedWithVideoCreation();
        }
    }, 1000);
}


function proceedWithVideoCreation() {
    balert('开始生成视频', 'info', false, 1500, "center");
    loadingBtn('.btnVideo');
    var imglistpath = [];
    for (var i = 0; i < imglist.length; i++) {
        imglistpath.push(imglist[i].path);
    }
    $.ajax({
        type: "POST",
        url: "/Product/CreateVideo",
        contentType: "application/json",
        data: JSON.stringify({ imglist: imglist, combinedMp3: combinedMp3 }),
        success: function (response) {
            unloadingBtn('.btnVideo');
            var videoUrl = response.videoPath.replace("wwwroot/", "");
            $("#video").find("source").attr("src", videoUrl);
            $("#video")[0].load();
            $("#videoDownload").attr("href", videoUrl);
            $("#step6").show();
            $("html, body").animate({ scrollTop: $(document).height() }, "slow");
        },
        error: function (error) {
            unloadingBtn('.btnVideo');
            balert('视频生成失败，您可以尝试重试，将不会产生任何其他费用', 'danger', false, 1500, "center");
            sendExceptionMsg(error);
        }
    });
}
//function createVideo() {
//    if (combinedMp3 == "") {
//        balert("请先合成音频", "warning", false, 1500, "center");
//        return;
//    }
//    if (imglist.length == 0) {
//        balert("请先生成图片", "warning", false, 1500, "center");
//        return;
//    }
//    //功能调试数据
//    //combinedMp3 = "/files/audio/output/20240301/6f70cf57a6894840b9c3ab736091a4fd.mp3";
//    //imglist = [
//    //    {
//    //        "id": "drawPrompt1",
//    //        "path": "/files/dallres\\maymay5jace@gmail.com\\20240203-7d4c2d4c31ac40b2a73ea2c328f46fd0.png"
//    //    },
//    //    {
//    //        "id": "drawPrompt3",
//    //        "path": "/files/dallres\\maymay5jace@gmail.com\\20240216-8e4e2b6cee334a4b87239610aecd468d.png"
//    //    },
//    //    {
//    //        "id": "drawPrompt2",
//    //        "path": "/files/dallres\\maymay5jace@gmail.com\\20240301-909866ec7df54b58b7051202d01d5756.png"
//    //    },
//    //    {
//    //        "id": "drawPrompt4",
//    //        "path": "/files/dallres\\maymay5jace@gmail.com\\20240301-3752f45cedf84e0a9a03e4afa8bf8b6c.png"
//    //    }
//    //]
//    imglist = sortImgListByID(imglist);
//    console.log(imglist);
//    loadingBtn('.btnVideo');
//    var imglistpath = [];
//    for (var i = 0; i < imglist.length; i++) {
//        imglistpath.push(imglist[i].path);
//    }
//    $.ajax({
//        type: "POST",
//        url: "/Product/CreateVideo",
//        contentType: "application/json",
//        data: JSON.stringify({ imglist: imglist, combinedMp3: combinedMp3 }), // 在这里加入combinedMp3
//        success: function (response) {
//            unloadingBtn('.btnVideo');
//            console.log("成功:", response);
//            var videoUrl = response.replace("wwwroot");
//            $("#video").find("source").attr("src", videoUrl);
//            $("#video")[0].load(); // 重新加载 video 以更新源
//            $("#videoDownload").attr("href", videoUrl);
//            $("#step6").show();
//            $("html, body").animate({ scrollTop: $(document).height() }, "slow");
//        },
//        error: function (error) {
//            console.log("错误:", error);
//        }
//    });
//}
function sortImgListByID(imglist) {
    // 使用sort方法对数组进行排序
    imglist.sort((a, b) => {
        // 提取id字符串中的数字部分
        let numA = parseInt(a.id.replace(/^\D+/g, ''), 10);
        let numB = parseInt(b.id.replace(/^\D+/g, ''), 10);

        // 根据数字进行比较，决定元素的排序顺序
        return numA - numB;
    });

    return imglist;
}
function TabD3ImgSize(size, cl) {
    $(".imgsize").css("border", "1px solid gray");
    $("." + cl).css("border", "2px solid orangered");
    d3imgsize = size;
}

function writelogview(log) {
    $("#logview").append(log + "\n");
    $("#logview").scrollTop($("#logview")[0].scrollHeight);
}