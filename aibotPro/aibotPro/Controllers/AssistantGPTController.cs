using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RestSharp;
using System.Text.RegularExpressions;

namespace aibotPro.Controllers
{
    public class AssistantGPTController : Controller
    {
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IAssistantService _assistantService;
        public AssistantGPTController(JwtTokenManager jwtTokenManager, IAssistantService assistantService)
        {
            _jwtTokenManager = jwtTokenManager;
            _assistantService = assistantService;
        }

        // GET: AssistantGPTController
        public ActionResult AssistantChat()
        {
            return View();
        }
        public ActionResult AssistantSetting()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetAssistantGPTs()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _assistantService.GetAssistantGPTs(username);
            if (result.Count == 0)
            {
                return Json(new
                {
                    success = false,
                    msg = "暂未创建助理"
                });
            }
            else
            {

                return Json(new
                {
                    success = true,
                    data = result
                });
            }
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetAssistantModel()
        {
            var result = _assistantService.GetAssistantModelPrices();
            //只保留ModelNick和ModelName
            var filteredResult = result.Select(model => new
            {
                ModelNick = model.ModelNick,
                ModelName = model.ModelName
            }).ToList();
            return Json(new
            {
                success = true,
                data = result
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult SaveAssistant(string assisId, string assisName, string assisSysPrompt, string assisModel, int codeinterpreter, int retrieval, string fileids)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var fileIdsList = System.Text.Json.JsonSerializer.Deserialize<List<Dictionary<string, string>>>(fileids);
            string saveResult = _assistantService.SaveAssistant(assisId, assisName, assisSysPrompt, assisModel, codeinterpreter, retrieval, fileIdsList, username);
            if (!string.IsNullOrEmpty(saveResult))
            {
                return Json(new
                {
                    success = true,
                    data = saveResult
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    data = saveResult
                });
            }
        }
        [Authorize]
        [HttpPost]
        public IActionResult UploadAssistantFiles([FromForm] IFormFileCollection files)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _assistantService.UploadAssistantFiles(username, files);
            return Json(new
            {
                success = true,
                data = result
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult DelFileByGPT(string fileids)
        {
            var fileIdsList = System.Text.Json.JsonSerializer.Deserialize<List<string>>(fileids);
            var result = _assistantService.DelFileByGPT(fileIdsList);
            return Json(new
            {
                success = result
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetFileList()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _assistantService.GetAssistantFiles(username);
            return Json(new
            {
                success = true,
                data = result
            });
        }
        public object DownloadFile(string fileid)
        {
            var assistantSetting = _assistantService.GetAssistantModelPrices();
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            var client = new RestClient($"{baseurl}/v1/files/{fileid}/content");
            var request = new RestRequest("", Method.Get);
            request.AddHeader("Authorization", $"Bearer {apikey}");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            request.AddHeader("Content-Type", "application/octet-stream");
            RestResponse response = client.Execute(request);
            if (response.IsSuccessful)
            {
                // 从Content-Disposition头获取文件名
                var contentDisposition = response.ContentHeaders.FirstOrDefault(x => x.Name == "Content-Disposition")?.Value.ToString();
                var filename = "defaultFilename";
                if (!string.IsNullOrEmpty(contentDisposition))
                {
                    // 尝试从Content-Disposition头中提取文件名
                    var match = Regex.Match(contentDisposition, @"filename=""([^""]+)""");
                    if (match.Success)
                    {
                        filename = match.Groups[1].Value;
                    }
                }
                int lastDotIndex = filename.LastIndexOf('.');
                string[] ofresult = new string[2];
                if (lastDotIndex >= 0)
                {
                    ofresult[0] = filename.Substring(0, lastDotIndex);
                    ofresult[1] = filename.Substring(lastDotIndex + 1);
                }
                else
                {
                    ofresult[0] = filename; // 如果没有找到点，则整个字符串为数组的第一个元素
                    ofresult[1] = "png";
                }
                string newname = ofresult[0].ToString() + Guid.NewGuid().ToString().Replace("-", "");
                filename = newname + "." + ofresult[1];
                // 指定要保存文件的本地路径
                string basePath = @"wwwroot\AIFILES\"; // 确保路径以\结尾
                string filePath = Path.Combine(basePath, filename); // Combine会添加必要的路径分隔符

                // Make sure the directory exists
                string directory = Path.GetDirectoryName(filePath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                // 将文件写入指定路径
                System.IO.File.WriteAllBytes(filePath, response.RawBytes);
                try
                {

                    var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.ReadWrite);
                    return File(fileStream, "application/octet-stream", filename);
                }
                catch (Exception)
                {
                    return null;
                }
            }
            else
                return null;
        }
    }
}
