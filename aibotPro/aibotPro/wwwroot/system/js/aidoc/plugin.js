class SaveButtonMenu {
    constructor() {
        this.title = '导出' // 自定义菜单标题
        this.iconSvg = '<svg t="1698810441740" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4304" width="200" height="200"><path d="M1006.933333 85.333333H580.266667V34.133333c0-6.826667-3.413333-10.24-6.826667-13.653333s-10.24-3.413333-13.653333-3.413333l-546.133334 136.533333c-6.826667 3.413333-13.653333 10.24-13.653333 17.066667v716.8c0 6.826667 6.826667 13.653333 13.653333 17.066666l546.133334 102.4h3.413333c3.413333 0 6.826667 0 10.24-3.413333 3.413333-3.413333 6.826667-6.826667 6.826667-13.653333v-51.2h426.666666c10.24 0 17.066667-6.826667 17.066667-17.066667V102.4c0-10.24-6.826667-17.066667-17.066667-17.066667zM477.866667 382.293333l-102.4 307.2c-3.413333 6.826667-10.24 10.24-17.066667 10.24s-13.653333-6.826667-17.066667-13.653333l-51.2-187.733333c-3.413333-13.653333-27.306667-13.653333-34.133333 0L204.8 686.08c-3.413333 6.826667-6.826667 13.653333-17.066667 13.653333s-13.653333-6.826667-13.653333-10.24l-102.4-307.2c-3.413333-10.24 3.413333-17.066667 10.24-20.48h6.826667c6.826667 0 13.653333 3.413333 17.066666 10.24l68.266667 201.386667c3.413333 6.826667 10.24 10.24 17.066667 10.24s13.653333-6.826667 17.066666-13.653333l54.613334-197.973334c3.413333-13.653333 27.306667-13.653333 34.133333 0l54.613333 197.973334c3.413333 6.826667 6.826667 13.653333 17.066667 13.653333 6.826667 0 13.653333-3.413333 17.066667-10.24l68.266666-201.386667c3.413333-10.24 13.653333-13.653333 20.48-10.24 0 0 6.826667 10.24 3.413334 20.48z m512 522.24H580.266667v-102.4h324.266666c10.24 0 17.066667-6.826667 17.066667-17.066666s-6.826667-17.066667-17.066667-17.066667H580.266667v-102.4h324.266666c10.24 0 17.066667-6.826667 17.066667-17.066667s-6.826667-17.066667-17.066667-17.066666H580.266667v-102.4h324.266666c10.24 0 17.066667-6.826667 17.066667-17.066667s-6.826667-17.066667-17.066667-17.066667H580.266667v-102.4h324.266666c10.24 0 17.066667-6.826667 17.066667-17.066666s-6.826667-17.066667-17.066667-17.066667H580.266667v-102.4h324.266666c10.24 0 17.066667-6.826667 17.066667-17.066667s-6.826667-17.066667-17.066667-17.066666H580.266667v-102.4h409.6v785.066666z" fill="#515151" p-id="4305"></path></svg>' // 可选
        this.tag = 'button'
    }

    // 获取菜单执行时的 value ，用不到则返回空 字符串或 false
    getValue(editor) {
        return ''
    }

    // 菜单是否需要激活（如选中加粗文本，“加粗”菜单会激活），用不到则返回 false
    isActive(editor) {
        return false
    }

    // 菜单是否需要禁用（如选中 H1 ，“引用”菜单被禁用），用不到则返回 false
    isDisabled(editor) {
        return false
    }

    // 点击菜单时触发的函数
    exec(editor, value) {
        if (this.isDisabled(editor)) return
        //editor.insertText(value) // value 即 this.value(editor) 的返回值
        var html = editor.getHtml();
        var docx = htmlDocx.asBlob(html);

        // Save the Word document
        saveAs(docx, "export.docx");
    }

}
let selectText;
class AIButtonMenu {
    constructor() {
        this.title = 'May妹帮帮忙' // 自定义菜单标题
        this.iconSvg = '<svg t="1698821393961" class="icon" viewBox="0 0 1280 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="14862" width="200" height="200"><path d="M0 512v256c0 35.4 28.6 64 64 64h64V448H64c-35.4 0-64 28.6-64 64zM928 192H704V64c0-35.4-28.6-64-64-64s-64 28.6-64 64v128H352c-88.4 0-160 71.6-160 160v544c0 70.6 57.4 128 128 128h640c70.6 0 128-57.4 128-128V352c0-88.4-71.6-160-160-160zM512 832h-128v-64h128v64z m-64-240c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z m256 240h-128v-64h128v64z m192 0h-128v-64h128v64z m-64-240c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80z m384-144h-64v384h64c35.4 0 64-28.6 64-64V512c0-35.4-28.6-64-64-64z" p-id="14863"></path></svg>' // 可选
        this.tag = 'button'
        this.showModal = true
        this.modalWidth = 600
    }
    // 获取菜单执行时的 value ，用不到则返回空 字符串或 false
    getValue(editor) {
        return ''
    }

    // 菜单是否需要激活（如选中加粗文本，“加粗”菜单会激活），用不到则返回 false
    isActive(editor) {
        return false
    }

    // 菜单是否需要禁用（如选中 H1 ，“引用”菜单被禁用），用不到则返回 false
    isDisabled(editor) {
        return false
    }

    // 点击菜单时触发的函数
    exec(editor, value) {
        if (this.isDisabled(editor)) return
        selectText = editor.getSelectionText();
    }
    getModalPositionNode(editor) {
        return null; // modal 依据选区定位
    }
    getModalContentElem(editor) {
        var showSelectText = selectText.length > 20 ? selectText.substring(0, 20) + ' ...略' : selectText
        const $content = $('<div id="modalcontent"></div>')
        const $selectText = $('<p>您选中的文本：<b>' + showSelectText + '</b></p>');
        const $input = $('<input type="text" id="input-ec48dc81" placeholder="想对这段文字做点什么？😊">')
        const $button = $('<button style="margin-bottom:10px" id="send">确定</button>')
        const $chatbox = $('<div id="chatbox">稍等一下☀️</div>')
        const $copybtn = $('<button style="margin-bottom:10px;display:none" id="copyBtn">复制</button>')
        $content.append($selectText)
        $content.append($input)
        $content.append($button)
        $content.append($chatbox)
        $content.append($copybtn)
        $copybtn.on('click', () => {
            copyText($("#chatbox").text(), function () {
                $("#copyBtn").text("已复制");
            })
        })
        $button.on('click', () => {
            var prompt = "数据：" + selectText + "，要求：" + $("#input-ec48dc81").val();
            if ($("#input-ec48dc81").val().trim() == "") {
                $("#input-ec48dc81").attr("placeholder", "还没填要求哦~😊");
                return;
            }
            $("#chatbox").slideDown();
            var chatId = generateGUID().replace(/-/g, "");
            $("#send").slideUp();
            send(prompt, chatId);
        })

        return $content[0]
    }

}
