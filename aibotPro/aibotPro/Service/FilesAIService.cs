using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Drawing.Printing;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace aibotPro.Service
{
    public class FilesAIService : IFilesAIService
    {
        private readonly ISystemService _systemService;
        private readonly AIBotProContext _context;
        public FilesAIService(ISystemService systemService, AIBotProContext context)
        {
            _systemService = systemService;
            _context = context;
        }
        public bool SaveFilesLib(FilesLib filesLib)
        {
            //保存文件库
            _context.FilesLibs.Add(filesLib);
            return _context.SaveChanges() > 0;
        }
        public List<FilesLib> GetFilesLibs(int page, int pageSize, string name, out int total, string account = "")
        {
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<FilesLib> query = _context.FilesLibs;

            // 如果name不为空，则加上name的过滤条件
            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(x => x.FileName.Contains(name));
            }
            if (!string.IsNullOrEmpty(account))
            {
                query = query.Where(x => x.Account == account);
            }

            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var listFilesLibs = query.OrderBy(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return listFilesLibs;
        }
        public bool DeleteFilesLibs(string fileCode, string account)
        {
            //删除文件库文件
            var filesLib = _context.FilesLibs.FirstOrDefault(x => x.FileCode == fileCode && x.Account == account);
            if (filesLib != null)
            {
                _context.FilesLibs.Remove(filesLib);
                //组合文件路径
                string filePath = $"wwwroot{filesLib.FilePath}";
                //根据文件路径删除文件
                if (_systemService.DeleteFile(filePath))
                {
                    return _context.SaveChanges() > 0;
                }
            }
            return false;
        }
        public async Task<string> PromptFromFiles(List<string> path, string account)
        {
            string prompt = "# 以下是文件内容：\n\n";
            //判断路径是否有wwwroot
            if (path.Count > 0)
            {
                for (int i = 0; i < path.Count; i++)
                {
                    if (!path[i].Contains("wwwroot"))
                    {
                        path[i] = $"wwwroot{path[i]}";
                    }
                    string fileText = await _systemService.GetFileText(path[i]);
                    if (!string.IsNullOrEmpty(fileText))
                    {
                        prompt += $"## 文件内容{i + 1}：{fileText} \n\n";
                    }
                }
                return prompt;
            }
            else
            {
                return "";
            }
        }
    }
}
