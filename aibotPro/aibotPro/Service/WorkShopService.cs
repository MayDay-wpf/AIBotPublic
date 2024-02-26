using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using JavaScriptEngineSwitcher.Core;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using OpenAI.ObjectModels.RequestModels;
using System.Data;
using JavaScriptEngineSwitcher.Extensions.MsDependencyInjection;
using JavaScriptEngineSwitcher.ChakraCore;
using Microsoft.CodeAnalysis.Scripting;
using Newtonsoft.Json.Linq;
using System.Security.Principal;

namespace aibotPro.Service
{
    public class WorkShopService : IWorkShop
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly IAiServer _aiServer;
        private readonly IUsersService _usersService;
        private readonly IRedisService _redisService;
        private readonly IFinanceService _financeService;
        public WorkShopService(AIBotProContext context, ISystemService systemService, IAiServer aiServer, IUsersService usersService, IRedisService redisService, IFinanceService financeService)
        {
            _context = context;
            _systemService = systemService;
            _aiServer = aiServer;
            _usersService = usersService;
            _redisService = redisService;
            _financeService = financeService;
        }
        public bool InstallPlugin(string account, int pluginId, out string errormsg)
        {
            errormsg = string.Empty;
            var plugin = _context.Plugins.Where(x => x.Id == pluginId && x.IsPublic == "yes").FirstOrDefault();
            if (plugin == null)
            {
                errormsg = "插件不存在";
                return false;
            }
            //判断用户是否已经安装过
            var pluginsInstall_b = _context.PluginsInstalls.Where(x => x.Account == account && x.PluginsCode == plugin.Pcode).FirstOrDefault();
            if (pluginsInstall_b != null)
            {
                errormsg = "已安装过该插件";
                return false;
            }
            //如果安装者不是作者，且不是VIP，且插件不免费，则需要支付
            if (plugin.Account != account && !_financeService.IsVip(account).Result && plugin.Pluginprice > 0)
            {
                //划转用户余额给插件作者
                if (!_financeService.UpdateUserMoney(account, plugin.Pluginprice.Value, "minus", out errormsg))
                {
                    return false;
                }
                //插件作者增加余额
                if (!_financeService.UpdateUserMoney(plugin.Account, plugin.Pluginprice.Value, "add", out errormsg))
                {
                    return false;
                }
            }

            PluginsInstall pluginsInstall = new PluginsInstall();
            pluginsInstall.Account = account;
            pluginsInstall.PluginsCode = plugin.Pcode;
            pluginsInstall.CreateTime = DateTime.Now;
            _context.PluginsInstalls.Add(pluginsInstall);
            return _context.SaveChanges() > 0;
        }
        public bool InstallMyPlugin(string account, int pluginId, out string errormsg)
        {
            errormsg = string.Empty;
            var plugin = _context.Plugins.Where(x => x.Id == pluginId && x.Account == account).FirstOrDefault();
            if (plugin == null)
            {
                errormsg = "插件不存在";
                return false;
            }
            //判断用户是否已经安装过
            var pluginsInstall_b = _context.PluginsInstalls.Where(x => x.Account == account && x.PluginsCode == plugin.Pcode).FirstOrDefault();
            if (pluginsInstall_b != null)
            {
                errormsg = "已安装过该插件";
                return false;
            }
            PluginsInstall pluginsInstall = new PluginsInstall();
            pluginsInstall.Account = account;
            pluginsInstall.PluginsCode = plugin.Pcode;
            pluginsInstall.CreateTime = DateTime.Now;
            _context.PluginsInstalls.Add(pluginsInstall);
            return _context.SaveChanges() > 0;
        }

        public bool UninstallPlugin(string account, int pluginId, out string errormsg)
        {
            errormsg = string.Empty;
            var plugin = _context.Plugins.Where(x => x.Id == pluginId).FirstOrDefault();
            if (plugin == null)
            {
                errormsg = "插件不存在";
                return false;
            }
            //判断用户是否已经安装过
            var pluginsInstall = _context.PluginsInstalls.Where(x => x.Account == account && x.PluginsCode == plugin.Pcode).FirstOrDefault();
            if (pluginsInstall == null)
            {
                errormsg = "未安装过该插件";
                return false;
            }
            _context.PluginsInstalls.Remove(pluginsInstall);
            //保存
            _context.SaveChanges();
            return true;
        }

