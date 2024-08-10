using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace aibotPro.AppCode;

public class CaptchaGenerator
{
    private static readonly string chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    public static string GenerateCaptchaCode(int length = 4)
    {
        var random = new Random();
        return new string(Enumerable.Repeat(chars, length)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    public static string CreateCaptchaImageBase64(string captchaCode)
    {
        var width = 120;
        var height = 40;

        //Arial 字体是一种无衬线字体，清晰、简洁的视觉效果
        var font = SystemFonts.CreateFont("Arial", 36, FontStyle.Bold);

        //Comic Sans 是一种非常非正式且具有手写风格的字体。
        //var font = SystemFonts.CreateFont("Comic Sans MS", 36, FontStyle.Bold);

        //Papyrus 有一种古老和神秘的外观，非常适合用于具有历史感或幻想风格的设计。
        //var font = SystemFonts.CreateFont("Papyrus", 36, FontStyle.Bold);

        //Chiller 字体看起来像是用毛笔画出的字，有一种恐怖和不规则的感觉。
        //var font = SystemFonts.CreateFont("Chiller", 36, FontStyle.Bold);

        //Brush Script MT 模仿了用刷子书写的效果，具有强烈的手写风格。
        //var font = SystemFonts.CreateFont("Brush Script MT", 36, FontStyle.Bold);

        //Jokerman 是一种非常装饰性和狂野的字体，有很多奇特的装饰和曲线。
        //var font = SystemFonts.CreateFont("Jokerman", 36, FontStyle.Bold);

        //Curlz MT 是一种非常花哨和曲线多的字体，非常适合用于装饰性文本。
        //var font = SystemFonts.CreateFont("Curlz MT", 36, FontStyle.Bold);

        using (var image = new Image<Rgba32>(width, height))
        {
            image.Mutate(ctx =>
            {
                // 添加渐变背景
                ctx.Fill(new LinearGradientBrush(new PointF(0, 0), new PointF(width, height),
                    GradientRepetitionMode.None, new ColorStop(0, Color.FromRgb(200, 200, 255)),
                    new ColorStop(1, Color.FromRgb(255, 200, 200))));

                // 使用彩色文本
                var textColor = Color.FromRgb((byte)Random.Shared.Next(256), (byte)Random.Shared.Next(256),
                    (byte)Random.Shared.Next(256));
                ctx.DrawText(captchaCode, font, textColor, new PointF(10, 10));

                // 添加多条彩色干扰线
                for (var i = 0; i < 5; i++)
                {
                    var p1 = new PointF(Random.Shared.Next(width), Random.Shared.Next(height));
                    var p2 = new PointF(Random.Shared.Next(width), Random.Shared.Next(height));
                    var lineColor = Color.FromRgb((byte)Random.Shared.Next(256), (byte)Random.Shared.Next(256),
                        (byte)Random.Shared.Next(256));
                    ctx.DrawLine(lineColor, 2, p1, p2);
                }

                // 添加随机色点
                for (var i = 0; i < 300; i++)
                {
                    var x = Random.Shared.Next(width);
                    var y = Random.Shared.Next(height);
                    var dotColor = Color.FromRgb((byte)Random.Shared.Next(256), (byte)Random.Shared.Next(256),
                        (byte)Random.Shared.Next(256));
                    image[x, y] = dotColor;
                }
            });

            using (var memoryStream = new MemoryStream())
            {
                image.SaveAsPng(memoryStream);
                memoryStream.Seek(0, SeekOrigin.Begin);
                var imageBytes = memoryStream.ToArray();
                return Convert.ToBase64String(imageBytes);
            }
        }
    }
}