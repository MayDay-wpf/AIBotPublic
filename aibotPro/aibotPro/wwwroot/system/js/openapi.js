let options = '';
let uniqueOptions = [];
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#cygf-main-menu").addClass('active');
    $("#cygf-main-menu").parent().addClass('show');
    $("#cygf-main-menu").parent().siblings().removeClass('show');
    $("#openapi-cygf-nav").addClass('active');
    getApiKey();
    getSystemPlugin();
    getWorkshopAIModelList();
    getAIModelList();
    getOpenAPISetting();
    // 绑定 checkbox 的点击事件
    $('.custom-control-input').change(function () {
        if ($(this).is(':checked')) {
            // Checkbox 被选中时的操作
            checkboxChecked($(this).attr('id'));
        } else {
            // Checkbox 被取消选中时的操作
            checkboxUnchecked($(this).attr('id'));
        }
    });
});

function getWorkshopAIModelList() {
    $.ajax({
        type: "Post", url: "/WorkShop/GetWorkShopAImodel", dataType: "json", async: false, success: function (res) {
            var html = "";
            if (res.success) {
                for (var i = 0; i < res.data.length; i++) {
                    html += `<a href="javascript:void(0);" class="badge badge-pill badge-success" onclick="copyText('${res.data[i].modelName}')">${res.data[i].modelName}</a> `;
                    if (!uniqueOptions.includes(res.data[i].modelName)) {
                        if (i == 0) options += `<option checked="checked">${res.data[i].modelName}</option>`; else options += `<option>${res.data[i].modelName}</option>`;
                        uniqueOptions.push(res.data[i].modelName);
                    }
                }
                html = html.substring(0, html.length - 1);
                $('#canUseModel').html(html);
            }
        }, error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统未配置AI模型", "info", false, 2000, "center");

        }
    });
}

function getAIModelList() {
    $.ajax({
        type: "Post", url: "/Home/GetAImodel", dataType: "json", success: function (res) {
            var html = "";
            if (res.success) {
                for (var i = 0; i < res.data.length; i++) {
                    html += `<a href="javascript:void(0);" class="badge badge-pill badge-info" onclick="copyText('${res.data[i].modelName}')">${res.data[i].modelName}</a> `;
                    if (!uniqueOptions.includes(res.data[i].modelName)) {
                        options += `<option>${res.data[i].modelName}</option>`;
                        uniqueOptions.push(res.data[i].modelName);
                    }
                }
                html = html.substring(0, html.length - 1);
                $('#defaultCanUseModel').html(html);
            }
        }, error: function (err) {
            // balert("系统未配置AI模型", "info", false, 2000, "center");
        }
    });
}

function createApiKey() {
    //二次确认
    showConfirmationModal('确认创建', '注意，如果您已存在API Key 本次创建将更新您的API Key', function () {
        //发起请求
        $.ajax({
            type: 'Post', url: '/OpenAPI/CreateApiKey', success: function (res) {
                $('#apikey').val(res.data);
            }
        });
    });
}

function getApiKey() {
    loadingOverlay.show();
    $.ajax({
        type: 'Post', url: '/OpenAPI/GetApiKey', success: function (res) {
            if (res.success) $('#apikey').val(res.data);
        }, error: function () {
            loadingOverlay.hide();
        }
    });
}

// 处理选中状态的函数
function checkboxChecked(id) {
    $.ajax({
        type: 'Post', url: '/OpenAPI/UpdateSystemPlugin', data: {
            Pfunctionname: id, type: 'add'
        }, success: function (res) {
            if (res.success) balert("更新成功", "success", false, 1500, "center"); else balert(res.msg, "danger", false, 1500, "center");
        }
    });
}

// 处理未选中状态的函数
function checkboxUnchecked(id) {
    $.ajax({
        type: 'Post', url: '/OpenAPI/UpdateSystemPlugin', data: {
            Pfunctionname: id, type: 'remove'
        }, success: function (res) {
            if (res.success) balert("更新成功", "success", false, 1500, "center"); else balert(res.msg, "danger", false, 1500, "center");
        }
    });
}

//获取已选用的系统插件，用于初始化checkbox
function getSystemPlugin() {
    $.ajax({
        type: 'Post', url: '/OpenAPI/GetSystemPlugin', success: function (res) {
            loadingOverlay.hide();
            var data = res.data;
            for (var i = 0; i < data.length; i++) {
                $('#' + data[i].pfunctionname).prop('checked', true);
            }
        }, error: function () {
            loadingOverlay.hide();
        }
    });
}

function addStLine() {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="自定义模型名" /></td>
                 <td><select class="form-control">${options}</select></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
}

function delLine() {
    $(event.target).closest('tr').remove();
}

