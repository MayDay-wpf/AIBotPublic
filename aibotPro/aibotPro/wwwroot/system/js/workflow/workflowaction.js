var startdata = {
    output: {
        prItems: [],
    }
};
var javascriptdata = {
    output: {
        javascript: ""
    }
}
var httpdata = {
    output: {
        requestUrl: "",
        type: "",
        jsontemplate: "",
        paramsItems: [],
        headersItems: [],
        cookiesItems: [],
    }
}
var LLMdata = {
    output: {
        aimodel: "",
        prompt: ""
    }
}
var DALLdata = {
    output: {
        prompt: ""
    }
}
var webdata = {
    output: {
        prompt: ""
    }
}
var enddata = {
    output: {
        endaction: "",
        endscript: ""
    }
}
var regex = /'/;
function saveNodeData() {
    switch (thisNodeName) {
        case 'start':
            var rows = $('.parameters-table tr');
            var isEmpty = false; // 初始化空值标志
            startdata = {
                output: {
                    prItems: [],
                }
            };
            rows.each(function () {
                var columns = $(this).find('td');

                var PRname = columns.eq(0).find('input').val();
                var PRvalue = columns.eq(1).find('input').val();
                var PRconstant = columns.eq(2).find('input').val();
                if (PRname.trim() === '' || PRvalue.trim() === '' || regex.test(PRname) || regex.test(PRvalue)) {
                    isEmpty = true;
                    layer.msg('存在空的参数值，请填写完整！', { icon: 2, time: 2500 });
                    return false;
                }
                var item = {
                    "prName": PRname,
                    "prInfo": PRvalue,
                    "prConst": PRconstant
                };
                startdata.output.prItems.push(item);
            });
            if (isEmpty) {
                return false; // 如果检测到空值，立即退出函数
            }
            //console.log(startdata);
            editor.updateNodeDataFromId(thisNodeId, startdata);
            saveNodeDataToCache();
            return true;
            break;
        case 'javascript':
            var js = codeeditor.getValue();
            javascriptdata.output.javascript = js;
            editor.updateNodeDataFromId(thisNodeId, javascriptdata);
            saveNodeDataToCache();
            return true;
            break;
        case 'http':
            httpdata = {
                output: {
                    requestUrl: "",
                    type: "",
                    jsontemplate: "",
                    paramsItems: [],
                    headersItems: [],
                    cookiesItems: [],
                }
            }
            var isEmpty = false;
            var rows_params = $('.params-table tr');
            var rows_headers = $('.headers-table tr');
            var rows_cookies = $('.cookies-table tr');
            var jsontemplate = $('.jsontemplate').val(); // 提取 jsontemplate 的值
            rows_params.each(function () {
                var columns = $(this).find('td');

                var ParamKey = columns.eq(0).find('input').val();
                var ParamValue = columns.eq(1).find('input').val();
                if (ParamKey.trim() === '' || ParamValue.trim() === '' || regex.test(ParamKey) || regex.test(ParamValue)) {
                    isEmpty = true;
                    layer.msg('存在空的参数值，请填写完整！', { icon: 2, time: 2500 });
                    return false;
                }
                var item = {
                    "paramKey": ParamKey,
                    "paramValue": ParamValue
                };
                httpdata.output.paramsItems.push(item);
            });
            rows_headers.each(function () {
                var columns = $(this).find('td');

                var HdKey = columns.eq(0).find('input').val();
                var HdValue = columns.eq(1).find('input').val();
                if (HdKey.trim() === '' || HdValue.trim() === '' || regex.test(HdKey) || regex.test(HdValue)) {
                    isEmpty = true;
                    layer.msg('存在空的Header值，请填写完整！', { icon: 2, time: 2500 });
                    return false;
                }
                var item = {
                    "hdKey": HdKey,
                    "hdValue": HdValue
                };
                httpdata.output.headersItems.push(item);
            });
            rows_cookies.each(function () {
                var columns = $(this).find('td');

                var CkKey = columns.eq(0).find('input').val();
                var CkValue = columns.eq(1).find('input').val();
                if (CkKey.trim() === '' || CkValue.trim() === '' || regex.test(CkKey) || regex.test(CkValue)) {
                    isEmpty = true;
                    layer.msg('存在空的Cookie值，请填写完整！', { icon: 2, time: 2500 });
                    return false;
                }
                var item = {
                    "ckKey": CkKey,
                    "ckValue": CkValue
                };
                httpdata.output.cookiesItems.push(item);
            });
            if (isEmpty) {
                return false; // 如果检测到空值，立即退出函数
            }
            if ($('.requestUrl').val() == "") {
                layer.msg('请填写请求地址', { icon: 2, time: 2500 });
                return false;
            }
            httpdata.output.type = $('.http-type').val();
            httpdata.output.requestUrl = $('.requestUrl').val();
            httpdata.output.jsontemplate = jsontemplate.trim(); // 将 jsontemplate 添加到数组中
            editor.updateNodeDataFromId(thisNodeId, httpdata);
            saveNodeDataToCache();
            return true;
            break;
        case 'LLM':
            LLMdata = {
                output: {
                    aimodel: "",
                    prompt: ""
                }
            }
            var AImodel = $('.aimodel').val();
            var Prompt = $('.prompt').val();
            LLMdata.output.aimodel = AImodel;
            if (Prompt == "") {
                layer.msg('请填写提示词', { icon: 2, time: 2500 });
                return false;
            }
            LLMdata.output.prompt = Prompt;
            editor.updateNodeDataFromId(thisNodeId, LLMdata);
            saveNodeDataToCache();
            return true;
            break;
        case 'DALL':
            DALLdata = {
                output: {
                    prompt: ""
                }
            }
            var Prompt = $('.prompt').val();
            if (Prompt == "") {
                layer.msg('请填写提示词', { icon: 2, time: 2500 });
                return false;
            }
            DALLdata.output.prompt = Prompt;
            editor.updateNodeDataFromId(thisNodeId, DALLdata);
            saveNodeDataToCache();
            return true;
            break;
        case 'web':
            DALLdata = {
                output: {
                    prompt: ""
                }
            }
            var Prompt = $('.prompt').val();
            if (Prompt == "") {
                layer.msg('请填写搜索关键词', { icon: 2, time: 2500 });
                return false;
            }
            DALLdata.output.prompt = Prompt;
            editor.updateNodeDataFromId(thisNodeId, DALLdata);
            saveNodeDataToCache();
            return true;
            break;
        case 'end':
            enddata = {
                output: {
                    endaction: "",
                    endscript: ""
                }
            }
            var EndAction = $('.endaction').val();
            var EndScript = '';
            EndScript = endCodeeditor.getValue();
            enddata.output.endaction = EndAction;
            enddata.output.endscript = EndScript;
            editor.updateNodeDataFromId(thisNodeId, enddata);
            saveNodeDataToCache();
            return true;
            break;
    }
}

function saveNodeDataToCache() {
    var nodeData = JSON.stringify(editor.export(), null, 4);
    $.ajax({
        type: "POST",
        url: "/WorkShop/SaveNodeDataToCache",
        data: {
            workflowcode: workflowcode,
            nodeData: nodeData
        },
        success: function (data) {
            if (data.success) {
                layer.msg('保存完成', { icon: 1, offset: 't', time: 2000 });
            }
            else {
                layer.msg(data.msg, { icon: 2, offset: 't', time: 2000 });
            }
        }
    });
}


function getWorkFlowNodeData(workflowcode) {
    $.ajax({
        type: "POST",
        url: "/WorkShop/GetWorkFlowNodeData",
        dataType: "json",
        data: {
            workflowcode: workflowcode
        },
        success: function (data) {
            data = data.data;
            if (data !== null) {
                editor.import(JSON.parse(data));
            }
        }
    });
}