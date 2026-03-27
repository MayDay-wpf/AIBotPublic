using Microsoft.AspNetCore.Mvc;
using aibotPro.Interface;
using System.IO.Compression;
using System.Text.Json;

namespace aibotPro.Controllers;

public class ToolsController : Controller
{
    private readonly IToolsService _toolsService;
    private readonly ILogger<ToolsController> _logger;

    public ToolsController(IToolsService toolsService, ILogger<ToolsController> logger)
    {
        _toolsService = toolsService;
        _logger = logger;
    }

    // GET
    public IActionResult ImageCompress()
    {
        return View();
    }

    // GET
    public IActionResult ImageConvert()
    {
        return View();
    }

    // GET
    public IActionResult PasswordGenerator()
    {
        return View();
    }

    // GET
    public IActionResult DiffComparator()
    {
        return View();
    }

    [HttpPost]
    public async Task<IActionResult> CompressImage([FromForm] IFormFile file, [FromForm] int quality = 60)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "请选择一个图片文件" });
            }

            if (!_toolsService.IsSupportedImageFormat(file.FileName))
            {
                return BadRequest(new { error = "不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式的图片" });
            }

            // 检查文件大小 (最大50MB)
            if (file.Length > 50 * 1024 * 1024)
            {
                return BadRequest(new { error = "图片文件过大，请选择小于50MB的图片" });
            }

            // 读取图片数据
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var imageData = memoryStream.ToArray();

            // 压缩图片
            var (compressedData, originalSize, compressedSize) = await _toolsService.CompressImageWithStatsAsync(
                imageData, file.FileName, quality);

            // 计算压缩率
            var compressionRatio = (double)(originalSize - compressedSize) / originalSize * 100;

            // 返回压缩后的图片和统计信息
            var result = new
            {
                success = true,
                data = Convert.ToBase64String(compressedData),
                originalSize = originalSize,
                compressedSize = compressedSize,
                compressionRatio = Math.Round(compressionRatio, 2),
                fileName = file.FileName,
                contentType = _toolsService.GetContentType(file.FileName)
            };

            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "图片压缩失败");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> CompressBatch([FromForm] List<IFormFile> files, [FromForm] int quality = 60)
    {
        try
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { error = "请选择至少一个图片文件" });
            }

            if (files.Count > 50)
            {
                return BadRequest(new { error = "最多只能同时压缩50张图片" });
            }

            var results = new List<object>();
            var successCount = 0;
            var errorCount = 0;
            long totalOriginalSize = 0;
            long totalCompressedSize = 0;

            foreach (var file in files)
            {
                try
                {
                    if (file == null || file.Length == 0)
                    {
                        results.Add(new
                        {
                            fileName = file?.FileName ?? "未知文件",
                            success = false,
                            error = "文件为空"
                        });
                        errorCount++;
                        continue;
                    }

                    if (!_toolsService.IsSupportedImageFormat(file.FileName))
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            success = false,
                            error = "不支持的图片格式"
                        });
                        errorCount++;
                        continue;
                    }

                    if (file.Length > 50 * 1024 * 1024)
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            success = false,
                            error = "文件过大"
                        });
                        errorCount++;
                        continue;
                    }

                    // 读取图片数据
                    using var memoryStream = new MemoryStream();
                    await file.CopyToAsync(memoryStream);
                    var imageData = memoryStream.ToArray();

                    // 压缩图片
                    var (compressedData, originalSize, compressedSize) = await _toolsService.CompressImageWithStatsAsync(
                        imageData, file.FileName, quality);

                    totalOriginalSize += originalSize;
                    totalCompressedSize += compressedSize;

                    var compressionRatio = (double)(originalSize - compressedSize) / originalSize * 100;

                    results.Add(new
                    {
                        fileName = file.FileName,
                        success = true,
                        data = Convert.ToBase64String(compressedData),
                        originalSize = originalSize,
                        compressedSize = compressedSize,
                        compressionRatio = Math.Round(compressionRatio, 2),
                        contentType = _toolsService.GetContentType(file.FileName)
                    });

                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "压缩图片失败: {FileName}", file?.FileName);
                    results.Add(new
                    {
                        fileName = file?.FileName ?? "未知文件",
                        success = false,
                        error = ex.Message
                    });
                    errorCount++;
                }
            }

            var overallCompressionRatio = totalOriginalSize > 0
                ? Math.Round((double)(totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100, 2)
                : 0;

            return Json(new
            {
                success = true,
                results = results,
                summary = new
                {
                    total = files.Count,
                    success = successCount,
                    error = errorCount,
                    totalOriginalSize = totalOriginalSize,
                    totalCompressedSize = totalCompressedSize,
                    overallCompressionRatio = overallCompressionRatio
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "批量压缩失败");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> DownloadConvertedImages([FromBody] List<CompressedImageData> images)
    {
        try
        {
            if (images == null || images.Count == 0)
            {
                return BadRequest(new { error = "没有可下载的图片" });
            }

            // 创建ZIP压缩包
            using var memoryStream = new MemoryStream();

            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                foreach (var image in images)
                {
                    if (string.IsNullOrEmpty(image.Data))
                        continue;

                    try
                    {
                        var imageData = Convert.FromBase64String(image.Data);

                        // 确保文件名安全并避免重复
                        var safeFileName = GetSafeFileName(image.FileName);
                        var entry = archive.CreateEntry($"converted_{safeFileName}", CompressionLevel.NoCompression);

                        // 设置修改时间
                        entry.LastWriteTime = DateTimeOffset.Now;

                        using var entryStream = entry.Open();
                        await entryStream.WriteAsync(imageData);
                        await entryStream.FlushAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "添加图片到ZIP失败: {FileName}", image.FileName);
                    }
                }
            } // archive会在这里被正确释放

            var zipData = memoryStream.ToArray();

            if (zipData.Length == 0)
            {
                return BadRequest(new { error = "生成的ZIP文件为空" });
            }

            var fileName = $"converted_images_{DateTime.Now:yyyyMMdd_HHmmss}.zip";

            return File(zipData, "application/zip", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "创建下载包失败");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> DownloadCompressedImages([FromBody] List<CompressedImageData> images)
    {
        try
        {
            if (images == null || images.Count == 0)
            {
                return BadRequest(new { error = "没有可下载的图片" });
            }

            // 创建ZIP压缩包
            using var memoryStream = new MemoryStream();

            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                foreach (var image in images)
                {
                    if (string.IsNullOrEmpty(image.Data))
                        continue;

                    try
                    {
                        var imageData = Convert.FromBase64String(image.Data);

                        // 确保文件名安全并避免重复
                        var safeFileName = GetSafeFileName(image.FileName);
                        var entry = archive.CreateEntry($"compressed_{safeFileName}", CompressionLevel.NoCompression);

                        // 设置修改时间
                        entry.LastWriteTime = DateTimeOffset.Now;

                        using var entryStream = entry.Open();
                        await entryStream.WriteAsync(imageData);
                        await entryStream.FlushAsync();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "添加图片到ZIP失败: {FileName}", image.FileName);
                    }
                }
            } // archive会在这里被正确释放

            var zipData = memoryStream.ToArray();

            if (zipData.Length == 0)
            {
                return BadRequest(new { error = "生成的ZIP文件为空" });
            }

            var fileName = $"compressed_images_{DateTime.Now:yyyyMMdd_HHmmss}.zip";

            return File(zipData, "application/zip", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "创建下载包失败");
            return BadRequest(new { error = ex.Message });
        }
    }

    private string GetSafeFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return "image.jpg";

        // 移除不安全的字符
        var invalidChars = Path.GetInvalidFileNameChars();
        var safeFileName = string.Join("_", fileName.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));

        // 确保文件名不为空
        if (string.IsNullOrWhiteSpace(safeFileName))
            return "image.jpg";

        // 限制文件名长度
        if (safeFileName.Length > 100)
            safeFileName = safeFileName.Substring(0, 100);

        return safeFileName;
    }

    [HttpPost]
    public async Task<IActionResult> ConvertImage([FromForm] IFormFile file, [FromForm] string targetFormat = "jpeg", [FromForm] int quality = 85)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "请选择一个图片文件" });
            }

            if (!_toolsService.IsSupportedImageFormat(file.FileName))
            {
                return BadRequest(new { error = "不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式的图片" });
            }

            // 检查文件大小 (最大50MB)
            if (file.Length > 50 * 1024 * 1024)
            {
                return BadRequest(new { error = "图片文件过大，请选择小于50MB的图片" });
            }

            // 读取图片数据
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var imageData = memoryStream.ToArray();

            // 转换图片格式
            var (convertedData, originalSize, convertedSize) = await _toolsService.ConvertImageFormatWithStatsAsync(
                imageData, file.FileName, targetFormat, quality);

            // 生成新的文件名
            var originalName = Path.GetFileNameWithoutExtension(file.FileName);
            var newExtension = GetFileExtensionFromFormat(targetFormat);
            var newFileName = $"{originalName}{newExtension}";

            var result = new
            {
                success = true,
                data = Convert.ToBase64String(convertedData),
                originalSize = originalSize,
                convertedSize = convertedSize,
                fileName = newFileName,
                originalFileName = file.FileName,
                contentType = _toolsService.GetContentTypeFromFormat(targetFormat),
                targetFormat = targetFormat
            };

            return Json(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "图片格式转换失败");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> ConvertBatch([FromForm] List<IFormFile> files, [FromForm] string targetFormat = "jpeg", [FromForm] int quality = 85)
    {
        try
        {
            if (files == null || files.Count == 0)
            {
                return BadRequest(new { error = "请选择至少一个图片文件" });
            }

            if (files.Count > 50)
            {
                return BadRequest(new { error = "最多只能同时转换50张图片" });
            }

            var results = new List<object>();
            var successCount = 0;
            var errorCount = 0;
            long totalOriginalSize = 0;
            long totalConvertedSize = 0;

            foreach (var file in files)
            {
                try
                {
                    if (file == null || file.Length == 0)
                    {
                        results.Add(new
                        {
                            fileName = file?.FileName ?? "未知文件",
                            success = false,
                            error = "文件为空"
                        });
                        errorCount++;
                        continue;
                    }

                    if (!_toolsService.IsSupportedImageFormat(file.FileName))
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            success = false,
                            error = "不支持的图片格式"
                        });
                        errorCount++;
                        continue;
                    }

                    if (file.Length > 50 * 1024 * 1024)
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            success = false,
                            error = "文件过大"
                        });
                        errorCount++;
                        continue;
                    }

                    // 读取图片数据
                    using var memoryStream = new MemoryStream();
                    await file.CopyToAsync(memoryStream);
                    var imageData = memoryStream.ToArray();

                    // 转换图片格式
                    var (convertedData, originalSize, convertedSize) = await _toolsService.ConvertImageFormatWithStatsAsync(
                        imageData, file.FileName, targetFormat, quality);

                    totalOriginalSize += originalSize;
                    totalConvertedSize += convertedSize;

                    // 生成新的文件名
                    var originalName = Path.GetFileNameWithoutExtension(file.FileName);
                    var newExtension = GetFileExtensionFromFormat(targetFormat);
                    var newFileName = $"{originalName}{newExtension}";

                    results.Add(new
                    {
                        fileName = newFileName,
                        originalFileName = file.FileName,
                        success = true,
                        data = Convert.ToBase64String(convertedData),
                        originalSize = originalSize,
                        convertedSize = convertedSize,
                        contentType = _toolsService.GetContentTypeFromFormat(targetFormat),
                        targetFormat = targetFormat
                    });

                    successCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "转换图片失败: {FileName}", file?.FileName);
                    results.Add(new
                    {
                        fileName = file?.FileName ?? "未知文件",
                        success = false,
                        error = ex.Message
                    });
                    errorCount++;
                }
            }

            return Json(new
            {
                success = true,
                results = results,
                summary = new
                {
                    total = files.Count,
                    success = successCount,
                    error = errorCount,
                    totalOriginalSize = totalOriginalSize,
                    totalConvertedSize = totalConvertedSize,
                    targetFormat = targetFormat
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "批量转换失败");
            return BadRequest(new { error = ex.Message });
        }
    }

    private string GetFileExtensionFromFormat(string format)
    {
        return format.ToLowerInvariant() switch
        {
            "jpeg" => ".jpg",
            "png" => ".png",
            "webp" => ".webp",
            "gif" => ".gif",
            "bmp" => ".bmp",
            "tiff" => ".tiff",
            "ico" => ".ico",
            "icns" => ".icns",
            _ => ".jpg"
        };
    }
}

public class CompressedImageData
{
    public string FileName { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
}