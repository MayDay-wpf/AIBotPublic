var workflowcode = '';
var plugincode = '';
var jsonmodelAI = ['gpt-3.5-turbo', 'gpt-3.5-turbo-0125', 'gpt-4o-mini', 'gpt-4o-mini-openai', 'gpt-4-0125-preview', 'gpt-4-0125-preview-openai', 'deepseek-chat', 'deepseek-coder'];
let pageIndex_k = 1;
let pageSize_k = 20;
$(function () {
    //changeMode('lock');
    workflowcode = getUrlParam('workflowcode');
    plugincode = getUrlParam('plugincode');
    if (workflowcode == '' || plugincode == '')
        layer.msg("未经许可的访问方式", { icon: 2, time: 1500 }, function () {
            window.location.href = "/Home/Index";
        });
    else
        getWorkFlowNodeData(workflowcode);
    const savedDarkMode = localStorage.getItem('darkMode');
    const dkmodelBtn = $('.dkmodel');
    if (savedDarkMode === 'true') {
        dkmodelBtn.html(`<i class="fas fa-sun" style="color:#ffcd42"></i> 开灯`);
    } else {
        dkmodelBtn.html(`<i class="fas fa-moon"></i> 关灯`);
    }
    // 页面加载完成后恢复滚动位置
    let savedScrollPosition = localStorage.getItem('sidebarScrollPosition');
    if (savedScrollPosition) {
        $('#dpSidebarBody').scrollTop(savedScrollPosition);
    }
})
$(document).ready(function () {
    // 隐藏侧边栏
    $("#closePanelBtn").click(function () {
        $("#sidePanel").hide();
    });
    $('.configure').on('change', '.http-type', function () {
        // 检查选中的选项值
        if ($(this).val() == 'get') {
            $('.jsontemplate-box').hide();
            $('.params-box').show();
        } else {
            $('.jsontemplate-box').show();
            $('.params-box').hide();
        }
    });
    $('.configure').on('change', '.stream', function () {
        // 检查选中的选项值
        if ($(this).val() == 'true') {
            $('.jsonmodel').val('false');
        }
    });
    $('.configure').on('change', '.jsonmodel', function () {
        // 检查选中的选项值
        if ($(this).val() == 'true') {
            var thisAIModel = $('.aimodel').val();
            if (jsonmodelAI.indexOf(thisAIModel) == -1) {
                $(this).val('false');
                layer.msg('当前模型不支持JsonModel', { icon: 2, time: 2500 });
                return;
            }
            $('.stream').val('false');
        }
    });
    $('.configure').on('input', '.retry', function () {
        var value = $(this).val();
        if (value > 5) {
            $(this).val(5);
        }
    });
    $('.configure').on('input', '.httpmaxcount', function () {
        var value = $(this).val();
        if (value > 20) {
            $(this).val(20);
        }
    });
    $('.configure').on('input', '.llmmaxcount', function () {
        var value = $(this).val();
        if (value > 20) {
            $(this).val(20);
        }
    });
    $('.configure').on('input', '.httpdelayed', function () {
        var value = $(this).val();
        if (value > 10000) {
            $(this).val(10000);
        }
    });

    // 监听'EndAction'下拉选择改变事件
    $('.configure').on('change', '.endAction', function () {
        toggleCodeEditor();
    });

    // 默认情况下隐藏代码编辑器
    toggleCodeEditor();
});

function toggleCodeEditor() {
    const selectedValue = $('.endAction').val();
    if (selectedValue === 'ai') {
        $('#codeBox').hide();
    } else {
        $('#codeBox').show();
    }
}

var myTextarea;
var codeeditor;
var functionName = '';
let isNodeBeingDeleted = false;

function initCodeEditor(code) {
    //if (!myTextarea) {
    myTextarea = document.getElementById("myTextarea");
    codeeditor = CodeMirror.fromTextArea(myTextarea, {
        lineNumbers: true,
        mode: "javascript",
        theme: "3024-night"
    });
    codeEditorSetOption(codeeditor, code);
}

var endTextarea;
var endCodeeditor;

function initEndCodeEditor(code) {
    endTextarea = document.getElementById("endTextarea");
    endCodeeditor = CodeMirror.fromTextArea(endTextarea, {
        lineNumbers: true,
        mode: "javascript",
        theme: "3024-night"
    });
    codeEditorSetOption(endCodeeditor, code);
}

var llmTextarea;
var llmCodeeditor;

function initLLMCodeEditor(code) {
    llmTextarea = document.getElementById("llmTextarea");
    llmCodeeditor = CodeMirror.fromTextArea(llmTextarea, {
        lineNumbers: true,
        mode: "javascript",
        theme: "3024-night"
    });
    codeEditorSetOption(llmCodeeditor, code);
}

var httpTextarea;
var httpCodeeditor;

function initHttpCodeEditor(code) {
    httpTextarea = document.getElementById("httpTextarea");
    httpCodeeditor = CodeMirror.fromTextArea(httpTextarea, {
        lineNumbers: true,
        mode: "javascript",
        theme: "3024-night"
    });
    codeEditorSetOption(httpCodeeditor, code);
}

var ifelseTextarea;
var ifelseCodeeditor;

function initIfElseCodeEditor(code) {
    ifelseTextarea = document.getElementById("ifelseTextarea");
    ifelseCodeeditor = CodeMirror.fromTextArea(ifelseTextarea, {
        lineNumbers: true,
        mode: "javascript",
        theme: "3024-night"
    });
    codeEditorSetOption(ifelseCodeeditor, code);
}

function codeEditorSetOption(codeEditor, code) {
    codeEditor.setOption("mode", "javascript");
    codeEditor.setOption("theme", "3024-night");
    codeEditor.setValue(code);
    codeEditor.setSize('auto', '500px');
    codeEditor.on("inputRead", function (cm, event) {
        if (!cm.state.completionActive && event.origin !== 'setValue') {
            cm.showHint({
                completeSingle: false
            });
        }
    });
}

function getAIModelList(callback) {
    $.ajax({
        type: "Post",
        url: "/Home/GetAImodel",
        dataType: "json",
        success: function (res) {
            var html = "";
            if (res.success) {
                for (var i = 0; i < res.data.length; i++) {
                    html += `<option value="${res.data[i].modelName}">${res.data[i].modelNick}</option>`;
                }
                $('.aimodel').html(html);
                callback && callback();
            }
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统未配置AI模型", "info", false, 2000, "center");
        }
    });
}

