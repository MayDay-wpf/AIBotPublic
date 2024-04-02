// 在页面加载完成后设置全局的jQuery AJAX预过滤器
var IP;
var Address;
var Scrolling;
var HeadImgPath;
$(document).ready(function () {
    let savedScrollPosition = localStorage.getItem('sidebarScrollPosition');
    if (savedScrollPosition) {
        $('#dpSidebarBody').scrollTop(savedScrollPosition);
    }
    // 添加AJAX预过滤器，用于在每个请求中自动添加JWT token
    $.ajaxPrefilter(function (options, originalOptions, xhr) {
        var token = localStorage.getItem('aibotpro_userToken');
        if (token) {
            // 添加 Authorization 头部，携带JWT token
            xhr.setRequestHeader('Authorization', 'Bearer ' + token);
            //token写入cookie
            Cookies.set('token', token, { expires: 30 });
        } else {
            window.location.herf = "/Users/Login"
        }
    });
    IsLogin();
    getIpInfo();
    isVipExpired();
    getUserSetting();
    var pathname = window.location.pathname;
    pathname = pathname.toLowerCase();
    if (pathname != "/workshop/workflow")
        isAdmin();
    IsBlackUser();
    getUserInfo();
    if (isMobile()) {
        $('.chat-body-footer').css({
            'position': 'fixed',
            'bottom': '0',
            'left': '0',
            'right': '0'
        });
        $('.content-body-chat').css({
            'padding': 0
        });
        $('.content-body').css({
            'padding': 0
        });
    }
});

//判断是否为移动端
function isMobile() {
    var userAgentInfo = navigator.userAgent;
    //判断鸿蒙系统
    var Agents = ["Android", "iPhone",
        "SymbianOS", "Windows Phone",
        "iPad", "iPod", "HarmonyOS"];
    var flag = false;
    for (var v = 0; v < Agents.length; v++) {
        if (userAgentInfo.indexOf(Agents[v]) > 0) {
            flag = true;
            break;
        }
    }
    //console.log(flag);
    return flag;
}
//获取IP信息
function getIpInfo() {
    //请求GetIPInfo
    $.ajax({
        type: "Post",
        url: "/Home/GetIPInfo",
        dataType: "json",
        success: function (res) {
            if (res.success) {
                IP = res.ip;
                Address = res.address;
            }
        }
    });
}

//生成GUID
function generateGUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return (
        s4() +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        '-' +
        s4() +
        s4() +
        s4()
    );
}
//发送异常信息
function sendExceptionMsg(msg) {
    $.ajax({
        type: "Post",
        url: "/Home/WriteLog",
        data: {
            msg: msg
        },
        dataType: "json",
        success: function (res) {
        }
    });
}
function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}
//获取URL参数
function getUrlParam(name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return decodeURI(r[2]);
    return '';
}
//按钮进入加载状态
function loadingBtn(dom) {
    //禁用按钮
    $(dom).prop('disabled', true)
    $(dom).append(` <span class="spinner-border spinner-border-sm"role="status"aria-hidden="true"></span>`);
}
//解除按钮加载状态
function unloadingBtn(dom) {
    //恢复按钮
    $(dom).prop('disabled', false)
    $(dom).find('span').remove();
}

