let forumpage = 1;
let forumpagesize = 50;
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#forum-nav").addClass('active');
    IsLogin();
});

document.addEventListener('DOMContentLoaded', function () {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const customSidebar = document.getElementById('customSidebar');
    const body = document.body;

    sidebarToggle.addEventListener('click', function (e) {
        e.preventDefault();
        toggleSidebar();
    });

    function toggleSidebar() {
        customSidebar.classList.toggle('open');
        if (customSidebar.classList.contains('open')) {
            createOverlay();
        } else {
            removeOverlay();
        }
    }

    function createOverlay() {
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.classList.add('sidebar-overlay');
            body.appendChild(overlay);
            setTimeout(() => overlay.style.display = 'block', 0);
            overlay.addEventListener('click', toggleSidebar);
        }
    }

    function removeOverlay() {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            setTimeout(() => overlay.remove(), 300);
        }
    }

    // 在大屏幕上总是显示侧边栏
    function checkScreenSize() {
        if (window.innerWidth >= 992) {
            customSidebar.classList.add('open');
            removeOverlay();
        } else {
            customSidebar.classList.remove('open');
        }
    }

    window.addEventListener('resize', checkScreenSize);
    checkScreenSize();// 初始化
});


$(document).ready(function () {
    loadTopics(forumpage);

    $(document).on('click', '.pagination .page-link', function (e) {
        e.preventDefault();
        var page = $(this).data('page');
        if (page && !isNaN(page) && page !== forumpage) {
            forumpage = page;
            loadTopics(forumpage);
        }
    });

    // 点击laugh按钮显示表情选择框
    $(document).on('click', '.laugh-btn', function (e) {
        e.stopPropagation();

        var $btn = $(this);
        var $selector = $('#emoji-selector');
        var windowWidth = $(window).width();
        var selectorWidth = Math.min(300, windowWidth * 0.8); // 根据屏幕宽度调整选择框宽度

        var pos = $btn.offset();
        var btnWidth = $btn.outerWidth();
        var btnHeight = $btn.outerHeight();

        var left = '50%';
        var top = pos.top + btnHeight - 80;

        // 确保选择框不会超出屏幕左右边界
        left = Math.max(10, Math.min(left, windowWidth - selectorWidth - 10));
        
        $selector.css({
            position: 'absolute', // 使用 absolute 定位
            top: top + 'px',
            //left: left,
            left: '25%',
            width: selectorWidth + 'px'
        }).toggle();

        // 存储当前激活的按钮
        $selector.data('activeBtn', $btn);
    });

    // 点击表情
    $(document).on('click', '.emoji', function () {
        var emoji = $(this).text();
        var index = $(this).data('index');
        var $activeBtn = $('#emoji-selector').data('activeBtn');
        var $container = $activeBtn.siblings('.emoji-container');

        var topicId = $activeBtn.attr('id').split('-').pop();

        var $existingEmoji = $container.find('[data-emoji="' + emoji + '"]');
        var oldCount = 0;
        var newElement = false;
        var updatedCount = 0;

        if ($existingEmoji.length) {
            oldCount = parseInt($existingEmoji.find('.count').text());
            updatedCount = oldCount + 1;
            $existingEmoji.find('.count').text(updatedCount);
        } else {
            newElement = true;
            updatedCount = 1;
            $container.append('<span class="badge badge-pill badge-light mg-b-10 mg-t-10" data-emoji="' + emoji + '">' + emoji + ' <span class="count">1</span></span>');
        }

        // 发送AJAX请求
        $.ajax({
            url: '/Forum/SubmissionStatements',
            method: 'POST',
            data: {
                topicId: topicId,
                index: index
            },
            success: function (response) {
                if (!response.success) {
                    balert(response.msg, "warning", false, 1500, "center");
                    if (newElement) {
                        // 如果是新添加的元素，直接移除
                        $container.find('[data-emoji="' + emoji + '"]').remove();
                    } else if ($existingEmoji.length) {
                        // 如果是已存在的元素，将计数恢复
                        $existingEmoji.find('.count').text(oldCount);
                    }
                }
            },
            error: function (xhr, status, error) {
                console.error('表情发送失败', error);

                // 发送失败时，回滚UI更改
                if (newElement) {
                    // 如果是新添加的元素，直接移除
                    $container.find('[data-emoji="' + emoji + '"]').remove();
                } else if ($existingEmoji.length) {
                    // 如果是已存在的元素，将计数恢复
                    $existingEmoji.find('.count').text(oldCount);
                }

                // 错误提示
                balert("表情发送失败: " + error, "danger", false, 2000, "center");
            }
        });

        $('#emoji-selector').hide();
    });


    // 点击空白处或滚动时隐藏表情选择框
    $(document).on('click scroll', function () {
        $('#emoji-selector').hide();
    });

    // 窗口大小改变时重新计算位置
    $(window).on('resize', function () {
        if ($('#emoji-selector').is(':visible')) {
            $('#emoji-selector').data('activeBtn').click();
        }
    });

});