function getKonwLedgeTypeByMilvus(type, callback) {
    if (type == 'loadmore')
        loadingBtn('.loadmorebtn');
    var name = $("#seachKnowledge").val();
    $.ajax({
        type: "Post",
        url: "/KnowledgeAI/GetKnowledgeType",
        dataType: "json",
        data: {
            name: name,
            page: pageIndex_k,
            pageSize: pageSize_k
        },
        success: function (res) {
            unloadingBtn('.loadmorebtn');
            var html = ``;
            res = res.data;
            if (res.length > 0) {
                if (res.length < pageSize_k)
                    $('.loadmorebtn').hide();
                for (var i = 0; i < res.length; i++) {
                    html += `<div class="list-group-item">
                                    <div>
                                        <input type="checkbox" value='${res[i].typeCode}'>
                                        ${truncateString(res[i].typeName, 15)}
                                    </div>
                             </div>`;
                }
            } else {
                html = `没有知识库~`;
                $('.loadmorebtn').hide();
            }
            $('#onknowledgeitem').html(html);
            callback && callback();
        },
        error: function (e) {
            unloadingBtn('.loadmorebtn');
        }
    });
}

var thisNodeId = 0;
var thisNodeName = '';
let id = document.getElementById("drawflow");
const editor = new Drawflow(id);
editor.reroute = true;
editor.start();

editor.on('nodeCreated', function (id) {
    console.log("Node created " + id);
    var obj = editor.export();
    const nodesData = obj.drawflow.Home.data;
    const nodeIds = Object.keys(nodesData).map(Number);
    const startNodesCount = nodeIds.filter(id => nodesData[id].name === "start").length;
    const endNodesCount = nodeIds.filter(id => nodesData[id].name === "end").length;
    // 检查当前创建的节点是否为"start"
    const currentNodeName = nodesData[id].name;

    // 如果当前节点不是"start"，检查是否已存在"start"节点
    if (startNodesCount === 0) { // 如果不存在"start"节点，则不允许创建非"start"节点
        editor.removeNodeId(`node-${id}`);
        layer.msg("请先配置开始节点", { icon: 2, time: 2500 });
        return;
    }
    if (currentNodeName === "start" || currentNodeName === "end") {
        // 如果尝试创建的是"start"节点，但已存在一个，则删除
        if (startNodesCount > 1) { // 因为当前节点已创建，所以计数大于1表示之前已存在"start"节点
            editor.removeNodeId(`node-${id}`);
            layer.msg("不可以出现多个start节点", { icon: 2, time: 2500 });
            return;
        }
        if (endNodesCount > 1) {
            editor.removeNodeId(`node-${id}`);
            layer.msg("不可以出现多个end节点", { icon: 2, time: 2500 });
            return;
        }
    }
    if (currentNodeName != "start" && currentNodeName != "end") {
        // 获取当前包含class="title-box"的DOM结构
        var titleBoxHtml = $("#node-" + id + " .title-box").prop('outerHTML');

        // 将动态内容加入，并在外面包裹一个新的<div>
        var newNodeHtml = `<div>${titleBoxHtml}</div>`;

        // 使用jQuery来创建HTML元素
        var $newNodeHtml = $(newNodeHtml);

        // 找到新构造的HTML中的节点文本位置，并添加id
        $newNodeHtml.find(".nodeText").append(`<b class="nodeTextId">${id}</b>`);

        // 更新Drawflow数据结构中的节点HTML内容
        editor.drawflow.drawflow.Home.data[id].html = $newNodeHtml.prop('outerHTML');

        // 更新节点的HTML内容
        $("#node-" + id + " .title-box .nodeText").append(`<b class="nodeTextId">${id}</b>`);
    }
});

editor.on('nodeRemoved', function (id) {
    console.log("Node removed " + id);
    isNodeBeingDeleted = true;
    $("#sidePanel").hide();
})

