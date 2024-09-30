var id = 0;
let page = 1;
let page_size = 15;
let total = 0;
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#notification-main-menu").addClass('active');
    $("#notification-main-menu").parent().toggleClass('show');
    $("#notification-main-menu").parent().siblings().removeClass('show');
    $("#system_notification_nav").addClass('active');
});
function send() {
    var title = $('#title').val();
    var content = $('#content').val();
    if (content == "") {
        balert('请输入通知内容', 'danger', false, 1500, 'top');
        return;
    }
    if (title == "") {
        balert('请输入通知标题', 'danger', false, 1500, 'top');
        return;
    }
    loadingBtn('.send');
    //发起请求
    $.ajax({
        url: '/OpenAll/SendSystemNotice',
        type: 'Post',
        data: {
            id: id,
            title: title,
            content: content
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.send');
            if (response.success) {
                balert('发送成功', 'success', false, 1500, 'center');
                location.reload();
            } else {
                balert(response.message, 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            unloadingBtn('.send');
            console.log(error);
            balert('添加失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}

$(document).ready(function () {
    // 加载第一页数据
    loadNotices(page, page_size);

    // 上一页
    $('#previous-page').click(function (e) {
        e.preventDefault(); // 阻止默认事件
        if (page > 1) {
            page--;
            loadNotices(page, page_size);
        }
    });

    // 下一页
    $('#next-page').click(function (e) {
        e.preventDefault(); // 阻止默认事件
        if (page < Math.ceil(total / page_size)) {
            page++;
            loadNotices(page, page_size);
        }
    });
});

// 加载订单数据的函数
function loadNotices(page, page_size) {
    // 示例中没有详细的后端接口URL，所以这里假设为'/api/getOrders'
    // 实际开发中需要替换为正确的URL
    $.ajax({
        url: '/OpenAll/GetSystemNoticeList', type: 'Post', data: {
            page: page, page_size: page_size
        }, dataType: 'json', success: function (response) {
            if (response.success) {
                var notices = response.data;
                total = response.total;
                updateNoticeList(notices);
                updatePagination(page, Math.ceil(total / page_size));
            } else {
                alert(response.msg);
            }
        }, error: function (error) {
            console.log(error);
            alert('加载失败，请稍后再试');
        }
    });
}

// 更新订单列表
function updateNoticeList(notices) {
    var $noticeList = $('#noticeList');
    $noticeList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < notices.length; i++) {
        str += `<tr><td>` + notices[i].noticeTitle +
            `</td><td>` + notices[i].noticeContent +
            `</td><td>` + notices[i].createTime +
            `</td>
            <td>
                <button class="btn btn-primary btn-sm m-1 edit-btn" data-index="${i}">编辑</button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${notices[i].id}">删除</button>
            </td></tr>`;
    }
    $noticeList.html(str);
    $('.edit-btn').click(function () {
        var index = $(this).data('index');
        id = notices[index].id; // 设置全局变量 id
        $('#title').val(notices[index].noticeTitle); // 设置标题
        $('#content').val(notices[index].noticeContent); // 设置内容
    });
    $('.delete-btn').click(function () {
        var noticeId = $(this).data('id');
        deleteNotice(noticeId);
    });
}

function deleteNotice(noticeId) {
    showConfirmationModal("提示", "确定删除这条通知记录吗？", function () {
        $.ajax({
            url: '/OpenAll/DeleteNotice',
            type: 'POST',
            data: {id: noticeId},
            success: function (response) {
                if (response.success) {
                    balert(response.msg, 'success', false, 1500, 'center');
                    location.reload(); // 刷新页面
                } else {
                    balert(response.msg, 'danger', false, 1500, 'center');
                }
            },
            error: function () {
                balert('删除请求失败，请稍后再试。', 'danger', false, 1500, 'center');
            }
        });
    });
}

// 更新分页
function updatePagination(currentPage, totalPages) {
    var $pagination = $('.pagination');
    $('li.page-item.dynamic').remove(); // 清除之前添加的页码

    const maxPagesToShow = 5; // 最多显示的页码数（含省略的...）
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
        // 显示所有页码
        startPage = 1;
        endPage = totalPages;
    } else {
        // 计算显示的页码范围
        const maxPagesBeforeCurrentPage = Math.floor(maxPagesToShow / 2);
        const maxPagesAfterCurrentPage = Math.ceil(maxPagesToShow / 2) - 1;

        if (currentPage <= maxPagesBeforeCurrentPage) {
            startPage = 1;
            endPage = maxPagesToShow - 1;
        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
            startPage = totalPages - maxPagesToShow + 2;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrentPage + 1;
            endPage = currentPage + maxPagesAfterCurrentPage;
        }
    }

    // 添加页码
    for (let i = startPage; i <= endPage; i++) {
        let $pageItem = $('<li class="page-item dynamic"><a class="page-link" href="#">' + i + '</a></li>');

        if (i === currentPage) {
            $pageItem.addClass('active');
        }

        $pageItem.insertBefore('#next-page').click(function (e) {
            e.preventDefault(); // 阻止默认事件
            var page = parseInt($(this).text());
            loadNotices(page, page_size);
        });
    }

    // 处理省略的显示
    if (startPage > 1) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('.page-item.dynamic:first');
    }

    if (endPage < totalPages) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('#next-page');
    }

    // 更新上一页和下一页的状态
    $('#previous-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#previous-page').click(function (e) {
            e.preventDefault();
            loadNotices(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadNotices(currentPage + 1, page_size);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadNotices(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            loadNotices(totalPages, page_size);  // 跳转到尾页
        });
    }
}