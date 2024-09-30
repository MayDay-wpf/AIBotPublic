$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#system-main-menu").addClass('active');
    $("#system-main-menu").parent().toggleClass('show');
    $("#system-main-menu").parent().siblings().removeClass('show');
    $("#systemlog_system_nav").addClass('active');
    loadLogs(page, page_size);
});

let page = 1;
let page_size = 15;
let total = 0;
function loadLogs(page, page_size) {
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/GetSystemLogs',
        type: 'Post',
        data: {
            page: page,
            page_size: page_size
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var logs = response.data;
                total = response.total;
                updateLogList(logs);
                updatePagination(page, Math.ceil(total / page_size));
            } else {
                balert('加载失败，请稍后再试', 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('加载失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}
function getLogLevelClass(logLevel) {
    switch (logLevel) {
        case "信息":
            return "log-info";
        case "警告":
            return "log-warning";
        case "错误":
            return "log-error";
        case "致命错误":
            return "log-critical";
        default:
            return "log-default";
    }
}
function updateLogList(logs) {
    var $logList = $('#logList');
    $logList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < logs.length; i++) {
        var logLevelClass = getLogLevelClass(logs[i].logLevel);
        str += `<tr><td class="` + logLevelClass + `">` + logs[i].logLevel + `</td><td>` + logs[i].logTxt + `</td><td>` + logs[i].createAccount + `</td><td>` + logs[i].createTime + `</td></tr>`;
    }
    $logList.html(str);
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
            loadLogs(page, page_size);
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
            loadLogs(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadLogs(currentPage + 1, page_size);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadLogs(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            loadLogs(totalPages, page_size);  // 跳转到尾页
        });
    }
}