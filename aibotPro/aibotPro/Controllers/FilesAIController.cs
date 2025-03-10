﻿using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers
{
    public class FilesAIController : Controller
    {
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IFilesAIService _filesAIService;
        public FilesAIController(ISystemService systemService, JwtTokenManager jwtTokenManager, IFilesAIService filesAIService)
        {
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _filesAIService = filesAIService;
        }
        public IActionResult FilesChat()
        {
            return View();
        }
        public IActionResult FilesLib()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] int chunkNumber, [FromForm] string fileName)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("请选择文件");
            }

            var systemCfgs = _systemService.GetSystemCfgs();
            var allowedFileTypes = systemCfgs.FirstOrDefault(x => x.CfgKey == "Allowed_File_Types");
            List<string> allowedExtensions;
            if (allowedFileTypes != null && !string.IsNullOrWhiteSpace(allowedFileTypes.CfgValue))
            {
                // 从配置中获取允许的文件类型,并转换为小写
                allowedExtensions = allowedFileTypes.CfgValue.Split(',')
                    .Select(x => x.Trim().ToLowerInvariant())
                    .ToList();
            }
            else
            {
                // 如果配置为空,使用默认值
                allowedExtensions = new List<string> { ".txt", ".pdf", ".ppt", ".doc", ".docx", ".xls", ".xlsx" };
            }

            var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();

            if (!allowedExtensions.Contains(fileExtension))
            {
                var allowedTypesMessage =
                    string.Join(", ", allowedExtensions.Select(ext => ext.TrimStart('.')).ToArray());
                return BadRequest($"只允许上传以下类型的文件: {allowedTypesMessage}");
            }

            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, "wwwroot/files/fileslib");
            return Ok(new { path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFiles([FromBody] MergeRequest request)
        {
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, "wwwroot/files/fileslib");
            FilesLib filesLib = new FilesLib();
            filesLib.FileCode = Guid.NewGuid().ToString();
            filesLib.Account = username;
            filesLib.FileName = request.FileName;
            filesLib.FilePath = path.Replace("wwwroot", "");
            filesLib.FileType = Path.GetExtension(path);
            filesLib.CreateTime = DateTime.Now;
            _filesAIService.SaveFilesLib(filesLib);
            return Ok(new
            {
                fileName = request.FileName,
                fileCode = filesLib.FileCode,
                path = path
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetFilesLibs(int page, int pageSize, string name)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            int total = 0;
            var listFilesLibs = _filesAIService.GetFilesLibs(page, pageSize, name, out total, username);
            return Ok(new { success = true, data = listFilesLibs, total });
        }
        [Authorize]
        [HttpPost]
        public IActionResult DeleteFilesLibs(string fileCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            _filesAIService.DeleteFilesLibs(fileCode, username);
            return Ok(new
            {
                success = true
            });
        }
    }
}
