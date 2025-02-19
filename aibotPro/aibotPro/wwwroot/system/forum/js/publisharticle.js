$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#forum-nav").addClass('active');
    bindMenu();
});
var tags = [];
// 定义保存键名
const STORAGE_KEY = 'postDraft';

// 从 localStorage 恢复数据
function restoreFormData() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        const data = JSON.parse(savedData);
        $('#title').val(data.title);
        easyMDE.value(data.content);
        tags = data.tags;
        updateTags();
        $('#inviteAI').prop('checked', data.inviteAI);
    }
}


// 页面加载时恢复数据
restoreFormData();

// 设置自动保存定时器 (每30秒保存一次)
setInterval(saveFormData, 30000);

// 监听表单变化,立即保存
$('#title, #tags, #inviteAI').on('change', saveFormData);
easyMDE.codemirror.on('change', saveFormData);
// 保存数据到 localStorage
function saveFormData() {
    const data = {
        title: $('#title').val(),
        content: easyMDE.value(),
        tags: tags,
        inviteAI: $('#inviteAI').is(':checked')
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// 监听全屏按钮
$('.fa-arrows-alt').parent().on('click', function () {
    setTimeout(function () {
        if ($('.CodeMirror-fullscreen').length) {
            updatePureMode(true);
        } else {
            updatePureMode(false);
        }
    }, 100);
});

// 监听并排预览按钮
$('.fa-columns').parent().on('click', function () {
    setTimeout(function () {
        if ($('.CodeMirror-sided').length) {
            updatePureMode(true);
        } else {
            updatePureMode(false);
        }
    }, 100);
});
function uploadIMGFile(file, destroyAlert) {
    if (!file.type.startsWith('image/')) {
        destroyAlert();
        balert("请选择图片文件", "warning", false, 2000, "center");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        destroyAlert();
        balert("图片文件大小不能超过5M", "warning", false, 2000, "center");
        return;
    }

    var formData = new FormData();
    formData.append("file", file);
    feather.replace();

    $.ajax({
        url: "/Home/SaveImg",
        type: "post",
        data: formData,
        contentType: false,
        processData: false,
        success: function (res) {
            destroyAlert();
            if (res.success) {
                balert("上传成功", "success", false, 800, "center");
                var imageUrl = res.data;
                var cm = easyMDE.codemirror;
                var output = '![image](' + imageUrl + ')';
                cm.replaceSelection(output);
            } else {
                balert("上传失败", "danger", false, 800, "center");
            }
        },
        error: function (e) {
            console.log("失败" + e);
            balert("上传失败", "danger", false, 800, "center");
        }
    });
}
// 标签功能
$('#tags').on('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        var tag = $(this).val().trim();
        if (tag && !tags.includes(tag)) {
            if (tags.length >= 5) {
                balert("最多只能添加5个标签", "warning", false, 800, "center");
                return;
            }
            tags.push(tag);
            updateTags();
        }
        $(this).val('');
    }
});

function updateTags() {
    $('#tagContainer').empty();
    tags.forEach(function (tag) {
        $('#tagContainer').append('<span class="badge badge-info mr-2">' + tag +
            ' <i class="fas fa-times remove-tag" data-tag="' + tag + '"></i></span>');
    });
    saveFormData();
}

$(document).on('click', '.remove-tag', function () {
    var tagToRemove = $(this).data('tag');
    tags = tags.filter(tag => tag != tagToRemove);
    updateTags();
});

// 发帖
$('#submitPost').on('click', function () {
    var title = $('#title').val();
    var content = easyMDE.value();
    var tagsString = tags.join(',');
    var inviteAI = $('#inviteAI').prop('checked');

    if (!title || !content || !tagsString) {
        balert('请填写所有必填项！', 'warning', false, 1500, 'center');
        return;
    }
    loadingBtn('#submitPost');
    $.ajax({
        url: '/Forum/PostTopic',
        method: 'POST',
        dataType: 'json',
        data: {
            title: title,
            content: content,
            tags: tagsString,
            inviteAI: inviteAI
        },
        success: function (response) {
            if (response.success) {
                balert('发布成功！', 'success', false, 1500, 'center');
                // 发布成功后清除草稿
                easyMDE.value('');
                $('#title').val('');
                $('#tags').val('');
                tags = [];
                $('#inviteAI').prop('checked', false);
                localStorage.removeItem(STORAGE_KEY);
                unloadingBtn('#submitPost');
                // 跳转到帖子详情页
                openInNewWindow(response.data);
            } else {
                balert('发布失败：' + response.msg, 'danger', false, 1500, 'center', unloadingBtn('#submitPost'));
            }
        },
        error: function (xhr, status, error) {
            balert('发布失败：' + error, 'danger', false, 1500, 'center', unloadingBtn('#submitPost'));
        }
    });
});

function updatePureMode(isPure, reload = false) {
    var body = $('body');
    var sidebar = document.querySelector('.sidebar');
    var header = document.querySelector('.header');
    var content = document.querySelector('.content');
    var customSidebar = document.querySelector('#customSidebar');
    if (isPure) {
        header.style.display = 'none';
        $('#dkbtn').show();
        if (!isMobile()) {
            body.addClass('pure-mode');
            sidebar.style.display = 'none';
            content.style.padding = '0';
            content.style.margin = '0';
            if (body.hasClass('sidebar-open')) {
                // 当前是展开状态，需要缩回
                body.removeClass('sidebar-open');
                body.addClass('sidebar-closed');
            }
            customSidebar.style.display = 'none';
        }

    }
    else {
        header.style.display = '';
        if (!isMobile()) {
            body.removeClass('pure-mode');
            sidebar.style.display = '';
            content.style.marginLeft = '240px';
            if (body.hasClass('sidebar-open') && reload) {
                // 当前是展开状态，需要缩回
                body.removeClass('sidebar-open');
                body.addClass('sidebar-closed');
            } else {
                // 当前是缩回状态，需要展开
                body.removeClass('sidebar-closed');
                body.addClass('sidebar-open');
            }
            customSidebar.style.display = '';
        }
    }
    feather.replace();
}

function openInNewWindow(postId) {
    var link = document.createElement('a');
    link.href = '/Forum/ReadTopic/' + postId;
    link.target = '_blank';
    link.rel = 'noopener noreferrer'; // 为安全起见
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function bindMenu() {
    $('.nav-sidebar .with-sub').on('click', function (e) {
        e.preventDefault();

        var $this = $(this);
        var $parentLi = $this.parent();
        var $subMenu = $parentLi.find('.nav-sub');
        var wasVisible = $subMenu.is(':visible');

        // 处理当前点击的子菜单
        if (!wasVisible) {
            // 如果子菜单之前不可见（收起状态），则把它展开
            $subMenu.stop(true, true).slideDown(300, function () {
                $parentLi.addClass('show');
            });
        } else {
            // 如果子菜单之前可见（展开状态），则把它收起
            $subMenu.stop(true, true).slideUp(300, function () {
                $parentLi.removeClass('show');
            });
        }
    });
}