// 定义一个加载覆盖对象
var loadingOverlay = {
    overlay: $('<div class="loading-overlay"></div>'),
    spinner: $('<div class="loading-spinner"><div class="spinner-border text-primary" role="status"><span class="sr-only">加载中...</span></div></div>'),
    show: function () {
        $('body').append(this.overlay).append(this.spinner);
        this.overlay.fadeIn();
        this.spinner.fadeIn();
    },
    hide: function () {
        this.overlay.fadeOut();
        this.spinner.fadeOut(() => {
            this.overlay.remove();
            this.spinner.remove();
        });
    }
};
//去除字符串中的空格
function removeSpaces(str) {
    return str.replace(/\s+/g, '');
}
//table导出Excel
function addExportButtonToTables() {
    // 遍历页面中的所有table
    $('table').each(function () {
        if ($(this).prev().hasClass('export-btn'))
            return;
        // 创建导出Excel按钮
        var exportBtn = $('<button class="btn btn-sm btn-success ed export-btn">').text('导出Excel');
        // 添加按钮点击事件
        exportBtn.click(function () {
            // 获取当前table的数据
            var tableData = [];
            // 处理thead部分
            $(this).next('table').find('thead tr').each(function () {
                var rowData = [];
                $(this).find('th').each(function () {
                    rowData.push($(this).text());
                });
                tableData.push(rowData);
            });
            // 处理tbody部分
            $(this).next('table').find('tbody tr').each(function () {
                var rowData = [];
                $(this).find('td').each(function () {
                    rowData.push($(this).text());
                });
                tableData.push(rowData);
            });
            // 创建Workbook对象
            var wb = XLSX.utils.book_new();
            // 创建Worksheet对象
            var ws = XLSX.utils.aoa_to_sheet(tableData);
            // 将Worksheet添加到Workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            // 将Workbook转换为Excel文件的二进制数据
            var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            // 创建Blob对象
            var blob = new Blob([wbout], { type: 'application/octet-stream' });
            // 创建下载链接
            var url = URL.createObjectURL(blob);
            var link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "table-byMayMay" + $.now() + ".xlsx");
            document.body.appendChild(link);
            // 触发下载
            link.click();
        });
        // 将按钮添加到table的上方
        $(this).before(exportBtn);
        $("#repositoryDatabase .ed").remove();
    });
}

