let forumpage = 1;
let forumpagesize = 50;
let accountId = 0;
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#forum-nav").addClass('active');
    getUserInfo();
    bindMenu();
    // 点击编辑按钮时显示模态框
    $('#editUserInfoBtn').click(function () {
        // 将当前的简介和网站填入模态框
        $('#introductionInput').val($('#introduction').text());
        $('#websiteInput').val($('#website').text());
        $('#editUserInfoModal').modal('show');
    });

    // 点击保存按钮时提交表单
    $('#saveUserInfo').click(function () {
        var introduction = $('#introductionInput').val();
        var website = $('#websiteInput').val();

        $.ajax({
            url: '/Forum/UpdateUserInfo',
            type: 'POST',
            dataType: 'json',
            data: {
                introduction: introduction,
                website: website
            },
            success: function (response) {
                if (response.success) {
                    $('#introduction').text(introduction);
                    $('#website').html(`<a href="${website}">${website}</a>`);
                    $('#editUserInfoModal').modal('hide');
                } else {
                    balert('修改失败', 'danger', false, 1500, 'center')
                }
            },
            error: function () {
                balert('发生错误，请稍后再试。', 'danger', false, 1500, 'center');
            }
        });
    });
});

function getUserId() {
    var url = window.location.href;
    var match = url.match(/\/(?:Forum\/)?Personal\/(\d+)(?:\?|$)/i);
    return match ? match[1] : '';
}

function getUserInfo() {
    $.ajax({
        url: "/Forum/GetUserInfo",
        type: "post",
        dataType: "json",
        data: {
            userId: getUserId()
        },
        success: function (res) {
            if (res.success) {
                var data = res.data;
                $('#user-name').text(data.userName);
                $('#userHeadImg').attr('src', data.avatar);
                $('#introduction').text(data.introduction);
                $('#website').html(`<a href="${data.webSite}">${data.webSite}</a>`);
                $('#points').text(data.points);
                getMineInfo();
                loadTopics(forumpage);
            }
        }, error: function (err) {
            $('.tologin').show();
        }
    });
}

function getMineInfo() {
    $.ajax({
        url: "/Users/GetUserInfo", type: "post", dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                accountId = res.id;
            }
        }
    });
}

$(document).on('click', '.pagination .page-link', function (e) {
    e.preventDefault();
    var page = $(this).data('page');
    if (page && !isNaN(page) && page !== forumpage) {
        forumpage = page;
        loadTopics(forumpage);
    }
});

