
// 复制的方法
function copyText(text, callback) { // text: 要复制的内容， callback: 回调
    var tag = document.createElement('textarea');
    tag.setAttribute('id', 'cp_hgz_input');
    tag.value = text;
    document.getElementsByTagName('body')[0].appendChild(tag);
    document.getElementById('cp_hgz_input').select();
    document.execCommand('copy');
    document.getElementById('cp_hgz_input').remove();
    if (callback) { callback(text) }
}
//获取get参数的方法
function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) { return pair[1]; }
    }
    return ("");
}

function DownSoft() {
    let gameId = getQueryVariable("from_gameid")
    let code = getQueryVariable("channelCode")
    let copyObj = {
        from_gameid: gameId,
        channelCode: code
    }
    let copyStr = JSON.stringify(copyObj)
    copyText(copyStr, function () { console.log('复制成功', copyStr) })

    if (/(iPhone|iPad|iPod|iOS)/i.test(navigator.userAgent)) {
        //苹果端

    } else if (/(Android)/i.test(navigator.userAgent)) {
        //安卓端

    } else {
        //pc端

    };
}