editor.on('nodeSelected', function (id) {
    console.log("Node selected " + id);
    isNodeBeingDeleted = false;
    $("#sidePanel").show();
    $(".side-panel").css("width", "400px");
    $("#togglePanelIcon").toggleClass("fas fa-chevron-left");
    optionMax_b = false;
    var node = editor.getNodeFromId(id);
    console.log(node);
    var name = node.name;
    thisNodeId = id;
    thisNodeName = name;
    var html = "";
    if (name == "start" || name == "end")
        $("#sidePanel .panel-title").text(`${name}`);
    else
        $("#sidePanel .panel-title").text(`${name}（节点Id:${id}）`);
    switch (name) {
        case 'start':
            html = `<p>参数（output，选填）：</p>
                       <div class="box">
                            <div>
                               <table class="parameters-table">
                               </table>
                               <button class="btn btn-info" onclick="addRow(this)">
                                   新增一行
                               </button>
                            </div>
                        </div>
                        <p class="nodeinfo">
                            <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                            当下级节点需要获取start的参数时，使用{{start.参数名}}获取，例如{{start.city}}
                        </p>`;
            $('.configure').html(html);
            //查询这个节点是否有data
            if (node && node.data && Object.entries(node.data).length > 0) {
                //回写
                var data = node.data;
                if (data.output.prItems && data.output.prItems.length > 0) {
                    var rows = '';
                    const options = ['String', 'Integer', 'Boolean', 'Number'];
                    data.output.prItems.forEach(item => {
                        const selectOptions = options.map(option =>
                            `<option ${item.prType === option ? 'selected' : ''}>${option}</option>`
                        ).join('');
                        rows += `<tr>
                                    <td><input value="${item.prName}" placeholder="参数名"  /></td>
                                    <td><select>${selectOptions}</select></td>
                                    <td><input value="${item.prInfo}" placeholder="参数描述"  /></td>
                                    <td><input value="${item.prConst}" placeholder="常量"  /></td>
                                    <td><button class="delete-btn" onclick="deleteRow(this)">删除</button></td>
                                </tr>`;
                    });
                    $(".parameters-table").html(rows);
                }
            }
            break;
        case 'javascript':
            html = ` <label>编写脚本：</label>
                         <textarea id="myTextarea"></textarea>
                     <p class="nodeinfo">
                     <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                          javascript节点必须return一个规范的json字符串，例如：<br>
                            function javascript2(){<br>
                                return '{ "data": {"code":200,"status":true}}'<br>
                            }<br>
                         当下级节点需要获取json中的数据时使用{{javascript+节点Id.data}}获取，例如获取上文中code，{{javascript2.data.code}} 可获取到值：200
                      </p>`;
            $('.configure').html(html);
            var code = `function javascript${id}(){

}`;
            if (node && node.data && Object.entries(node.data).length > 0) {
                //回写
                var data = node.data;
                if (data.output.javascript) {
                    code = data.output.javascript;
                }
            }
            initCodeEditor(code);
            break;
        case 'http':
            html = `<div class="box">
                       <div class="custom-select">
                           <p>选择请求方式：</p>
                           <select class="http-type">
                              <option value="post" selected>Post</option>
                              <option value="get">Get</option>
                           </select>
                       </div>
                       <div>
                         <p>请求地址：</p>
                         <input type="text" placeholder="请输入请求地址" class="requestUrl"  />
                       </div>
                       <div class="params-box">
                           <p>Params（模板示例{{参数}}，选填）：</p>
                             <table class="params-table">
                             </table>
                             <button class="btn btn-info" onclick="addPrRow(this)">
                                 新增一行
                             </button>
                       </div>
                       <div class="jsontemplate-box">
                            <p>Body（模板示例{{参数}}，选填）：</p>
                               <textarea class="jsontemplate" style="width:100%;height:150px;"></textarea>
                       </div>
                       <div>
                             <p>Headers：</p>
                             <table class="headers-table">
                             </table>
                             <button class="btn btn-info" onclick="addHdRow(this)">
                                 新增一行
                             </button>
                       </div>
                       <div>
                             <p>Cookies：</p>
                             <table class="cookies-table">
                             </table>
                             <button class="btn btn-info" onclick="addCkRow(this)">
                                 新增一行
                             </button>
                       </div>
                    </div>
                    <p>循环极限次数（≤20）：</p>
                    <input type="number" class="httpmaxcount" value="10" max="20" min="0" />
                    <p>循环调用延时（≤10000ms）：</p>
                    <input type="number" class="httpdelayed" value="0" max="10000" min="0" />ms
                    <p>循环条件脚本：</p>
                    <textarea id="httpTextarea"></textarea>
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                      * 当Http请求节点有返回值时，必须是一个Json对象，例如请求返回值为{"data":{"code":200,"status":true}}，使用{{http+节点Id.json结构值}}获取，例如{{http1.data.status}} 可获取到值：true<br><br>
                      * 当需要循环执行时，return true;代表结束循环<br><br>
                      * return false;将持续循环<br><br>
                      * retuen 其他时将调用即时通讯将原文响应客户端<br><br>
                      * 当需要获取当前节点的数据作为参数时可以使用 {{this.http+节点Id.返回值json结构}}获取<br><br>
                    </p>`;
            $('.configure').html(html);
            //查询这个节点是否有data
            if (node && node.data && Object.entries(node.data).length > 0) {
                //回写
                var data = node.data;
                if (data.output.type) {
                    $(".http-type").val(data.output.type); // 回写请求方式
                    if (data.output.type == "get") {
                        $('.jsontemplate-box').hide();
                        $('.params-box').show();
                    } else {
                        $('.jsontemplate-box').show();
                        $('.params-box').hide();
                    }
                }
                if (data.output.requestUrl) {
                    $(".requestUrl").val(data.output.requestUrl); // 回写请求地址
                }
                if (data.output.jsontemplate) {
                    $(".jsontemplate").val(data.output.jsontemplate); // 回写Json模板
                }
                if (data.output.paramsItems && data.output.paramsItems.length > 0) {
                    var rows_param = '';
                    data.output.paramsItems.forEach(itempr => {
                        rows_param += `<tr>
                                        <td><input value="${itempr.paramKey}"  /></td>
                                        <td><input value="${itempr.paramValue}" /></td>
                                        <td><button class="delete-btn" onclick="deleteRow(this)">删除</button></td>
                                     </tr>`;
                    });
                    $(".params-table").html(rows_param);
                }
                if (data.output.headersItems && data.output.headersItems.length > 0) {
                    var rows_hd = '';
                    data.output.headersItems.forEach(itemhd => {
                        rows_hd += `<tr>
                                    <td><input value="${itemhd.hdKey}"  /></td>
                                    <td><input value="${itemhd.hdValue}" /></td>
                                    <td><button class="delete-btn" onclick="deleteRow(this)">删除</button></td>
                                 </tr>`;
                    });
                    $(".headers-table").html(rows_hd);
                }
                if (data.output.cookiesItems && data.output.cookiesItems.length > 0) {
                    var rows_ck = '';
                    data.output.cookiesItems.forEach(itemck => {
                        rows_ck += `<tr>
                                    <td><input value="${itemck.ckKey}"  /></td>
                                    <td><input value="${itemck.ckValue}" /></td>
                                    <td><button class="delete-btn" onclick="deleteRow(this)">删除</button></td>
                                 </tr>`;
                    });
                    $(".cookies-table").html(rows_ck);
                }
                var code = `function http${id}(){
    return true;
}`;
                if (data.output.judgescript) {
                    code = data.output.judgescript;
                }
                if (data.output.httpmaxcount) {
                    $('.httpmaxcount').val(data.output.httpmaxcount);
                } else
                    $('.httpmaxcount').val(10);
                if (data.output.httpdelayed) {
                    $('.httpdelayed').val(data.output.httpdelayed);
                } else
                    $('.httpdelayed').val(10);
                initHttpCodeEditor(code);
            }
            break;
        case 'LLM':
            html = `<div class="custom-select">
                       <p>选择模型：</p>
                       <select class="aimodel">
                         <option value="--">--</option>
                       </select>
                    <div>
                    <p>Prompt（模板示例{{参数}}，必填）：</p>
                    <textarea class="prompt" style="width:100%;height:150px;"></textarea>
                    <p>图片链接（模板示例{{参数}}，选填）：</p>
                    <input type="text" placeholder="请输入图片链接" class="imgUrl"  />
                    <p>失败重试次数（≤5）：</p>
                    <input type="number" class="retry" value="0" max="5" min="0" />
                    <p>Stream：</p>
                    <select class="stream"><option checked="checked">false</option><option>true</option></select>
                    <p>JsonModel：</p>
                    <select class="jsonmodel"><option checked="checked">false</option><option>true</option></select>
                    <p>循环极限次数（≤20）：</p>
                    <input type="number" class="llmmaxcount" value="10" max="20" min="0" />
                    <p>循环条件脚本：</p>
                    <textarea id="llmTextarea"></textarea>
                    <p></p>
                    <div class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                      * 当下级节点需要获取AI处理的返回数据时，使用{{LLM+节点Id.data}}获取，例如{{LLM1.data}}<br><br>
                      * 当Stream选择true时 API会中途返回LLM响应至客户端<br><br>
                      * 当需要循环执行时，return true;代表结束循环，return 其他时，会以返回值作为prompt继续提交给LLM<br><br>
                      * 当需要获取当前节点的数据作为参数时可以使用 {{this.LLM+节点Id.data}}获取<br><br>
                      * 当使用JsonModel时，最终Json合成格式为：LLM+节点Id+Json,例如：<br>
                      要求AI生成的Json为：
<pre><code>
{
    "oldprompt": "aaaaa",
    "newprompt": "bbbbb"
}
</code></pre>
系统最终合成的Json为：
<pre><code>
{
  "LLM2": {
    "oldprompt": "aaaaa",
    "newprompt": "bbbbb"
  }
}
</code></pre>
取值方式：{{LLM2.newprompt}}
  <br><br>
</div>`
            $('.configure').html(html);
            getAIModelList(function () {
                var code = `function LLM${id}(){
    return true;
}`;
                if (node && node.data && Object.entries(node.data).length > 0) {
                    var data = node.data;
                    if (data.output.aimodel) {
                        $(".aimodel").val(data.output.aimodel);
                    }
                    if (data.output.prompt) {
                        $(".prompt").val(data.output.prompt);
                    }
                    if (data.output.imgurl) {
                        $(".imgurl").val(data.output.imgurl);
                    }
                    if (data.output.retry) {
                        $(".retry").val(data.output.retry);
                    }
                    if (data.output.stream) {
                        $(".stream").val(data.output.stream);
                    }
                    if (data.output.jsonmodel) {
                        $(".jsonmodel").val(data.output.jsonmodel);
                    }
                    if (data.output.judgescript) {
                        code = data.output.judgescript;
                    }
                    if (data.output.llmmaxcount) {
                        $(".llmmaxcount").val(data.output.llmmaxcount);
                    } else {
                        $(".llmmaxcount").val(10);
                    }
                }
                initLLMCodeEditor(code);
            });
            break;
        case 'DALL':
            html = `<div class="custom-select">
                       <p>绘制尺寸：</p>
                       <select class="dallsize">
                         <option value="1024x1024" selected>1024x1024</option>
                         <option value="1024x1792">1024x1792</option>
                         <option value="1792x1024">1792x1024</option>
                       </select>
                    <div>
                    <div class="custom-select">
                       <p>绘图质量：</p>
                       <select class="dallquality">
                         <option value="standard" selected>standard</option>
                         <option value="hd">hd</option>
                       </select>
                    <div>
                    <p>Prompt（模板示例{{参数}}，必填）：</p>
                    <textarea class="prompt" style="width:100%;height:150px;"></textarea>
                    <p>失败重试次数（≤5）：</p>
                    <input type="number" class="retry" value="0" max="5" min="0" />
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                    当下级节点需要获取绘画图片链接时，使用{{DALL+节点Id.data}}获取，例如{{DALL1.data}}
                    </p>`
            $('.configure').html(html);
            if (node && node.data && Object.entries(node.data).length > 0) {
                var data = node.data;
                if (data.output.prompt) {
                    $(".prompt").val(data.output.prompt);
                }
                if (data.output.size)
                    $(".dallsize").val(data.output.size);
                else
                    $(".dallsize").val("1024x1024");
                if (data.output.quality)
                    $(".dallquality").val(data.output.quality);
                else
                    $(".dallquality").val("standard");
                if (data.output.retry) {
                    $(".retry").val(data.output.retry);
                }
            }
            break;
        case 'DALLsm':
            html = `<p>Prompt（模板示例{{参数}}，必填）：</p>
                    <textarea class="prompt" style="width:100%;height:150px;"></textarea>
                    <p>失败重试次数（≤5）：</p>
                    <input type="number" class="retry" value="0" max="5" min="0" />
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                    当下级节点需要获取绘画图片链接时，使用{{DALLsm+节点Id.data}}获取，例如{{DALLsm1.data}}
                    </p>`
            $('.configure').html(html);
            if (node && node.data && Object.entries(node.data).length > 0) {
                var data = node.data;
                if (data.output.prompt) {
                    $(".prompt").val(data.output.prompt);
                }
                if (data.output.retry) {
                    $(".retry").val(data.output.retry);
                }
            }
            break;
        case 'downloadimg':
            html = `<p>线上图片链接（模板示例{{参数}}，必填）：</p>
                    <input type="text" placeholder="请输入图片链接" class="imageUrl"  />
                    <p>图片描述（模板示例{{参数}}，选填）：</p>
                    <input type="text" placeholder="请输入图片描述" class="downloadImgPrompt"  />
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                      * 此节点作用于将【线上图片链接】转存至【图库】<br><br>
                      * 此节点可使用{{downloadimg+节点Id.data}}获取返回值，例如{{downloadimg1.data}}<br><br>
                      * 此节点返回值为原样返回您需要下载的图片链接
                    </p>`
            $('.configure').html(html);
            if (node && node.data && Object.entries(node.data).length > 0) {
                var data = node.data;
                if (data.output.imageurl) {
                    $(".imageUrl").val(data.output.imageurl);
                }
                if (data.output.prompt) {
                    $(".downloadImgPrompt").val(data.output.prompt);
                }
            }
            break;
        case 'web':
            html = `<p>搜索关键词（模板示例{{参数}}，必填）：</p>
                    <textarea class="prompt" style="width:100%;height:150px;" placeholder="请输入搜索关键词"></textarea>
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                    注意：此节点只充当搜索引擎，请不要输入自然语言，否则会影响搜索结果<br>
                    当下级节点需要获取搜索结果时，使用{{web+节点Id.data}}获取，例如{{web1.data}}
                    </p>`
            $('.configure').html(html);
            if (node && node.data && Object.entries(node.data).length > 0) {
                var data = node.data;
                if (data.output.prompt) {
                    $(".prompt").val(data.output.prompt);
                }
            }
            break;
        case 'ifelse':
            html = ` <label>编写脚本：</label>
                         <textarea id="ifelseTextarea"></textarea>
                     <p class="nodeinfo">
                     <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                          ifelse节点必须return一个布尔值，流程会根据布尔值的结果决定走向<br>
                            function ifelse2(){<br>
                                return 1>2<br>
                            }<br>
                         当下级节点需要获取json中的数据时使用{{ifelse+节点Id.data}}获取
                      </p>`;
            $('.configure').html(html);
            var code = `function ifelse${id}(){

}`;
            if (node && node.data && Object.entries(node.data).length > 0) {
                //回写
                var data = node.data;
                if (data.output.judgresult) {
                    code = data.output.judgresult;
                }
            }
            initIfElseCodeEditor(code);
            break;
        case 'knowledge':
            var html = `<p>检索关键词（模板示例{{参数}}，必填）：</p>
                    <textarea class="prompt" style="width:100%;height:150px;"></textarea>
                    <p>失败重试次数（≤5）：</p>
                    <input type="number" class="retry" value="0" max="5" min="0" />
                    <p>topK（3≤topK≤10）：</p>
                    <input type="number" class="topk" value="3" max="10" min="3" />
                    <p>知识库选用：</p>
                    <div id="onknowledgeitem">加载中...</div>
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                    当下级节点需要获取知识库检索结果时，使用{{knowledge+节点Id.data}}获取，例如{{knowledge1.data}}
                    </p>`
            $('.configure').html(html);
            getKonwLedgeTypeByMilvus("init", function () {
                if (node && node.data && Object.entries(node.data).length > 0) {
                    //回写
                    var data = node.data;
                    if (data.output.prompt) {
                        $(".prompt").val(data.output.prompt);
                    }
                    if (data.output.retry) {
                        $(".retry").val(data.output.retry);
                    }
                    if (data.output.topk) {
                        $(".topk").val(data.output.topk);
                    }
                    $('#onknowledgeitem input[type="checkbox"]').each(function () {
                        var typecode = $(this).val();
                        if (data.output.typecode.includes(typecode)) {
                            $(this).prop('checked', true);
                        } else {
                            $(this).prop('checked', false);
                        }
                    });
                }
            });

            break;
        case 'debug':
            html = `<p>需要向聊天窗口发送的内容（模板示例{{参数}}，必填）：</p>
                    <textarea placeholder="输入需要发送的内容" class="chatlog"></textarea>
                    <p class="nodeinfo">
                    <span><i class="fas fa-question-circle" style="color:#689e38"></i> <b>节点说明</b></span><br>
                      * 此节点用于调试，方式为：向Chat推送任意消息,支持markdown<br><br>
                      * 此节点在Open API中不生效<br><br>
                      * 此节点可使用{{debug+节点Id.data}}获取返回值，例如{{debug1.data}}<br><br>
                      * 此节点返回值为原样返回您需要发送的内容
                    </p>`
            $('.configure').html(html);
            if (node && node.data && Object.entries(node.data).length > 0) {
                var data = node.data;
                if (data.output.chatlog) {
                    $(".chatlog").val(data.output.chatlog);
                }
            }
            break;
        case 'end':
            html = `<div class="box">
                       <div class="custom-select">
                           <p>结束动作：</p>
                           <select class="endAction">
                              <option value="ai" selected>AI再次处理</option>
                              <option value="html">直接渲染Html</option>
                              <option value="js">执行前端任意脚本</option>
                           </select>
                       </div>
                       <div id="codeBox">
                           <label>编写脚本：</label>
                           <textarea id="endTextarea"></textarea>
                       </div>
                    </div>`;
            $('.configure').html(html);
            var code = `function end(){
  return "结束时可用模板语法调用前节点返回值";
}`;
            if (node && node.data && Object.entries(node.data).length > 0) {
                // 回写
                var data = node.data;
                if (data.output.endaction) {
                    $(".endAction").val(data.output.endaction); // 回写请求方式
                }
                if (data.output.endscript) {
                    code = data.output.endscript;
                }
                initEndCodeEditor(code);
                toggleCodeEditor();
            }
            break;
    }
})
editor.on('nodeUnselected', function () {
    if (!isNodeBeingDeleted && saveNodeData()) {
        $("#sidePanel").hide();
    }
})
editor.on('moduleCreated', function (name) {
    console.log("Module Created " + name);
})

