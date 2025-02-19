let bookimg = ""
let bookimgthumbnails = ""
var bookCode = ""
let currentPage = 1;
let pageSize = 15;
let totalChapters = 0;
let isLoading = false;
let keyword = '';
var thisChapter = 0;
let desc = false;
let autoSaveInterval = null;
let lastEditorContent = '';
let lastChapterTitle = '';
let saveInterval = 10; // 每10秒执行一次
let saveTimer = saveInterval;
var editor = document.getElementById("editor");
var $editor = $('#editor');
var quoteButton = $('#quoteButton');
var chapterBigTitle = document.getElementById("chapterBigTitle");
var overlay = document.getElementById("overlay");

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#aibook-nav").addClass('active');
    bookCode = getUrlParam("code");
    //如果没有code则跳转首页
    if (!bookCode) {
        window.location.href = "/AiBook/Index";
    }
    if (thisChapter == 0) {
        editor.disabled = true;

        // 显示蒙板
        overlay.style.display = "flex";
    }
    getBookInfo();
    loadChapters(currentPage, keyword, desc);
    getAIModelList();
    $editor.on('mouseup', function (event) {
        const selectedText = $editor[0].value.substring($editor[0].selectionStart, $editor[0].selectionEnd);
        if (selectedText) {
            quoteButton.css({
                display: 'block',
                top: event.clientY - 50,
                left: event.clientX - 700
            });

            // Adjust position if button goes out of viewport
            const viewportWidth = $(window).width();
            const viewportHeight = $(window).height();

            if (event.clientX + quoteButton.outerWidth() > viewportWidth) {
                quoteButton.css('left', event.clientX - quoteButton.outerWidth() - 5);
            }
            if (event.clientY + quoteButton.outerHeight() > viewportHeight) {
                quoteButton.css('top', event.clientY - quoteButton.outerHeight() - 5);
            }
        } else {
            quoteButton.hide();
        }
    });

    $(document).on('mousedown', function (event) {
        if (!$(event.target).closest('#editor, #quoteButton').length) {
            quoteButton.hide();
        }
    });

    quoteButton.on('click', function () {
        const selectedText = $editor[0].value.substring($editor[0].selectionStart, $editor[0].selectionEnd);
        if (selectedText) {
            const quotedText = `> ${selectedText}\n\n`;
            const startPos = $editor.prop('selectionStart');
            const endPos = $editor.prop('selectionEnd');

            //$editor.val(
            //    $editor.val().substring(0, startPos) +
            //    quotedText +
            //    $editor.val().substring(endPos)
            //);

            $("#chatInput").val(`**引用片段:** \n${selectedText}\n--------------------------------\n\n`);
            adjustInputHeight($("#chatInput"));
            $editor.prop({
                selectionStart: startPos + quotedText.length,
                selectionEnd: startPos + quotedText.length
            });

            quoteButton.hide();
            $editor.focus();
        }
    });
})

// 二级分类数据
const categories = {
    "男生": [
        "东方玄幻",
        "异世大陆",
        "西方奇幻",
        "史诗奇幻",
        "黑暗奇幻",
        "蒸汽朋克",
        "废土朋克",
        "传统武侠",
        "新派武侠",
        "国术",
        "古典仙侠",
        "仙侠幻想",
        "都市生活",
        "都市娱乐",
        "都市异能",
        "现实百态",
        "人间烟火",
        "军旅生涯",
        "抗战烽火",
        "谍战风云",
        "架空历史",
        "两宋元明",
        "秦汉三国",
        "虚拟网游",
        "电子竞技",
        "体育竞技",
        "篮球运动",
        "足球运动",
        "硬科幻",
        "星际文明",
        "进化变异",
        "末世危机",
        "灵异神怪",
        "推理探案",
        "悬疑惊悚",
        "日系轻小说",
        "搞笑轻小说",
        "衍生同人",
        "原作同人"
    ],
    "女生": [
        "古代言情",
        "宫闱宅斗",
        "经商种田",
        "女尊王朝",
        "现代言情",
        "豪门总裁",
        "娱乐明星",
        "婚恋职场",
        "青春校园",
        "纯爱",
        "现代纯爱",
        "古代纯爱",
        "玄幻奇幻",
        "东方玄幻",
        "西方奇幻",
        "科幻",
        "星际科幻",
        "末世科幻",
        "悬疑",
        "推理悬疑",
        "灵异悬疑",
        "仙侠",
        "修真仙侠",
        "幻想仙侠",
        "游戏竞技",
        "电子竞技",
        "虚拟网游",
        "现实",
        "人间百态",
        "家庭生活",
        "轻小说",
        "日系轻小说",
        "少女漫风",
        "同人",
        "动漫同人",
        "影视同人"
    ]
};