//判断VIP是否过期
function isVipExpired() {
    //发起请求
    $.ajax({
        url: "/Users/VipExceed",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                //提示VIP已过期
                showConfirmationModal('VIP已过期', '您的VIP已过期，是否立即续费？', function () {
                    window.location.href = '/Pay/VIP';
                });
                return true;
            }
        }
    })
}
//获取用户设置
function getUserSetting() {
    //发起请求
    $.ajax({
        url: "/Users/getUserSetting",
        type: "post",
        dataType: "json",//返回对象
        async: false,
        success: function (res) {
            if (res.success) {
                res = res.data;
                //保存滚动设置
                Scrolling = res.scrolling;
            }
        }
    });
}
//是否为管理员
function isAdmin() {
    //发起请求
    $.ajax({
        url: "/Users/IsAdmin",
        type: "post",
        dataType: "json",//返回对象
        async: false,
        success: function (res) {
            if (res.success) {
                //判断#system-menu中是否存在.system-admin-aibot-pro
                if ($("#system-menu .system-admin-aibot-pro").length === 0) {
                    $("#system-menu").append(`
                    <li class="nav-label system-admin-aibot-pro">
                    <label class="content-label">
                        系统管理 (System Admin)
                    </label>
                    </li>
                    <li class="nav-item system-admin-aibot-pro">
                        <a href="" class="nav-link with-sub" id="datastatistics-main-menu">
                            <i data-feather="pie-chart">
                            </i>
                            数据统计 (Data Statistics)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/GetVisitor" class="nav-sub-link" id="visitor_datastatistics_nav">
                                访客统计（Visitor）
                            </a>
                            <a href="/OpenAll/Consumption" class="nav-sub-link"id="consumption_datastatistics_nav">
                                消耗统计（Consumption）
                            </a>
                        </nav>
                    </li>
                    <li class="nav-item system-admin-aibot-pro">
                        <a href="" class="nav-link with-sub" id="userslist-main-menu">
                            <i data-feather="smile">
                            </i>
                            用户管理 (Users)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/UsersList" class="nav-sub-link" id="userlist_userlists_nav">
                                用户列表（User List）
                            </a>
                            <a href="/OpenAll/VipList" class="nav-sub-link" id="viplist_userlists_nav">
                                会员列表（VIP List）
                            </a>
                            <a href="/OpenAll/BlackList" class="nav-sub-link" id="blacklist_userlists_nav">
                                黑名单（Blacklist）
                            </a>
                        </nav>
                    </li>
                    <li class="nav-item system-admin-aibot-pro">
                        <a href="" class="nav-link with-sub" id="ordermanager-main-menu">
                            <i data-feather="dollar-sign">
                            </i>
                            订单管理 (Order)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/OrderList" class="nav-sub-link" id="orderlist_ordermanager_nav">
                                订单列表（Order List）
                            </a>
                            <a href="/OpenAll/Payment" class="nav-sub-link" id="payment_ordermanager_nav">
                                支付配置 (Payment)
                            </a>
                        </nav>
                    </li>
                    <li class="nav-item system-admin-aibot-pro">
                        <a href="" class="nav-link with-sub" id="notification-main-menu">
                            <i data-feather="mail">
                            </i>
                            通知管理 (Notification)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/SystemNotice" class="nav-sub-link" id="system_notification_nav">
                                系统通知（Send）
                            </a>
                            <a href="/OpenAll/MailNotice" class="nav-sub-link" id="email_notification_nav">
                                邮件发送（mail）
                            </a>
                        </nav>
                    </li>
                    <li class="nav-item system-admin-aibot-pro">
                        <a href="" class="nav-link with-sub" id="aisystem-main-menu">
                            <i data-feather="codesandbox">
                            </i>
                            AI管理 (AI System)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/AiChatModelSetting" class="nav-sub-link" id="aichatmodel_aisystem_nav">
                                对话模型管理 (Chat Model)
                            </a>
                            <a href="/OpenAll/AiDrawModelSetting" class="nav-sub-link" id="aidrawmodel_aisystem_nav">
                                绘画模型管理 (Draw Model)
                            </a>
                            <a href="/OpenAll/WorkShopModelSetting" class="nav-sub-link" id="workshopmodel_aisystem_nav">
                                工坊模型管理 (WorkShop Model)
                            </a>
                            <a href="/OpenAll/AssistantSetting" class="nav-sub-link" id="assistantmodel_aisystem_nav">
                                助理模型管理 (Assistant Model)
                            </a>
                            <a href="/OpenAll/ModelPriceSetting" class="nav-sub-link" id="modelprice_aisystem_nav">
                                价格管理 (Price)
                            </a>
                        </nav>
                    </li>
                    <li class="nav-item system-admin-aibot-pro">
                        <a href="" class="nav-link with-sub" id="system-main-menu">
                            <i data-feather="settings">
                            </i>
                            系统管理 (System)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/SystemConfig" class="nav-sub-link" id="systemcfg_system_nav">
                                系统配置（Setting）
                            </a>
                            <a href="/OpenAll/AdminSetting" class="nav-sub-link" id="admin_system_nav">
                                管理员管理（Admin）
                            </a>
                            <a href="/OpenAll/SystemLog" class="nav-sub-link"id="systemlog_system_nav">
                                系统日志（Log）
                            </a>
                        </nav>
                    </li>`);
                    //恢复菜单的功能
                    //$('#system-menu').on('click', '.nav-link.with-sub', function (e) {
                    //    e.preventDefault(); // 阻止默认的导航行为
                    //    var $subMenu = $(this).next('.nav-sub');

                    //    // 切换.show类来控制菜单的展开和折叠
                    //    if ($subMenu.hasClass('show')) {
                    //        $subMenu.removeClass('show').slideUp();  // 如果是展开的，折叠它
                    //    } else {
                    //        // 如果是折叠的，先把其他所有已展开的子菜单折叠，再展开当前点击的子菜单
                    //        $('.nav-sub.show').removeClass('show').slideUp();
                    //        $subMenu.addClass('show').slideDown();  // 展开它
                    //    }
                    //});
                    feather.replace();
                }
            } else {
                $(".system-admin-aibot-pro").remove();
            }
            const psSidebarBody = new PerfectScrollbar('#dpSidebarBody', {
                suppressScrollX: false
            });
            $('.nav-sidebar .with-sub').on('click', function (e) {
                e.preventDefault();

                var $this = $(this);
                var $parentLi = $this.parent();
                var $subMenu = $parentLi.find('.nav-sub');
                var wasVisible = $subMenu.is(':visible');

                // 首先折叠所有其他已经展开的兄弟子菜单
                //$parentLi.siblings('.show').removeClass('show').children('.nav-sub').slideUp(300, function () {
                //    if (psSidebarBody && typeof psSidebarBody.update === 'function') {
                //        psSidebarBody.update();
                //    }
                //});

                // 处理当前点击的子菜单
                if (!wasVisible) {
                    // 如果子菜单之前不可见（收起状态），则把它展开
                    $subMenu.slideDown(300, function () {
                        $parentLi.addClass('show');
                        if (psSidebarBody && typeof psSidebarBody.update === 'function') {
                            psSidebarBody.update();
                        }
                    });
                } else {
                    // 如果子菜单之前可见（展开状态），则把它收起
                    $subMenu.slideUp(300, function () {
                        $parentLi.removeClass('show');
                        if (psSidebarBody && typeof psSidebarBody.update === 'function') {
                            psSidebarBody.update();
                        }
                    });
                }
            });
        },
        error: function (res) {
            $(".system-admin-aibot-pro").remove();
            return false;
        }
    });
}
//判断是否为黑名单用户
function IsBlackUser() {
    //发起请求
    $.ajax({
        url: "/Users/IsBlackUser",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                if (res.isBlack == 1) {
                    balert('您已被加入黑名单，无法使用本系统', 'danger', false, 1500, 'center', function () {
                        //清除本地存储
                        localStorage.clear();
                        //跳转到登录页面
                        window.location.href = '/Users/Login';
                    });
                    return true;
                }
            }
        }
    })
}

