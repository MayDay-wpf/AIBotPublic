// 在页面加载完成后设置全局的jQuery AJAX预过滤器
var IP;
var Address;
var Scrolling;
var HeadImgPath;
var UserNickText;
let backgroundImg = '';
let fontColor = '#000000';
var menuShow = true;

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
    if (pathname != "/workshop/workflow") {
        isAdmin();
        getUISetting();
        customMenu();
        // 创建应用按钮
        var applyBtn = $('<button/>', {
            class: 'btn btn-primary apply-btn',
            html: feather.icons['check-circle'].toSvg() + ' 引用',
            css: {
                'display': 'none'
            },
            click: function () {
                $(this).hide();
                copyBtn.hide();
                window.getSelection().removeAllRanges();
                $Q.val("# 引用对话片段： " + selectedText + "\n\n");
                adjustTextareaHeight();
                //$Q获得焦点
                $Q.focus();
            }
        }).appendTo('body'); // 直接添加到 body

        // 创建复制按钮
        var copyBtn = $('<button/>', {
            class: 'btn btn-success copy-btn-select',
            html: feather.icons['copy'].toSvg() + ' 复制',
            css: {
                'display': 'none'
            },
            click: function () {
                copyText(selectedText);
                $(this).hide();
                applyBtn.hide();
            }
        }).appendTo('body');

        var selectedText = '';
        // 监听文本选取事件
        $(document).on('mouseup', function (e) {
            var selection = window.getSelection();
            if (selection.rangeCount > 0) {
                var container = selection.getRangeAt(0).commonAncestorContainer;
                container = container.nodeType === 3 ? container.parentNode : container;

                // 检查选中的文本是否来源于 .chat-message-box 或其子元素
                if ($(container).closest('.chat-message-box').length > 0) {
                    selectedText = selection.toString();
                    if (selectedText) {
                        // 显示按钮并调整位置
                        applyBtn.css({
                            'left': e.pageX,
                            'top': e.pageY + 10 // 根据需要调整偏移量
                        }).fadeIn();

                        copyBtn.css({
                            'left': e.pageX + applyBtn.outerWidth() + 10, // 根据引用按钮的宽度调整偏移量
                            'top': e.pageY + 10
                        }).fadeIn();
                    } else {
                        applyBtn.hide();
                        copyBtn.hide();
                    }
                }
            } else {
                applyBtn.hide();
                copyBtn.hide();
            }
        });

        // 点击页面其他位置隐藏按钮
        $(document).on('click', function (e) {
            var target = $(e.target);

            // 如果目标元素是按钮或按钮的子元素，不执行任何操作
            if (target.is('.apply-btn, .copy-btn-select') || target.closest('.apply-btn, .copy-btn-select').length > 0) {
                return;
            }

            // 如果点击的是.chat-message-box，但不是文本选取，隐藏按钮
            if (target.closest('.chat-message-box').length > 0) {
                var selection = window.getSelection();
                // 如果当前没有文本被选取或选取的文本为空，则隐藏按钮
                if (!selection.toString()) {
                    applyBtn.hide();
                    copyBtn.hide();
                }
            } else {
                // 如果点击的不是.chat-message-box，隐藏按钮
                applyBtn.hide();
                copyBtn.hide();
                selectedText = '';
            }
        });
    }
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
//获取当前时间
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
//获取当前时间戳
function getCurrentTimestamp() {
    return new Date().getTime();
}
//iso时间转换为标准时间格式
function isoStringToDateTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
                        <a href="" class="nav-link with-sub" id="mall-main-menu">
                            <i data-feather="shopping-cart">
                            </i>
                            商城管理 (Mall)
                        </a>
                        <nav class="nav nav-sub">
                            <a href="/OpenAll/Grounding" class="nav-sub-link" id="grounding_mall_nav">
                                商品上架（Grounding）
                            </a>
                            <a href="/OpenAll/Goods" class="nav-sub-link" id="goods_mall_nav">
                                商品管理（Goods）
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
            //const psSidebarBody = new PerfectScrollbar('#dpSidebarBody', {
            //    suppressScrollX: false
            //});
            $('.nav-sidebar .with-sub').on('click', function (e) {
                e.preventDefault();

                var $this = $(this);
                var $parentLi = $this.parent();
                var $subMenu = $parentLi.find('.nav-sub');
                var wasVisible = $subMenu.is(':visible');

                // 处理当前点击的子菜单
                if (!wasVisible) {
                    // 如果子菜单之前不可见（收起状态），则把它展开
                    $subMenu.stop(true, true).slideDown(300, function () {
                        $parentLi.addClass('show');
                    });
                } else {
                    // 如果子菜单之前可见（展开状态），则把它收起
                    $subMenu.stop(true, true).slideUp(300, function () {
                        $parentLi.removeClass('show');
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
    var tempTextArea = $('<textarea>').appendTo('body').val(txt).select(); // 创建临时的 textarea 并选中文本
    document.execCommand('copy'); // 执行复制操作
    tempTextArea.remove(); // 移除临时创建的 textarea
    balert('复制成功', 'success', false, 1500, 'center');
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
                UserNickText = res.nick;
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
function getUISetting() {
    //loadingOverlay.show();
    $.ajax({
        url: '/Home/GetUISetting',
        type: 'Post',
        success: function (res) {
            //loadingOverlay.hide();
            if (res.success) {
                if (res.data.systemName != null) {
                    $('.sidebar-logo span').text(res.data.systemName);
                } else {
                    $('.sidebar-logo span').text('Mufasa');
                }
                if (res.data.menuTransparency != null) {
                    $('.sidebar').css('opacity', res.data.menuTransparency);
                } else {
                    $('.sidebar').css('opacity', '1');
                }
                if (res.data.contentTransparency != null) {
                    $('.content').css('opacity', res.data.contentTransparency);
                } else {
                    $('.content').css('opacity', '1');
                }
                if (res.data.colorPicker != null) {
                    fontColor = res.data.colorPicker;
                } else {
                    fontColor = '#000000';
                }
                if (res.data.shadowSize != null) {
                    if (res.data.shadowSize > 0)
                        $('body').css('text-shadow', `0 0 ${res.data.shadowSize}px ${fontColor}`);
                    else
                        $('body').css('text-shadow', 'none');
                } else {
                    $('body').css('text-shadow', 'none');
                }
                if (res.data.backgroundImg != null) {
                    $('body').css('background-image', `url('${res.data.backgroundImg}')`);
                    backgroundImg = res.data.backgroundImg;
                } else {
                    $('body').css('background', `none`);
                    backgroundImg = '';
                }
            }
            else {
                //balert(res.msg, 'danger', false, 1500, 'center');
            }
        }, errr: function () {
            //loadingOverlay.hide();
        }
    });
}
function aboutus() {
    showConfirmationModal('AIBot Pro System', 'AIBot Pro System 是一款基于OpenAI的对话系统<br>支持多种功能，包括创意工坊、角色扮演、文件助手、知识库、产品中心、充值中心、个人中心等<br>AIBot Pro由 MayMay团队开发运营，如果觉得我们做到还不错<br><b style="color:red">【请收购我们】</b>');
}
function customMenu() {
    $("#systemNAME").html('Mufasa');
    //检查#custommenu 下是否存在#QQ #ABOUTUS #GITHUB
    if ($("#custommenu #QQ").length > 0 || $("#custommenu #ABOUTUS").length > 0 || $("#custommenu #GITHUB").length > 0) {
        return;
    }
    var html = `<li class="nav-item" id="ImgHost">
                    <a href="https://img.maymay5.com/" style="color:rgb(112,188,255)" class="nav-link" target="_blank">
                        <i data-feather="image">
                        </i>
                        只是图床
                    </a>
                </li>
                <li class="nav-item" id="QQ">
                    <a href="https://qm.qq.com/q/gNwQHVDhkc" style="color:rgb(23,223,135)" class="nav-link" target="_blank">
                        <i data-feather="message-circle">
                        </i>
                        QQ群：833716234
                    </a>
                </li>
                <li class="nav-item" id="ABOUTUS">
                    <a href="#" onclick="aboutus()" class="nav-link">
                        <i data-feather="aperture">
                        </i>
                        关于我们 (About Us)
                    </a>
                </li>
                <li class="nav-item" id="GITHUB">
                    <a href="https://github.com/MayDay-wpf/AIBotPublic" class="nav-link" target="_blank">
                        <i data-feather="github">
                        </i>
                        GitHub
                    </a>
                </li>`;
    $("#custommenu").append(html);
    feather.replace();
}
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function escapeQuotes(str) {
    return str.replace(/'/g, "\\'");
}
function truncateString(str, num) {
    if (str.length > num) {
        return str.slice(0, num) + "...";
    } else {
        return str;
    }
}
function completeMarkdown(markdown) {
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let completedMarkdown = '';
    let codeBlockLines = [];
    let codeBlockLanguage = '';

    function addCompletedCodeBlock() {
        if (codeBlockLines.length > 0) {
            completedMarkdown += '```' + codeBlockLanguage + '\n';
            completedMarkdown += codeBlockLines.join('\n') + '\n';
            completedMarkdown += '```\n';
            codeBlockLines = [];
            codeBlockLanguage = '';
        }
    }

    lines.forEach((line, index) => {
        if (line.trim().startsWith('```')) {
            if (inCodeBlock) {
                addCompletedCodeBlock();
                inCodeBlock = false;
            } else {
                codeBlockLanguage = line.trim().slice(3);
                inCodeBlock = true;
            }
        } else if (inCodeBlock) {
            codeBlockLines.push(line);
        } else {
            completedMarkdown += line + '\n';
        }

        if (index === lines.length - 1 && inCodeBlock) {
            addCompletedCodeBlock();
        }
    });

    return completedMarkdown;
}