        public List<Plugin> GetPlugins(string account)
        {
            //获取用户制作的插件列表
            var plugins = _context.Plugins.Where(x => x.Account == account).ToList();
            return plugins;
        }

        public List<Plugin> GetWorkShopPlugins(int page, int pageSize, string name, out int total)
        {
            //分页获取插件
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<Plugin> query = _context.Plugins.Where(p => p.IsPublic == "yes");

            // 如果name不为空，则加上name的过滤条件
            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(x => x.Pnickname.Contains(name));
            }

            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var plugins = query.OrderBy(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return plugins;

        }

        public bool DeletePlugin(string account, int pluginId, out string errormsg)
        {
            //删除插件
            errormsg = string.Empty;
            //判断插件是否存在
            var plugin = _context.Plugins.Where(x => x.Id == pluginId).FirstOrDefault();
            if (plugin == null)
            {
                errormsg = "插件不存在";
                return false;
            }
            //判断用户是否安装了该插件
            var pluginsInstall = _context.PluginsInstalls.Where(x => x.Account == account && x.PluginsCode == plugin.Pcode).FirstOrDefault();
            if (pluginsInstall != null)
            {
                errormsg = "用户已安装该插件，无法删除";
                return false;
            }
            //删除用户该插件安装记录
            _context.PluginsInstalls.Remove(pluginsInstall);
            return true;
        }

