$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ordermanager-main-menu").addClass('active');
    $("#ordermanager-main-menu").parent().toggleClass('show');
    $("#ordermanager-main-menu").parent().siblings().removeClass('show');
    $("#orderlist_ordermanager_nav").addClass('active');
    loadOrders(page, page_size);
});
let page = 1;
let page_size = 15;
let total = 0;
// 加载订单数据的函数
function loadOrders(page, page_size) {
    // 示例中没有详细的后端接口URL，所以这里假设为'/api/getOrders'
    // 实际开发中需要替换为正确的URL
    $.ajax({
        url: '/OpenAll/GetOrderList',
        type: 'Post',
        data: {
            page: page,
            page_size: page_size
        },
        dataType: 'json',
        success: function (response) {
            if (response.success) {
                var orders = response.data;
                total = response.total;
                updateOrderList(orders);
                updatePagination(page, Math.ceil(total / page_size));
            } else {
                alert(response.msg);
            }
        },
        error: function (error) {
            console.log(error);
            alert('加载失败，请稍后再试');
        }
    });
}

// 更新订单列表
function updateOrderList(orders) {
    var $orderList = $('#orderList');
    $orderList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < orders.length; i++) {
        var dosomething = `<span style="color:green">已支付</span>`;
        var status = ``;
        if (orders[i].orderStatus == 'NO') {
            status = `<span style="color:red">未支付</span>`
            dosomething = `<button class="btn btn-success" onclick="checkOrder('` + orders[i].orderCode + `')">核验</button>`;
        }
        else
            status = `<span style="color:green">已支付</span>`;
        str += `<tr><td>` + orders[i].account + `</td><td>` + orders[i].orderCode + `</td><td>` + orders[i].orderMoney + `</td><td>` + orders[i].createTime + `</td><td>` + status + `</td></tr>`;
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
            endPage = maxPagesToShow;
        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
            startPage = totalPages - maxPagesToShow + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrentPage;
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
            loadOrders(page, page_size);
        });
    }

    // 处理省略的显示
    if (startPage > 1) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('#next-page');
    }

    if (endPage < totalPages) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('#next-page');
    }

    // 更新上一页和下一页的状态
    $('#previous-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#previous-page').click(function (e) {
            e.preventDefault();
            loadOrders(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadOrders(currentPage + 1, page_size);
        });
    }
}

