function initCaptcha(customElementId, customButtonId, captchaVerifyCallback, onBizResultCallback) {
    let captcha;
    const button = document.getElementById(customButtonId);
    // 嵌入式验证码初始化
    initAliyunCaptcha({
        SceneId: '1bkvy3x9', // 场景ID
        prefix: '1tw0u3', // 身份标
        mode: 'popup', // 验证码模式
        element: '#' + customElementId, // 自定义元素ID
        button: '#' + customButtonId, // 自定义按钮ID
        captchaVerifyCallback: captchaVerifyCallback, // 业务请求(带验证码校验)回调函数
        onBizResultCallback: onBizResultCallback, // 业务请求结果回调函数
        getInstance: getInstance, // 绑定验证码实例函数
        slideStyle: {
            width: 360,
            height: 40,
        }, // 滑块验证码样式
        language: 'cn', // 验证码语言类型
        immediate: false,
    });

    function getInstance(instance) {
        captcha = instance;
    }
    //async function captchaVerifyCallback(captchaVerifyParam) {
    //    // 1.向后端发起业务请求，获取验证码验证结果和业务结果
    //    const result = await checkCaptcha('/Home/AlibabaCaptcha', {
    //        captchaVerifyParam: captchaVerifyParam, // 验证码参数
    //    });
    //    const verifyResult = {
    //        captchaResult: result.captchaVerifyResult, // 这里应替换为您的逻辑
    //        bizResult: result.captchaVerifyResult,
    //    };
    //    return verifyResult;
    //}
    //async function checkCaptcha(url, params) {
    //    const response = await fetch(url, {
    //        method: 'POST',
    //        headers: {
    //            'Content-Type': 'application/json',
    //        },
    //        body: JSON.stringify(params), // 将参数对象转换为 JSON 字符串
    //    });

    //    if (!response.ok) {
    //        throw new Error('Network response was not ok');
    //    }

    //    return response.json(); // 解析返回的 JSON，这也返回一个 Promise
    //}
}