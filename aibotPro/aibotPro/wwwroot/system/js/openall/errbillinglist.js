$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ordermanager-main-menu").addClass('active');
    $("#ordermanager-main-menu").parent().toggleClass('show');
    $("#ordermanager-main-menu").parent().siblings().removeClass('show');
    $("#errbillinglist_ordermanager_nav").addClass('active');
    loadErrList(page, page_size, "");
});
let page = 1;
let page_size = 15;
let total = 0;
$(document).keypress(function (e) {
    if ($("#account").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            var account = $("#account").val();
            loadErrList(page, page_size, account)
        }
    }
});
// 加载订单数据的函数
function loadErrList(page, page_size, account = '') {
    // 示例中没有详细的后端接口URL，所以这里假设为'/api/getOrders'
    // 实际开发中需要替换为正确的URL
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/GetErrorBilling',
        type: 'Post',
        data: {
            page: page,
            page_size: page_size,
            account: account
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var logs = response.data;
                total = response.total;
                updateOrderList(logs);
                updatePagination(page, Math.ceil(total / page_size));
            } else {
                balert(response.msg, 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('加载失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}

// 更新订单列表
function updateOrderList(logs) {
    var $orderList = $('#orderList');
    $orderList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < logs.length; i++) {
        var progress = `<span class="badge badge-pill badge-info">处理中</a>`;
        var handle = `<button class="btn btn-success" onclick="handle(${logs[i].id},1,'通过')">通过</button> <button class="btn btn-danger" onclick="handle(${logs[i].id},2,'拒绝')">拒绝</button>`;
        if (logs[i].status == 1) {
            progress = `<span class="badge badge-pill badge-success">已通过</a>`;
            handle = `<button class="btn btn-danger" onclick="handle(${logs[i].id},3,'删除')">删除</button>`;
        }
        else if (logs[i].status == 2) {
            progress = `<span class="badge badge-pill badge-danger">已拒绝</a>`;
            handle = `<button class="btn btn-danger" onclick="handle(${logs[i].id},3,'删除')">删除</button>`;
        }
        str += `<tr>
                    <td onclick="loginfo(${logs[i].logId})" style="color:rgb(14,83,154);cursor:pointer">${logs[i].logId}</td>
                    <td>${logs[i].useMoney}</td>
                    <td>${logs[i].cause}</td>
                    <td>${logs[i].createTime}</td>
                    <td>${progress}</td>
                    <td>${logs[i].reply}</td>
                    <td>${logs[i].handlingTime == null ? '等待处理' : logs[i].handlingTime}</td>
                    <td>${handle}</td>
                </tr>`;
    }
    $orderList.html(str);
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
            var account = $("#account").val();
            loadOrders(page, page_size, account);
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
            var account = $("#account").val();
            loadErrList(currentPage - 1, page_size, account);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            var account = $("#account").val();
            loadErrList(currentPage + 1, page_size, account);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            var account = $("#account").val();
            loadErrList(1, page_size, account);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            var account = $("#account").val();
            loadErrList(totalPages, page_size, account);  // 跳转到尾页
        });
    }
}

function handle(id, type, typeName) {
    showPromptModal('操作' + typeName, `请输入<b style="color:red">${typeName}</b>原因`, function (value) {
        if (value != "") {
            loadingOverlay.show();
            $.ajax({
                url: "/OpenAll/HandleErrorBilling",
                type: "POST",
                data: {
                    id: id,
                    type: type,
                    reply: value
                },
                success: function (data) {
                    loadingOverlay.hide();
                    if (data.success) {
                        balert("提交成功", 'success', false, 1500, 'top');
                        loadErrList(page, page_size, "");
                    } else {
                        balert(data.msg, 'danger', false, 1500, 'top');
                    }
                }
            });
        } else {
            balert(typeName + '原因不能为空', 'danger', false, 1000, 'top');
        }
    });
}
function loginfo(logid) {
    $.ajax({
        url: "/OpenAll/GetLogInfo",
        type: "post",
        dataType: "json",//返回对象
        data: {
            logId: logid
        },
        success: function (res) {
            if (res.success) {
                var data = res.data;
                var str = ``;
                str = `<p>模型名称：<b>${data.modelName}</b></p>
                           <p>账号：<b>${data.account}</b></p>
                           <p>消耗金额：<b>${data.useMoney}</b></p>`;
                showConfirmationModal('消耗记录详情', str);
            }
        }
    });
}