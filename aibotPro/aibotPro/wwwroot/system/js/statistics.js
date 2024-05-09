$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#statistics_usercenter_nav").addClass('active');
});
let page = 1;
let page_size = 15;
let total = 0;
let totalUseMoney = 0;
let totalUseCount = 0;
$(document).ready(function () {
    loadLogs(page, page_size);
    var start = moment().subtract(6, 'days').startOf('day'); // 设置开始日期为6天前
    var end = moment().endOf('day'); // 设置结束日期为今天
    var cb = function (start, end, label) {
        // 日期范围改变后的回调函数
        var startDate = start.format('YYYY-MM-DD HH:mm:ss');
        var endDate = end.format('YYYY-MM-DD HH:mm:ss');
        totalUseMoney = 0;
        totalUseCount = 0;
        // 使用 AJAX 调用后端方法
        $.ajax({
            url: '/Users/GetUsedData', // 这里替换成你的 API 端点
            method: 'Post',
            data: {
                startTime: startDate,
                endTime: endDate
            },
            success: function (response) {
                // 这里是请求成功后的处理函数，`response` 是从服务器接收的数据
                if (response.data.length == 0) {
                    balert('暂无数据', 'warning', false, 1500, 'center');
                }
                var myChart = echarts.init(document.getElementById('pieChart'));
                var chartModeSelect = document.getElementById('chartMode');
                chartModeSelect.selectedIndex = label
                var moneyData = processData(response.data, 'money');
                var tokensData = processData(response.data, 'tokens');
                updateTotalUse('money');
                var option = {
                    tooltip: {
                        trigger: 'item',
                        formatter: "模型：{b} <br/> 消耗：{c}<br/> 占比：{d}%"
                    },
                    legend: {
                        type: 'scroll',
                        orient: 'vertical',
                        left: 'left',
                        align: 'left',
                        pageButtonPosition: 'end',
                        pageIconColor: '#2f4554',
                        pageIconInactiveColor: '#aaa',
                        pageIconSize: 15,
                        pageTextStyle: {
                            color: '#fff'
                        }
                    },
                    series: [
                        {
                            type: 'pie',
                            radius: '55%',
                            center: ['50%', '50%'],
                            data: moneyData,
                            emphasis: {
                                itemStyle: {
                                    shadowBlur: 10,
                                    shadowOffsetX: 0,
                                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                                }
                            }
                        }
                    ],
                    responsive: true,
                    media: [
                        {
                            query: {
                                maxWidth: 600
                            },
                            option: {
                                legend: {
                                    orient: 'horizontal',
                                    bottom: 'bottom',
                                    align: 'center',
                                    itemWidth: 20,
                                    itemHeight: 14,
                                    textStyle: {
                                        fontSize: 12
                                    },
                                    pageButtonItemGap: 15,
                                    pageButtonPosition: 'end',
                                    pageFormatter: '{current}/{total}',
                                    pageIconColor: '#2f4554',
                                    pageIconInactiveColor: '#aaa',
                                    pageIconSize: 15,
                                    pageTextStyle: {
                                        color: '#333'
                                    },
                                    formatter: function (name) {
                                        return name.length > 6 ? name.slice(0, 6) + '...' : name;
                                    }
                                },
                                series: [
                                    {
                                        center: ['50%', '40%']
                                    }
                                ]
                            }
                        }
                    ]
                };






                myChart.setOption(option);
                // 更新图表数据
                function updateChartData(dataset) {
                    myChart.setOption({
                        series: [{
                            data: dataset
                        }]
                    });
                }
                // 监听下拉选择变化
                chartModeSelect.addEventListener('change', function () {
                    if (this.value === 'money') {
                        updateChartData(moneyData);
                        updateTotalUse('money');
                    } else {
                        updateChartData(tokensData);
                        updateTotalUse('tokens');
                    }
                });

                // 响应式调整图表大小
                window.onresize = function () {
                    myChart.resize();
                };
            },
            error: function (jqXHR, textStatus, errorThrown) {
                // 这里是请求失败后的处理函数
                console.error('Error fetching data:', textStatus, errorThrown);
            }
        });
    }
    $('.datepicker').daterangepicker({
        startDate: start,
        endDate: end,
        locale: {
            format: 'YYYY-MM-DD', // 日期格式
            separator: " - ",
            applyLabel: "确定",
            cancelLabel: "取消",
            fromLabel: "起始时间",
            toLabel: "结束时间'",
            customRangeLabel: "自定义",
            weekLabel: "W",
            daysOfWeek: ["日", "一", "二", "三", "四", "五", "六"],
            monthNames: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"],
            firstDay: 1,
        },
        ranges: {
            '今天': [moment(), moment()],
            '昨天': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            '过去7天': [moment().subtract(6, 'days'), moment()],
            '过去30天': [moment().subtract(29, 'days'), moment()],
            '这个月': [moment().startOf('month'), moment().endOf('month')],
            '上个月': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        },
        autoApply: true,
    }, cb);
    cb(start, end, 0);
});
function processData(data, key) {
    let modelData = {};
    data.forEach(d => {
        if (!modelData[d.modelName]) {
            modelData[d.modelName] = 0;
        }
        if (key === 'money') {
            modelData[d.modelName] += d.useMoney;
            totalUseMoney += d.useMoney;
        } else {
            modelData[d.modelName] += d.inputCount + d.outputCount;
            totalUseCount += d.inputCount + d.outputCount;
        }
    });
    return Object.entries(modelData).map(([name, value]) => ({ name, value }));
}

function loadLogs(page, page_size) {
    // 示例中没有详细的后端接口URL，所以这里假设为'/api/getOrders'
    // 实际开发中需要替换为正确的URL
    loadingOverlay.show();
    $.ajax({
        url: '/Users/GetLogs',
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

function updateLogList(logs) {
    var $logList = $('#logList');
    $logList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < logs.length; i++) {
        str += `<tr><td>` + logs[i].modelName + `</td><td>` + logs[i].useMoney + `</td><td>` + logs[i].inputCount + `</td><td>` + logs[i].outputCount + `</td><td>` + logs[i].createTime + `</td></tr>`;
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

function updateTotalUse(type) {
    if (type === 'money') {
        $("#totalUse").val(totalUseMoney);
        $("#unit").text('￥');
    } else {
        $("#totalUse").val(totalUseCount);
        $("#unit").text('tokens');
    }
}

