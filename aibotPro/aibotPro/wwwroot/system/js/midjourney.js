var botType = 'MID_JOURNEY';
var referenceImgPath = '';
var showlog = false;
var intervalId;
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
})
$(document).ready(function () {
    $('#inputText').keyup(function () {
        var charCount = $(this).val().length;
        $('#charCount').text(charCount);
    });

    $('#inputText').keydown(function (e) {
        var maxChars = 500;
        if ($(this).val().length === maxChars && e.keyCode !== 8) {
            e.preventDefault();
        }
    });

    $('#myTab .nav-link').on('click', function (e) {
        // 获取点击的 Tab 的文本
        var tabText = $(this).text().trim();

        // 根据 Tab 的文本来设置 botType 的值
        if (tabText === 'Mid-Journey') {
            botType = 'MID_JOURNEY';
        } else if (tabText === 'Niji-Journey') {
            botType = 'MID_JOURNEY';//暂时没有Niji-Journey渠道，先用MID代替
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
            $("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
            //创建任务
            var formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('botType', botType);
            formData.append('referenceImgPath', referenceImgPath);
            $.ajax({
                type: "Post",
                url: "/AIdraw/CreateMJTask",
                data: formData,
                contentType: false,
                processData: false,
                success: function (res) {
                    if (res.success) {
                        balert('任务创建成功,详情请查看日志', 'success', false, 2000, "center");
                        writeDrawLog('信息：任务创建成功，TaskId：' + res.taskId + '——' + getCurrentDateTime());
                        // 开始查询任务状态
                        queryTaskStatus(res.taskId, "CREATE");
                    }
                    else {
                        balert(res.msg, 'danger', false, 2000, "center");
                        writeDrawLog('失败：' + res.msg + '——' + getCurrentDateTime());
                        //恢复按钮
                        $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
                        //进度条恢复0
                        $('#p2').css('width', '0%').attr('aria-valuenow', 0).text('0%');
                    }
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
                    $("#log").show();
                    $("#log").html(`<b>任务日志</b> <i data-feather="chevron-down"></i>`);
                    feather.replace();
                    showlog = true;
                    writeDrawLog('信息：[' + tasktype + ']任务状态查询成功，进度：' + res.taskResponse.progress + '——' + getCurrentDateTime());
                    //更新进度条#p2
                    var progress = res.taskResponse.progress.replace("%", "");
                    $('#p2').css('width', progress + '%').attr('aria-valuenow', progress).text(Math.round(progress) + '%');
                    if (res.taskResponse.status == "SUCCESS") {
                        clearInterval(intervalId); // 关闭定时器
                        writeDrawLog('图片绘制完成——' + getCurrentDateTime());
                        //恢复按钮
                        $("#createTaskBtn").prop('disabled', false).addClass('btn-success').removeClass('btn-secondary');
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
                        }

                        $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
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
    $("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
    //发起请求
    $.ajax({
        type: "Post",
        url: "/AIdraw/CreateMJChange",
        data: {
            action: changetype,
            index: changeindex,
            taskId: taskId

        },
        success: function (res) {
            if (res.success) {
                balert('任务创建成功,详情请查看日志', 'success', false, 2000, "center");
                writeDrawLog('信息：' + changetype + '任务创建成功，TaskId：' + res.taskId + '——' + getCurrentDateTime());
                // 开始查询任务状态
                queryTaskStatus(res.taskId, changetype);
            }
            else {
                balert(res.msg, 'danger', false, 2000, "center");
                writeDrawLog('失败：' + res.msg + '——' + getCurrentDateTime());
            }
        }
    });
}

function MJinfo() {
    var content = `<p>1、请按照步骤执行绘画任务</p>
                   <p>2、图片创建完成后可以进行放大和变化</p>
                   <p>3、Midjourney 是创作绘画，不能P图</p>
                   <p>4、图片绘制完成前，请【切勿刷新页面】</p>
                   <p>5、图片绘制完成前如果刷新页面，图片将无法存入图库，费用依旧会扣除，请【切勿刷新页面】</p>`;
    showConfirmationModal("Midjourney说明", content);
}