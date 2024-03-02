var d3imgsize = '1024x1024';
var quality = 'standard';
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#dall-nav").addClass('active');
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

    $('#createTaskBtn').click(function () {
        var prompt = $('#inputText').val().trim();
        if (prompt != "") {
            //禁用按钮
            $("#createTaskBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-success');
            //发起请求
            $("#resview").show();
            $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
            balert('任务创建成功', 'success', false, 1000, "center");
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
                        $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
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
                        balert('任务创建失败', 'danger', false, 1000, "center");
                    }
                },
                error: function (xhr, status, error) {
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
                   <p>3、图片绘制完成前如果刷新页面，图片将无法存入图库，费用依旧会扣除，请【切勿刷新页面】</p>
                   <p>4、DALL-E3绘画，对于自然语言理解能力很强</p>
                   <p>5、DALL-E3 源于OpenAI</p>`;
    showConfirmationModal("DALL·E3说明", content);
}