function loadTopics(page) {
    $.ajax({
        url: '/Forum/GetTopicList',
        type: 'POST',
        data: {
            page: page,
            size: forumpagesize,
            searchKey: $('#searchKey').val(),
            userId: getUserId()
        },
        success: function (response) {
            if (response.success) {
                var html = '';
                var data = response.data.list;
                if (data.length === 0) {
                    html = `<div class="no-content-placeholder">
                                <p>😊 暂时还没有帖子哦！快去发布第一篇吧！ 🎉</p>
                                <a href="/Forum/PublishArticle" class="btn btn-success ml-2">
                                   <i class="fas fa-edit"></i> 发布新帖
                                </a>
                            </div>`;
                } else {
                    for (var i = 0; i < data.length; i++) {
                        var istop = data[i].isTop ? `<span class="badge badge-danger"><i class="fas fa-fire-alt"></i> 置顶</span>` : '';
                        var thistags = data[i].tags;
                        var tagsArray = thistags.split(',');
                        var htmltags = tagsArray.map(function (tag) {
                            return '<span class="badge badge-pill badge-info"><i class="fas fa-tag"></i> ' + tag.trim() + '</span>';
                        }).join(' ');
                        // 渲染表情符号
                        var emojiHtml = '';
                        if (data[i].statements) {
                            var statements = Array.isArray(data[i].statements) ? data[i].statements : JSON.parse(data[i].statements);
                            statements.forEach(function (statement) {
                                var emojiObj = emojis.find(e => e.index === statement.emoji);
                                if (emojiObj) {
                                    emojiHtml += `<span class="badge badge-pill badge-light mg-b-10 mg-t-10" data-emoji="${emojiObj.emoji}">
                            ${emojiObj.emoji} <span class="count">${statement.count}</span>
                        </span>`;
                                }
                            });
                        }
                        // 检查是否是当前用户的帖子
                        var isCurrentUser = data[i].accountId === accountId;
                        var userActions = '';
                        if (isCurrentUser) {
                            userActions = `
                            <div class="user-actions">
                                <i class="fas fa-trash-alt text-danger mg-r-10 delete-post"data-id="${data[i].id}" title="删除"></i>
                                <i class="fas fa-comment-medical text-warning append-post" data-id="${data[i].id}" title="附言"></i>
                            </div>
                        `;
                            $('#editUserInfoBtn').show();
                        }

                        html += `<div class="media mb-3 post-item">
                                    <img src="${data[i].avatar}" class="userHeadImg" alt="头像">
                                    <div class="media-body">
                                        ${istop}
                                        <a href="/Forum/ReadTopic/${data[i].id}" target="_blank" class="mt-0 post-title d-block">${data[i].title}</a>
                                        <div class="post-meta">
                                            <span><i class="far fa-clock"></i> ${data[i].createTime}</span>
                                            <span><i class="far fa-comment"></i> ${data[i].commentCount}</span>
                                            <span><i class="far fa-eye"></i> ${data[i].hit}</span>
                                            <div class="emoji-container">
                                            ${emojiHtml}
                                            </div>
                                        </div>
                                        <div class="post-tag">
                                            ${htmltags}
                                        </div>
                                    </div>
                                ${userActions}
                            </div>`
                    }
                }
                $('#topicList').html(html);
                var totalPages = Math.ceil(response.data.total / forumpagesize);
                renderPagination(page, totalPages);

                // 添加删除和附言按钮的事件监听器
                $('.delete-post').on('click', function () {
                    var topicId = $(this).data('id');
                    deteleteTopic(topicId);
                });

                $('.append-post').on('click', function () {
                    var postId = $(this).data('id');
                    // 显示模态框
                    $('#appendModal').modal('show');
                    // 提交附言
                    $('#submitAppend').on('click', function () {
                        var content = $('#appendContent').val();
                        if (content.trim() === '') {
                            balert('请输入附言内容', 'warning', false, 1500, 'center');
                            return;
                        }

                        $.ajax({
                            url: '/Forum/AddTopicEndum',
                            type: 'POST',
                            data: {
                                id: postId,
                                content: content
                            },
                            success: function (response) {
                                if (response.success) {
                                    $('#appendModal').modal('hide');
                                    // 跳转到帖子页面
                                    openInNewWindow(postId);
                                } else {
                                    balert(response.msg, 'danger', false, 1500, 'center');
                                }
                            },
                            error: function () {
                                balert('添加附言请求失败', 'danger', false, 1500, 'center');
                            }
                        });
                    });

                    // 模态框关闭
                    $('#appendModal').on('hidden.bs.modal', function () {
                        $(this).hide();
                    });
                });
            } else {
                console.error('Failed to load topics:', response.msg);
            }
        },
        error: function (xhr, status, error) {
            console.error('Ajax request failed:', error);
        }
    });
}

function renderPagination(currentPage, totalPages) {
    var $pagination = $('.pagination');
    $pagination.empty();

    // 添加"上一页"按钮
    $pagination.append(
        `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>
        </li>`
    );

    var startPage = Math.max(1, currentPage - 2);
    var endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        $pagination.append('<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>');
        if (startPage > 2) {
            $pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
    }

    for (var i = startPage; i <= endPage; i++) {
        $pagination.append(
            `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>`
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            $pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
        $pagination.append(`<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`);
    }

    // 添加"下一页"按钮
    $pagination.append(
        `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>
        </li>`
    );
}

function deteleteTopic(topicId) {
    showConfirmationModal("提示", "确定删除这篇主题吗？", function () {
        $.ajax({
            url: '/Forum/DeleteTopic',
            method: 'post',
            dataType: 'json',
            data: {
                id: topicId
            },
            success: function (response) {
                if (response.success) {
                    balert('删除成功', 'success', false, 1500, 'center');
                    loadTopics(forumpage);
                } else {
                    balert('删除失败，请稍后再试', 'danger', false, 1500, 'center')
                }
            },
            error: function (xhr, status, error) {
                balert('网络错误或服务器错误：' + error, 'warning', false, 1500, 'top')
            }
        });
    });
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