editor.on('moduleChanged', function (name) {
    console.log("Module Changed " + name);
})

editor.on('connectionCreated', function (connection) {
    console.log('Connection created');
    console.log(connection);
})

editor.on('connectionRemoved', function (connection) {
    console.log('Connection removed');
    console.log(connection);
})

editor.on('mouseMove', function (position) {
    //console.log('Position mouse x:' + position.x + ' y:' + position.y);
})

editor.on('nodeMoved', function (id) {
    console.log("Node moved " + id);
})

editor.on('zoom', function (zoom) {
    console.log('Zoom level ' + zoom);
})

editor.on('translate', function (position) {
    console.log('Translate x:' + position.x + ' y:' + position.y);
});

editor.on('addReroute', function (id) {
    console.log("Reroute added " + id);
})

editor.on('removeReroute', function (id) {
    console.log("Reroute removed " + id);
})

/* DRAG EVENT */

/* Mouse and Touch Actions */

var elements = document.getElementsByClassName('drag-drawflow');
for (var i = 0; i < elements.length; i++) {
    elements[i].addEventListener('touchend', drop, false);
    elements[i].addEventListener('touchmove', positionMobile, false);
    elements[i].addEventListener('touchstart', drag, false);
}

var mobile_item_selec = '';
var mobile_last_move = null;

