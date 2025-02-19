let currentPage = 1;
const pageSize = 10;
let totalPages = 0;
var md = window.markdownit({
    breaks: true
});
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#forum-nav").addClass('active');
    loadNotifications(currentPage);
    bindMenu();
});

function loadNotifications(page) {
    $.ajax({
        url: '/Forum/GetNotifications',
        method: 'post',
        dataType: 'json',
        data: {
            page: page,
            size: pageSize
        },
        success: function (response) {
            if (response.success) {
                displayNotifications(response.data);
                totalPages = Math.ceil(response.total / pageSize);
                displayPagination();
            } else {
                console.error('Failed to load notifications');
            }
        },
        error: function (xhr, status, error) {
            console.error('Error:', error);
        }
    });
}

function displayNotifications(notifications) {
    const messageList = $('.message-list');
    messageList.empty();
    if (notifications.length === 0) {
        // 没有通知时的友好提示
        const emptyMessage = `
            <div class="empty-notifications">
                <p>📭 目前没有新通知哦！ 🌟</p>
                <p>休息一下，喝杯咖啡吧 ☕️</p>
            </div>
        `;
        messageList.append(emptyMessage);
        return;
    }
    notifications.forEach(function (notification) {
        const renderedContent = md.render(notification.content);
        const messageItem = `
            <div class="message-item" data-id="${notification.id}">
                <img src="${notification.fromAvatar || 'https://dummyimage.com/50x50/000/fff.png'}" alt="User Avatar" class="avatar">
                <div class="message-content">
                    <a href="#" class="username">${notification.fromUserName}</a>
                    ${!notification.isRead ? '<span class="unread-badge"><i class="fas fa-circle"></i></span>' : ''}
                    <span class="badge badge-secondary deleteItem">删除</span>
                    <p class="message-text">在&nbsp;<a href="/Forum/ReadTopic/${notification.topicId}?n=${notification.id}" target="_blank">${notification.topicTitle}</a>&nbsp;回复了你 
                        <span class="time"><i class="far fa-clock"></i> ${notification.createTime}</span>
                    </p>
                    <div class="message-reply">
                        <div class="rendered-content">${renderedContent}</div>
                    </div>
                </div>
            </div>
        `;
        messageList.append(messageItem);
    });

    // 渲染数学公式
    MathJax.typeset();

    // 代码高亮
    messageList.find('pre code').each(function (i, block) {
        hljs.highlightElement(block);
    });
}

function displayPagination() {
    const pagination = $('.pagination');
    pagination.empty();

    // First page
    pagination.append(`
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="1" aria-label="First">
                <span aria-hidden="true">&laquo;&laquo;</span>
            </a>
        </li>
    `);

    // Previous button
    pagination.append(`
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </a>
        </li>
    `);

    // Page numbers
    const displayRange = 5; // Number of page links to show before and after current page
    let startPage = Math.max(1, currentPage - displayRange);
    let endPage = Math.min(totalPages, currentPage + displayRange);

    if (startPage > 1) {
        pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
    }

    for (let i = startPage; i <= endPage; i++) {
        pagination.append(`
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a>
            </li>
        `);
    }

    if (endPage < totalPages) {
        pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
    }

    // Next button
    pagination.append(`
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </a>
        </li>
    `);

    // Last page
    pagination.append(`
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${totalPages}" aria-label="Last">
                <span aria-hidden="true">&raquo;&raquo;</span>
            </a>
        </li>
    `);
}

// Event delegation for pagination clicks
$('.pagination').on('click', 'a.page-link', function (e) {
    e.preventDefault();
    const page = $(this).data('page');
    if (page && page !== currentPage) {
        currentPage = page;
        loadNotifications(currentPage);
    }
});

// Event delegation for delete button clicks
$('.message-list').on('click', '.deleteItem', function () {
    const messageItem = $(this).closest('.message-item');
    const notificationId = messageItem.data('id');
    showConfirmationModal("提示", "确定删除这条消息吗？", function () {
        $.ajax({
            url: '/Forum/DeleteNotification',
            method: 'post',
            dataType: 'json',
            data: {
                id: notificationId
            },
            success: function (response) {
                if (response.success) {
                    balert('删除成功', 'success', false, 1500, 'center');
                    messageItem.remove();
                } else {
                    balert('删除失败，请稍后再试', 'danger', false, 1500, 'center')
                }
            },
            error: function (xhr, status, error) {
                balert('网络错误或服务器错误：' + error, 'warning', false, 1500, 'top')
            }
        });
    });
});
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