// 初始化二级分类
updateCategory2();

// 一级分类改变事件
$("#category1").change(function () {
    updateCategory2();
});

// 更新二级分类选项
function updateCategory2() {
    const category1 = $("#category1").val();
    const category2Options = categories[category1];
    $("#category2").empty();
    category2Options.forEach(option => {
        $("#category2").append(`<option value="${option}">${option}</option>`);
    });
}
// 图片预览
$("#bookCover").change(function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            $("#coverPreview").attr("src", e.target.result);
        }
        reader.readAsDataURL(file);
        var formData = new FormData();
        formData.append('file', file);
        $.ajax({
            url: '/AiBook/UploadBookImg',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                if (res.success) {
                    bookimg = res.filePath.replace('wwwroot', '');
                    bookimgthumbnails = res.thumbnailFilePath.replace('wwwroot', '');
                }
                else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
});

// 标签处理
let tags = [];
$("#bookTag").keypress(function (e) {
    if (e.which === 13) { // Enter key
        e.preventDefault();
        let tag = $("#bookTag").val().trim();
        if (tag && tags.length < 3 && !tags.includes(tag)) {
            tags.push(tag);
            renderTags();
            $("#bookTag").val("");
        }
    }
});
// 渲染标签
function renderTags() {
    $("#selectedTags").empty();
    tags.forEach((tag, index) => {
        $("#selectedTags").append(`
                <span class="badge badge-success">${tag} <span class="remove-tag" data-index="${index}">&times;</span></span>
            `);
    });

    // 移除标签
    $(".remove-tag").click(function () {
        const index = $(this).data("index");
        tags.splice(index, 1);
        renderTags();
    });
}

function getBookInfo() {
    $.ajax({
        url: '/AiBook/GetBookInfo',
        type: 'post',
        dataType: 'json',
        data: {
            bookCode: bookCode
        },
        success: function (res) {
            if (res.success) {
                $("#bookName").val(res.data.bookName);
                bookimg = res.data.bookImg;
                bookimgthumbnails = res.data.bookThumbnail;
                $("#coverPreview").attr("src", bookimgthumbnails);
                $("#bookRemark").val(res.data.bookRemark);
                $("#wordCount").text(res.data.bookWordCount);
                tags = res.data.bookTag.split(",");
                renderTags();
                $("#category1").val(res.data.bookType.split(",")[0]);
                $("#category2").val(res.data.bookType.split(",")[1]);
            }
        }
    })
}

$(".saveBookBtn").on("click", function (e) {
    e.preventDefault();

    // 获取是否公开的值
    let bookName = $("#bookName").val().trim();
    if (!bookName) {
        balert('请输入书籍名称', 'warning', false, 1500, 'center');
        return;
    }
    let bookRemark = $("#bookRemark").val().trim();
    if (!bookRemark) {
        balert('请输入书籍简介', 'warning', false, 1500, 'center');
        return;
    }
    let bookType = `${$("#category1").val()},${$("#category2").val()}`;
    // 添加你的表单提交逻辑，例如使用FormData发送数据
    var formData = new FormData();
    formData.append("bookCode", bookCode);
    formData.append("bookTag", tags.join(","));
    formData.append("bookimg", bookimg);
    formData.append("bookimgthumbnails", bookimgthumbnails);
    formData.append("bookName", bookName);
    formData.append("bookType", bookType);
    formData.append("bookRemark", bookRemark);
    loadingBtn('.saveBookBtn');
    $.ajax({
        url: "/AiBook/UpdateBookInfo",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: function (res) {
            unloadingBtn('.saveBookBtn');
            balert(res.msg, res.success ? 'success' : 'danger', false, 1500, 'center');
        },
        error: function (error) {
            unloadingBtn('.saveBookBtn');
            balert('提交失败' + error, 'danger', false, 3000, 'center');
        }
    });
});