function positionMobile(ev) {
    mobile_last_move = ev;
}

function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    if (ev.type === "touchstart") {
        mobile_item_selec = ev.target.closest(".drag-drawflow").getAttribute('data-node');
    } else {
        ev.dataTransfer.setData("node", ev.target.getAttribute('data-node'));
    }
}

function drop(ev) {
    if (ev.type === "touchend") {
        var parentdrawflow = document.elementFromPoint(mobile_last_move.touches[0].clientX, mobile_last_move.touches[0].clientY).closest("#drawflow");
        if (parentdrawflow != null) {
            addNodeToDrawFlow(mobile_item_selec, mobile_last_move.touches[0].clientX, mobile_last_move.touches[0].clientY);
        }
        mobile_item_selec = '';
    } else {
        ev.preventDefault();
        var data = ev.dataTransfer.getData("node");
        addNodeToDrawFlow(data, ev.clientX, ev.clientY);
    }

}

function addRow(element) {
    var table = element.closest('.box').querySelector('.parameters-table');
    var newRow = table.insertRow(-1);
    var cell1 = newRow.insertCell(0);
    var cell2 = newRow.insertCell(1);
    var cell3 = newRow.insertCell(2);
    var cell4 = newRow.insertCell(3);
    var cell5 = newRow.insertCell(4);

    cell1.innerHTML = '<input placeholder="参数名" />';
    cell2.innerHTML = '<select><option checked="checked">String</option><option>Integer</option><option>Boolean</option><option>Number</option></select>';
    cell3.innerHTML = '<input placeholder="参数描述" />';
    cell4.innerHTML = '<input placeholder="常量" />';

    var deleteBtn = document.createElement("button");
    deleteBtn.textContent = "删除";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.onclick = function () {
        deleteRow(this);
    };

    cell5.appendChild(deleteBtn);
}

function addPrRow(element) {
    var table = element.closest('.box').querySelector('.params-table');
    var newRow = table.insertRow(-1);
    var cell1 = newRow.insertCell(0);
    var cell2 = newRow.insertCell(1);
    var cell3 = newRow.insertCell(2);

    cell1.innerHTML = '<input placeholder="Params Key" />';
    cell2.innerHTML = '<input placeholder="Params Value" />';

    var deleteBtn = document.createElement("button");
    deleteBtn.textContent = "删除";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.onclick = function () {
        deleteRow(this);
    };

    cell3.appendChild(deleteBtn);
}

function addHdRow(element) {
    var table = element.closest('.box').querySelector('.headers-table');
    var newRow = table.insertRow(-1);
    var cell1 = newRow.insertCell(0);
    var cell2 = newRow.insertCell(1);
    var cell3 = newRow.insertCell(2);

    cell1.innerHTML = '<input placeholder="Header Key" />';
    cell2.innerHTML = '<input placeholder="Header Value" />';

    var deleteBtn = document.createElement("button");
    deleteBtn.textContent = "删除";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.onclick = function () {
        deleteRow(this);
    };

    cell3.appendChild(deleteBtn);
}

function addCkRow(element) {
    var table = element.closest('.box').querySelector('.cookies-table');
    var newRow = table.insertRow(-1);
    var cell1 = newRow.insertCell(0);
    var cell2 = newRow.insertCell(1);
    var cell3 = newRow.insertCell(2);

    cell1.innerHTML = '<input placeholder="Cookie Key" />';
    cell2.innerHTML = '<input placeholder="Cookie Value" />';

    var deleteBtn = document.createElement("button");
    deleteBtn.textContent = "删除";
    deleteBtn.classList.add("delete-btn");
    deleteBtn.onclick = function () {
        deleteRow(this);
    };

    cell3.appendChild(deleteBtn);
}

