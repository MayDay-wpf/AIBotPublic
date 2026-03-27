using aibotPro.Interface;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Png;
using SixLabors.ImageSharp.Formats.Gif;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Formats.Bmp;
using SixLabors.ImageSharp.Formats.Tiff;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Advanced;

namespace aibotPro.Service;

public class ToolsService: IToolsService
{
    private readonly ILogger<ToolsService> _logger;

    public ToolsService(ILogger<ToolsService> logger)
    {
        _logger = logger;
    }

    public async Task<byte[]> CompressImageAsync(byte[] imageData, string fileName, int quality = 60)
    {
        try
        {
            using var image = Image.Load(imageData);
            var extension = Path.GetExtension(fileName).ToLowerInvariant();

            // 根据图片大小和质量设置动态调整尺寸
            var shouldResize = ShouldResizeImage(image.Width, image.Height, imageData.Length);
            if (shouldResize.resize)
            {
                image.Mutate(x => x.Resize(shouldResize.newWidth, shouldResize.newHeight));
            }

            // 根据文件扩展名选择优化的编码器
            using var memoryStream = new MemoryStream();

            switch (extension)
            {
                case ".jpg":
                case ".jpeg":
                    await image.SaveAsJpegAsync(memoryStream, new JpegEncoder
                    {
                        Quality = quality
                    });
                    break;
                case ".png":
                    // PNG转换为JPEG以获得更好的压缩效果（如果质量设置较低）
                    if (quality < 85)
                    {
                        await image.SaveAsJpegAsync(memoryStream, new JpegEncoder
                        {
                            Quality = quality
                        });
                    }
                    else
                    {
                        await image.SaveAsPngAsync(memoryStream, new PngEncoder
                        {
                            CompressionLevel = PngCompressionLevel.BestCompression
                        });
                    }
                    break;
                case ".gif":
                    // GIF转换为JPEG以获得更好的压缩
                    await image.SaveAsJpegAsync(memoryStream, new JpegEncoder
                    {
                        Quality = Math.Max(quality, 70)  // GIF转换时保持相对较高的质量
                    });
                    break;
                case ".webp":
                    await image.SaveAsWebpAsync(memoryStream, new WebpEncoder
                    {
                        Quality = quality,
                        Method = WebpEncodingMethod.BestQuality
                    });
                    break;
                default:
                    // 默认保存为JPEG
                    await image.SaveAsJpegAsync(memoryStream, new JpegEncoder
                    {
                        Quality = quality
                    });
                    break;
            }

            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "图片压缩失败: {FileName}", fileName);
            throw new InvalidOperationException($"图片压缩失败: {ex.Message}");
        }
    }

    private (bool resize, int newWidth, int newHeight) ShouldResizeImage(int width, int height, long fileSize)
    {
        // 根据文件大小和尺寸决定是否需要调整大小
        const int maxDimension = 2048;  // 最大边长
        const long largeSizeThreshold = 2 * 1024 * 1024;  // 2MB
        const long hugeSizeThreshold = 5 * 1024 * 1024;   // 5MB

        // 超大文件强制缩小
        if (fileSize > hugeSizeThreshold)
        {
            var ratio = Math.Min(1200.0 / width, 1200.0 / height);
            if (ratio < 1.0)
            {
                return (true, (int)(width * ratio), (int)(height * ratio));
            }
        }
        // 大文件适度缩小
        else if (fileSize > largeSizeThreshold && (width > maxDimension || height > maxDimension))
        {
            var ratio = Math.Min((double)maxDimension / width, (double)maxDimension / height);
            if (ratio < 1.0)
            {
                return (true, (int)(width * ratio), (int)(height * ratio));
            }
        }
        // 超高分辨率图片缩小
        else if (width > 3000 || height > 3000)
        {
            var ratio = Math.Min(2400.0 / width, 2400.0 / height);
            if (ratio < 1.0)
            {
                return (true, (int)(width * ratio), (int)(height * ratio));
            }
        }

        return (false, width, height);
    }

    public async Task<(byte[] compressedData, long originalSize, long compressedSize)> CompressImageWithStatsAsync(byte[] imageData, string fileName, int quality = 60)
    {
        var originalSize = imageData.Length;
        var compressedData = await CompressImageAsync(imageData, fileName, quality);
        var compressedSize = compressedData.Length;

        return (compressedData, originalSize, compressedSize);
    }

    public async Task<byte[]> ConvertImageFormatAsync(byte[] imageData, string fileName, string targetFormat, int quality = 85)
    {
        try
        {
            using var image = Image.Load(imageData);


            using var memoryStream = new MemoryStream();
            var format = targetFormat.ToLowerInvariant();

            switch (format)
            {
                case "jpeg":
                case "jpg":
                    // 如果原图有透明背景，先填充白色背景
                    if (HasTransparency(image))
                    {
                        image.Mutate(ctx =>
                        {
                            ctx.BackgroundColor(Color.White);
                        });
                    }
                    await image.SaveAsJpegAsync(memoryStream, new JpegEncoder { Quality = quality });
                    break;

                case "png":
                    await image.SaveAsPngAsync(memoryStream, new PngEncoder
                    {
                        CompressionLevel = PngCompressionLevel.BestCompression
                    });
                    break;

                case "webp":
                    await image.SaveAsWebpAsync(memoryStream, new WebpEncoder
                    {
                        Quality = quality,
                        Method = WebpEncodingMethod.BestQuality
                    });
                    break;

                case "gif":
                    await image.SaveAsGifAsync(memoryStream);
                    break;

                case "bmp":
                    await image.SaveAsBmpAsync(memoryStream);
                    break;

                case "tiff":
                case "tif":
                    await image.SaveAsTiffAsync(memoryStream);
                    break;

                case "ico":
                    // ICO 格式需要特殊处理，缩放到合适尺寸
                    if (image.Width > 256 || image.Height > 256)
                    {
                        image.Mutate(x => x.Resize(256, 256));
                    }
                    // 暂时保存为PNG，因为ImageSharp不直接支持ICO输出
                    await image.SaveAsPngAsync(memoryStream);
                    break;

                case "icns":
                    // ICNS 格式也需要特殊处理
                    if (image.Width > 1024 || image.Height > 1024)
                    {
                        image.Mutate(x => x.Resize(1024, 1024));
                    }
                    // 暂时保存为PNG，因为ImageSharp不直接支持ICNS输出
                    await image.SaveAsPngAsync(memoryStream);
                    break;

                default:
                    throw new ArgumentException($"不支持的目标格式: {targetFormat}");
            }

            return memoryStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "图片格式转换失败: {FileName} -> {TargetFormat}", fileName, targetFormat);
            throw new InvalidOperationException($"图片格式转换失败: {ex.Message}");
        }
    }

    public async Task<(byte[] convertedData, long originalSize, long convertedSize)> ConvertImageFormatWithStatsAsync(byte[] imageData, string fileName, string targetFormat, int quality = 85)
    {
        var originalSize = imageData.Length;
        var convertedData = await ConvertImageFormatAsync(imageData, fileName, targetFormat, quality);
        var convertedSize = convertedData.Length;

        return (convertedData, originalSize, convertedSize);
    }


    private static bool HasTransparency(Image image)
    {
        // 检查图片是否有透明通道
        if (image is Image<Rgba32> rgba32Image)
        {
            var hasTransparency = false;
            rgba32Image.ProcessPixelRows(accessor =>
            {
                for (int y = 0; y < accessor.Height && !hasTransparency; y++)
                {
                    var row = accessor.GetRowSpan(y);
                    for (int x = 0; x < row.Length; x++)
                    {
                        if (row[x].A < 255)
                        {
                            hasTransparency = true;
                            break;
                        }
                    }
                }
            });
            return hasTransparency;
        }
        return false;
    }

    public bool IsSupportedImageFormat(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension is ".jpg" or ".jpeg" or ".png" or ".gif" or ".webp" or ".bmp" or ".tiff" or ".tif" or ".ico" or ".icns";
    }

    public string GetContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            ".tiff" or ".tif" => "image/tiff",
            ".ico" => "image/x-icon",
            ".icns" => "image/x-icns",
            _ => "application/octet-stream"
        };
    }

    public string GetContentTypeFromFormat(string format)
    {
        return format.ToLowerInvariant() switch
        {
            "jpeg" or "jpg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "bmp" => "image/bmp",
            "tiff" or "tif" => "image/tiff",
            "ico" => "image/x-icon",
            "icns" => "image/x-icns",
            _ => "application/octet-stream"
        };
    }
}