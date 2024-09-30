// 在页面加载完成后设置全局的jQuery AJAX预过滤器
var IP;
var Address;
var Scrolling;
var HeadImgPath;
var UserNickText;
let backgroundImg = '';
let fontColor = '#000000';
var menuShow = true;
var savedDarkMode = localStorage.getItem('darkMode');
var timerIds = {};
let promptlistPage = 1;
let promptlistSize = 20;
var topVipType = "";

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
            Cookies.set('token', token, {expires: 30});
        } else {
            window.location.herf = "/Home/Welcome"
        }
    });
    IsLogin();
    getIpInfo();
    isVipExpired();
    getUserSetting();
    getTopVipType();
    var pathname = window.location.pathname;
    pathname = pathname.toLowerCase();
    if (pathname != "/workshop/workflow") {
        isAdmin();
        getUISetting();
        customMenu();
        getUserPromptList('init');
        // 创建应用按钮
        var applyBtn = $('<button/>', {
            class: 'btn btn-info apply-btn', html: '<i class="icon ion-quote"></i> 引用', css: {
                'display': 'none',
                'z-index': 1055
            }, click: function () {
                $(this).hide();
                copyBtn.hide();
                window.getSelection().removeAllRanges();
                $Q.val("# 引用对话片段： " + selectedText + "\n\n ---------------------------------------------------------------------- \n\n");
                adjustTextareaHeight();
                //$Q获得焦点
                $Q.focus();
            }
        }).appendTo('body'); // 直接添加到 body

        // 创建复制按钮
        var copyBtn = $('<button/>', {
            class: 'btn btn-success copy-btn-select', html: feather.icons['copy'].toSvg() + ' 复制', css: {
                'display': 'none',
                'z-index': 1055
            }, click: function () {
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
                            'left': e.pageX, 'top': e.pageY + 10 // 根据需要调整偏移量
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
            if (!$(e.target).closest('.custom-delete-btn-1, .custom-confirm-delete-1').length) {
                $('.custom-confirm-delete-1').removeClass('custom-show-1');
            }
            if (!$(e.target).closest('.delete-btn-1, .confirm-delete').length) {
                $('.confirm-delete').hide();
            }
        });
    }
    //如果hljs已已定义
    IsBlackUser();
    getUserInfo();
});

//判断是否为移动端
function isMobile() {
    var userAgentInfo = navigator.userAgent;
    //判断鸿蒙系统
    var Agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod", "HarmonyOS"];
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
        type: "Post", url: "/Home/GetIPInfo", dataType: "json", success: function (res) {
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

    return (s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4());
}

//发送异常信息
function sendExceptionMsg(msg) {
    $.ajax({
        type: "Post", url: "/Home/WriteLog", data: {
            msg: msg
        }, dataType: "json", success: function (res) {
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
        if ($(this).prev().hasClass('export-btn')) return;
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
            var wbout = XLSX.write(wb, {bookType: 'xlsx', type: 'array'});
            // 创建Blob对象
            var blob = new Blob([wbout], {type: 'application/octet-stream'});
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
        url: "/Users/VipExceed", type: "post", dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                if (res.exceed && !res.unopened) {
                    //用户开通了会员，但是依旧过期
                    showConfirmationModal('VIP已过期', '您的VIP已过期，是否立即续费？', function () {
                        window.location.href = '/Pay/VIP';
                    });
                }

            }
        }
    })
}