function deleteRow(btn) {
    var row = btn.parentNode.parentNode; // 通过按钮找到所在的行
    row.parentNode.removeChild(row); // 从其父元素（表格）中删除该行
}

function addNodeToDrawFlow(name, pos_x, pos_y) {
    if (editor.editor_mode === 'fixed') {
        return false;
    }
    pos_x = pos_x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)) - (editor.precanvas.getBoundingClientRect().x * (editor.precanvas.clientWidth / (editor.precanvas.clientWidth * editor.zoom)));
    pos_y = pos_y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)) - (editor.precanvas.getBoundingClientRect().y * (editor.precanvas.clientHeight / (editor.precanvas.clientHeight * editor.zoom)));

    switch (name) {
        case 'start':
            var start = `
            <div>
              <div class="title-box"><i class="far fa-play-circle"></i> <span class="nodeText">开始(start)<span></div>
            </div>
            `;
            editor.addNode('start', 0, 1, pos_x, pos_y, 'start', {
                output: {
                    prItems: []
                }
            }, start);
            break;
        case 'javascript':
            var javascript = `
            <div>
              <div class="title-box"> <i class="fab fa-js"></i> <span class="nodeText">脚本(javascript)<span></div>
            </div>
            `;
            editor.addNode('javascript', 1, 1, pos_x, pos_y, 'javascript', {
                output: {
                    javascript: ""
                }
            }, javascript);
            break;
        case 'http':
            var http = `
            <div>
              <div class="title-box"><i class="fas fa-paper-plane"></i> <span class="nodeText">Http请求(http)</span></div>
            </div>
            `;
            editor.addNode('http', 1, 1, pos_x, pos_y, 'http', {
                output: {
                    requestUrl: "",
                    type: "",
                    jsontemplate: "",
                    paramsItems: [],
                    headersItems: [],
                    cookiesItems: [],
                    judgescript: "",
                    httpmaxcount: 10,
                    httpdelayed: 0
                }
            }, http);
            break;
        case 'LLM':
            var LLM = `
            <div>
              <div class="title-box"><i class="fas fa-robot"></i> <span class="nodeText">LLM(LLM)</span></div>
            </div>
            `;
            editor.addNode('LLM', 1, 1, pos_x, pos_y, 'LLM', {
                output: {
                    aimodel: "",
                    prompt: "",
                    imgurl: "",
                    retry: 0,
                    stream: false,
                    jsonmodel: false,
                    judgescript: "",
                    llmmaxcount: 10
                }
            }, LLM);
            break;
        case 'DALL':
            var DALL = `
            <div>
              <div class="title-box"><i class="fas fa-paint-brush"></i> <span class="nodeText">DALL·E3(DALL)</span></div>
            </div>`;
            editor.addNode('DALL', 1, 1, pos_x, pos_y, 'DALL', {
                output: {
                    prompt: "",
                    size: "",
                    quality: "",
                    retry: 0
                }
            }, DALL);
            break;
        case 'DALLsm':
            var DALLsm = `
            <div>
              <div class="title-box"><i class="fas fa-paint-brush"></i> <span class="nodeText">DALL·E2(DALLsm)</span></div>
            </div>`;
            editor.addNode('DALLsm', 1, 1, pos_x, pos_y, 'DALLsm', {
                output: {
                    prompt: "",
                    retry: 0
                }
            }, DALLsm);
            break;
        case 'downloadimg':
            var downloadimg = `
            <div>
              <div class="title-box"><i class="far fa-image"></i> <span class="nodeText">图片下载(downloadImg)</span></div>
            </div>`;
            editor.addNode('downloadimg', 1, 1, pos_x, pos_y, 'downloadimg', {
                output: {
                    imageurl: "",
                    prompt: ""
                }
            }, downloadimg);
            break;
        case 'web':
            var web = `
            <div>
              <div class="title-box"><i class="fas fa-globe"></i> <span class="nodeText">联网搜索(web)</span></div>
            </div>`;
            editor.addNode('web', 1, 1, pos_x, pos_y, 'web', {
                output: {
                    prompt: ""
                }
            }, web);
            break;
        case 'ifelse':
            var ifelse = `
            <div>
              <div class="title-box"><i class="fas fa-question-circle"></i> <span class="nodeText">if-else(ifelse)</span></div>
            </div>`;
            editor.addNode('ifelse', 1, 2, pos_x, pos_y, 'ifelse', {
                output: {
                    judgresult: ""
                }
            }, ifelse);
            break;
        case 'knowledge':
            var knowledge = `
             <div>
              <div class="title-box"><i class="fas fa-database"></i> <span class="nodeText">knowledge</span></div>
             </div>`;
            editor.addNode('knowledge', 1, 1, pos_x, pos_y, 'knowledge', {
                output: {
                    prompt: "",
                    retry: 0,
                    topk: 3,
                    typecode: []
                }
            }, knowledge);
            break;
        case 'debug':
            var debug = `
            <div>
              <div class="title-box"><i class="fas fa-bug"></i> <span class="nodeText"> Debug(debug)</span></span></div>
            </div>
            `;
            editor.addNode('debug', 1, 1, pos_x, pos_y, 'debug', {
                output: {
                    chatlog: ""
                }
            }, debug);
            break;
        case 'end':
            var end = `
            <div>
              <div class="title-box"><i class="fas fa-stop-circle"></i> <span class="nodeText">结束(end)</span></div>
            </div>
            `;
            editor.addNode('end', 1, 0, pos_x, pos_y, 'end', {
                output: {
                    endaction: "",
                    endscript: ""
                }
            }, end);
            break;
    }
}

var transform = '';

function showpopup(e) {
    e.target.closest(".drawflow-node").style.zIndex = "9999";
    e.target.children[0].style.display = "block";
    //document.getElementById("modalfix").style.display = "block";

    //e.target.children[0].style.transform = 'translate('+translate.x+'px, '+translate.y+'px)';
    transform = editor.precanvas.style.transform;
    editor.precanvas.style.transform = '';
    editor.precanvas.style.left = editor.canvas_x + 'px';
    editor.precanvas.style.top = editor.canvas_y + 'px';
    console.log(transform);

    //e.target.children[0].style.top  =  -editor.canvas_y - editor.container.offsetTop +'px';
    //e.target.children[0].style.left  =  -editor.canvas_x  - editor.container.offsetLeft +'px';
    editor.editor_mode = "fixed";

}

function closemodal(e) {
    e.target.closest(".drawflow-node").style.zIndex = "2";
    e.target.parentElement.parentElement.style.display = "none";
    //document.getElementById("modalfix").style.display = "none";
    editor.precanvas.style.transform = transform;
    editor.precanvas.style.left = '0px';
    editor.precanvas.style.top = '0px';
    editor.editor_mode = "edit";
}

