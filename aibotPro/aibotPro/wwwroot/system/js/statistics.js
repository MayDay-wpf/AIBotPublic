$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#statistics_usercenter_nav").addClass('active');
});
let page = 1;
let page_err = 1;
let page_size = 15;
let page_size_err = 15;
let total = 0;
let total_err = 0;
let totalUseMoney = 0;
let totalUseCount = 0;
$(document).ready(function () {
    loadLogs(page, page_size);
    loadErrLogs(page_err, page_size_err);
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
        str += `<tr><td style="cursor:pointer;color:rgb(13,86,158)" onclick="modelPriceInfo('${logs[i].modelName}',${logs[i].inputCount},${logs[i].outputCount})">` + logs[i].modelName + `</td>
                    <td>` + logs[i].useMoney + `</td><td>` + logs[i].inputCount + `</td>
                    <td>` + logs[i].outputCount + `</td>
                    <td>` + logs[i].createTime + `</td>
                    <td><button class="btn btn-info" onclick="errorBilling(${logs[i].id},${logs[i].useMoney})"><i data-feather="frown"></i> 要求撤回</button></td></tr>`;
    }
    $logList.html(str);
    feather.replace();
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


function loadErrLogs(page_err, page_size_err) {
    // 示例中没有详细的后端接口URL，所以这里假设为'/api/getOrders'
    // 实际开发中需要替换为正确的URL
    loadingOverlay.show();
    $.ajax({
        url: '/Users/GetErrorBilling',
        type: 'Post',
        data: {
            page: page_err,
            page_size: page_size_err
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var logs = response.data;
                total_err = response.total;
                updateErrLogList(logs);
                if (total_err > 0)
                    updateErrPagination(page, Math.ceil(total_err / page_size_err));
                else {
                    $('.errpagination').hide();
                }
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

function updateErrLogList(logs) {
    var $logList = $('#errList');
    $logList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < logs.length; i++) {
        var progress = `<span class="badge badge-pill badge-info">处理中</a>`;
        if (logs[i].status == 1) {
            progress = `<span class="badge badge-pill badge-success">已通过</a>`;
        }
        else if (logs[i].status == 2) {
            progress = `<span class="badge badge-pill badge-danger">已拒绝</a>`;
        }
        str += `<tr>
                    <td>${logs[i].logId}</td>
                    <td>${logs[i].useMoney}</td>
                    <td>${logs[i].cause}</td>
                    <td>${logs[i].createTime}</td>
                    <td>${progress}</td>
                    <td>${logs[i].reply}</td>
                    <td>${logs[i].handlingTime == null ? '等待处理' : logs[i].handlingTime}</td>
                </tr>`;
    }
    $logList.html(str);
    feather.replace();
}

// 更新分页
function updateErrPagination(currentPage, totalPages) {
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
            loadErrLogs(page, page_size_err);
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
    $('#previous-page-err').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#previous-page-err').click(function (e) {
            e.preventDefault();
            loadErrLogs(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page-err').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page-err').click(function (e) {
            e.preventDefault();
            loadErrLogs(currentPage + 1, page_size);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page-err').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page-err').click(function (e) {
            e.preventDefault();
            loadErrLogs(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page-err').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page-err').click(function (e) {
            e.preventDefault();
            loadErrLogs(totalPages, page_size);  // 跳转到尾页
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
function modelPriceInfo(modelName, input, output) {
    $.ajax({
        url: "/Home/GetModelPrice",
        type: "post",
        dataType: "json",//返回对象
        data: {
            modelName: modelName
        },
        success: function (res) {
            if (res.success) {
                res = res.data;
                var str = ``;
                if (res.length > 0) {
                    var data = res[0];
                    if (data.modelPrice.modelName == "Midjourney" || data.modelPrice.modelName == "UPSCALE" || data.modelPrice.modelName == "VARIATION" || data.modelPrice.modelName == "DALLE3" || data.modelPrice.onceFee > 0 || data.modelPrice.vipOnceFee > 0) {
                        if (data.modelPrice.onceFee > 0) {
                            str = `<p>模型名称：<b>${data.modelPrice.modelName}</b></p>
                           <p>按次计费模型使用一次价格（普通用户）：<b>${data.modelPrice.onceFee}</b></p>
                           <p>模型倍率（普通用户）：<b>${data.modelPrice.rebate}</b></p>
                           <p>按次计费模型使用一次价格（VIP用户）：<b>${data.modelPrice.vipOnceFee}</b></p>
                           <p>模型倍率（VIP用户）：<b>${data.modelPrice.vipRebate}</b></p>
                           <p>普通用户应付：<b>${data.modelPrice.onceFee}</b></p>
                           <p>VIP用户应付：<b>${data.modelPrice.vipOnceFee}</b></p>`;
                        } else {
                            str = `<p> 模型名称：<b>${data.modelPrice.modelName}</b></p>
                           <p>绘画模型使用一次价格（普通用户）：<b>${data.modelPrice.modelPriceOutput}</b></p>
                           <p>模型倍率（普通用户）：<b>${data.modelPrice.rebate}</b></p>
                           <p>绘画模型使用一次价格（VIP用户）：<b>${data.modelPrice.vipModelPriceOutput}</b></p>
                           <p>模型倍率（VIP用户）：<b>${data.modelPrice.vipRebate}</b></p>
                           <p>普通用户应付：<b>${data.modelPrice.modelPriceOutput}</b></p>
                           <p>VIP用户应付：<b>${data.modelPrice.vipModelPriceOutput}</b></p>`;
                        }
                    } else {
                        str = `<p> 模型昵称：<b>${data.modelNick}</b></p>
                           <p>模型名称：<b>${data.modelPrice.modelName}</b></p>
                           <p>模型输入价格/1k tokens（普通用户）：<b>${data.modelPrice.modelPriceInput}</b></p>
                           <p>模型输出价格/1k tokens（普通用户）：<b>${data.modelPrice.modelPriceOutput}</b></p>
                           <p>模型倍率（普通用户）：<b>${data.modelPrice.rebate}</b></p>
                           <p>模型输入价格/1k tokens（VIP用户）：<b>${data.modelPrice.vipModelPriceInput}</b></p>
                           <p>模型输出价格/1k tokens（VIP用户）：<b>${data.modelPrice.vipModelPriceOutput}</b></p>
                           <p>模型倍率（VIP用户）：<b>${data.modelPrice.vipRebate}</b></p>
                           <p>当前记录的输入输出tokens数分别为：<b>${input}</b>、<b>${output}</b></p>
                           <p>根据费用计算公式：<b>计费＝(输入价格+输出价格)*倍率</b> 可得出以下计算结果：</p>
                           <p>普通用户应付：<b>(${input}/1000*${data.modelPrice.modelPriceInput}+${output}/1000*${data.modelPrice.modelPriceOutput})*${data.modelPrice.rebate}＝${calculate(input, output, data.modelPrice.modelPriceInput, data.modelPrice.modelPriceOutput, data.modelPrice.rebate)}</b></p>
                           <p>VIP用户应付：<b>(${input}/1000*${data.modelPrice.vipModelPriceInput}+${output}/1000*${data.modelPrice.vipModelPriceOutput})*${data.modelPrice.vipRebate}＝${calculate(input, output, data.modelPrice.vipModelPriceInput, data.modelPrice.vipModelPriceOutput, data.modelPrice.vipRebate)}</b></p>`;
                    }
                } else {
                    str += '该模型免费使用，使用前提：账户余额>0';
                }
                showConfirmationModal('消耗详情', str);
            }
        }
    });
}
function calculate(input, output, inputPrice, outputPrice, rebate) {
    const result = (input / 1000 * inputPrice + output / 1000 * outputPrice) * rebate;
    // Round to 4 decimal places
    let roundedResult = result.toFixed(4);
    // Remove trailing zeros
    roundedResult = parseFloat(roundedResult).toString();
    return roundedResult;
}
function errorBilling(id, useMoney) {
    showPromptModal('要求撤回', '<b style="color:red">非常抱歉</b>我们的系统对您进行了错误计费,请您简述您要求撤回这笔消费的原因,我们会尽快为您处理', function (value) {
        if (value != "") {
            loadingOverlay.show();
            $.ajax({
                url: "/Users/ErrorBilling",
                type: "POST",
                data: {
                    id: id,
                    useMoney: useMoney,
                    cause: value
                },
                success: function (data) {
                    loadingOverlay.hide();
                    if (data.success) {
                        balert("提交成功", 'success', false, 1500, 'top');
                        loadErrLogs(page_err, page_size_err);
                    } else {
                        balert(data.msg, 'danger', false, 1500, 'top');
                    }
                }
            });
        } else {
            balert('撤回原因不能为空', 'danger', false, 1000, 'top');
        }
    });
}