function getOpenAPISetting() {
    $.ajax({
        type: 'Post', url: '/OpenAPI/GetOpenAPISetting', success: function (res) {
            loadingOverlay.hide();
            var data = res.data;
            if (data == null) return;
            for (var i = 0; i < data.length; i++) {
                addStLine();
                $('#AddSt tr').eq(i).find('td').eq(0).find('input').val(data[i].fromModelName);
                $('#AddSt tr').eq(i).find('td').eq(1).find('select').val(data[i].toModelName);
                feather.replace();
            }
        }, error: function () {
            loadingOverlay.hide();
        }
    });
}

function saveOpenAPISetting() {
    var formData = new FormData();
    var rows = $("#AddSt").find("tr");
    var issave = true;
    rows.each(function (index, row) {
        // 非空校验
        var fromModelName = $(row).find("input").eq(0).val();
        var toModelName = $(row).find("select").eq(0).val();

        if (!removeSpaces(fromModelName) || !removeSpaces(toModelName)) {
            balert('请将空的【自定义API模型】输入行删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;

        } else {
            formData.append(`openAPIModelSettings[${index}].FromModelName`, fromModelName);
            formData.append(`openAPIModelSettings[${index}].ToModelName`, toModelName);
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST', url: '/OpenAPI/SaveOpenAPISetting', processData: false,  // 告诉jQuery不要处理发送的数据
            contentType: false,  // 告诉jQuery不要设置contentType
            data: formData, success: function (res) {
                unloadingBtn('.save');
                if (res.success) {
                    balert("保存成功", 'success', false, 1500, 'top');
                } else {
                    balert("保存失败", 'danger', false, 1500, 'top');
                }
            }, error: function (error) {
                unloadingBtn('.save');
                sendExceptionMsg(error);
                balert('保存失败，请稍后再试', 'danger', false, 1500, 'top');
            }
        });
    }
}

function openapisettinginfo() {
    var content = `由于AIBot的模型名称加入了特殊后缀，在一些无法自定义模型名的客户端将无法使用，自定义模型名允许您将自定义的模型名映射到Aibot模型名，增加使用灵活性`;
    showConfirmationModal("自定义模型名说明", content);
}

$(document).ready(function () {
    var md = window.markdownit();

    var curlCode = `curl --location --request POST 'https://aibotpro.cn/v1/chat/completions' \
--header 'Authorization: Bearer sk-3ce2284b*************' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)' \
--header 'Content-Type: application/json' \
--header 'Accept: */*' \
--header 'Host: aibotpro.cn' \
--header 'Connection: keep-alive' \
--data-raw '{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "user",
      "content": "你好"
    }
  ],
  "stream": false
}'`;

    var pythonCode = `import requests

url = "https://aibotpro.cn/v1/chat/completions"

payload = {
    "model": "gpt-4o-mini",
    "messages": [
        {
            "role": "user",
            "content": "你好"
        }
    ],
    "stream": False
}

headers = {
    "Authorization": "Bearer sk-3ce2284b*************",
    "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Host": "aibotpro.cn",
    "Connection": "keep-alive"
}

response = requests.post(url, json=payload, headers=headers)

print(response.text)`;
    var csharpCode = `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program
{
    static async Task Main(string[] args)
    {
        using var client = new HttpClient();
        
        client.DefaultRequestHeaders.Add("Authorization", "Bearer sk-3ce2284b*************");
        client.DefaultRequestHeaders.Add("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
        client.DefaultRequestHeaders.Add("Accept", "*/*");
        client.DefaultRequestHeaders.Add("Host", "aibotpro.cn");
        client.DefaultRequestHeaders.Add("Connection", "keep-alive");

        var content = new StringContent(@"{
            ""model"": ""gpt-4o-mini"",
            ""messages"": [
                {
                    ""role"": ""user"",
                    ""content"": ""你好""
                }
            ],
            ""stream"": false
        }", Encoding.UTF8, "application/json");

        var response = await client.PostAsync("https://aibotpro.cn/v1/chat/completions", content);
        var responseContent = await response.Content.ReadAsStringAsync();
        Console.WriteLine(responseContent);
    }
}`;

    var javaCode = `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Main {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        
        String requestBody = "{" +
            "\"model\": \"gpt-4o-mini\"," +
            "\"messages\": [" +
                "{" +
                    "\"role\": \"user\"," +
                    "\"content\": \"你好\"" +
                "}" +
            "]," +
            "\"stream\": false" +
        "}";

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://aibotpro.cn/v1/chat/completions"))
            .header("Authorization", "Bearer sk-3ce2284b*************")
            .header("User-Agent", "Apifox/1.0.0 (https://apifox.com)")
            .header("Content-Type", "application/json")
            .header("Accept", "*/*")
            .header("Host", "aibotpro.cn")
            .header("Connection", "keep-alive")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`;
    $('#curlCode').text(curlCode);
    $('#pythonCode').text(pythonCode);
    $('#csharpCode').text(csharpCode);
    $('#javaCode').text(javaCode);
    $('#curl-tab').addClass('active');
    hljs.highlightAll();
});