function changeModule(event) {
    var all = document.querySelectorAll(".menu ul li");
    for (var i = 0; i < all.length; i++) {
        all[i].classList.remove('selected');
    }
    event.target.classList.add('selected');
}

//function changeMode(option) {

//    //console.log(lock.id);
//    if (option == 'lock') {
//        lock.style.display = 'none';
//        unlock.style.display = 'block';
//    } else {
//        lock.style.display = 'block';
//        unlock.style.display = 'none';
//    }

//}
function exportDrawFlow() {
    const jsonString = JSON.stringify(editor.export(), null, 4);
    layer.open({
        title: '预览Json',
        area: ['90%', '80%'],
        content: `<pre>${escapeHtml(jsonString)}</pre>`
    });
}

let toolsHide = false;

function hideTools() {
    if (!toolsHide) {
        $("#drawflow").css("width", "calc(100vw)");
        $(".col").hide();
        toolsHide = true;
    } else {
        $("#drawflow").css("width", "calc(100vw - 301px)");
        $(".col").show();
        toolsHide = false;
    }
}

let optionMax_b = false;

function optionMax() {
    if (!optionMax_b) {
        $(".side-panel").css("width", "70%");
        $("#togglePanelIcon").toggleClass("fas fa-chevron-right");
        optionMax_b = true;
    } else {
        $(".side-panel").css("width", "400px");
        $("#togglePanelIcon").toggleClass("fas fa-chevron-left");
        optionMax_b = false;
    }
}

function pushtoPlugin(showlayer = true) {
    layer.load(1, {
        shade: [0.5, '#000'] //0.3透明度的白色背景
    });
    saveNodeDataToCache(function () {
        $.ajax({
            type: "POST",
            async: false,
            url: "/WorkShop/PushtoPlugin",
            data: {
                plugincode: plugincode,
                workflowcode: workflowcode
            },
            success: function (data) {
                layer.closeAll('loading'); //关闭加载中的弹窗
                if (showlayer) {
                    if (data.success) {
                        layer.confirm('<i class="fas fa-check-circle" style="color:rgb(40,232,139)"></i> 发布成功！您想要留在此页还是返回插件列表？', {
                            btn: ['留在此页', '返回插件列表'] //按钮
                        }, function () {
                            // 点击“留在此页”后的回调
                            layer.closeAll();
                        }, function () {
                            // 点击“返回插件列表”后的回调
                            window.location.href = '/WorkShop/MyPlugins?tab=mycreate';
                        });
                    } else {
                        layer.msg(data.msg, { icon: 2, time: 2000 });
                    }
                }
            },
            error: function () {
                // 关闭加载中的弹窗
                layer.closeAll('loading');
                layer.msg('请求失败，请重试', { icon: 2, time: 2000 });
            }
        });
    });
}