// 滚动事件监听
$("#chapterList").on('scroll', function () {
    if ($("#chapterList").scrollTop() + $("#chapterList").height() >= $("#chapterList").height() - 100 && !isLoading) {
        if (currentPage * pageSize < totalChapters) {
            currentPage++;
            loadChapters(currentPage, keyword, desc);
        }
    }
});


// 搜索功能
$('#searchButton').click(function () {
    keyword = $('#searchInput').val();
    currentPage = 1;
    $('#chapterList').empty();
    loadChapters(currentPage, keyword, desc);
});

$('#searchInput').keypress(function (event) {
    if (event.keyCode == 13) {
        keyword = $('#searchInput').val();
        currentPage = 1;
        $('#chapterList').empty();
        loadChapters(currentPage, keyword, desc);
    }
});

function loadChapters(page, keyword, desc) {
    isLoading = true;
    if (page === 1) {
        $('#chapterList').html('<i class="fas fa-spinner fa-spin"></i> 加载中...');
    } else {
        $('#chapterList').append('<div class="loading-more text-center"><i class="fas fa-spinner fa-spin"></i> 加载更多...</div>');
    }

    $.ajax({
        url: '/AiBook/GetChapterList',
        type: 'POST',
        dataType: 'json',
        data: {
            keyword: keyword,
            bookCode: bookCode,
            page: page,
            pageSize: pageSize,
            desc: desc
        },
        success: function (response) {
            if (response.success) {
                totalChapters = response.total;
                if (page === 1) {
                    $('#chapterList').empty();
                } else {
                    $('#chapterList .loading-more').remove();
                }

                if (response.data.length === 0 && page === 1) {
                    $('#chapterList').html(`<div class="text-center"><p>没有任何章节信息<br />点击创建章节按钮开始创作吧🤗</p>
                        <img src = "/system/images/nothing.png" /></div>`);
                } else {
                    renderChapters(response.data);
                }

                isLoading = false;
            } else {
                $('#chapterList').html('<div class="text-center">加载失败</div>');
                isLoading = false;
            }
        },
        error: function () {
            $('#chapterList').html('<div class="text-center">加载失败</div>');
            isLoading = false;
        }
    });
}

function renderChapters(chapters) {
    $.each(chapters, function (index, chapter) {
        $('#chapterList').append(`
                <div class="chapter-item" id="chapter-${chapter.id}">
                    <div class="chapter-content" onclick="getChapterContent(${chapter.id})">
                        <div class="chapter-title">${chapter.chapterTitle}</div>
                        <div class="chapter-wordcount">${chapter.wordCount}字</div>
                    </div>
                    <div class="chapter-delete" onclick="deleteChapter(${chapter.id})"><i class="far fa-trash-alt"></i></div>
                </div>
            `);
    });
}