function shutDown() {
    //清除本地存储
    localStorage.clear();
    //跳转到登录页面
    window.location.href = '/Users/Login';
}
function price() {
    //发起请求
    $.ajax({
        url: "/Home/GetModelPrice",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                var str = '<div style="max-height:500px;overflow-y: scroll;"><p>我们的原则是：<b>不限期无理由退款,用户体验第一</b></p><p>退款方式：加左下角QQ群找<b>群主</b></p><p>退款金额=充值-使用-所有赠送金额</p><p>1k token≈600汉字，下方的输入输出价格皆以1k token 为标准<p><p>计费算法=(输入+输出)*倍率，倍率小于1则是有折扣<p><p style="color:orangered"><b>各模型价格受OpenAI等官方影响存在不稳定性，以及特殊活动，模型价格也会有差异，本站保留在合理范围内，随时涨价或降价或上架或下架各模型的权力</b></p><table><tr><td>模型</td><td>输入价格</td><td>输出价格</td><td>VIP输入价格</td><td>VIP输出价格</td><td>普通用户倍率</td><td>VIP倍率</td></tr>';
                for (var i = 0; i < res.length; i++) {
                    str += `<tr><td>${res[i].modelName}</td><td>${res[i].modelPriceInput}</td><td>${res[i].modelPriceOutput}</td><td>${res[i].vipModelPriceInput}</td><td>${res[i].vipModelPriceOutput}</td><td>${res[i].rebate}</td><td>${res[i].vipRebate}</td></tr>`;
                }
                str += '</table></div>';
                showConfirmationModal('价格信息', str);
            }
        }
    });
}
function copyText(txt) {
    //复制到剪贴板
    var input = document.createElement('input');
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('value', txt);
    document.body.appendChild(input);
    input.select();
    if (document.execCommand('copy')) {
        document.execCommand('copy');
        balert('复制成功', 'success', false, 1500, 'center');
    } else {
        balert('复制失败', 'danger', false, 1500, 'center');
    }
    document.body.removeChild(input);
}

function getUserInfo() {
    $.ajax({
        url: "/Users/GetUserInfo",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                HeadImgPath = res.headImg;
            }
        }
    });
}
function IsLogin() {
    $.ajax({
        url: "/Users/IsLogin",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            if (!res.success) {
                window.location.href = "/Users/Login"
            }
        }, error: function (err) {
            window.location.href = "/Users/Login"
        }
    });
}
// 改进后的Base64编码函数，可以处理中文字符
function encodeBase64(str) {
    // 使用encodeURIComponent先将非ASCII字符编码，然后转成base64
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
}

// 改进后的Base64解码函数，可以处理中文字符
function decodeBase64(encodedStr) {
    // 先将base64解码，然后使用decodeURIComponent将编码的字符还原
    return decodeURIComponent(Array.from(atob(encodedStr)).map(c =>
        '%' + c.charCodeAt(0).toString(16).padStart(2, '0')
    ).join(''));
}