editor.createCurvature = function (start_pos_x, start_pos_y, end_pos_x, end_pos_y, curvature_value, type) {
    var line_x = start_pos_x;
    var line_y = start_pos_y;
    var x = end_pos_x;
    var y = end_pos_y;
    var curvature = curvature_value;
    switch (type) {
        case 'open':
            if (start_pos_x >= end_pos_x) {
                var hx1 = line_x + Math.abs(x - line_x) * curvature;
                var hx2 = x - Math.abs(x - line_x) * (curvature * -1);
            } else {
                var hx1 = line_x + Math.abs(x - line_x) * curvature;
                var hx2 = x - Math.abs(x - line_x) * curvature;
            }
            return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y;
            break
        case 'close':
            if (start_pos_x >= end_pos_x) {
                var hx1 = line_x + Math.abs(x - line_x) * (curvature * -1);
                var hx2 = x - Math.abs(x - line_x) * curvature;
            } else {
                var hx1 = line_x + Math.abs(x - line_x) * curvature;
                var hx2 = x - Math.abs(x - line_x) * curvature;
            }                                                                                                                  //M0 75H10L5 80L0 75Z

            return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y + ' M ' + (x - 11) + ' ' + y + ' L' + (x - 20) + ' ' + (y - 5) + '  L' + (x - 20) + ' ' + (y + 5) + 'Z';
            break;
        case 'other':
            if (start_pos_x >= end_pos_x) {
                var hx1 = line_x + Math.abs(x - line_x) * (curvature * -1);
                var hx2 = x - Math.abs(x - line_x) * (curvature * -1);
            } else {
                var hx1 = line_x + Math.abs(x - line_x) * curvature;
                var hx2 = x - Math.abs(x - line_x) * curvature;
            }
            return ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + hx2 + ' ' + y + ' ' + x + '  ' + y;
            break;
        default:
            var hx1 = line_x + Math.abs(x - line_x) * curvature;
            var hx2 = x - Math.abs(x - line_x) * curvature;
            let xx = ' M ' + line_x + ' ' + line_y + ' C ' + hx1 + ' ' + line_y + ' ' + (hx2) + ' ' + y + ' ' + (x - 20) + '  ' + y + ' M ' + (x - 11) + ' ' + y + ' L' + (x - 20) + ' ' + (y - 5) + '  L' + (x - 20) + ' ' + (y + 5) + 'Z';
            return xx;
            break;
    }
}
//workflow测试区代码
// websocket连接设置
var connection = new signalR.HubConnectionBuilder()
    .withUrl('/chatHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();

// 启动连接
connection.start()
    .then(function () {
        console.log('与工坊服务器握手成功 :-)'); // 与服务器握手成功
    })
    .catch(function (error) {
        console.log('与工坊服务器握手失败 :-( 原因: ' + error); // 与服务器握手失败
        sendExceptionMsg('与工坊服务器握手失败 :-( 原因: ' + error);
        // 检查令牌是否过期，如果是，则跳转到登录页面
        if (isTokenExpiredError(error)) {
            window.location.href = "/Users/Login";
        }
    });

// 检查错误是否表示令牌过期的函数
// 注意：您需要根据实际的错误响应格式来调整此函数
function isTokenExpiredError(error) {
    // 这里的判断逻辑依赖于服务器返回的错误格式
    // 例如，如果服务器在令牌过期时返回特定的状态码或错误信息，您可以在这里检查
    var expiredTokenStatus = 401; // 假设401表示令牌过期
    return error.statusCode === expiredTokenStatus || error.message.includes("令牌过期");
}

// You can also handle the reconnection events if needed:
connection.onreconnecting((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Reconnecting);
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接工坊。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection.onreconnected((connectionId) => {
    console.assert(connection.state === signalR.HubConnectionState.Connected);
    console.log(`工坊连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
});
var chatid = "";
var chatgroupid = "";
var assistansBoxId = "";
var thisAiModel = "gpt-4o-mini-CYGF"; //当前AI模型
var processOver = true;
var bottomPanel = document.getElementById('bottomPanel');
var closePanelBtn = document.getElementById('debugerclosePanelBtn');
var chatBody = $(".bottom-panel-content");

var md = window.markdownit();
var sysmsg = "";
var jishuqi = 0;

// 添加显示代码语言的 Labels
function addLanguageLabels(useSpecificId = false, assistansBoxId = '') {
    // 根据 useSpecificId 决定选择器的范围
    var selector = useSpecificId && assistansBoxId ? $("#" + assistansBoxId + " pre code") : $("pre code");

    selector.each(function () {
        // 仅对尚未添加过语言标签的 code 元素进行处理
        if ($(this).parent().find('.code-lang-label-container').length === 0) {
            var lang = $(this).attr('class').match(/language-(\w+)/);
            if (lang) {
                // 创建语言标签容器
                var langLabelContainer = $('<div class="code-lang-label-container" style="background-color: rgb(80, 80, 90);"></div>');
                // 创建语言标签
                var langLabel = $('<span class="code-lang-label" style="color: white;">' + lang[1] + '</span>');
                // 将语言标签添加到容器中
                langLabelContainer.append(langLabel);
                // 将语言标签容器插入到代码块的顶部
                $(this).before(langLabelContainer);
            }
        }
    });
}

connection.on('ReceiveWorkShopMessage', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
        } else {
            if (message.message != null) {
                sysmsg += message.message;
                $("#" + assistansBoxId).html(md.render(sysmsg));
                MathJax.typeset();
                //hljs.highlightAll();
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addLanguageLabels(true, assistansBoxId);
            }

        }
        jishuqi++;
    } else {
        processOver = true;
        $("#sendBtn").css('background-color', 'rgb(0,123,255)');
        $("#sendBtn").text('发送');
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
        MathJax.typeset();
        //hljs.highlightAll();
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        addLanguageLabels(true, assistansBoxId);
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
    }
    if (message.jscode != null && message.jscode != "") {
        (function () {
            eval(message.jscode);
        })();
    }
});


//发送消息
function sendMsg() {
    var msg = $("#Q").val().trim();
    if (msg == "") {
        layer.msg('请输入问题', { icon: 3, time: 2000 });
        return;
    }
    if (!processOver) {
        layer.msg('对话进行中,请结束后再试', { icon: 3, time: 2000 });
        return;
    }
    processOver = false;
    $("#sendBtn").css('background-color', 'red');
    $("#sendBtn").text('停止');
    chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    assistansBoxId = msgid_g;
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": "",
        "chatfrom": plugincode
    };
    $("#Q").val("");
    $("#Q").focus();
    var html = `<div class="chat-message user"><pre id="` + msgid_u + `"></pre></div>`;
    $(".bottom-panel-content").append(html);
    $("#" + msgid_u).text(msg);
    var gpthtml = `<div class="chat-message system"><div id="` + msgid_g + `"></div><div class="spinner-grow spinner-grow-sm LDI"></div></div>`;
    $(".bottom-panel-content").append(gpthtml);
    chatBody.animate({
        scrollTop: chatBody.prop("scrollHeight")
    }, 500);
    connection.invoke("SendWorkShopMessage", data, false, [])
        .then(function () {
        })
        .catch(function (err) {
            processOver = true;
            sendExceptionMsg("【WorkFlow测试】发送消息时出现了一些未经处理的异常 :-( 原因：" + err);
            //balert("您的登录令牌似乎已失效，我们将启动账号保护，请稍候，正在前往重新登录...", "danger", false, 3000, "center", function () {
            //    window.location.href = "/Users/Login";
            //});
        });
}

//新建会话
function newChat() {
    if (!processOver) {
        layer.msg('对话进行中,请结束后再试', { icon: 3, time: 2000 });
        return;
    }
    chatid = "";
    chatgroupid = "";
    chatBody.html("");
    $("#Q").focus();
}

function stopGenerate() {
    processOver = true;
    $("#sendBtn").css('background-color', 'rgb(0,123,255)');
    $("#sendBtn").text('发送');
    $('.LDI').remove();
    if (sysmsg != '')
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
    MathJax.typeset();
    $("#" + assistansBoxId + " pre code").each(function (i, block) {
        hljs.highlightElement(block);
    });
    addLanguageLabels(true, assistansBoxId);
    $.ajax({
        type: "Post",
        url: "/Home/StopGenerate",
        dataType: "json",
        data: {
            chatId: chatgroupid
        },
        success: function (res) {
            console.log(`workshop停止生成，Id：${chatgroupid} --${getCurrentDateTime()}`);
        },
        error: function (err) {
            layer.msg('出现了一些未经处理的异常，请联系管理员', { icon: 2, time: 2000 }, function () {
                sendExceptionMsg(err.toString());
            });
        }
    });
}

function debugWorkFlow() {
    saveNodeDataToCache();
    pushtoPlugin(false);
    $('#overlay').show();
    bottomPanel.classList.add('show');
    getWorkShopAIModelList();
}

closePanelBtn.addEventListener('click', () => {
    bottomPanel.classList.remove('show');
    $('#overlay').hide();
});
$(document).keypress(function (e) {
    if ($("#Q").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            sendMsg();
        }
    }
});
$(document).ready(function () {
    // 监听模型选择下拉框的变化
    $('#modelSelect').change(function () {
        var selectedModel = $(this).val();
        thisAiModel = selectedModel;
        layer.msg('切换成功', { icon: 1, time: 2000 });
    });
    $("#sendBtn").on("click", function () {
        if (!processOver) {
            stopGenerate();
        } else
            sendMsg();
    });
});

function getWorkShopAIModelList(callback) {
    $.ajax({
        type: "Post",
        url: "/WorkShop/GetWorkShopAImodel",
        dataType: "json",
        success: function (res) {
            var html = "";
            if (res.success) {
                for (var i = 0; i < res.data.length; i++) {
                    html += `<option value="${res.data[i].modelName}">${res.data[i].modelNick}</option>`;
                }
                $('.aimodelCYGF').html(html);
                callback && callback();
            }
        },
        error: function (err) {
            layer.msg('系统未配置AI模型', { icon: 2, time: 2000 });

        }
    });
}

function goBack() {
    window.location.href = `/WorkShop/MyWork?plugincode=${plugincode}&id=1393&type=edit`;
}
function darkModel() {
    const isDarkMode = $('html').hasClass('dark');
    const newMode = !isDarkMode;
    const dkmodelBtn = $('.dkmodel');
    if (newMode) {
        $('html').addClass('dark');
        dkmodelBtn.html(`<i class="fas fa-sun" style="color:#ffcd42"></i> 开灯`);
    } else {
        $('html').removeClass('dark');
        dkmodelBtn.html(`<i class="fas fa-moon"></i> 关灯`);
    }
    // 保存状态到 localStorage
    localStorage.setItem('darkMode', newMode);
}