var plugincode = '';
var ispublic = 'yes';
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#cygf-main-menu").addClass('active');
    $("#cygf-main-menu").parent().addClass('show');
    $("#cygf-main-menu").parent().siblings().removeClass('show');
    $("#mywork-cygf-nav").addClass('active');

    $('#avatar').val('');
    $('#nickname').val('');
    $('#functionname').val('');
    $('#functioninfo').val('');
    $("#usehtml1").prop("checked", false);
    $("#usehtml2").prop("checked", false);
    $("#usehtml3").prop("checked", false);
    $('#apiurl').val('');
    $('#apiurl2').val('');
    plugincode = getUrlParam('plugincode');
    id = getUrlParam('id');
    type = getUrlParam('type');
    if (plugincode && id && type) {
        getPluginInfo(plugincode, id, type);
    }
});
var codemodel = '';
var myTextarea = '';
var editor = '';
var output = '';
var myTextarea2 = '';
var editor2 = '';
var output2 = '';
function runCode() {
    var code = editor.getValue();
    try {
        var result = eval(code);
        output.setValue(result);
    } catch (error) {
        output.setValue(error.toString());
    }
}
function runCode2() {
    var code = editor2.getValue();
    try {
        var result = eval(code);
        output2.setValue(result);
    } catch (error) {
        output2.setValue(error.toString());
    }
}
$(document).ready(function () {
    $('#pluginprice').on('input', function (event) {
        this.value = this.value.replace(/[^0-9\.]/g, ''); // 只允许数字和小数点
        this.value = this.value.replace(/(\..*)\./g, '$1'); // 只允许一个小数点
        this.value = this.value.replace(/(\.\d{2})./g, '$1'); // 只保留两位小数
    }).on('focus', function (event) {
        // 如果当前值是'0.00'，则清空输入框
        if (this.value === '0.00') {
            this.value = '';
        }
    }).on('blur', function (event) {
        // 如果输入框为空，则恢复默认值'0.00'
        if (this.value === '') {
            this.value = '0.00';
        }
    });
});
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
            url: '/WorkShop/UploadAvatar',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                if (res.success) {
                    avatar = res.filePath.replace('wwwroot', '');
                }
                else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
}
function initEditor(index, code) {
    if (index == 1) {
        if (!myTextarea) {
            myTextarea = document.getElementById("myTextarea");
            editor = CodeMirror.fromTextArea(myTextarea, {
                lineNumbers: true,
                mode: "javascript",
                theme: "3024-night",
            });
        }
        if (!editor) {
            // Update editor settings if it already exists
            editor.setOption("mode", "javascript");
            editor.setOption("theme", "3024-night");
        }
        editor.setValue(code);
        editor.setSize('auto', '600px');

        if (!output) {
            output = CodeMirror(document.getElementById("output"), {
                value: "Hello, world!",
                lineNumbers: true,
                theme: "3024-night"
            });
        } else {
            // Update output settings if it already exists
            output.setOption("theme", "3024-night");
            output.setValue("Hello, world!"); // Set new content if needed
        }
    }
    if (index == 2) {
        if (!myTextarea2) {
            myTextarea2 = document.getElementById("myTextarea2");
            editor2 = CodeMirror.fromTextArea(myTextarea2, {
                lineNumbers: true,
                mode: "javascript",
                theme: "3024-night"
            });
        }
        if (!editor2) {
            // Update editor settings if it already exists
            editor2.setOption("mode", "javascript");
            editor2.setOption("theme", "3024-night");
        }
        editor2.setValue(code);
        editor2.setSize('auto', '600px');
        if (!output2) {
            output2 = CodeMirror(document.getElementById("output2"), {
                value: "Hello, world!",
                lineNumbers: true,
                theme: "3024-night"
            });
        } else {
            // Update output settings if it already exists
            output2.setOption("theme", "3024-night");
            output2.setValue("Hello, world!"); // Set new content if needed
        }
    }
}
function selectMode(model) {
    switch (model) {
        case 'plugin-online':
            $('#plugin-online').show();
            $('#plugin-offline').hide();
            $('#plugin-mixed').hide();
            codemodel = 'plugin-online';
            $('html, body').animate({ scrollTop: $('.content-body').height() }, 1000);
            break;
        case 'plugin-offline':
            $('#plugin-online').hide();
            $('#plugin-offline').show();
            $('#plugin-mixed').hide();
            initEditor(1, `//演示脚本（请删除）插件脚本请不要写注释
function get_weather_forecast() {
  return 'Hello, world!';
}`);
            var element = document.getElementById("plugin-offline");
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            codemodel = 'plugin-offline';
            break;
        case 'plugin-mixed':
            $('#plugin-online').hide();
            $('#plugin-offline').hide();
            $('#plugin-mixed').show();
            initEditor(2, `//演示脚本（请删除）插件脚本请不要写注释
function get_weather_forecast(res) {
  return res;
}`);
            var element = document.getElementById("plugin-mixed");
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            codemodel = 'plugin-mixed';
            break;
        default:
            break;
    }
}
function addPrLine(index) {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="参数名(只允许字母、字符)，例：number" /></td>
                 <td><input type="text" class="form-control" maxlength="200" placeholder="参数描述，重要！例：手机号码" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="常量,可输入固定值,不用AI填写参数"  /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`;
    if (index == 1)
        $("#AddPr1").append(str);
    else if (index == 2)
        $("#AddPr2").append(str);
    else
        $("#AddPr").append(str);
    feather.replace();
}
function addHdLine(index) {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="100" placeholder="Header参数名" /></td>
                 <td><input type="text" class="form-control" maxlength="300" placeholder="Header参数值" /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`;
    if (index == 2)
        $("#AddHd2").append(str);
    else
        $("#AddHd").append(str);
    feather.replace();
}
function addCkLine(index) {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="100" placeholder="Cookie-Key" /></td>
                 <td><input type="text" class="form-control" maxlength="300" placeholder="Cookie-Value" /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    if (index == 2)
        $("#AddCk2").append(str);
    else
        $("#AddCk").append(str);
    feather.replace();
}
function delLine() {
    $(event.target).closest('tr').remove();
}
function showStep() {
    $("#plugin-1").show();
    $("#plugin-2").show();
}
var avatar = '';
var nickname = '';
var functionname = '';
var functioninfo = '';
var opensource = 'yes';
var pluginprice = 0.00;
var apiurl = '';
var method = 'post';
var rows;
var rowsHd;
var rowsCk;
var jscode = '';
var runLocation = '';
var usehtml = '';
var regex = /'/;

