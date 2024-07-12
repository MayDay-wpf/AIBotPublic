$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#user_usercenter_nav").addClass('active');
    getUserInfo();
    isVIPbyUserInfo();
});
let avatar = '';
let page = 1;
let page_size = 15;
let total = 0;
function loadImage(event) {
    var input = event.target;
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        //只允许上传图片
        if (!/image\/\w+/.test(input.files[0].type)) {
            balert('请确保文件为图像类型', 'warning', false, 1500, 'center');
            return;
        }
        //图片大小不大于5M
        if (input.files[0].size > 5 * 1024 * 1024) {
            balert('图片大小不得超过5M', 'warning', false, 1500, 'center');
            return;
        }
        reader.onload = function (e) {
            $('#avatar-image').attr('src', e.target.result);
        }
        reader.readAsDataURL(input.files[0]);
        //上传图片
        var formData = new FormData();
        formData.append('file', input.files[0]);
        $.ajax({
            url: '/Users/UploadAvatar',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                if (res.success) {
                    avatar = res.filePath.replace('wwwroot', '');
                    HeadImgPath = res.filePath.replace('wwwroot', '');
                }
                else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
}

function getUserInfo() {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/Users/GetUserInfo",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                avatar = res.headImg;
                $('#avatar-image').attr('src', res.headImg);
                $('#nickname').val(res.nick);
                $('#account').text(res.account);
                $('#sex').text(res.sex);
                $('#mcoin').text(res.mcoin);
                $('#createtime').text(res.createTime);
            }
        }
    });
}
function saveUserInfo() {
    var nick = $('#nickname').val();
    if (nick == "") {
        balert('昵称不能为空', 'danger', false, 1500, 'center');
        return;
    }
    if (nick.length > 10) {
        balert('昵称长度不能超过10个字符', 'danger', false, 1500, 'center');
        return;
    }
    loadingBtn('.saveUserInfoBtn');
    $.ajax({
        url: "/Users/SaveUserInfo",
        type: "post",
        dataType: "json",//返回对象
        data: {
            nick: nick,
            avatar: avatar
        },
        success: function (res) {
            unloadingBtn('.saveUserInfoBtn');
            if (res.success) {
                balert('保存成功', 'success', false, 1500, 'center');
            }
            else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

function isVIPbyUserInfo() {
    //发起请求
    $.ajax({
        url: "/Users/IsVIP",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                $('#isvip').show();
                $('#vipendtime').text(res.data[0].endTime);
            }
            else {
                $('#isvip').hide();
                $('#vipendtime').text('未开通');
            }
        }
    });
}

$(document).ready(function () {
    // 加载第一页数据
    loadOrders(page, page_size);

    // 上一页
    $('#previous-page').click(function (e) {
        e.preventDefault(); // 阻止默认事件
        if (page > 1) {
            page--;
            loadOrders(page, page_size);
        }
    });

    // 下一页
    $('#next-page').click(function (e) {
        e.preventDefault(); // 阻止默认事件
        if (page < Math.ceil(total / page_size)) {
            page++;
            loadOrders(page, page_size);
        }
    });
});

// 加载订单数据的函数
function loadOrders(page, page_size) {
    // 示例中没有详细的后端接口URL，所以这里假设为'/api/getOrders'
    // 实际开发中需要替换为正确的URL
    $.ajax({
        url: '/Users/GetOrders',
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
        str += `<tr><td>` + orders[i].orderCode + `</td><td>` + orders[i].orderMoney + `</td><td>` + orders[i].createTime + `</td><td>` + status + `</td><td>` + dosomething + `</td></tr>`;
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
            loadOrders(page, page_size);
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
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadOrders(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            loadOrders(totalPages, page_size);  // 跳转到尾页
        });
    }
}


function checkOrder(orderCode) {
    loadingOverlay.show();
    $.ajax({
        url: "/Users/CheckUserOrder",
        type: "post",
        dataType: "json",//返回对象
        data: {
            orderCode: orderCode
        },
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                balert('核验结果：' + res.msg, 'success', false, 1500, 'center');
                loadOrders(page, page_size);
            } else {
                balert('核验结果：' + res.msg, 'danger', false, 1500, 'center');
            }
        },
        error: function (e) {
            loadingOverlay.hide();
            window.location.href = "/Users/Login"
        }
    });
}

function signIn() {
    //发起请求
    loadingBtn('.signInBtn');
    $.ajax({
        url: "/Users/SignIn",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            unloadingBtn('.signInBtn');
            if (res.success) {
                balert(res.msg, 'success', false, 1500, 'center');
            }
            else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

function exchangeCard() {
    var cardno = $('#cardno').val().trim();
    if (cardno == "") {
        balert('卡号不能为空', 'danger', false, 1500, 'center');
        return;
    }
    //发起请求
    loadingBtn('.exchangeCardBtn');
    $.ajax({
        url: "/Users/ExchangeCard",
        type: "post",
        dataType: "json",//返回对象
        data: {
            cardno: cardno
        },
        success: function (res) {
            unloadingBtn('.exchangeCardBtn');
            if (res.success) {
                balert(res.msg, 'success', false, 1500, 'center');
            }
            else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}