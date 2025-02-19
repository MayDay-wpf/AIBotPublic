let articleId = 0;
let topicId = 0;
var md = window.markdownit({
    breaks: true
});
let currentPage = 1;
let repliesPerPage = 20;
let totalReplies = 0;
let replyId = 0;
let replyUsername = '';

$(document).ready(function () {
    let savedScrollPosition = localStorage.getItem('sidebarScrollPosition');
    if (savedScrollPosition) {
        $('#dpSidebarBody').scrollTop(savedScrollPosition);
    }
    // 添加AJAX预过滤器，用于在每个请求中自动添加JWT token
    $.ajaxPrefilter(function (options, originalOptions, xhr) {
        var token = localStorage.getItem('aibotpro_userToken');
        if (token) {
            // 添加 Authorization 头部，携带JWT token
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            //token写入cookie
            Cookies.set('token', token, { expires: 30 });
        } else {
            window.location.herf = "/Home/Welcome"
        }
    });
    IsLogin();
    getTopicById();
    var notifId = getUrlParameter('n');
    if (notifId) {
        readNotification(notifId);
    }
    // 回复和感谢按钮点击事件
    $('#replies').on('click', '.reply-btn, .thank-btn', function (e) {
        const newReplyId = $(this).data('id');
        const newReplyUsername = $(this).data('username');
        if (replyId !== newReplyId) {
            replyId = newReplyId;
            replyUsername = newReplyUsername;
            updateReplyTag();
        }
        easyMDE.codemirror.focus();
        setTimeout(function () {
            window.scrollTo(0, document.body.scrollHeight);
        }, 100);

    });
    function updateReplyTag() {
        const existingTag = $('.reply-tag');
        if (existingTag.length) {
            existingTag.html(`@${replyUsername} <a href="#" class="remove-tag">&times;</a>`);
        } else {
            const replyTag = $(`<span class="reply-tag">@${replyUsername} <a href="#" class="remove-tag">&times;</a></span>`);
            $('#editor').before(replyTag);
        }
    }

    function removeReplyTag() {
        $('.reply-tag').remove();
        replyId = 0;
        replyUsername = '';
    }
    // 添加移除标签的点击事件
    $(document).on('click', '.remove-tag', function (e) {
        e.preventDefault();
        removeReplyTag();
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

        var left = pos.left + (btnWidth / 2) - (selectorWidth / 2);
        var top = pos.top + btnHeight + 5;

        // 确保选择框不会超出屏幕左右边界
        left = Math.max(10, Math.min(left, windowWidth - selectorWidth - 10));

        // 如果选择框底部超出屏幕，就显示在按钮上方
        if (top + $selector.outerHeight() > $(window).height()) {
            top = pos.top - $selector.outerHeight() - 5;
        }

        $selector.css({
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
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
    $.ajax({
        url: "/Users/IsLogin",
        type: "post",
        dataType: "json",
        success: function (res) {
            if (!res.success) {
                // 未登录时显示遮罩层和登录/注册按钮
                $("#reply-mask").show();
            } else {
                // 已登录时隐藏遮罩层
                $("#reply-mask").hide();
            }
        },
        error: function (err) {
            console.log(err);
        }
    });
}

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

function getTopicId() {
    var url = window.location.href;
    var match = url.match(/\/(?:Forum\/)?ReadTopic\/(\d+)(?:\?|$)/i);
    return match ? match[1] : '';
}

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function getTopicById() {
    topicId = getTopicId();
    if (topicId) {
        $.ajax({
            url: "/Forum/GetTopicById",
            type: "post",
            dataType: "json",
            data: {
                topicId: topicId
            },
            success: function (res) {
                if (res.success) {
                    var data = res.data;
                    articleId = data.accountId;
                    topicId = data.id;
                    optimizeSEO(data);
                    $('#avatarHeadImg').attr('src', data.avatar)
                    $('#articleUsername').text(data.author);
                    $('#topicCreateTime').text(data.createTime);
                    $('#topicCommentCount').text(data.commentCount);
                    $('#topicHitCount').text(data.hit);
                    $('.post-title').text(data.title);
                    $(".post-content").html(md.render(data.content));
                    MathJax.typeset();
                    $(".post-content pre code").each(function (i, block) {
                        hljs.highlightElement(block);
                    });
                    // 渲染表情符号
                    var emojiHtml = '';
                    if (data.statements) {
                        var statements = Array.isArray(data.statements) ? data.statements : JSON.parse(data.statements);
                        statements.forEach(function (statement) {
                            var emojiObj = emojis.find(e => e.index === statement.emoji);
                            if (emojiObj) {
                                emojiHtml += `<span class="badge badge-pill badge-light mg-b-10 mg-t-10" data-emoji="${emojiObj.emoji}">
                            ${emojiObj.emoji} <span class="count">${statement.count}</span>
                        </span>`;
                            }
                        });
                    }
                    $('.emoji-container').html(emojiHtml);
                    var thistags = data.tags;
                    var tagsArray = thistags.split(',');
                    var htmltags = tagsArray.map(function (tag) {
                        return '<span class="badge badge-pill badge-info"><i class="fas fa-tag"></i> ' + tag.trim() + '</span>';
                    }).join(' ');
                    $('.post-tag').html(htmltags);
                    getTopicEndum(data.id);
                    getTopicComments(data.id);
                } else
                    notFound();
            },
            error: function (e) {
                notFound();
            }
        });
    } else {
        notFound();
    }
}
function optimizeSEO(data) {
    $('title').text(data.title);
    // 更新或创建 meta 描述
    var metaDescription = $('meta[name="description"]');
    if (metaDescription.length === 0) {
        $('head').append('<meta name="description" content="' + (data.title + ' - ' + data.author) + '">');
    } else {
        metaDescription.attr('content', data.title + ' - ' + data.author);
    }
    // 更新meta描述
    $('meta[name="description"]').attr('content', data.title + ' - ' + data.author);

    // 添加结构化数据
    var schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": data.title,
        "author": {
            "@type": "Person",
            "name": data.author
        },
        "datePublished": data.createTime,
        "image": data.avatar,
        "articleBody": data.content
    };
    $('head').append('<script type="application/ld+json">' + JSON.stringify(schema) + '</script>');

    // 添加规范链接
    $('head').append('<link rel="canonical" href="' + window.location.href + '" />');
}


// 获取评论数据
function getTopicComments(topicId) {
    if (topicId > 0) {
        $('#replies').append(`<div id="loading" style="text-align: center;">
                        <div class="spinner"></div>
                    </div>`);
        $.ajax({
            url: "/Forum/GetTopicComments",
            type: "post",
            dataType: "json",
            data: {
                topicId: topicId,
                page: currentPage,
                pagesize: repliesPerPage,
            },
            success: function (res) {
                if (res.success) {
                    const replies = res.data;
                    totalReplies = res.total;
                    updateReplies(replies);
                    updatePagination();
                }
            }
        });
    }
}

// 构建评论树
function buildReplyTree(replies, parentId = null) {
    let html = '';

    const currentReplies = replies.filter(reply => reply.parentCommentId === parentId);

    if (currentReplies.length === 0 && parentId === null) {
        return '<h4 style="text-align:center;color:lightgray;">夏虫也为我沉默🦗，沉默是今晚的康桥😶</h4>';
    }

    currentReplies.forEach(reply => {
        const childCommentsHtml = buildReplyTree(replies, reply.id);
        //<a href="#" class="thank-btn"><i class="fas fa-heart"></i> 感谢</a>
        // 使用 markdown-it 渲染评论内容
        const renderedContent = md.render(reply.content);

        html += `
            <div class="reply mt-3" data-id="${reply.id}">
                <div class="d-flex align-items-center">
                    <img src="${reply.avatar}" alt="Avatar" class="avatar mr-2" style="width: 30px; height: 30px;">
                    <b>${reply.userName}</b>
                </div>
                <div class="reply-content">${renderedContent}</div>
                <div class="reply-actions">
                    <a href="javascript:void(0)" class="reply-btn" data-id="${reply.id}" data-username="${reply.userName}"><i class="far fa-comment"></i> 回复</a>
                    <small><i class="far fa-clock"></i> ${reply.createTime}</small>
                </div>
                <div class="child-comments" data-parent-id="${reply.id}">
                    ${childCommentsHtml}
                </div>
            </div>
        `;
    });

    return html;
}

// 更新评论显示
function updateReplies(replies) {
    $('#replies').html(buildReplyTree(replies));

    // 渲染数学公式
    MathJax.typeset();

    // 应用代码高亮
    $('#replies pre code').each(function (i, block) {
        hljs.highlightElement(block);
    });
}

// 更新分页
function updatePagination() {
    const totalPages = Math.ceil(totalReplies / repliesPerPage);
    let paginationHtml = '';

    // 首页
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="1" aria-label="First">
                <span aria-hidden="true">&laquo;&laquo;</span>
            </a>
        </li>
    `;

    // 上一页
    paginationHtml += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `;

    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }
    } else {
        const maxDisplayedPages = 5;
        let startPage, endPage;

        if (currentPage <= 3) {
            startPage = 1;
            endPage = maxDisplayedPages;
        } else if (currentPage >= totalPages - 2) {
            startPage = totalPages - maxDisplayedPages + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - 2;
            endPage = currentPage + 2;
        }

        if (startPage > 1) {
            paginationHtml += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="1">1</a>
                </li>
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
            `;
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `;
        }

        if (endPage < totalPages) {
            paginationHtml += `
                <li class="page-item disabled">
                    <span class="page-link">...</span>
                </li>
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>
                </li>
            `;
        }
    }

    // 下一页
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `;

    // 尾页
    paginationHtml += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${totalPages}" aria-label="Last">
                <span aria-hidden="true">&raquo;&raquo;</span>
            </a>
        </li>
    `;

    $('#pagination').html(paginationHtml);
}

// 处理分页点击事件
$(document).on('click', '#pagination .page-link', function (e) {
    e.preventDefault();
    const page = parseInt($(this).data('page'));
    if (!isNaN(page) && page !== currentPage && page > 0 && page <= Math.ceil(totalReplies / repliesPerPage)) {
        currentPage = page;
        getTopicComments(topicId);
    }
});

function notFound() {
    var html = '<div class="error-page">' +
        '<div class="container">' +
        '<div class="row justify-content-center">' +
        '<div class="col-md-6 col-sm-10 text-center">' +
        '<h1 class="error-page-title mb-4 mt-4">404</h1>' +
        '<p class="h4 text-muted">你来到了没有知识的荒原😕</p>' +
        '<p class="error-page-text">你所访问的页面不存在或已被删除</p>' +
        '<a href="/Forum" class="btn btn-primary btn-lg mt-4">返回首页</a>';
    $('.container').html(html);
}

function submitReply() {
    // 发送评论
    var content = easyMDE.value();
    if (content.trim() !== '') {
        // 发送评论
        loadingBtn('#submit-reply')
        $.ajax({
            url: "/Forum/SubmitReply",
            type: "post",
            dataType: "json",
            data: {
                topicId: topicId,
                content: content,
                replyId: replyId,
                toAccountId: articleId
            },
            success: function (res) {
                unloadingBtn('#submit-reply');
                if (res.success) {
                    // 刷新评论列表
                    getTopicComments(topicId);
                    // 清空评论框
                    easyMDE.value('');
                    // 清空AT
                    $('.reply-tag').remove();
                    replyId = 0;
                    replyUsername = '';
                } else {
                    balert("发送失败", "danger", false, 1500, "center");
                }
            }, error: function () {
                unloadingBtn('#submit-reply');
                balert("发送失败", "danger", false, 1500, "center");
            }
        });
    } else {
        balert("评论内容不能为空", "warning", false, 1500, "center");
    }
}

$(document).on('click', '#submit-reply', function () {
    submitReply();
});
//按钮进入加载状态
function loadingBtn(dom) {
    //禁用按钮
    $(dom).prop('disabled', true)
    $(dom).append(` <span class="spinner-border spinner-border-sm"role="status"aria-hidden="true"></span>`);
}

//解除按钮加载状态
function unloadingBtn(dom) {
    //恢复按钮
    $(dom).prop('disabled', false)
    $(dom).find('span').remove();
}

//已读消息
function readNotification(id) {
    $.ajax({
        url: "/Forum/ReadNotification",
        type: "post",
        dataType: "json",
        data: {
            id: id
        }
    });
}

//获取附言
function getTopicEndum(id) {
    $.ajax({
        url: "/Forum/GetTopicEndum",
        type: "post",
        dataType: "json",
        data: {
            id: id
        },
        success: function (res) {
            if (res.success) {
                var data = res.data;
                var html = '';
                for (var i = 0; i < data.length; i++) {
                    html += `<div class="card-footer">
                                <h5 class="postscript-title">附言${i + 1}：</h5>
                                <p class="postscript-content">${data[i].addendumContent}</p>
                                <small>${data[i].createTime}</small>
                            </div>`;
                }
                $('#postscript').html(html);
            } else {
                balert("获取附言失败", "danger", false, 1500, "center");
            }
        }
    })
}