function PostPlugin(type) {
    nickname = $('#nickname').val();
    functionname = $('#functionname').val();
    functioninfo = $('#functioninfo').val();
    if (avatar === '' || nickname === '' || functionname === '' || functioninfo === '') {
        balert('请填写所有必填项', 'warning', false, 1500, 'center');
        return;
    }
    var isEmpty = false;
    var isEmptyHd = false;
    var isEmptyCk = false;
    var conversation = [];
    var conversationHd = [];
    var conversationCk = [];
    if (codemodel == 'plugin-online') {
        apiurl = $('#apiurl').val().trim();
        method = $("input[name='method']:checked").val();
        if (apiurl == "") {
            balert('请填写API地址', 'warning', false, 1500, 'center');
            return;
        }
        rows = $('#AddPr tr');
        rowsHd = $('#AddHd tr');
        rowsCk = $('#AddCk tr');
        usehtml = $("#usehtml1").prop("checked");
    }
    else if (codemodel == 'plugin-offline') {
        rows = $('#AddPr1 tr');
        jscode = editor.getValue();
        runLocation = $("input[name='runLocation']:checked").val();
        usehtml = $("#usehtml2").prop("checked");
    }
    else if (codemodel == 'plugin-mixed') {
        apiurl = $('#apiurl2').val().trim();
        method = $("input[name='method2']:checked").val();
        if (apiurl == "") {
            balert('请填写API地址', 'warning', false, 1500, 'center');
            return;
        }
        rows = $('#AddPr2 tr');
        rowsHd = $('#AddHd2 tr');
        rowsCk = $('#AddCk2 tr');
        jscode = editor2.getValue();
        runLocation = $("input[name='runLocation2']:checked").val();
        usehtml = $("#usehtml3").prop("checked");
    }
    rows.each(function () {
        var columns = $(this).find('td');

        var PRname = columns.eq(0).find('input').val();
        var PRvalue = columns.eq(1).find('input').val();
        var PRconstant = columns.eq(2).find('input').val();
        if (PRname.trim() === '' || PRvalue.trim() === '' || regex.test(PRname) || regex.test(PRvalue)) {
            isEmpty = true;
            return false; // Exit the loop if any textbox is empty
        }

        var item = {
            "ParamName": PRname,
            "ParamInfo": PRvalue,
            "ParamConst": PRconstant
        };
        conversation.push(item);
    });
    if (codemodel != 'plugin-offline') {
        rowsHd.each(function () {
            var columns = $(this).find('td');

            var HeadName = columns.eq(0).find('input').val();
            var HeadValue = columns.eq(1).find('input').val();
            if (HeadName.trim() === '' || HeadValue.trim() === '' || regex.test(HeadName) || regex.test(HeadValue)) {
                isEmptyHd = true;
                return false; // Exit the loop if any textbox is empty
            }

            var item = {
                "PheadersName": HeadName,
                "PheadersValue": HeadValue,
            };
            conversationHd.push(item);
        });

        rowsCk.each(function () {
            var columns = $(this).find('td');

            var Ckey = columns.eq(0).find('input').val();
            var Cvalue = columns.eq(1).find('input').val();
            if (Ckey.trim() === '' || Cvalue.trim() === '' || regex.test(Ckey) || regex.test(Cvalue)) {
                isEmptyCk = true;
                return false; // Exit the loop if any textbox is empty
            }

            var item = {
                "PcookiesName": Ckey,
                "PcookiesValue": Cvalue
            };
            conversationCk.push(item);
        });



        if (isEmpty) {
            balert('请将空的【参数】输入行删除，或填写完整', 'warning', false, 1500, 'center');
            return;
        }
        if (isEmptyHd) {
            balert('请将空的【Headers】输入行删除，或填写完整', 'warning', false, 1500, 'center');
            return;
        }
        if (isEmptyCk) {
            balert('请将空的【Cookies】输入行删除，或填写完整', 'warning', false, 1500, 'center');
            return;
        }
    }
    nickname = $('#nickname').val();
    functionname = $('#functionname').val();
    functioninfo = $('#functioninfo').val();
    opensource = $("input[name='opensource']:checked").val();
    pluginprice = $('#pluginprice').val();
    var formData = new FormData();
    formData.append('plugin.Pcode', plugincode);
    formData.append('plugin.Pavatar', avatar);
    formData.append('plugin.Pnickname', nickname);
    formData.append('plugin.Pfunctionname', functionname);
    formData.append('plugin.Pfunctioninfo', functioninfo);
    formData.append('plugin.Popensource', opensource);
    formData.append('plugin.Pluginprice', pluginprice);
    formData.append('plugin.Pcodemodel', codemodel);
    formData.append('plugin.Papiurl', apiurl);
    formData.append('plugin.Pmethod', method);
    //formData.append('plugin.Param', conversation);
    //formData.append('plugin.Pheaders', conversationHd);
    //formData.append('plugin.Pcookies', conversationCk);

    // 对Param进行序列化
    conversation.forEach((param, index) => {
        formData.append(`plugin.Param[${index}].ParamName`, param.ParamName);
        formData.append(`plugin.Param[${index}].ParamInfo`, param.ParamInfo);
        formData.append(`plugin.Param[${index}].ParamCode`, param.ParamCode);
        formData.append(`plugin.Param[${index}].ParamConst`, param.ParamConst);
    });

    // 对Pheaders进行序列化
    conversationHd.forEach((header, index) => {
        formData.append(`plugin.Pheaders[${index}].PheadersName`, header.PheadersName);
        formData.append(`plugin.Pheaders[${index}].PheadersValue`, header.PheadersValue);
        formData.append(`plugin.Pheaders[${index}].PheadersCode`, header.PheadersCode);
    });

    // 对Pcookies进行序列化
    conversationCk.forEach((cookie, index) => {
        formData.append(`plugin.Pcookies[${index}].PcookiesName`, cookie.PcookiesName);
        formData.append(`plugin.Pcookies[${index}].PcookiesValue`, cookie.PcookiesValue);
        formData.append(`plugin.Pcookies[${index}].PcookiesCode`, cookie.PcookiesCode);
    });
    formData.append('plugin.Pjscode', jscode);
    formData.append('plugin.PrunLocation', runLocation);
    formData.append('plugin.Pusehtml', usehtml);
    if (type == 'test') {
        loadingBtn('.savePluginBtn');
        ispublic = 'no';
    }
    else {
        loadingBtn('.uploadPluginBtn');
        ispublic = 'yes';
    }
    formData.append('plugin.IsPublic', ispublic);
    //发起请求
    $.ajax({
        type: "POST",
        url: "/WorkShop/PostPlugin",
        data: formData,
        contentType: false,
        processData: false,
        success: function (data) {
            if (data.success) {
                unloadingBtn('.uploadPluginBtn');
                unloadingBtn('.savePluginBtn');
                balert(data.msg, 'success', false, 1500, 'center');
            }
            else {
                balert(data.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

function getPluginInfo(plugincode, id, type) {
    loadingOverlay.show();
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/WorkShop/SeePlugin',
        data: {
            id: id,
            pcode: plugincode
        },
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                if (type == 'see') {
                    $('#STEP').find(':not([disabled="true"])').prop('disabled', true);
                    $(".uploadPluginBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-primary');
                }
                if (type == 'edit') {
                    $(".uploadPluginBtn").prop('disabled', false).addClass('btn-primary').removeClass('btn-secondary');
                }
                var plugin = res.data;
                $('#avatar-image').attr('src', plugin.pavatar);
                $('#nickname').val(plugin.pnickname);
                $('#functionname').val(plugin.pfunctionname);
                $('#functioninfo').val(plugin.pfunctioninfo);
                avatar = plugin.pavatar;
                nickname = plugin.pnickname;
                functionname = plugin.pfunctionname;
                functioninfo = plugin.pfunctioninfo;
                codemodel = plugin.pcodemodel;
                if (plugin.pcodemodel == 'plugin-online') {
                    $('#plugin-online').show();
                    $('#plugin-offline').hide();
                    $('#plugin-mixed').hide();
                    $("#usehtml1").prop("checked", plugin.pusehtml);
                    $('#apiurl').val(plugin.papiurl);
                    $("input[name='method'][value='" + plugin.pmethod + "']").prop("checked", true);
                    for (var i = 0; i < plugin.param.length; i++) {
                        addPrLine(0);
                        $('#AddPr tr').eq(i).find('td').eq(0).find('input').val(plugin.param[i].paramName);
                        $('#AddPr tr').eq(i).find('td').eq(1).find('input').val(plugin.param[i].paramInfo);
                        $('#AddPr tr').eq(i).find('td').eq(2).find('input').val(plugin.param[i].paramConst);
                    }
                    for (var i = 0; i < plugin.pheaders.length; i++) {
                        addHdLine(0);
                        $('#AddHd tr').eq(i).find('td').eq(0).find('input').val(plugin.pheaders[i].pheaders);
                        $('#AddHd tr').eq(i).find('td').eq(1).find('input').val(plugin.pheaders[i].pheadersValue);
                    }
                    for (var i = 0; i < plugin.pcookies.length; i++) {
                        addCkLine(0);
                        $('#AddCk tr').eq(i).find('td').eq(0).find('input').val(plugin.pcookies[i].pcookiesName);
                        $('#AddCk tr').eq(i).find('td').eq(1).find('input').val(plugin.pcookies[i].pcookiesValue);
                    }
                    $('#pluginprice').val(plugin.pluginprice);
                    $('#plugin-1').show();
                    $('#plugin-2').hide();
                    $('#usehtml1').prop('checked', plugin.pusehtml === "true");
                }
                else if (plugin.pcodemodel == 'plugin-offline') {
                    $('#plugin-online').hide();
                    $('#plugin-offline').show();
                    $('#plugin-mixed').hide();
                    $('#pluginprice').val(plugin.pluginprice);
                    $('#plugin-1').show();
                    $('#plugin-2').hide();
                    $('#usehtml2').prop('checked', plugin.pusehtml === "true");
                    $("input[name='runLocation'][value='" + plugin.prunLocation + "']").prop('checked', true);
                    for (var i = 0; i < plugin.param.length; i++) {
                        addPrLine(1);
                        $('#AddPr1 tr').eq(i).find('td').eq(0).find('input').val(plugin.param[i].paramName);
                        $('#AddPr1 tr').eq(i).find('td').eq(1).find('input').val(plugin.param[i].paramInfo);
                        $('#AddPr1 tr').eq(i).find('td').eq(2).find('input').val(plugin.param[i].paramConst);
                    }
                    initEditor(1, plugin.pjscode);
                }
                else if (plugin.pcodemodel == 'plugin-mixed') {
                    $('#plugin-online').hide();
                    $('#plugin-offline').hide();
                    $('#plugin-mixed').show();
                    $('#apiurl2').val(plugin.papiurl);
                    for (var i = 0; i < plugin.param.length; i++) {
                        addPrLine(2);
                        $('#AddPr2 tr').eq(i).find('td').eq(0).find('input').val(plugin.param[i].paramName);
                        $('#AddPr2 tr').eq(i).find('td').eq(1).find('input').val(plugin.param[i].paramInfo);
                        $('#AddPr2 tr').eq(i).find('td').eq(2).find('input').val(plugin.param[i].paramConst);
                    }
                    for (var i = 0; i < plugin.pheaders.length; i++) {
                        addHdLine(2);
                        $('#AddHd2 tr').eq(i).find('td').eq(0).find('input').val(plugin.pheaders[i].pheaders);
                        $('#AddHd2 tr').eq(i).find('td').eq(1).find('input').val(plugin.pheaders[i].pheadersValue);
                    }
                    for (var i = 0; i < plugin.pcookies.length; i++) {
                        addCkLine(2);
                        $('#AddCk2 tr').eq(i).find('td').eq(0).find('input').val(plugin.pcookies[i].pcookiesName);
                        $('#AddCk2 tr').eq(i).find('td').eq(1).find('input').val(plugin.pcookies[i].pcookiesValue);
                    }
                    $('#pluginprice').val(plugin.pluginprice);
                    $('#plugin-1').show();
                    $('#plugin-2').hide();
                    $('#usehtml3').prop('checked', plugin.pusehtml === "true");
                    $("input[name='runLocation'][value='" + plugin.prunLocation + "']").prop('checked', true);
                    initEditor(2, plugin.pjscode);
                }
            }
        }
    });
}