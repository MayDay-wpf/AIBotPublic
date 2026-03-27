namespace aibotPro.Interface;

public interface IToolsService
{
    Task<byte[]> CompressImageAsync(byte[] imageData, string fileName, int quality = 60);
    Task<(byte[] compressedData, long originalSize, long compressedSize)> CompressImageWithStatsAsync(byte[] imageData, string fileName, int quality = 60);
    Task<byte[]> ConvertImageFormatAsync(byte[] imageData, string fileName, string targetFormat, int quality = 85);
    Task<(byte[] convertedData, long originalSize, long convertedSize)> ConvertImageFormatWithStatsAsync(byte[] imageData, string fileName, string targetFormat, int quality = 85);
    bool IsSupportedImageFormat(string fileName);
    string GetContentType(string fileName);
    string GetContentTypeFromFormat(string format);
}