        public WorkShopPlugin GetPlugin(int pluginId, string account, string pcode = "", string pfunctionName = "")
        {
            Plugin plugin = new Plugin();
            //获取插件信息，如果pcode不为空，则根据pcode获取
            if (!string.IsNullOrEmpty(pcode))
                plugin = _context.Plugins.Where(x => x.Pcode == pcode && (x.IsPublic == "yes" || x.Account == account)).FirstOrDefault();
            else if (!string.IsNullOrEmpty(pfunctionName))
                plugin = _context.Plugins.Where(x => x.Pfunctionname == pfunctionName && (x.IsPublic == "yes" || x.Account == account)).FirstOrDefault();
            else
                plugin = _context.Plugins.Where(x => x.Id == pluginId && (x.IsPublic == "yes" || x.Account == account)).FirstOrDefault();
            if (plugin == null)
            {
                return null;
            }
            //是否开源
            if (plugin.Popensource == "no")
            {
                //判断是否是作者
                if (plugin.Account != account)
                {
                    return null;
                }
            }
            WorkShopPlugin workShopPlugin = new WorkShopPlugin
            {
                Id = plugin.Id,
                Pcode = plugin.Pcode,
                Pnickname = plugin.Pnickname,
                Popensource = plugin.Popensource,
                Pavatar = plugin.Pavatar,
                Pfunctionname = plugin.Pfunctionname,
                Pfunctioninfo = plugin.Pfunctioninfo,
                Pluginprice = plugin.Pluginprice,
                Pcodemodel = plugin.Pcodemodel,
                Papiurl = plugin.Papiurl,
                Pmethod = plugin.Pmethod,
                Pjscode = _systemService.DecodeBase64(plugin.Pjscode),
                PrunLocation = plugin.PrunLocation,
                Pusehtml = plugin.Pusehtml,
                CreateTime = plugin.CreateTime,
                Param = _context.PluginsParams.Where(x => x.PrCode == plugin.ParamCode).Select(x => new PluginParamDto
                {
                    ParamCode = x.PrCode,
                    ParamInfo = x.PrInfo,
                    ParamName = x.PrName,
                    ParamConst = x.PrConst
                }).ToList(),
                Pheaders = _context.PluginsHeaders.Where(x => x.HdCode == plugin.PheadersCode).Select(x => new PluginHeaderDto
                {
                    PheadersCode = x.HdCode,
                    PheadersName = x.HdName,
                    PheadersValue = x.HdValue
                }).ToList(),
                Pcookies = _context.PluginsCookies.Where(x => x.CkCode == plugin.PcookiesCode).Select(x => new PluginCookieDto
                {
                    PcookiesCode = x.CkCode,
                    PcookiesName = x.CkName,
                    PcookiesValue = x.CkValue
                }).ToList()
            };
            return workShopPlugin;
        }
        public List<Plugin> GetPluginInstall(string account)
        {
            //获取用户安装的插件
            var pluginsInstall = _context.PluginsInstalls.Where(x => x.Account == account).ToList();
            //遍历插件安装记录，获取插件信息
            List<Plugin> plugins = new List<Plugin>();
            foreach (var item in pluginsInstall)
            {
                var plugin = _context.Plugins.Where(x => x.Pcode == item.PluginsCode).FirstOrDefault();
                if (plugin != null)
                {
                    plugins.Add(plugin);
                }
            }
            return plugins;
        }
        public List<PluginParamDto> GetPluginParams(int pluginId)
        {
            //获取插件参数
            var plugin = _context.Plugins.Where(x => x.Id == pluginId).FirstOrDefault();
            if (plugin == null)
            {
                return null;
            }
            var pluginParams = _context.PluginsParams.Where(x => x.PrCode == plugin.ParamCode).Select(x => new PluginParamDto
            {
                ParamCode = x.PrCode,
                ParamInfo = x.PrInfo,
                ParamName = x.PrName,
                ParamConst = x.PrConst
            }).ToList();
            return pluginParams;
        }
        public List<PluginHeaderDto> GetPluginHeaders(int pluginId)
        {
            //获取插件headers
            var plugin = _context.Plugins.Where(x => x.Id == pluginId).FirstOrDefault();
            if (plugin == null)
            {
                return null;
            }
            var pluginHeaders = _context.PluginsHeaders.Where(x => x.HdCode == plugin.PheadersCode).Select(x => new PluginHeaderDto
            {
                PheadersCode = x.HdCode,
                PheadersName = x.HdName,
                PheadersValue = x.HdValue
            }).ToList();
            return pluginHeaders;
        }
        public List<PluginCookieDto> GetPluginCookies(int pluginId)
        {
            //获取插件cookies
            var plugin = _context.Plugins.Where(x => x.Id == pluginId).FirstOrDefault();
            if (plugin == null)
            {
                return null;
            }
            var pluginCookies = _context.PluginsCookies.Where(x => x.CkCode == plugin.PcookiesCode).Select(x => new PluginCookieDto
            {
                PcookiesCode = x.CkCode,
                PcookiesName = x.CkName,
                PcookiesValue = x.CkValue
            }).ToList();
            return pluginCookies;
        }
        public async Task<PluginResDto> RunPlugin(string account, FunctionCall fn)
        {
            PluginResDto pluginResDto = new PluginResDto();
            //获取插件信息
            string fnName = fn.Name;
            //如果是系统插件
            if (fnName == "use_dalle3_withpr")
            {
                pluginResDto.doubletreating = false;
                pluginResDto.doubletype = "dalle3";
                string baseUrl = string.Empty;
                string apiKey = string.Empty;
                //获取对话设置
                var chatSetting = _usersService.GetChatSetting(account);
                if (chatSetting != null)
                {
                    if (chatSetting.MyDall != null && !string.IsNullOrEmpty(chatSetting.MyDall.BaseURL) && !string.IsNullOrEmpty(chatSetting.MyDall.ApiKey))
                    {
                        baseUrl = chatSetting.MyDall.BaseURL;
                        apiKey = chatSetting.MyDall.ApiKey;
                    }
                }
                else
                {
                    var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "DALLE3").FirstOrDefault();
                    if (aiModel == null)
                    {
                        pluginResDto.result = string.Empty;
                        pluginResDto.errormsg = "AI模型不存在";
                    }
                    baseUrl = aiModel.BaseUrl;
                    apiKey = aiModel.ApiKey;
                }
                string prompt = string.Empty;
                string drawsize = "1024x1024";
                string quality = "standard";
                foreach (var entry in fn.ParseArguments())
                {
                    if (entry.Key == "drawprompt")
                        prompt = entry.Value.ToString();
                    if (entry.Key == "drawsize")
                        drawsize = entry.Value.ToString();
                    if (entry.Key == "quality")
                        quality = entry.Value.ToString();
                    quality = entry.Value.ToString();
                }
                pluginResDto.result = await _aiServer.CreateDALLdraw(prompt, drawsize, quality, baseUrl, apiKey);
                // 在后台启动一个任务下载图片
                Task.Run(async () =>
                {
                    string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "") + ".jpg";
                    string savePath = Path.Combine("wwwroot", "files/dallres", account);
                    await _aiServer.DownloadImageAsync(pluginResDto.result, savePath, newFileName);
                    string imgResPath = Path.Combine("/files/dallres", account, newFileName);

                    // 这里做一些后续处理，比如更新数据库记录等
                    _aiServer.SaveAiDrawResult(account, "DALLE3", imgResPath, prompt, prompt);
                });

            }
            else if (fnName == "search_google_when_gpt_cannot_answer")
            {
                List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
                string googleSearchApiKey = systemConfig.Find(x => x.CfgKey == "GoogleSearchApiKey").CfgValue;
                string googleSearchEngineId = systemConfig.Find(x => x.CfgKey == "GoogleSearchEngineId").CfgValue;
                pluginResDto.doubletreating = true;
                pluginResDto.doubletype = "websearch";
                string query = string.Empty;
                foreach (var entry in fn.ParseArguments())
                {
                    query = entry.Value.ToString();
                }
                var googleSearch = await _aiServer.GetWebSearchResult(query, googleSearchApiKey, googleSearchEngineId);
                string searchResult = string.Empty;
                for (int i = 0; i < googleSearch.Count; i++)
                {
                    searchResult += $"# {i + 1}:标题：{googleSearch[i].Title}\n # 链接地址：{googleSearch[i].Link}\n # 摘要：{googleSearch[i].Snippet}；\n\n";
                }
                pluginResDto.result = searchResult;
            }
            else if (fnName == "search_knowledge_base")
            {
                List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
                var Alibaba_DashVectorApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorApiKey")?.CfgValue;
                var Alibaba_DashVectorEndpoint = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorEndpoint")?.CfgValue;
                var Alibaba_DashVectorCollectionName = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorCollectionName")?.CfgValue;
                var EmbeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
                var EmbeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
                VectorHelper vectorHelper = new VectorHelper(_redisService, Alibaba_DashVectorApiKey, Alibaba_DashVectorEndpoint, Alibaba_DashVectorCollectionName, EmbeddingsUrl, EmbeddingsApiKey);
                pluginResDto.doubletreating = true;
                pluginResDto.doubletype = "knowledge";
                string query = string.Empty;
                foreach (var entry in fn.ParseArguments())
                {
                    query = entry.Value.ToString();
                }
                List<string> pm = new List<string>();
                pm.Add(query);
                List<List<double>> vectorList = await vectorHelper.StringToVectorAsync("text-embedding-3-small", pm.Select(s => s.Replace("\r", "").Replace("\n", "")).ToList(), account);
                SearchVectorPr searchVectorPr = new SearchVectorPr();
                searchVectorPr.filter = $"account = '{account}'";
                searchVectorPr.topk = 3;
                searchVectorPr.vector = vectorList[0];
                SearchVectorResult searchVectorResult = vectorHelper.SearchVector(searchVectorPr);
                string knowledge = string.Empty;
                if (searchVectorResult.output != null)
                {
                    for (int i = 0; i < searchVectorResult.output.Count; i++)
                    {
                        Output output = searchVectorResult.output[i];
                        knowledge += $"{i + 1}：{output.fields.knowledge} \n";
                    }
                    pluginResDto.result = $"知识库查询结果如下：\n {knowledge}";
                }
                else
                    pluginResDto.result = "知识库中没有查到关于这个问题的内容";
            }
            else
            {
                //获取插件信息
                var plugin = GetPlugin(-1, account, "", fnName);
                if (plugin == null)
                {
                    pluginResDto.result = string.Empty;
                    pluginResDto.errormsg = "插件不存在";
                    return pluginResDto;
                }
                //获取插件模式
                string runLocation = plugin.PrunLocation;
                string useHtml = plugin.Pusehtml;
                string pModel = plugin.Pcodemodel;
                if (pModel == "plugin-online")
                {
                    string url = plugin.Papiurl;
                    string method = plugin.Pmethod;
                    Dictionary<string, string> parameters = new Dictionary<string, string>();
                    Dictionary<string, string> headers = new Dictionary<string, string>();
                    Dictionary<string, string> cookies = new Dictionary<string, string>();
                    var plugin_pr = GetPluginParams(plugin.Id);
                    var plugin_hd = GetPluginHeaders(plugin.Id);
                    var plugin_ck = GetPluginCookies(plugin.Id);
                    if (plugin_hd != null)
                    {
                        foreach (var item_hd in plugin_hd)
                        {
                            headers.Add(item_hd.PheadersName, item_hd.PheadersValue);
                        }
                    }
                    if (plugin_ck != null)
                    {
                        foreach (var item_ck in plugin_ck)
                        {
                            cookies.Add(item_ck.PcookiesName, item_ck.PcookiesValue);
                        }
                    }
                    foreach (var entry in fn.ParseArguments())
                    {
                        string pr_val = entry.Value.ToString();
                        if (plugin_pr != null)
                        {
                            var pr = plugin_pr.Where(x => x.ParamName == entry.Key).FirstOrDefault();
                            if (pr != null)
                            {
                                if (!string.IsNullOrEmpty(pr.ParamConst))//如果是常量
                                    parameters.Add(pr.ParamName, pr.ParamConst);
                                else
                                    parameters.Add(pr.ParamName, pr_val);
                            }
                        }
                    }
                    if (plugin.Pmethod == "get")
                    {
                        pluginResDto.result = _aiServer.AiGet(url, parameters, headers, cookies);
                    }
                    else
                    {
                        pluginResDto.result = _aiServer.AiPost(url, parameters, headers, cookies);
                    }
                    if (useHtml == "true")
                    {
                        pluginResDto.doubletreating = false;
                        pluginResDto.doubletype = "html";
                    }
                    else
                    {
                        pluginResDto.doubletreating = true;
                    }

                }
                else if (pModel == "plugin-offline")
                {
                    string jsCode = plugin.Pjscode;
                    //初始化脚本引擎
                    IServiceCollection services = new ServiceCollection();
                    services.AddJsEngineSwitcher(options => options.DefaultEngineName = ChakraCoreJsEngine.EngineName)
                            .AddChakraCore();

                    IServiceProvider serviceProvider = services.BuildServiceProvider();
                    IJsEngineSwitcher jsEngineSwitcher = serviceProvider.GetRequiredService<IJsEngineSwitcher>();

                    IJsEngine jsEngine = jsEngineSwitcher.CreateDefaultEngine();

                    List<object> arguments = new List<object>();
                    var plugin_pr = GetPluginParams(plugin.Id);
                    string runScript = string.Empty;
                    string qdScriptpr = string.Empty;
                    foreach (var entry in fn.ParseArguments())
                    {
                        string pr_val = entry.Value.ToString();
                        if (plugin_pr != null)
                        {
                            var pr = plugin_pr.Where(x => x.ParamName == entry.Key).FirstOrDefault();
                            if (pr != null)
                            {
                                if (!string.IsNullOrEmpty(pr.ParamConst))//如果是常量
                                {
                                    arguments.Add(pr.ParamConst.ToString());
                                    runScript += $@"var {entry.Key}=`{pr.ParamConst.ToString()}`;  ";
                                }
                                else
                                {
                                    arguments.Add(pr_val);
                                    runScript += $@"var {entry.Key}=`{pr_val}`;  ";
                                }
                                qdScriptpr += entry.Key + ",";
                            }
                        }
                    }
                    object[] arr = arguments.ToArray();
                    //后端运行脚本
                    if (runLocation == "back-end")
                    {
                        runScript += jsCode;
                        jsEngine.Execute(runScript);
                        pluginResDto.result = jsEngine.CallFunction<string>(fn.Name, arr);
                        if (useHtml == "true")
                        {
                            pluginResDto.doubletreating = false;
                            pluginResDto.doubletype = "html";
                        }
                        else
                        {
                            pluginResDto.doubletreating = true;
                        }
                    }
                    //前端运行脚本
                    else if (runLocation == "fore-end")
                    {
                        runScript += jsCode;
                        pluginResDto.result = $"{runScript} {plugin.Pfunctionname}({qdScriptpr.TrimEnd(',')});";
                        pluginResDto.doubletreating = false;
                        pluginResDto.doubletype = "js";

                    }
                }
                else if (pModel == "plugin-mixed")
                {
                    string url = plugin.Papiurl;
                    string method = plugin.Pmethod;
                    string request_res = string.Empty;
                    Dictionary<string, string> parameters = new Dictionary<string, string>();
                    Dictionary<string, string> headers = new Dictionary<string, string>();
                    Dictionary<string, string> cookies = new Dictionary<string, string>();
                    var plugin_pr = GetPluginParams(plugin.Id);
                    var plugin_hd = GetPluginHeaders(plugin.Id);
                    var plugin_ck = GetPluginCookies(plugin.Id);
                    if (plugin_hd != null)
                    {
                        foreach (var item_hd in plugin_hd)
                        {
                            headers.Add(item_hd.PheadersName, item_hd.PheadersValue);
                        }
                    }
                    if (plugin_ck != null)
                    {
                        foreach (var item_ck in plugin_ck)
                        {
                            cookies.Add(item_ck.PcookiesName, item_ck.PcookiesValue);
                        }
                    }
                    foreach (var entry in fn.ParseArguments())
                    {
                        string pr_val = entry.Value.ToString();
                        if (plugin_pr != null)
                        {
                            var pr = plugin_pr.Where(x => x.ParamName == entry.Key).FirstOrDefault();
                            if (pr != null)
                            {
                                if (!string.IsNullOrEmpty(pr.ParamConst))//如果是常量
                                    parameters.Add(pr.ParamName, pr.ParamConst);
                                else
                                    parameters.Add(pr.ParamName, pr_val);
                            }
                        }
                    }
                    if (plugin.Pmethod == "get")
                    {
                        request_res = _aiServer.AiGet(url, parameters, headers, cookies);
                    }
                    else
                    {
                        request_res = _aiServer.AiPost(url, parameters, headers, cookies);
                    }
                    //脚本回调
                    string jsCode = plugin.Pjscode;
                    //初始化脚本引擎
                    IServiceCollection services = new ServiceCollection();
                    services.AddJsEngineSwitcher(options => options.DefaultEngineName = ChakraCoreJsEngine.EngineName)
                            .AddChakraCore();

                    IServiceProvider serviceProvider = services.BuildServiceProvider();
                    IJsEngineSwitcher jsEngineSwitcher = serviceProvider.GetRequiredService<IJsEngineSwitcher>();

                    IJsEngine jsEngine = jsEngineSwitcher.CreateDefaultEngine();

                    //string script_pr = $"var res='{request_res}';";
                    string runScript = jsCode;
                    List<object> arguments = new List<object>();
                    arguments.Add(request_res);
                    //后端运行脚本
                    if (runLocation == "back-end2")
                    {
                        jsEngine.Execute(runScript);
                        pluginResDto.result = jsEngine.CallFunction<string>(fn.Name, arguments.ToArray());
                        if (useHtml == "true")
                        {
                            pluginResDto.doubletreating = false;
                            pluginResDto.doubletype = "html";
                        }
                        else
                        {
                            pluginResDto.doubletreating = true;
                        }
                    }
                    //前端运行脚本
                    else if (runLocation == "fore-end2")
                    {
                        pluginResDto.result = $"{runScript}";
                        pluginResDto.doubletreating = false;
                        pluginResDto.doubletype = "js";

                    }

                }
                else
                {
                    pluginResDto.result = string.Empty;
                    pluginResDto.errormsg = "插件模式错误";
                    pluginResDto.doubletreating = false;
                    return pluginResDto;
                }
            }
            return pluginResDto;
        }
    }
}
