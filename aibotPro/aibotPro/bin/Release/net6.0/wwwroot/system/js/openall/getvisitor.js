$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#datastatistics-main-menu").addClass('active');
    $("#datastatistics-main-menu").parent().toggleClass('show');
    $("#datastatistics-main-menu").parent().siblings().removeClass('show');
    $("#visitor_datastatistics_nav").addClass('active');
    getVisitorView();
    loadIps(page, page_size);
});
let page = 1;
let page_size = 15;
function getVisitorView() {
    //发起请求
    $.ajax({
        url: "/OpenAll/GetVisitorView",
        type: "post",
        success: function (data) {
            if (data.length > 0) {
                $('#totalCount').text(data[0].totalClicks);
                $('#todayCount').text(data[0].todayClicks);
                var dates = data.map(function (item) {
                    return item.date.replace('T00:00:00', '');
                });
                var clicks = data.map(function (item) {
                    return item.clicks;
                });
                var chart = echarts.init(document.getElementById('lineChart'));
                var option = {
                    xAxis: {
                        type: 'category',
                        data: dates
                    },
                    yAxis: {
                        type: 'value'
                    },
                    tooltip: {
                        trigger: 'axis',
                        formatter: function (params) {
                            return '日期：' + params[0].name + '<br>点击量：' + params[0].value;
                        }
                    },
                    series: [{
                        data: clicks,
                        type: 'line'
                    }]
                };
                chart.setOption(option);
            }
        }
    });
}

function loadIps(page, page_size) {
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/GetIps',
        type: 'Post',
        data: {
            page: page,
            page_size: page_size
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var ips = response.data;
                total = response.total;
                updateIpList(ips);
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

function updateIpList(ips) {
    var $ipList = $('#ipList');
    $ipList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < ips.length; i++) {
        str += `<tr><td>` + ips[i].iPv4 + `</td><td>` + ips[i].address + `</td><td>` + ips[i].lookTime + `</td></tr>`;
    }
    $ipList.html(str);
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
            loadIps(page, page_size);
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
            loadIps(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadIps(currentPage + 1, page_size);
        });
    }
}
