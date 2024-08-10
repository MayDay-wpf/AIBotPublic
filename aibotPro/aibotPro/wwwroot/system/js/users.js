// 确保DOM完全加载完成

var shareCode;
var codekey = "";
$(document).ready(function () {
    // 如果有需要，可以从本地存储获取计时器的状态
    // 检查localStorage中是否存在倒计时的结束时间
    if (localStorage.getItem("countdownEnd") && new Date().getTime() < localStorage.getItem("countdownEnd")) {
        // 如果存在且时间未到，恢复倒计时状态
        initializeButton();
        resumeCountdownIfNeeded();
    }
    generateCodeImage();
});

function getUrlParam(name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return decodeURI(r[2]);
    return '';
}

//验证邮箱格式，只允许qq,gmail,163,126,sina,hotmail
function isEmail(str) {
    var reg = /^(?:\w+\.?)*\w+@(?:qq|gmail|163|126)\.(?:com|cn|com\.cn)$/;
    return reg.test(str);
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

function regiest() {
    loadingBtn('.regiest');
    if (!$("#agree").is(":checked")) {
        balert('请勾选同意用户使用条例', 'danger', true, 2000, "top");
        unloadingBtn('.regiest');
        return;
    }
    var nick = $('#nick').val().trim();
    var sex = $('#sex').val().trim();
    var email = $('#email').val().trim();
    var password = $('#password').val().trim();
    var checkCode = $('#checkCode').val().trim();
    if (nick != "" && sex != "" && email != "" && password != "" && checkCode != "") {
        //nick小于2个字符或者大于10个字符
        if (nick.length < 2 || nick.length > 10) {
            balert('昵称长度应该在2-10之间', 'danger', true, 2000, "top");
            unloadingBtn('.regiest');
            return;
        }
        //密码小于6个字符或者大于16个字符
        if (password.length < 6 || password.length > 16) {
            balert('密码长度应该在6-16之间', 'danger', true, 2000, "top");
            unloadingBtn('.regiest');
            return;
        }
        //密码只允许数字和字母
        //var reg = /^[0-9a-zA-Z]+$/;
        //if (!reg.test(password)) {
        //    balert('密码只允许数字和字母', 'danger', true, 2000, "top");
        //    return;
        //}
        //邮箱格式不正确
        if (!isEmail(email)) {
            balert('只允许使用qq,gmail,163,126 邮箱', 'danger', true, 2000, "top");
            unloadingBtn('.regiest');
            return;
        }
        //var data = {
        //    users: {
        //        //User对象
        //        Nick: nick,
        //        Sex: sex,
        //        Account: email,
        //        Password: password,
        //        HeadImg: 'defaultHeadImg.png'
        //    },
        //    checkCode: checkCode
        //};
        var formData = new FormData();
        formData.append('users.Nick', nick);
        formData.append('users.Sex', sex);
        formData.append('users.Account', email);
        formData.append('users.Password', password);
        formData.append('users.HeadImg', '/system/images/defaultHeadImg.png');
        formData.append('checkCode', checkCode);
        shareCode = getUrlParam('sharecode');
        formData.append('shareCode', shareCode)
        $.ajax({
            url: '/Users/Regiest', type: 'POST', data: formData, // FormData 支持混合的数据类型
            processData: false, // 确保 jQuery 不要处理数据
            contentType: false, // 不要设置任何内容类型头
            success: function (res) {
                unloadingBtn('.regiest');
                if (res.success) {
                    window.location.href = '/Users/Login';
                } else {
                    balert(res.msg, 'danger', true, 2000, "top");
                }
            }, error: function (xhr, status, error) {
                unloadingBtn('.regiest');
                generateCodeImage();
                // 处理错误的回调
                console.error(error);
            }
        });
    } else {
        balert('请填写完整所有资料', 'danger', true, 2000, "top");
        unloadingBtn('.regiest');
    }
}

function login() {
    var account = $('#email').val().trim();
    var password = $('#password').val().trim();
    var checkCode = $('#checkCode').val().trim();
    if (account != "" && password != "") {
        //account大于50个字符
        if (account.length < 2 || account.length > 50) {
            balert('账号长度异常', 'danger', true, 2000, "top");
            return;
        }
        //密码只允许数字和字母
        //var reg = /^[0-9a-zA-Z]+$/;
        //if (!reg.test(password)) {
        //    balert('密码只允许数字和字母', 'danger', true, 2000, "top");
        //    return;
        //}
        loadingBtn(".login");
        $.ajax({
            url: '/Users/Login', type: 'POST', data: {
                account: account, password: password, checkCode: checkCode, codekey: codekey
            }, success: function (res) {
                if (res.success && res.token) {
                    // 将token存储在localStorage中
                    localStorage.setItem('aibotpro_userToken', res.token);

                    // token在30天后过期
                    var expirationTime = new Date().getTime() + (24 * 60 * 60 * 1000);

                    // 将过期时间存储为一个时间戳，以便以后检查
                    localStorage.setItem('aibotpro_userToken_Expiration', expirationTime);

                    unloadingBtn(".login");
                    // 导航到主页
                    window.location.href = '/Home/Index';
                } else {
                    // 如果响应中没有token或请求不成功，则显示错误信息
                    unloadingBtn(".login");
                    generateCodeImage();
                    balert(res.msg, 'danger', true, 2000, "top");
                    if (res.errorCount && res.errorCount >= 3) {
                        $('#checkCodeBox').show();
                    }
                }
            }, error: function (xhr, status, error) {
                // 处理错误的回调
                unloadingBtn(".login");
                console.error(error);
                generateCodeImage();
            }
        });
    } else {
        balert('请输入账号和密码以及验证码', 'danger', true, 2000, "top");
        generateCodeImage();
    }
}

//判断用户是否登录
function isLogin(check) {
    var token = localStorage.getItem('aibotpro_userToken');
    var expiration = localStorage.getItem('aibotpro_userToken_Expiration');

    if (!token || !expiration) {
        return false;
    } else {
        // 如果token过期，则删除它
        if (isExpired(expiration)) {
            localStorage.removeItem('aibotpro_userToken');
            localStorage.removeItem('aibotpro_userToken_Expiration');
            return false;
        } else {
            //请求后台验证token是否有效
            if (!check) return true;
            $.ajax({
                url: '/Users/IsLogin', type: 'POST', data: {
                    token: token
                }, success: function (res) {
                    if (res.success) {
                        return true;
                    } else {
                        localStorage.removeItem('aibotpro_userToken');
                        localStorage.removeItem('aibotpro_userToken_Expiration');
                        return false;
                    }
                }, error: function (xhr, status, error) {
                    // 处理错误的回调
                    console.error(error);
                }
            });
        }
    }

    return new Date().getTime() < expiration;
}

//找回密码
function findPassword() {
    var account = $('#email').val().trim();
    var password = $('#password').val().trim();
    var checkCode = $('#checkCode').val().trim();
    if (account != "" && password != "" && checkCode != "") {
        //account大于50个字符
        if (account.length < 2 || account.length > 50) {
            balert('账号长度异常', 'danger', true, 2000, "top");
            return;
        }
        //密码小于6个字符或者大于16个字符
        if (password.length < 6 || password.length > 16) {
            balert('密码长度应该在6-16之间', 'danger', true, 2000, "top");
            return;
        }
        $.ajax({
            url: '/Users/FindPassword', type: 'POST', data: {
                account: account, password: password, checkCode: checkCode
            }, success: function (res) {
                if (res.success) {
                    window.location.href = '/Users/Login';
                } else balert(res.msg, 'danger', true, 2000, "top");
            }, error: function (xhr, status, error) {
                // 处理错误的回调
                console.error(error);
            }
        });
    } else balert('请填写完整所有资料', 'danger', true, 2000, "top");
}

//发送找回密码邮件
async function sendFindPasswordEmail(captchaVerifyParam) {
    var toemail = $("#email").val().trim();
    if (toemail == "") {
        balert('请输入邮箱地址', 'danger', true, 2000, "top");
        const verifyResult2 = {
            captchaResult: true, bizResult: "",
        };
        return verifyResult2;
    }
    // 1.向后端发起业务请求，获取验证码验证结果和业务结果
    const result = await checkCaptcha('/Users/SendFindPasswordEmail', {
        captchaVerifyParam: captchaVerifyParam, // 验证码参数
        toemail: toemail
    });
    const verifyResult = {
        captchaResult: result.captchaVerifyResult, // 这里应替换为您的逻辑
        bizResult: result.success,
    };
    return verifyResult;
}

async function sendCheckCode(captchaVerifyParam) {
    var toemail = $("#email").val();
    if (toemail == "") {
        balert('请输入邮箱地址', 'danger', true, 2000, "top");
        const verifyResult2 = {
            captchaResult: true, bizResult: "",
        };
        return verifyResult2;
    }
    // 1.向后端发起业务请求，获取验证码验证结果和业务结果
    const result = await checkCaptcha('/Users/SendRegiestEmail', {
        captchaVerifyParam: captchaVerifyParam, // 验证码参数
        toemail: toemail
    });
    const verifyResult = {
        captchaResult: result.captchaVerifyResult, bizResult: result.success,
    };
    return verifyResult;
}

async function checkCaptcha(url, params) {
    const response = await fetch(url, {
        method: 'POST', headers: {
            'Content-Type': 'application/json',
        }, body: JSON.stringify(params), // 将参数对象转换为 JSON 字符串
    });

    if (!response.ok) {
        throw new Error('Network response was not ok');
    }

    return response.json(); // 解析返回的 JSON，这也返回一个 Promise
}


function oldFindPasswordEmail() {
    var toemail = $("#email").val().trim();
    var checkCode = $('#checkCodebyImage').val().trim();
    if (toemail != "" && checkCode != "") {
        disableButtonAndStartCountdown();
        $.ajax({
            url: "/Users/SendFindPasswordEmail", type: "post", dataType: "json",//返回对象
            data: {
                toemail: toemail, checkCode: checkCode, codekey: codekey
            }, success: function (res) {
                if (res.success) {
                    // 立即禁用按钮，并开始倒计时
                    balert('邮件已发送', 'success', true, 2000, "top");
                } else {
                    balert(res.msg, 'danger', true, 2000, "top");
                    generateCodeImage();
                    stopCountdownImmediately();
                }
            }, error: function (e) {
                console.log("失败" + e);
                generateCodeImage();
                stopCountdownImmediately();
            }
        });
    } else {
        balert('请输入邮箱地址和图形验证码', 'danger', true, 2000, "top");
        stopCountdownImmediately();
    }
}

function oldsendCheckCode() {
    var toemail = $("#email").val().trim();
    var checkCode = $('#checkCodebyImage').val().trim();
    if (toemail != "" && checkCode != "") {
        disableButtonAndStartCountdown();
        $.ajax({
            url: "/Users/SendRegiestEmail", type: "post", dataType: "json",//返回对象
            data: {
                toemail: toemail, checkCode: checkCode, codekey: codekey
            }, success: function (res) {
                if (res.success) {
                    // 立即禁用按钮，并开始倒计时
                    balert('邮件已发送', 'success', true, 2000, "top");
                } else {
                    balert(res.msg, 'danger', true, 2000, "top");
                    generateCodeImage();
                    stopCountdownImmediately();
                }
            }, error: function (e) {
                console.log("失败" + e);
                generateCodeImage();
                stopCountdownImmediately();
            }
        });
    } else {
        balert('请输入邮箱地址和验证码', 'danger', true, 2000, "top");
        stopCountdownImmediately();
    }
}

function disableBtn(success) {
    if (success) {
        // 立即禁用按钮，并开始倒计时
        balert('邮件已发送', 'success', true, 2000, "top");
        disableButtonAndStartCountdown();
    } else {
        balert('邮件发送失败,只允许使用qq,gmail,163,126邮箱', 'danger', true, 2000, "top");
    }
}

let countdownTimer;
let $button;
const COUNTDOWN_DURATION = 60; // 倒计时时长（秒）

function initializeButton() {
    $button = $(".btn-primary, .btn-secondary").filter(":visible:first");
}

function updateButtonText(text) {
    if ($button) {
        $button.text(text);
    }
}

function setButtonEnabled(enabled) {
    if ($button) {
        $button.prop('disabled', !enabled)
            .toggleClass('btn-primary', enabled)
            .toggleClass('btn-secondary', !enabled);
    }
}

function resetButtonState() {
    setButtonEnabled(true);
    updateButtonText('发送验证码');
    localStorage.removeItem("countdownEnd");
}

function startCountdown(duration) {
    let endTime = new Date().getTime() + duration * 1000;
    localStorage.setItem("countdownEnd", endTime);

    function tick() {
        let now = new Date().getTime();
        let remainingTime = Math.ceil((endTime - now) / 1000);

        if (remainingTime <= 0) {
            resetButtonState();
        } else {
            updateButtonText(`发送验证码(${remainingTime})`);
            setButtonEnabled(false);
            countdownTimer = setTimeout(tick, 1000);
        }
    }

    tick();
}

function stopCountdown() {
    clearTimeout(countdownTimer);
    resetButtonState();
}

function resumeCountdownIfNeeded() {
    let countdownEnd = localStorage.getItem("countdownEnd");
    if (countdownEnd) {
        let now = new Date().getTime();
        let remainingTime = Math.ceil((countdownEnd - now) / 1000);
        if (remainingTime > 0) {
            startCountdown(remainingTime);
        } else {
            resetButtonState();
        }
    }
}

function disableButtonAndStartCountdown() {
    initializeButton();
    stopCountdown(); // 总是先停止之前的倒计时
    startCountdown(COUNTDOWN_DURATION);
}

// 全局函数，用于立即停止倒计时
function stopCountdownImmediately() {
    initializeButton();
    stopCountdown();
}

function generateCodeImage() {
    codekey = `cache_${generateGUID()}`;
    $.ajax({
        url: "/Users/GenerateCodeImage", type: "post", dataType: "json",//返回对象
        data: {
            key: codekey
        }, success: function (res) {
            if (res.success) {
                $('#checkCodeImage').attr("src", res.data);
            } else {
                balert(res.data, 'danger', true, 2000, "top");
            }
        }, error: function (e) {
            console.log("失败" + e);
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