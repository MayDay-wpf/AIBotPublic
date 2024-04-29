$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#mall-main-menu").addClass('active');
    $("#mall-main-menu").parent().toggleClass('show');
    $("#mall-main-menu").parent().siblings().removeClass('show');
    $("#goods_mall_nav").addClass('active');
    loadGoodList(page, page_size);
});
let page = 1;
let page_size = 15;
let total = 0;
$(document).keypress(function (e) {
    if ($("#name").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            loadGoodList(page, page_size);
        }
    }
});
function deleteGood(goodCode) {
    //询问框
    showConfirmationModal("提醒", "确定要删除这个商品吗？", function () {
        //发起请求
        $.ajax({
            url: "/OpenAll/DeleteGood",
            type: "post",
            dataType: "json",//返回对象
            data: {
                goodCode: goodCode
            },
            success: function (res) {
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "center");
                    loadGoodList(page, page_size);
                } else
                    balert("删除失败", "danger", false, 1000, "center");
            },
            error: function (e) {

            }
        })
    });
}
function putonOrOffShelves(goodCode, shelves) {
    //发起请求
    $.ajax({
        url: "/OpenAll/PutonOrOffShelves",
        type: "post",
        dataType: "json",//返回对象
        data: {
            goodCode: goodCode,
            shelves: shelves
        },
        success: function (res) {
            if (res.success) {
                loadGoodList(page, page_size);
            } else
                balert("修改失败", "danger", false, 1000, "center");
        },
        error: function (e) {

        }
    })
}

function editGood(goodCode) {
    window.open("/OpenAll/Grounding?goodCode=" + goodCode);
}

function loadGoodList(page, page_size) {
    var name = $('#name').val();
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/GetGoods',
        type: 'Post',
        data: {
            pageIndex: page,
            pageSize: page_size,
            name: name,
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var goods = response.data;
                total = response.total;
                updateGoodList(goods);
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
function updateGoodList(goods) {
    var $goodsList = $('#goodsList');
    $goodsList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < goods.length; i++) {
        var btn = `<button class="btn btn-danger" onclick="deleteGood('${goods[i].goodCode}')">删除</button>
                   <button class="btn btn-info" onclick="editGood('${goods[i].goodCode}')">编辑</button>`;
        if (goods[i].onShelves)
            btn += ` <button class="btn btn-warning" onclick="putonOrOffShelves('${goods[i].goodCode}',false)">下架</button>`;
        else
            btn += ` <button class="btn btn-primary" onclick="putonOrOffShelves('${goods[i].goodCode}',true)">上架</button>`;
        var payTypes = goods[i].goodPayType.split(',');
        var payTypeHtml = ``;
        payTypeHtml += payTypes.includes('wechat') ? ` <span class="badge badge-success">微信支付</span>` : '';
        payTypeHtml += payTypes.includes('alipay') ? ` <span class="badge badge-primary">支付宝支付</span>` : '';
        payTypeHtml += payTypes.includes('balancepay') ? ` <span class="badge badge-info">余额支付</span>` : '';
        str += `<tr><td><img src="${goods[i].goodImage}" style="width:80px;height:50px;" /></td>
                    <td>${goods[i].goodName}</td>
                    <td>${goods[i].goodPrice}</td>
                    <td>${goods[i].goodStock}</td>
                    <td>${payTypeHtml}</td>
                    <td>${btn}</td></tr>`;
    }
    $goodsList.html(str);
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
            loadGoodList(page, page_size);
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
            loadGoodList(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadGoodList(currentPage + 1, page_size);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadGoodList(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            loadGoodList(totalPages, page_size);  // 跳转到尾页
        });
    }
}