// 新建章节功能
$(document).on('click', '.newbtn', function () {
    // 弹出模态框
    $('body').append(`
            <div class="modal fade" id="newChapterModal" tabindex="-1" role="dialog" aria-labelledby="newChapterModalLabel" aria-hidden="true">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="newChapterModalLabel">新建章节</h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <input type="text" id="newChapterTitle" class="form-control" placeholder="请输入章节名">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="createChapterBtn">创建</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    $('#newChapterModal').modal('show');

    // 创建章节按钮点击事件
    $('#createChapterBtn').click(function () {
        let newChapterTitle = $('#newChapterTitle').val();
        if (newChapterTitle.trim() === '') {
            balert('请输入章节名', 'warning', false, 1500, 'top');
            return;
        }
        loadingBtn('#createChapterBtn');
        // 发送请求创建章节
        $.ajax({
            url: '/AiBook/CreateChapter',
            type: 'POST',
            data: {
                title: newChapterTitle,
                bookCode: bookCode
            },
            success: function (response) {
                unloadingBtn('#createChapterBtn');
                if (response.success) {
                    // 关闭模态框
                    $('#newChapterModal').modal('hide');
                    $('#newChapterModal').remove();
                    $('.modal-backdrop').remove();
                    $('body').removeClass('modal-open');
                    // 重新加载章节列表
                    currentPage = 1;
                    $('#chapterList').empty();
                    loadChapters(currentPage, keyword, desc);
                    balert('章节创建成功', 'success', false, 1500, 'center');
                    thisChapter = response.id;
                    getChapterContent(thisChapter);
                } else {
                    balert('章节创建失败: ' + response.message, 'danger', false, 1500, 'center');
                }
            },
            error: function () {
                unloadingBtn('#createChapterBtn');
                balert('章节创建失败', 'danger', false, 1500, 'center');
            }
        });
    });
    //模态框消失后移除
    $('#newChapterModal').on('hidden.bs.modal', function () {
        $('#newChapterModal').remove();
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
    });
});

function loadOrderBy() {
    currentPage = 1;
    if (!desc) {
        $('#orderBy').html('<i class="fas fa-sort-amount-down"></i> 倒序');
        desc = true;
        loadChapters(currentPage, keyword, desc);
    } else {
        $('#orderBy').html('<i class="fas fa-sort-amount-up"></i> 顺序');
        desc = false;
        loadChapters(currentPage, keyword, desc);
    }
}
function deleteChapter(chapterId) {
    //防止冒泡
    event.stopPropagation();
    showConfirmationModal("提示", `确定要<b style="color:red;">删除</b>此章节吗？ `, function () {
        loadingOverlay.show();
        $.ajax({
            url: '/AiBook/DeleteChapter',
            type: 'POST',
            data: {
                id: chapterId
            },
            success: function (response) {
                loadingOverlay.hide();
                if (response.success) {
                    loadChapters(currentPage, keyword, desc);
                } else {
                    balert('删除失败' + response.msg, 'danger', false, 1500, 'center');
                }
            },
            error: function () {
                loadingOverlay.hide();
            }
        });
    });
}

function getChapterContent(chapterId) {
    loadingOverlay.show();
    $.ajax({
        url: '/AiBook/GetChapterInfo',
        type: 'POST',
        dataType: 'json',
        data: {
            id: chapterId,
            bookCode: bookCode
        },
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                $('.chapter-item').removeClass('active');
                $('#chapter-' + chapterId).addClass('active');
                chapterBigTitle.value = response.data.chapterTitle;
                thisChapter = chapterId;
                editor.disabled = false;
                overlay.style.display = "none";
                editor.value = response.data.chapterBody;
                startAutoSave();
            }
        },
        error: function () {
            loadingOverlay.hide();
        }
    })
}
function checkForChanges() {
    const editorContent = editor.value; // 获取编辑器内容
    const chapterTitle = chapterBigTitle.value; // 获取章节标题

    // 检查内容是否发生变化
    if (editorContent !== lastEditorContent || chapterTitle !== lastChapterTitle) {
        lastEditorContent = editorContent;
        lastChapterTitle = chapterTitle;

        // 调用后端API保存数据
        saveChapterInfo(thisChapter, chapterTitle, editorContent);
    }
}
function saveChapterInfo(id, title, body) {
    const wordCount = body.trim().length; // 计算字数

    $.ajax({
        url: '/AiBook/UpdateChapterInfo',
        type: 'POST',
        dataType: 'json',
        data: { id, title, body, wordCount },
        success: function (data) {
            if (data.success) {
                // 显示保存成功提示
                document.querySelector('.saveInfo').innerText = '保存成功！';
                lastChapterTitle = title;
                lastEditorContent = body;
                $('#chapter-' + id + ' .chapter-wordcount').text(wordCount + '字');
                $('#chapter-' + id + ' .chapter-title').text(title);
            } else {
                // 显示保存失败提示
                document.querySelector('.saveInfo').innerText = '保存失败：' + data.msg;
            }
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.error('Error:', textStatus, errorThrown);
            document.querySelector('.saveInfo').innerText = '保存失败：网络错误';
        }
    });
}

function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }

    autoSaveInterval = setInterval(() => {
        checkForChanges();
        saveTimer--;

        // 更新倒计时
        document.querySelector('.saveInfo').innerText = `下次保存还有 ${saveTimer} 秒`;

        if (saveTimer <= 0) {
            saveTimer = saveInterval; // 重置倒计时
        }
    }, 1000);
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
        document.querySelector('.saveInfo').innerText = '自动保存已停止';
    }
}