function IsLogin() {
    debugger;
    $.ajax({
        url: "/Users/IsLogin", type: "post", dataType: "json",//返回对象
        success: function (res) {
            if (!res.success) {
                $('.tologin').show();
            } else {
                $('.user-info').show();
                $('.user-msg').show();
                getUserInfo();
            }
        }, error: function (err) {
            $('.tologin').show();
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

$('#searchKey').focus(function () {
    $(this).keypress(function (event) {
        if (event.which === 13) {
            event.preventDefault();
            $('#topicList').html(` <div id="loading" style="text-align: center;">
                                      <div class="spinner"></div>
                                   </div>`);
            loadTopics(forumpage);
        }
    });
}).blur(function () {
    $(this).off('keypress');
});

function loadTopics(page) {
    $.ajax({
        url: '/Forum/GetTopicList',
        type: 'POST',
        data: {
            page: page,
            size: forumpagesize,
            searchKey: $('#searchKey').val()
        },
        success: function (response) {
            if (response.success) {
                var html = '';
                var data = response.data.list;
                if (data.length === 0) {
                    html = `<div class="no-content-placeholder">
                                <p>😊 暂时还没有帖子哦！快去发布第一篇吧！ 🎉</p>
                            </div>`;
                } else {
                    for (var i = 0; i < data.length; i++) {
                        var istop = data[i].isTop ? `<span class="badge badge-danger"><i class="fas fa-fire-alt InTop"></i> 置顶</span>` : '';
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
                        html += `<div class="media mb-3 post-item" data-id="${data[i].id}" data-is-top="${data[i].isTop}">
                                <img src="${data[i].avatar}" class="userHeadImg" alt="头像">
                                <div class="media-body">
                                    ${istop}
                                    <a href="/Forum/ReadTopic/${data[i].id}" target="_blank" class="mt-0 post-title d-block">${data[i].title}</a>
                                    <div class="post-meta">
                                        <a href="/Forum/Personal/${data[i].accountId}"><span><i class="far fa-user"></i> ${data[i].author}</span></a>
                                        <span><i class="far fa-clock"></i> ${data[i].createTime}</span>
                                        <span><i class="far fa-comment"></i> ${data[i].commentCount}</span>
                                        <span><i class="far fa-eye"></i> ${data[i].hit}</span>
                                        <a href="javascript:void(0)" class="laugh-btn" id="laugh-btn-${data[i].id}">
                                            <span><i class="far fa-laugh"></i> 表态</span>
                                        </a>
                                        <div class="emoji-container">
                                        ${emojiHtml}
                                        </div>
                                    </div>
                                    <div class="post-tag">
                                        ${htmltags}
                                    </div>
                                </div>
                            </div>`
                    }
                }
                $('#topicList').html(html);
                var totalPages = Math.ceil(response.data.total / forumpagesize);
                renderPagination(page, totalPages);
                // 检查管理员权限并添加操作按钮
                checkAdminAndAddActions();
            } else {
                console.error('Failed to load topics:', response.msg);
            }
        },
        error: function (xhr, status, error) {
            console.error('Ajax request failed:', error);
        }
    });
}

function checkAdminAndAddActions() {
    $.ajax({
        url: "/Users/IsAdmin",
        type: "post",
        dataType: "json",
        success: function (res) {
            if (res.success) {
                $('.post-item').each(function () {
                    var $post = $(this);
                    var postId = $post.data('id');
                    var isTop = $post.data('is-top');

                    var topButtonClass = isTop ? 'cancel-top' : 'to-top';
                    var topButtonIcon = isTop ? 'fa-arrow-down' : 'fa-arrow-up';
                    var topButtonTitle = isTop ? '取消置顶' : '置顶';
                    var topButtonColor = isTop ? 'text-success' : 'text-warning';

                    var userActions = `<div class="user-actions">
                        <i class="fas fa-trash-alt text-danger mg-r-10 delete-post" data-id="${postId}" title="删除"></i>
                        <i class="fas ${topButtonIcon} ${topButtonColor} mg-r-10 ${topButtonClass}" data-id="${postId}" data-is-top="${isTop}" title="${topButtonTitle}"></i>
                    </div>`;

                    $post.append(userActions);
                });

                // 添加点击事件
                $('.delete-post').click(function () {
                    var postId = $(this).data('id');
                    deteleteTopic(postId);
                });

                $('.to-top, .cancel-top').click(function () {
                    var postId = $(this).data('id');
                    var isCurrentlyTop = $(this).data('is-top');
                    toggleTopStatus(postId, isCurrentlyTop);
                });
            }
        },
        error: function (res) {
            console.error('Failed to check admin status:', res);
        }
    });
}

function deteleteTopic(topicId) {
    showConfirmationModal("提示", "确定删除这篇主题吗？", function () {
        $.ajax({
            url: '/Forum/DeleteTopicAdmin',
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

function toggleTopStatus(postId, isCurrentlyTop) {
    var action = isCurrentlyTop ? '取消置顶' : '置顶';
    var url = isCurrentlyTop ? '/Forum/CancelTopicAdmin' : '/Forum/TopTopicAdmin';

    showConfirmationModal("提示", `确定要${action}这篇主题吗？`, function () {
        $.ajax({
            url: url,
            method: 'post',
            dataType: 'json',
            data: {
                id: postId
            },
            success: function (response) {
                if (response.success) {
                    balert(`${action}成功`, 'success', false, 1500, 'center');
                    loadTopics(forumpage);
                } else {
                    balert(`${action}失败，请稍后再试`, 'danger', false, 1500, 'center');
                }
            },
            error: function (xhr, status, error) {
                if (xhr.status === 403) {
                    balert('没有权限执行此操作', 'warning', false, 1500, 'top');
                } else {
                    balert('网络错误或服务器错误：' + error, 'warning', false, 1500, 'top');
                }
            }
        });
    });
}

function getUserInfo() {
    $.ajax({
        url: "/Forum/GetUserInfo", type: "post", dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                var data = res.data;
                $('#user-name').text(data.userName);
                $('#user-name').attr('href', '/Forum/Personal/' + data.id);
                $('#userHeadImg').attr('src', data.avatar);
                $('#introduction').text(data.introduction);
                $('#website').html(`<a href="${data.webSite}">${data.webSite}</a>`);
                $('#points').text(data.points);
                if (data.unReadNotifitions > 0) {
                    $('.user-msg').css('color', '#ffaa06');
                }
                $('#unreadmsg').text(data.unReadNotifitions);
            }
        }, error: function (err) {
            $('.tologin').show();
        }
    });
}