//获取用户设置
function getUserSetting() {
    //发起请求
    $.ajax({
        url: "/Users/getUserSetting", type: "post", dataType: "json",//返回对象
        async: false, success: function (res) {
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
        url: "/Users/IsAdmin", type: "post", dataType: "json",//返回对象
        async: false, success: function (res) {
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
                            <a href="/OpenAll/ErrBillingList" class="nav-sub-link" id="errbillinglist_ordermanager_nav">
                                撤销列表（Cancel List）
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
                                艺术模型管理 (Art Model)
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
        }, error: function (res) {
            $(".system-admin-aibot-pro").remove();
            return false;
        }
    });
}

//判断是否为黑名单用户
function IsBlackUser() {
    //发起请求
    $.ajax({
        url: "/Users/IsBlackUser", type: "post", dataType: "json",//返回对象
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
        url: "/Home/GetModelPrice", type: "post", dataType: "json",//返回对象
        success: function (res) {
            if (res.success) {
                res = res.data;
                var str = '<div style="max-height:500px;overflow-y: scroll;"><p>我们的原则是：<b>不限期无理由退款,用户体验第一</b></p><p>退款方式：加左下角QQ群找<b>群主</b></p><p>退款金额=充值-使用-所有赠送金额</p><p>1k token≈600汉字，下方的输入输出价格皆以1k token 为标准<p><p>计费算法=(输入+输出)*倍率，倍率小于1则是有折扣<p><p style="color:orangered"><b>各模型价格受OpenAI等官方影响存在不稳定性，以及特殊活动，模型价格也会有差异，本站保留在合理范围内，随时涨价或降价或上架或下架各模型的权力</b></p><table><tr><td>模型昵称</td><td>模型名</td><td>输入价格</td><td>输出价格</td><td>VIP输入价格</td><td>VIP输出价格</td><td>普通用户倍率</td><td>VIP倍率</td><td>普通用户按次计费</td><td>VIP按次计费</td></tr>';
                for (var i = 0; i < res.length; i++) {
                    if (res[i].modelNick == null || res[i].modelNick == "") res[i].modelNick = res[i].modelPrice.modelName;
                    str += `<tr><td>${res[i].modelNick}</td>
                            <td>${res[i].modelPrice.modelName}</td>
                            <td>${res[i].modelPrice.modelPriceInput}</td>
                            <td>${res[i].modelPrice.modelPriceOutput}</td>
                            <td>${res[i].modelPrice.vipModelPriceInput}</td>
                            <td>${res[i].modelPrice.vipModelPriceOutput}</td>
                            <td>${res[i].modelPrice.rebate}</td>
                            <td>${res[i].modelPrice.vipRebate}</td>
                            <td>${res[i].modelPrice.onceFee}</td>
                            <td>${res[i].modelPrice.vipOnceFee}</td></tr>`;
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
        url: "/Users/GetUserInfo", type: "post", dataType: "json",//返回对象
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
        url: "/Users/IsLogin", type: "post", dataType: "json",//返回对象
        success: function (res) {
            if (!res.success) {
                window.location.href = "/Home/Welcome"
            }
        }, error: function (err) {
            window.location.href = "/Home/Welcome"
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
    return decodeURIComponent(Array.from(atob(encodedStr)).map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
}

function getUISetting() {
    //loadingOverlay.show();
    $.ajax({
        url: '/Home/GetUISetting', type: 'Post', success: function (res) {
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
                    if (res.data.shadowSize > 0) $('body').css('text-shadow', `0 0 ${res.data.shadowSize}px ${fontColor}`); else $('body').css('text-shadow', 'none');
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
            } else {
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
    var html = `<li class="nav-item" id="STATUS">
                    <a href="https://status.aibotpro.cn/status/aibot" style="color:#17a2b8" class="nav-link" target="_blank">
                        <i data-feather="activity">
                        </i>
                        模型可用性监控
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
                <li class="nav-item" id="IaskU">
                    <a href="https://55555.wiki/doc/10/" class="nav-link" target="_blank">
                        <i data-feather="book-open">
                        </i>
                        使用方法（Instructions）
                    </a>
                </li>
                <li>
                    <hr class="mg-t-30 mg-b-25">
                    <label class="content-label">
                           友情链接
                    </label>
                  <li class="nav-item" id="ImgHost">
                    <a href="https://img2anywhere-hk.maymay5.com/" class="nav-link" target="_blank">
                        <i data-feather="image">
                        </i>
                        只是图床
                    </a>
                  </li>
                  <li>
                    <a href="https://55555.wiki/" class="nav-link" target="_blank">
                        <i data-feather="file-text">
                        </i>
                        在线文档
                    </a>
                  </li>
                  <li class="nav-item" id="GITHUB">
                    <a href="https://github.com/MayDay-wpf/AIBotPublic" class="nav-link" target="_blank">
                        <i data-feather="github">
                        </i>
                        GitHub
                    </a>
                  </li>
                  <li class="nav-item" id="VSCodeWeb">
                    <a href="https://vscode.dev/?vscode-lang=zh-cn" class="nav-link" target="_blank">
                        <i data-feather="code">
                        </i>
                        VS Code for the Web
                    </a>
                  </li>
                  <li class="nav-item" id="SQLTruck">
                    <a href="https://sql.aibotpro.cn/" class="nav-link" target="_blank">
                        <i data-feather="coffee">
                        </i>
                        SQL-Truck
                    </a>
                  </li>
                  <li class="nav-item" id="SQLTruck">
                    <a href="https://pdf.maymay5.com/?lang=zh_CN" class="nav-link" target="_blank">
                        <i data-feather="type">
                        </i>
                        PDF工具
                    </a>
                  </li>
                </li>
                <li class="nav-item" id="UserUseSpecifications">
                    <hr class="mg-t-30 mg-b-25">
                    <a href="/system/doc/UserUseSpecifications.html" style="color:gray" class="nav-link" target="_blank">
                        <i data-feather="bookmark">
                        </i>
                        用户使用规范
                    </a>
                </li>
                <li class="nav-item" id="UserPrivacyRegulations">
                    <a href="/system/doc/UserPrivacyRegulations.html" style="color:gray" class="nav-link" target="_blank">
                        <i data-feather="bookmark">
                        </i>
                        用户隐私条例
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

function isVIP(callback, needQuery = false) {
    if (typeof callback !== 'function') {
        return;
    }
    const now = new Date().getTime();
    const cachedData = localStorage.getItem('vipStatus');

    if (cachedData && !needQuery) {
        const {status, expiry} = JSON.parse(cachedData);
        if (now < expiry) {
            // 缓存有效，直接返回结果
            callback(status);
            return;
        } else {
            // 缓存过期，清除缓存
            localStorage.removeItem('vipStatus');
        }
    }

    // 缓存不存在或已过期，发起请求
    $.ajax({
        url: "/Users/IsVIP", type: "post", dataType: "json", async: false, success: function (res) {
            const currentTimestamp = new Date().getTime();
            const status = res.success;
            const vipStatus = {
                status: status, expiry: currentTimestamp + 3600000 // 1小时后过期
            };
            localStorage.setItem('vipStatus', JSON.stringify(vipStatus));
            callback(status);
        }, error: function (err) {
            console.error("查询VIP状态时出错:", err);
            callback(false); // 出错时默认为非VIP
        }
    });
}

function getTopVipType() {
    $.ajax({
        url: "/Users/GetTopVipType", type: "post", dataType: "json",
        async: false,
        success: function (res) {
            if (res.success)
                topVipType = res.data;
        }, error: function (err) {
            console.error("获取VIP状态时出错:", err);
        }
    });
}

function getBalanceToDom(dom) {
    var $domElement = $(dom);
    if ($domElement.length === 0) {
        console.error("未找到目标元素:", dom);
        return;
    }

    $.ajax({
        url: "/Users/GetBalance", type: "post", dataType: "json", success: function (res) {
            if (res && res.data !== undefined) {
                var oldBalance = parseFloat($domElement.text()) || 0;
                var newBalance = parseFloat(res.data);

                // 更新DOM中的余额，显示4位小数
                $domElement.html(newBalance.toFixed(4));

                var difference = oldBalance - newBalance;

                if (difference > 0.5) {
                    // 创建动画元素
                    var $animation = $('<div>')
                        .text('-' + difference.toFixed(4))
                        .css({
                            position: 'absolute',
                            left: $domElement.offset().left + 'px',
                            top: $domElement.offset().top + 'px',
                            color: 'red',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            opacity: 1,
                            zIndex: 9999
                        });

                    $('body').append($animation);

                    $animation.animate({
                        top: '-=50px', opacity: 0
                    }, 1500, function () {
                        $(this).remove();
                    });
                } else if (difference < -0.5) {
                    //余额增多
                    var $animation = $('<div>')
                        .text('+' + Math.abs(difference.toFixed(4)))
                        .css({
                            position: 'absolute',
                            left: $domElement.offset().left + 'px',
                            top: $domElement.offset().top + 'px',
                            color: '#43e700',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            opacity: 1,
                            zIndex: 9999
                        });

                    $('body').append($animation);

                    $animation.animate({
                        top: '-=50px', opacity: 0
                    }, 1500, function () {
                        $(this).remove();
                    });
                } else {
                    console.log("余额没有减少，不显示动画");
                }
            } else {
                console.error("响应数据格式不正确:", res);
            }
        }, error: function (err) {
            console.error("查询余额时出错:", err);
        }
    });
}

function darkModel() {
    const isDarkMode = $('html').hasClass('dark');
    const newMode = !isDarkMode;
    const dkmodelBtn = $('.dkmodel');
    if (newMode) {
        $('html').addClass('dark');
        dkmodelBtn.html(`<i data-feather="sun" style="color:#ffcd42"></i>`);
    } else {
        $('html').removeClass('dark');
        dkmodelBtn.html(`<i data-feather="moon"></i>`);
    }
    feather.replace();
    // 保存状态到 localStorage
    localStorage.setItem('darkMode', newMode);
}

function initDarkMode() {
    if (savedDarkMode === 'true') {
        $('html').addClass('dark');
    } else if (savedDarkMode === null) {
        // 如果没有保存的状态,并且不是移动设备,默认关闭夜间模式
        localStorage.setItem('darkMode', 'false');
    }
}

// 开始计时函数
// 开始计时函数
function startTimer(selector, color = false) {
    var startTime = Date.now(); // 获取当前时间
    var $element = $(selector); // 获取选择器对应的DOM元素
    var timerId = setInterval(function () {
        var elapsedTime = Date.now() - startTime; // 计算经过的时间
        var seconds = (elapsedTime / 1000).toFixed(1); // 计算秒数并保留一位小数
        $element.text(seconds + "s"); // 更新DOM的文字
        // 根据时间更新颜色
        if (color) {
            if (seconds > 10) {
                $element.removeClass('badge-success badge-warning').addClass('badge-danger');
            } else if (seconds > 5) {
                $element.removeClass('badge-success badge-danger').addClass('badge-warning');
            }
        }
    }, 100); // 每100毫秒更新一次，以允许固定一位小数
    timerIds[selector] = timerId; // 将timerId存储到全局对象中
}

// 停止计时函数
function stopTimer(selector) {
    var timerId = timerIds[selector]; // 从全局对象中获取timerId
    if (timerId) {
        clearInterval(timerId); // 使用timerId清除计时器
        delete timerIds[selector]; // 移除全局对象中的timerId，保持数据清洁
    }
}

function applyMagnificPopup(selector) {
    $(selector + ' img').each(function () {
        var $img = $(this);
        // 检查图片是否已被处理，避免重复添加
        if (!$img.hasClass('magnified')) {
            $img.addClass('magnified'); // 标记已处理
            // 只有当图片没有被<a>标签包裹时，才添加包裹
            if (!$img.parent().is('a')) {
                $img.wrap('<a href="' + $img.attr('src') + '" class="magnific"></a>');
            }
        }
    });

    // 为新包裹的<a>标签初始化magnificPopup
    $(selector + ' .magnific:not(.mfp-ready)').magnificPopup({
        type: 'image', gallery: {
            enabled: true  // 启用画廊功能
        }
    }).addClass('mfp-ready'); // 标记a标签为已初始化
}

function isSupperVIP(callback) {
    $.ajax({
        url: "/Users/IsSupperVIP", type: "post", dataType: "json", success: function (res) {
            callback(res.success);
        }, error: function (err) {
            sendExceptionMsg(`【API：/Users/IsSupperVIP】:${err}`);
            callback(false);  // 出错时默认为非超级VIP
        }
    });
}

//AI转英语快捷键
function bindEnglishPromptTranslation(selector) {
    // 创建一个固定位置的小型加载指示器
    var $loadingIndicator = $('<div class="position-fixed p-2 rounded shadow-sm wait" style="display:none; z-index: 1050; right: 50%; bottom: 10px;">')
        .append('<div class="spinner-border spinner-border-sm text-primary mr-2" role="status"><span class="sr-only">Loading...</span></div>')
        .append('<span>正在翻译...</span>');
    $('body').append($loadingIndicator);

    function showLoadingIndicator() {
        $loadingIndicator.fadeIn(200);
    }

    function hideLoadingIndicator() {
        $loadingIndicator.fadeOut(200);
    }

    $(selector).on('input', function () {
        //检查设置是否开启
        var enable = true;
        var shortcuts_cache = localStorage.getItem('shortcuts');
        if (shortcuts_cache) {
            var cachedData = JSON.parse(shortcuts_cache);
            enable = cachedData.value;
        }
        if (!enable)
            return;
        var $inputElement = $(this);
        var fullText = $inputElement.val();
        var lastIndexOfM = fullText.toLowerCase().lastIndexOf('mmmmm');

        // 如果没有找到完整的 'mmmmm' 字符串，则返回
        if (lastIndexOfM === -1) return;

        // 检查 'mmmmm' 是否在 3 秒内完成输入
        if (Date.now() - $inputElement.data('lastMTime') <= 3000) {
            var textBeforeM = fullText.substring(0, lastIndexOfM);
            var textAfterM = fullText.substring(lastIndexOfM + 5);

            // 显示加载提示
            showLoadingIndicator();

            $.ajax({
                type: "POST",
                url: "/AIdraw/EnglishPrompt",
                dataType: "json",
                data: {"prompt": textBeforeM},
                success: function (data) {
                    if (data.success) {
                        // 验证是否仍然包含 'mmmmm'，确保用户在加载时没有修改
                        if ($inputElement.val().includes('mmmmm')) {
                            // 只替换 'mmmmm'
                            $inputElement.val(textBeforeM + data.data + textAfterM);
                        }
                    } else {
                        balert("转换失败，请重试", "danger", false, 2000);
                    }
                },
                error: function (err) {
                    balert("转换失败，请重试", "danger", false, 2000);
                    sendExceptionMsg("【/AIdraw/EnglishPrompt】：" + err.statusText, "danger");
                },
                complete: function () {
                    hideLoadingIndicator();
                }
            });
        }
    }).on('keypress', function (e) {
        if ((e.key === 'm' || e.key === 'M') && ($(this).val() + e.key).toLowerCase().indexOf('mmmmm') !== -1) {
            $(this).data('lastMTime', Date.now());
        }
    });
}

//AI优化提示词
function bindOptimizePrompt(selector) {
    // 创建一个固定位置的小型加载指示器
    var $loadingIndicator = $('<div class="position-fixed p-2 rounded shadow-sm wait" style="display:none; z-index: 1050; right: 50%; bottom: 10px;">')
        .append('<div class="spinner-border spinner-border-sm text-primary mr-2" role="status"><span class="sr-only">Loading...</span></div>')
        .append('<span>正在优化提示词...</span>');
    $('body').append($loadingIndicator);

    function showLoadingIndicator() {
        $loadingIndicator.fadeIn(200);
    }

    function hideLoadingIndicator() {
        $loadingIndicator.fadeOut(200);
    }

    $(selector).on('input', function () {
        //检查设置是否开启
        var enable = true;
        var shortcuts_cache = localStorage.getItem('shortcuts');
        if (shortcuts_cache) {
            var cachedData = JSON.parse(shortcuts_cache);
            enable = cachedData.value;
        }
        if (!enable)
            return;

        var $inputElement = $(this);
        var fullText = $inputElement.val();
        var lastIndexOfF = fullText.toLowerCase().lastIndexOf('fffff');

        // 如果没有找到完整的 'fffff' 字符串，则返回
        if (lastIndexOfF === -1) return;

        // 检查 'fffff' 是否在 3 秒内完成输入
        if (Date.now() - $inputElement.data('lastMTime') <= 3000) {
            var textBeforeF = fullText.substring(0, lastIndexOfF);
            var textAfterF = fullText.substring(lastIndexOfF + 5);

            // 显示加载提示
            showLoadingIndicator();

            $.ajax({
                type: "POST",
                url: "/Home/OptimizePrompt",
                dataType: "json",
                data: {"prompt": textBeforeF},
                success: function (data) {
                    if (data.success) {
                        // 验证是否仍然包含 'fffff'，确保用户在加载时没有修改
                        if ($inputElement.val().includes('fffff')) {
                            // 只替换 'fffff'
                            $inputElement.val(textBeforeF + data.data + textAfterF);
                        }
                    } else {
                        balert("优化失败，请重试", "danger", false, 2000);
                    }
                },
                error: function (err) {
                    balert("优化失败，请重试", "danger", false, 2000);
                    sendExceptionMsg("【/Home/OptimizePrompt】：" + err.statusText, "danger");
                },
                complete: function () {
                    hideLoadingIndicator();
                }
            });
        }
    }).on('keypress', function (e) {
        if ((e.key === 'f' || e.key === 'F') && ($(this).val() + e.key).toLowerCase().indexOf('fffff') !== -1) {
            $(this).data('lastMTime', Date.now());
        }
    });
}

//常用题词本
function bindInputToSidebar(selector) {
    $(selector).on('input', function (e) {
        var inputValue = $(this).val();

        // 检查输入是否只有一个斜杠
        if (inputValue === '/') {
            // 打开侧边栏
            $('#offCanvas1').addClass('show');
        } else {
            // 其他所有情况都关闭侧边栏
            $('#offCanvas1').removeClass('show');
        }
    });

    // 当输入框失去焦点时，如果内容为空，关闭侧边栏
    $(selector).on('blur', function () {
        if ($(this).val() === '') {
            $('#offCanvas1').removeClass('show');
        }
    });

    // 保留原有的关闭侧边栏和点击外部关闭的功能
    $('.off-canvas .close').on('click', function (e) {
        e.preventDefault();
        $(this).closest('.off-canvas').removeClass('show');
    });

    $(document).on('click touchstart', function (e) {
        e.stopPropagation();
        if (!$(e.target).closest('.off-canvas-menu').length) {
            var offCanvas = $(e.target).closest('.off-canvas').length;
            if (!offCanvas) {
                $('.off-canvas.show').removeClass('show');
            }
        }
    });
}

function showContextMenu(x, y, chatId) {
    // 隐藏任何已显示的右键菜单
    $('.custom-context-menu').remove();

    // 创建菜单HTML
    var menuHtml = `
        <div class="custom-context-menu" style="position:absolute; z-index:1000;">
            <ul>
                <li onclick="saveMemory('','${chatId}')"><i data-feather="cpu"></i>&nbsp;存入记忆</li>
                <li onclick="startEditing('${chatId}')"><i data-feather="edit-3"></i>&nbsp;编辑标题</li>
                <li onclick="exportChat('${chatId}')"><i data-feather="share"></i>&nbsp;导出记录</li>
                <li onclick="multipleChoice()"><i data-feather="check-square"></i>&nbsp;多项选择</li>
                <li class="historyPreview" onclick="showHistoryPreview('${chatId}')"><i data-feather="message-square"></i>&nbsp;预览内容</li>
                <li onclick="deleteChat('${chatId}')" class="text-danger"><i data-feather="trash-2"></i>&nbsp;删除</li>
            </ul>
        </div>
    `;

    // 添加菜单到body
    $('body').append(menuHtml);

    // 获取菜单元素
    var $menu = $('.custom-context-menu');

    // 计算菜单的尺寸
    var menuWidth = $menu.outerWidth();
    var menuHeight = $menu.outerHeight();

    // 获取窗口尺寸
    var windowWidth = $(window).width();
    var windowHeight = $(window).height();

    // 调整X坐标
    if (x + menuWidth > windowWidth) {
        x = windowWidth - menuWidth;
    }

    // 调整Y坐标
    if (y + menuHeight > windowHeight) {
        y = y - menuHeight;
        if (y < 0) y = 0; // 确保菜单不会超出顶部
    }

    // 设置菜单位置
    $menu.css({top: y, left: x});

    feather.replace();

    // 点击其他地方隐藏菜单
    $(document).on('click', function () {
        $('.custom-context-menu').remove();
    });
}

function startEditing(chatId) {
    // 使用转义字符直接在选择器中
    const escapedChatId = chatId.replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1');

    // 寻找 txt 元素并使其可编辑
    const txtElement = $(`#${escapedChatId} txt`);
    txtElement.attr('contenteditable', 'true').focus();

    // 修改鼠标指针，并自动选择所有文本
    txtElement.css('cursor', 'text');
    document.execCommand('selectAll', false, null);

    // 临时移除绑定的 onclick 事件
    const listItem = $(`#${escapedChatId}`);
    const originalOnclick = listItem.attr('onclick');
    listItem.attr('onclick', '');

    // 实时监控文本输入，确保不超过100字符
    txtElement.on('input', function () {
        const maxLength = 100;
        if (this.textContent.length > maxLength) {
            // 如果输入超出100字符，截断超出的部分
            this.textContent = this.textContent.substring(0, maxLength);
            // 将光标移动到文本末尾
            let range = document.createRange();
            let sel = window.getSelection();
            range.selectNodeContents(this);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    });

    // 监听 blur 和 keydown 事件，用于提交内容和截断显示
    txtElement.on('blur keydown', function (e) {
        if (e.type === 'blur' || (e.type === 'keydown' && e.key === 'Enter')) {
            e.preventDefault();

            let textContent = this.textContent.trim(); // 获取聊天标题原始文本
            updateChatTitle(chatId, textContent);  // 更新聊天标题

            // 将文本截断后设置回 txt 元素以供显示
            if (textContent.length > 50) {
                txtElement.text(textContent.substring(0, 50) + "...");
            }

            txtElement.attr('contenteditable', 'false').off('input blur keydown');

            // 编辑完成，恢复原始的点击事件
            listItem.attr('onclick', originalOnclick);
            // 恢复鼠标指针样式
            txtElement.css('cursor', '');
        }
    });
}

function updateChatTitle(chatId, chatTitle) {
    $.ajax({
        url: "/Home/UpdateChatTitle",
        type: "post",
        dataType: "json",
        data: {
            chatId: chatId,
            chatTitle: chatTitle
        },
        success: function (res) {
            if (res.success && chatTitle == "")
                getHistoryList(1, 20, true, false, "");
        }, error: function (err) {
            sendExceptionMsg(`【API：/Home/UpdateChatTitle】:${err}`);
        }
    });
}

function addUserPrompt() {
    var prompt = $('#newPrompt').val().trim();
    if (prompt == "") {
        balert("请输入提示词", "danger", false, 1500, "center");
        return;
    }
    $.ajax({
        url: "/Home/AddUserPrompt",
        type: "post",
        dataType: "json",
        data: {
            prompt: prompt
        },
        success: function (res) {
            balert("添加成功", "success", false, 1500, "center");
            promptlistPage = 1;
            promptlistSize = 20;
            getUserPromptList('init');
        }, error: function (err) {
            sendExceptionMsg(`【API：/Home/AddUserPrompt】:${err}`);
        }
    });
}

function getUserPromptList(type) {
    $.ajax({
        url: "/Home/GetUserPromptList",
        type: "post",
        dataType: "json",
        data: {
            page: promptlistPage,
            size: promptlistSize
        },
        success: function (res) {
            if (res.success) {
                var html = ``;
                var data = res.data;
                for (var i = 0; i < data.length; i++) {
                    html += `<li class="prompt-list-group-item">
                                <div class="prompt-content">
                                    <p id='promptitem-${data[i].id}'>${escapeHtml(data[i].prompt)}</p>
                                </div>
                                <button class="btn btn-sm btn-outline-secondary copy-btn" onclick="copyText($('#promptitem-${data[i].id}').text())">
                                    <i data-feather="copy"></i> 复制
                                </button>
                                <button class="btn btn-sm btn-outline-danger copy-btn" onclick="deleteUserPrompt(${data[i].id})">
                                    <i data-feather="x"></i> 删除
                                </button>
                            </li>`;
                }
                if (type == 'loadmore') {
                    if (data.length == 0) {
                        balert("没有更多了", "warning", false, 1500, "center");
                        promptlistPage--;
                    }
                    $('#promptItems').append(html);
                } else
                    $('#promptItems').html(html);
                feather.replace();
            }
        }, error: function (err) {
            sendExceptionMsg(`【API：/Home/GetUserPromptList】:${err}`);
        }
    });
}

function loadmorePromptList() {
    promptlistPage++;
    getUserPromptList('loadmore');
}

function deleteUserPrompt(id) {
    $.ajax({
        url: "/Home/DeleteUserPrompt",
        type: "post",
        dataType: "json",
        data: {
            id: id
        },
        success: function (res) {
            if (res.success) {
                balert("删除成功", "success", false, 1500, "center");
                promptlistPage = 1;
                promptlistSize = 20;
                getUserPromptList('init');
            } else {
                balert("删除失败", "danger", false, 1500, "center");
            }

        }, error: function (err) {
            balert("系统异常", "danger", false, 1500, "center");
            sendExceptionMsg(`【API：/Home/AddUserPrompt】:${err}`);
        }
    });
}

// 调用函数打开模态框
function exportChat(chatId) {
    $('#exportModal').modal('show');
    showHistoryDetail(chatId);
    $('#exportMarkdown').off('click').on('click', function () {
        exportAny(chatId, "markdown");
        $('#exportModal').modal('hide');
    });

    $('#exportImage').off('click').on('click', function () {
        // 调用图片导出逻辑
        exportAny(chatId, "image");
        $('#exportModal').modal('hide');
    });

    $('#exportHTML').off('click').on('click', function () {
        // 调用HTML导出逻辑
        exportAny(chatId, "html");
        $('#exportModal').modal('hide');
    });
}

function exportAny(chatId, type) {
    loadingOverlay.show();
    if (type === "image") {
        var element = document.querySelector(".chat-body-main");

        // 获取元素的滚动高度
        var scrollHeight = element.scrollHeight;
        var originalHeight = element.style.height;

        // 临时设置元素高度为滚动高度，以显示所有内容
        element.style.height = scrollHeight + 'px';

        html2canvas(element, {
            scrollY: -window.scrollY,
            height: scrollHeight
        }).then(function (canvas) {
            // 恢复原始高度
            element.style.height = originalHeight;

            // 将 canvas 转换为图片 URL
            var imageURL = canvas.toDataURL("image/png");

            // 创建下载链接
            var downloadLink = document.createElement('a');
            downloadLink.href = imageURL;
            downloadLink.download = `${generateGUID()}.png`;

            // 触发下载
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        });
        loadingOverlay.hide();
        return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/Home/ExportChat", true);
    xhr.responseType = "blob";

    // 获取 JWT Token
    var token = localStorage.getItem('aibotpro_userToken');

    if (token) {
        // 设置 Authorization 头，携带 JWT token
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    } else {
        // 如果 token 不存在，跳转到登录页面
        window.location.href = "/Home/Welcome";
        return;
    }

    // 设置请求的 Content-Type
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onload = function () {
        if (xhr.status === 200) {
            // 从 Content-Disposition 头中获取文件名
            var contentDisposition = xhr.getResponseHeader('Content-Disposition');
            var filename = chatId;

            if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
                var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                var matches = filenameRegex.exec(contentDisposition);
                if (matches !== null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            var blob = xhr.response;
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            loadingOverlay.hide();
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        } else {
            balert("导出失败", "danger", false, 1500, "center");
            sendExceptionMsg(`【API：/Home/ExportChat】:${xhr.statusText}`);
        }
    };

    xhr.onerror = function () {
        loadingOverlay.hide();
        balert("导出失败", "danger", false, 1500, "center");
        sendExceptionMsg(`【API：/Home/ExportChat】:${xhr.statusText}`);
    };

    var data = `chatId=${encodeURIComponent(chatId)}&type=${encodeURIComponent(type)}`;
    xhr.send(data);
}

let previewWindow = null;
let chatTabs = [];

function showHistoryPreview(chatId) {
    if (!previewWindow) {
        createPreviewWindow();
    }

    let existingTab = chatTabs.find(tab => tab.chatId === chatId);
    if (existingTab) {
        activateTab(existingTab.tabId);
    } else {
        createNewTab(chatId);
    }

    previewWindow.show();
}

function createPreviewWindow() {
    let windowHtml = `
        <div id="preview-window" class="preview-window">
            <div class="preview-header">
                <span>对话预览</span>
                <div>
                    <span class="minimize-btn" style="cursor: pointer; margin-right: 10px; display: inline-block; width: 20px; text-align: center;"><i style="width: 15px;" data-feather="minus"></i></span>
                    <span class="close-btn" style="cursor: pointer; display: inline-block; width: 20px; text-align: center;"><i style="width: 15px;" data-feather="x"></i></span>
                </div>
            </div>
            <ul class="nav nav-tabs" id="previewTabs" role="tablist"></ul>
            <div class="tab-content" id="previewTabContent" style="height: calc(100% - 90px); overflow-y: auto; padding: 25px;"></div>
        </div>
    `;

    $('body').append(windowHtml);
    feather.replace();
    let isMinimized = false;
    let originalSize = {width: '600px', height: '650px'};

    previewWindow = {
        element: $('#preview-window'),
        show: function () {
            this.element.show();
        },
        hide: function () {
            if (!isMinimized) {
                originalSize = {
                    width: this.element.css('width'),
                    height: this.element.css('height')
                };
                this.element.find('.preview-header').nextAll().hide();
                this.element.css({height: 'auto', width: '300px'});
                this.element.find('.minimize-btn').html(`<i style="width: 15px;" data-feather="maximize"></i>`);
                isMinimized = true;
                feather.replace();
            }
        },
        restore: function () {
            if (isMinimized) {
                this.element.find('.preview-header').nextAll().show();
                this.element.css(originalSize);
                this.element.find('.minimize-btn').html(`<i style="width: 15px;" data-feather="minus"></i>`);
                isMinimized = false;
                feather.replace();
            }
        }
    };

    // 实现拖动功能
    previewWindow.element.find('.preview-header').on('mousedown', function (e) {
        let $draggable = $(this).parent();
        let pos_y = $draggable.offset().top + $draggable.outerHeight() - e.pageY;
        let pos_x = $draggable.offset().left + $draggable.outerWidth() - e.pageX;

        $(document).on('mousemove', function (e) {
            $draggable.offset({
                top: e.pageY + pos_y - $draggable.outerHeight(),
                left: e.pageX + pos_x - $draggable.outerWidth()
            });
        }).on('mouseup', function () {
            $(document).off('mousemove');
        });
        e.preventDefault();
    });

    // 最小化/恢复功能
    previewWindow.element.find('.minimize-btn').on('click', function () {
        if (isMinimized) {
            previewWindow.restore();
        } else {
            previewWindow.hide();
        }
    });

    // 关闭功能
    previewWindow.element.find('.close-btn').on('click', function () {
        previewWindow.element.remove();
        previewWindow = null;
        chatTabs = [];
    });
}

function createNewTab(chatId) {
    let shortId = chatId.substring(0, 8) + '...';
    let tabId = 'tab-' + chatId;

    let $tab = $(`
        <li class="nav-item">
            <a class="nav-link" id="${tabId}-tab" data-toggle="tab" href="#${tabId}" role="tab">
                <span>${shortId}</span>
                <button class="close-tab" type="button" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </a>
        </li>
    `);

    let $content = $(`
        <div class="tab-pane fade" id="${tabId}" role="tabpanel">
            <div class="d-flex justify-content-center align-items-center" style="min-height: 200px;">
                <div class="spinner-border" role="status">
                    <span class="sr-only">加载中...</span>
                </div>
            </div>
        </div>
    `);

    $('#preview-window #previewTabs').append($tab);
    $('#preview-window #previewTabContent').append($content);

    // 为新的tab添加点击事件
    $tab.find('a').on('click', function (e) {
        e.preventDefault();
        activateTab(tabId);
    });

    // 为关闭按钮添加点击事件
    $tab.find('.close-tab').on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();  // 阻止事件冒泡到tab
        removeTab(chatId);
    });

    chatTabs.push({chatId: chatId, tabId: tabId});
    activateTab(tabId);
    loadChatContent(chatId, tabId);
}

function removeTab(chatId) {
    let tabInfo = chatTabs.find(tab => tab.chatId === chatId);
    if (tabInfo) {
        let wasActive = $(`#preview-window [id="${tabInfo.tabId}-tab"]`).hasClass('active');

        $(`#preview-window [id="${tabInfo.tabId}-tab"]`).parent().remove();  // 移除tab
        $(`#preview-window [id="${tabInfo.tabId}"]`).remove();  // 移除tab内容
        chatTabs = chatTabs.filter(tab => tab.chatId !== chatId);

        // 如果删除的是当前激活的tab，或者没有激活的tab，则激活另一个tab
        if (wasActive || $('#preview-window .nav-tabs .active').length === 0) {
            if (chatTabs.length > 0) {
                activateTab(chatTabs[0].tabId);
            }
        }

        // 如果没有剩余的tab，关闭预览窗口
        if (chatTabs.length === 0) {
            if (previewWindow) {
                previewWindow.element.remove();
                previewWindow = null;
            }
        }
    }
}

function activateTab(tabId) {
    $('#preview-window #previewTabs a').removeClass('active');
    $('#preview-window .tab-pane').removeClass('show active');
    $(`#preview-window [id="${tabId}-tab"]`).addClass('active');
    $(`#preview-window [id="${tabId}"]`).addClass('show active');
}


function loadChatContent(chatId, tabId) {
    $.ajax({
        type: "Post",
        url: "/Home/ShowHistoryDetail",
        dataType: "json",
        data: {chatId: chatId},
        success: function (res) {
            let html = "";
            var isvip = false;
            isVIP(function (status) {
                isvip = status;
            });
            var vipHead = isvip ? `<div class="avatar" style="border:2px solid #FFD43B">
                                 <img src='${HeadImgPath}'/>
                                 <i class="fas fa-crown vipicon"></i>
                             </div>
                             <div class="nicknamevip">${UserNickText}</div>` : `<div class="avatar">
                                 <img src='${HeadImgPath}'/>
                             </div>
                             <div class="nickname">${UserNickText}</div>`;
            var imgBox = [];
            for (var i = 0; i < res.data.length; i++) {
                var content = res.data[i].chat;
                var msgclass = "chat-message";
                if (res.data[i].isDel === 2)
                    msgclass = "chat-message chatgroup-masked";
                if (res.data[i].role == "user") {
                    if (content.indexOf('aee887ee6d5a79fdcmay451ai8042botf1443c04') == -1) {
                        content = content.replace(/&lt;/g, "&amp;lt;").replace(/&gt;/g, "&amp;gt;");
                        content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        html += `<div class="${msgclass}" data-group="${res.data[i].chatGroupId}">
                                     <div style="display: flex; align-items: center;">
                                       ${vipHead}
                                     </div>
                                     <div class="chat-message-box">
                                       <pre id="${res.data[i].chatCode}">${content}</pre>
                                     </div>
                                 </div>`;
                    } else {
                        var contentarr = content.split("aee887ee6d5a79fdcmay451ai8042botf1443c04");
                        html += `<div class="${msgclass}" data-group="${res.data[i].chatGroupId}">
                                   <div style="display: flex; align-items: center;">
                                      ${vipHead}
                                   </div>
                                   <div class="chat-message-box">
                                     <pre id="${res.data[i].chatCode}">${contentarr[0].replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;

                        contentarr.slice(1).forEach(item => {
                            if (item.includes('<img ')) {
                                html += item;
                            } else {
                                html += item.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            }
                        });

                        html += `</pre></div>
                                 </div>`;
                        imgBox.push(res.data[i].chatCode);
                    }
                } else {
                    var item = {
                        "id": res.data[i].chatCode,
                        "markdown": content
                    };
                    markdownHis.push(item);
                    var markedcontent = marked(completeMarkdown(content));
                    var firstTime = '';
                    var allTime = '';
                    if (res.data[i].firstTime != "null" && res.data[i].allTime != "null" && res.data[i].firstTime != null && res.data[i].allTime != null) {
                        firstTime = `<span class="badge badge-pill badge-success">${res.data[i].firstTime}s</span>`;
                        allTime = `<span class="badge badge-pill badge-dark">${res.data[i].allTime}s</span>`;
                        if (res.data[i].firstTime > 10) {
                            firstTime = `<span class="badge badge-pill badge-danger">${res.data[i].firstTime}s</span>`;
                        } else if (res.data[i].firstTime > 5) {
                            firstTime = `<span class="badge badge-pill badge-warning">${res.data[i].firstTime}s</span>`;
                        }
                    }

                    html += `<div class="${msgclass}" data-group="${res.data[i].chatGroupId}">
                                 <div style="display: flex; align-items: center;">
                                    <div class="avatar  gpt-avatar">${roleAvatar}</div>
                                    <div class="nickname" style="font-weight: bold; color: black;">${roleName}</div>
                                    <span class="badge badge-info ${res.data[i].model.replace('.', '')}">${res.data[i].model}</span>
                                    ${firstTime}${allTime}
                                 </div>
                                <div class="chat-message-box">
                                    <div id="${res.data[i].chatCode}">${markedcontent}</div>
                                </div>
                            </div>`;
                }
            }
            $(`[id="${tabId}"]`).html(html);

            MathJax.typeset();
            $(`[id="${tabId}"] .chat-message pre code`).each(function (i, block) {
                hljs.highlightElement(block);
            });
            addLanguageLabels();
            addCopyBtn();
            addExportButtonToTables();
            applyMagnificPopup(`[id="${tabId}"] .chat-message-box`);
            imgBox.forEach(item => initImageFolding(`#${item}`));
            createMaskedOverlays();
        },
        error: function (err) {
            $(`[id="${tabId}"]`).html("加载失败，请重试。");
            balert("获取对话详情失败，请联系管理员：err", "danger", false, 2000, "center");
        }
    });
}

function setInputToCache(data, callback) {
    $.ajax({
        url: "/Home/InputToCache",
        type: "post",
        dataType: "json",
        data: {
            chatDto: data
        },
        success: function (res) {
            callback(res.data);
        },
        error: function (err) {
            balert("系统异常", "danger", false, 1500, "center");
            sendExceptionMsg(`【API：/Home/InputToCache】:${err}`);
        }
    });
}

function initImageFolding(selector) {
    const $container = $(selector);
    const $images = $container.find('img.magnified');

    // 检查是否已经创建过图片容器
    if ($container.find('.horizontal-image-container').length > 0) {
        return; // 如果已经创建过,直接返回
    }

    // 等待所有图片加载完成
    let loadedImages = 0;
    $images.on('load', function () {
        loadedImages++;
        if (loadedImages === $images.length) {
            initFolding();
        }
    }).each(function () {
        if (this.complete) $(this).trigger('load');
    });

    function initFolding() {
        // 创建一个新的容器来横向排列图片
        const $horizontalContainer = $('<div>').addClass('horizontal-image-container').css({
            display: 'flex',
            overflowX: 'auto',
            width: '100%',
            marginTop: '10px' // 为与上方文字内容留出空间
        });

        $images.each(function (index) {
            const $img = $(this);
            const $link = $img.parent('a');
            const $wrapper = $('<div>').css({
                width: '100px',
                height: '100px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                marginRight: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                position: 'relative'
            });

            // 克隆图片并应用新样式
            const $clonedImg = $img.clone().css({
                maxWidth: 'none', // 覆盖行内样式
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                transition: 'transform 0.3s ease',
                cursor: 'pointer'
            });

            // 创建新的a标签并保留原有的属性
            const $clonedLink = $link.clone().empty().append($clonedImg).css({
                display: 'block',
                width: '100%',
                height: '100%'
            });
            $wrapper.append($clonedLink);
            $horizontalContainer.append($wrapper);

            // 鼠标悬停事件
            $wrapper.on('mouseenter', function () {
                $clonedImg.css('transform', 'translate(-50%, -50%) scale(1.1)');
            }).on('mouseleave', function () {
                $clonedImg.css('transform', 'translate(-50%, -50%) scale(1)');
            });

            // 隐藏原始图片
            $img.hide();
        });

        // 找到最后一个非图片元素
        let $lastNonImageElement = null;
        $container.contents().each(function () {
            if (this.nodeType === 1 && !$(this).is('img.magnified') && !$(this).find('img.magnified').length) {
                $lastNonImageElement = $(this);
            }
        });

        // 在最后一个非图片元素后插入新的图片容器
        if ($lastNonImageElement) {
            $lastNonImageElement.after($horizontalContainer);
        } else {
            // 如果没有找到非图片元素,则添加到容器末尾
            $container.append($horizontalContainer);
        }

        // 重新初始化 MagnificPopup
        $horizontalContainer.magnificPopup({
            delegate: 'a',
            type: 'image',
            gallery: {
                enabled: true
            }
        });
    }
}


$(document).on('click', '.custom-delete-btn-1', function (e) {
    e.preventDefault();
    const chatgroupid = $(this).data('chatgroupid');
    const $btn = $(this);

    if ($btn.next('.custom-confirm-delete-1').length) {
        $btn.next('.custom-confirm-delete-1').addClass('custom-show-1');
        return;
    }

    const $confirmDialog = $(`
        <div class="custom-confirm-delete-1">
            <div class="custom-confirm-delete-content-1">
                <div class="custom-confirm-delete-arrow-1"></div>
                <p><i class="fas fa-question-circle"></i> 删除模式选择</p>
                <button class="btn btn-sm btn-danger mr-2 custom-confirm-1"><i class="far fa-trash-alt"></i> 彻底删除</button>
                <button class="btn btn-sm btn-warning custom-confirm-2"><i class="fas fa-tag"></i> 标记删除</button>
            </div>
        </div>
    `);

    $btn.after($confirmDialog);

    // 计算尖角位置
    const btnCenter = $btn.offset().left + $btn.width() / 2;
    const dialogLeft = $confirmDialog.offset().left;
    const arrowLeft = btnCenter - dialogLeft - 6; // 6是尖角宽度的一半
    $confirmDialog.find('.custom-confirm-delete-arrow-1').css('left', `${arrowLeft}px`);

    setTimeout(() => $confirmDialog.addClass('custom-show-1'), 10);

    $confirmDialog.find('.custom-confirm-1').on('click', function () {
        deleteChatGroup(chatgroupid, 1);
        $confirmDialog.removeClass('custom-show-1');
    });

    $confirmDialog.find('.custom-confirm-2').on('click', function () {
        deleteChatGroup(chatgroupid, 2);
        const $chatgroup = $(`.chat-message[data-group='${chatgroupid}']`);
        $chatgroup.addClass('chatgroup-masked');
        createMaskedOverlays();
        $confirmDialog.removeClass('custom-show-1');
    });
});

function restoreChatGroup(chatgroupid) {
    loadingOverlay.show();
    $.ajax({
        type: "Post",
        url: "/Home/RestoreChatGroup",
        dataType: "json",
        data: {
            groupId: chatgroupid  // 注意：这里使用传入的 chatgroupid，而不是 id
        },
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                // 找到对应的聊天组元素
                const $chatgroup = $(`.chat-message[data-group='${chatgroupid}']`);

                // 移除遮罩层类
                $chatgroup.removeClass('chatgroup-masked');

                // 移除遮罩层内容和按钮
                $chatgroup.find('.chatgroup-masked-content').remove();
                $chatgroup.find('.chatgroup-masked-buttons').remove();

                balert("上下文已成功恢复", "success", false, 2000, "top");
            } else {
                balert("恢复失败: " + (res.message || "未知错误"), "danger", false, 2000, "center");
            }
        },
        error: function (err) {
            loadingOverlay.hide();
            balert("恢复失败，错误请联系管理员：" + err.statusText, "danger", false, 2000, "center");
        }
    });
}

function createMaskedOverlays() {
    $('.chatgroup-masked').each(function () {
        const $chatgroup = $(this);

        // 检查是否已经有遮罩层内容，如果有则跳过
        if ($chatgroup.find('.chatgroup-masked-content').length > 0) {
            return;
        }

        const chatgroupid = $chatgroup.data('group');

        // 创建遮罩层内容
        const $maskedContent = $('<div class="chatgroup-masked-content"></div>');
        const $buttonsContainer = $('<div class="chatgroup-masked-buttons"></div>');
        const $deleteButton = $('<button class="btn btn-danger btn-sm chatgroup-masked-button delete"><i class="fas fa-trash-alt"></i> 彻底删除</button>');
        const $restoreButton = $('<button class="btn btn-success btn-sm chatgroup-masked-button restore"><i class="fas fa-undo"></i> 恢复</button>');

        $buttonsContainer.append($deleteButton).append($restoreButton);

        // 添加遮罩层内容到聊天组
        $chatgroup.append($maskedContent).append($buttonsContainer);

        // 彻底删除按钮事件
        $deleteButton.on('click', function () {
            deleteChatGroup(chatgroupid, 1);
        });

        // 恢复按钮事件
        $restoreButton.on('click', function () {
            restoreChatGroup(chatgroupid);
        });
    });
}