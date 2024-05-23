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
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using System.Text;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;

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
        private readonly IServiceProvider _serviceProvider;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IMilvusService _milvusService;
        public WorkShopService(AIBotProContext context, ISystemService systemService, IAiServer aiServer, IUsersService usersService, IRedisService redisService, IFinanceService financeService, IServiceProvider serviceProvider, IHubContext<ChatHub> hubContext, IMilvusService milvusService)
        {
            _context = context;
            _systemService = systemService;
            _aiServer = aiServer;
            _usersService = usersService;
            _redisService = redisService;
            _financeService = financeService;
            _serviceProvider = serviceProvider;
            _hubContext = hubContext;
            _milvusService = milvusService;
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
            _context.Plugins.Remove(plugin);
            _context.SaveChanges();
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
                    ParamType = x.PrType,
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
                }).ToList(),
                JsonPr = _context.PluginsJsonPrs.Where(x => x.PrCode == plugin.Pcode).Select(x => x.JsonContent).FirstOrDefault(),
                WorkFlowCode = _context.WorkFlows.Where(x => x.Pcode == plugin.Pcode).Select(x => x.FlowCode).FirstOrDefault()
            };
            return workShopPlugin;
        }
        public List<PluginDto> GetPluginInstall(string account)
        {
            //获取用户安装的插件
            var pluginsInstall = _context.PluginsInstalls.Where(x => x.Account == account).ToList();
            //遍历插件安装记录，获取插件信息
            List<PluginDto> plugins = new List<PluginDto>();
            foreach (var item in pluginsInstall)
            {
                var plugin = _context.Plugins.Where(x => x.Pcode == item.PluginsCode).FirstOrDefault();
                if (plugin != null)
                {
                    PluginDto pluginDto = new PluginDto();
                    _systemService.CopyPropertiesTo(plugin, pluginDto);
                    pluginDto.MustHit = item.MustHit == null ? false : item.MustHit;
                    pluginDto.InstallId = item.Id;
                    plugins.Add(pluginDto);
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
                ParamType = x.PrType,
                ParamInfo = x.PrInfo,
                ParamName = x.PrName,
                ParamConst = x.PrConst
            }).ToList();
            return pluginParams;
        }
        public PluginsJsonPr GetPluginsJsonPr(int pluginId)
        {
            //获取插件参数
            var plugin = _context.Plugins.Where(x => x.Id == pluginId).FirstOrDefault();
            if (plugin == null)
            {
                return null;
            }
            var pluginsJsonPr = _context.PluginsJsonPrs.Where(x => x.PrCode == plugin.Pcode).FirstOrDefault();
            return pluginsJsonPr;
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
        public async Task<PluginResDto> RunPlugin(string account, FunctionCall fn, string chatId = "", string senMethod = "", List<string> typeCode = null)
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
                bool shouldPay = true;
                //检查用户余额
                var user = _usersService.GetUserData(account);
                if (user.Mcoin <= 0)
                {
                    pluginResDto.result = string.Empty;
                    pluginResDto.errormsg = "DALL-E3为付费插件，您的余额不足";
                    return pluginResDto;
                }
                //获取对话设置
                var chatSetting = _usersService.GetChatSetting(account);
                if (chatSetting != null && chatSetting.MyDall != null && chatSetting.MyDall.ApiKey != null && chatSetting.MyDall.BaseURL != null)
                {
                    baseUrl = chatSetting.MyDall.BaseURL;
                    apiKey = chatSetting.MyDall.ApiKey;
                    shouldPay = false;
                }
                else
                {
                    var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "DALLE3").FirstOrDefault();
                    if (aiModel == null)
                    {
                        pluginResDto.result = string.Empty;
                        pluginResDto.errormsg = "AI模型不存在";
                        return pluginResDto;
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
                pluginResDto.dallprompt = prompt;
                //扣费
                if (shouldPay)
                    await _financeService.CreateUseLogAndUpadteMoney(account, "DALLE3", 0, 0, true);
                // 在后台启动一个任务下载图片
                Task.Run(async () =>
                {
                    using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                    {
                        string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
                        string savePath = Path.Combine("wwwroot", "files/dallres", account);
                        await _aiServer.DownloadImageAsync(pluginResDto.result, savePath, newFileName);
                        string imgResPath = Path.Combine("/files/dallres", account, newFileName + ".png");

                        // 这里做一些后续处理，比如更新数据库记录等
                        var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>(); // 假设保存记录方法在IAiSaveService中。
                        await aiSaveService.SaveAiDrawResult(account, "DALLE3", imgResPath, prompt, prompt);
                    }
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
                pluginResDto.result = $"I will give you a question or an instruction. Your objective is to answer my question or fulfill my instruction.\n\nMy question or instruction is: {query}\n\nFor your reference, today's date is {DateTime.Now.ToString()} in Beijing.\n\nIt's possible that the question or instruction, or just a portion of it, requires relevant information from the internet to give a satisfactory answer or complete the task. Therefore, provided below is the necessary information obtained from the internet, which sets the context for addressing the question or fulfilling the instruction. You will write a comprehensive reply to the given question or instruction. Do not include urls and sources in the summary text. If the provided information from the internet results refers to multiple subjects with the same name, write separate answers for each subject:\n\"\"\"\n{searchResult}\n\"\"\"\n Reply in 中文";
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
                if (vectorList[0] == null)
                {
                    await _systemService.WriteLog("text-embedding-3-small模型执行失败，该问题通常重试后即可", Dtos.LogLevel.Error, "system");
                    throw new Exception("text-embedding-3-small模型执行失败，该问题通常重试后即可");
                }
                SearchVectorPr searchVectorPr = new SearchVectorPr();
                searchVectorPr.filter = $"account = '{account}'";
                searchVectorPr.topk = 3;
                searchVectorPr.vector = vectorList[0];
                SearchVectorResult searchVectorResult = new SearchVectorResult();
                if (typeCode != null && typeCode.Count > 0)
                {
                    List<float> vectorByMilvus = searchVectorPr.vector.ConvertAll(x => (float)x);
                    var resultByMilvus = await _milvusService.SearchVector(vectorByMilvus, account, typeCode, searchVectorPr.topk);
                    searchVectorResult = new SearchVectorResult
                    {
                        code = resultByMilvus.Code,
                        request_id = Guid.NewGuid().ToString(),
                        message = string.Empty,
                        output = resultByMilvus.Data.Select(data => new Output
                        {
                            id = data.Id,
                            fields = new Fields
                            {
                                account = string.Empty,
                                knowledge = data.VectorContent
                            },
                            score = (double)data.Distance
                        }).ToList()
                    };
                }
                else
                    searchVectorResult = vectorHelper.SearchVector(searchVectorPr);
                string knowledge = string.Empty;
                if (searchVectorResult.output != null)
                {
                    for (int i = 0; i < searchVectorResult.output.Count; i++)
                    {
                        Output output = searchVectorResult.output[i];
                        knowledge += $"{i + 1}：{output.fields.knowledge} \n";
                    }
                    pluginResDto.result = $@"知识库查询结果如下：
                                           {knowledge}
                                           - 保持回答尽可能参考知识库的内容。 
                                           - 使用 Markdown 语法优化回答格式。
                                           - 以知识库中的理念和说话风格来解答用户的问题。 
                                           - 使用与问题相同的语言回答。";
                }
                else
                    pluginResDto.result = "知识库中没有查到关于这个问题的内容,请自行回答";
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
                    Dictionary<string, object> parameters = new Dictionary<string, object>();
                    Dictionary<string, string> headers = new Dictionary<string, string>();
                    Dictionary<string, string> cookies = new Dictionary<string, string>();
                    var plugin_pr = GetPluginParams(plugin.Id);
                    var plugin_hd = GetPluginHeaders(plugin.Id);
                    var plugin_ck = GetPluginCookies(plugin.Id);
                    var plugin_jsonpr = GetPluginsJsonPr(plugin.Id);
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
                        var pr_val = entry.Value;
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
                    string jsonBody = string.Empty;
                    if (plugin_jsonpr != null)
                    {
                        jsonBody = plugin_jsonpr.JsonContent;
                        //替换参数parameters
                        foreach (var item in parameters)
                        {
                            jsonBody = Regex.Replace(jsonBody, @"\{\{" + item.Key + @"\}\}", item.Value.ToString());
                        }

                    }
                    if (plugin.Pmethod == "get")
                    {
                        pluginResDto.result = _aiServer.AiGet(url, parameters, headers, cookies);
                    }
                    else
                    {
                        pluginResDto.result = _aiServer.AiPost(url, parameters, headers, cookies, jsonBody);
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
                        var pr_val = entry.Value;
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
                                    if (pr.ParamType == "String")
                                        runScript += $@"var {entry.Key}=`{Convert.ToString(pr_val)}`;  ";
                                    else
                                        runScript += $@"var {entry.Key}={Convert.ToString(pr_val)};  ";
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
                        pluginResDto.result = jsEngine.CallFunction<string>(fn.Name);
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
                    Dictionary<string, object> parameters = new Dictionary<string, object>();
                    Dictionary<string, string> headers = new Dictionary<string, string>();
                    Dictionary<string, string> cookies = new Dictionary<string, string>();
                    var plugin_pr = GetPluginParams(plugin.Id);
                    var plugin_hd = GetPluginHeaders(plugin.Id);
                    var plugin_ck = GetPluginCookies(plugin.Id);
                    var plugin_jsonpr = GetPluginsJsonPr(plugin.Id);
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
                        var pr_val = entry.Value;
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
                    string jsonBody = string.Empty;
                    if (plugin_jsonpr != null)
                    {
                        jsonBody = plugin_jsonpr.JsonContent;
                        //替换参数parameters
                        foreach (var item in parameters)
                        {
                            jsonBody = Regex.Replace(jsonBody, @"\{\{" + item.Key + @"\}\}", item.Value.ToString());
                        }

                    }
                    if (plugin.Pmethod == "get")
                    {
                        request_res = _aiServer.AiGet(url, parameters, headers, cookies);
                    }
                    else
                    {
                        request_res = _aiServer.AiPost(url, parameters, headers, cookies, jsonBody);
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

                    string script_pr = $"var res='{request_res}';";
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
                        pluginResDto.result = $"{script_pr} {runScript} {plugin.Pfunctionname}(res)";
                        pluginResDto.doubletreating = false;
                        pluginResDto.doubletype = "js";

                    }

                }
                else if (pModel == "plugin-workflow")
                {
                    //从数据库获取工作流
                    var workFlowData = _context.WorkFlows.Where(x => x.Pcode == plugin.Pcode).FirstOrDefault();
                    if (workFlowData != null)
                    {
                        string workFlowCode = workFlowData.FlowCode;
                        string workFlowJson = workFlowData.FlowJson;
                        //获取工作流节点数据
                        string nodeData = await GetWorkFlowNodeData(workFlowCode);
                        if (string.IsNullOrEmpty(nodeData))
                        {
                            pluginResDto.result = string.Empty;
                            pluginResDto.errormsg = "工作流不存在";
                            pluginResDto.doubletreating = false;
                            return pluginResDto;
                        }
                        //找到start节点
                        WorkFlowNodeData workFlowNodeData = JsonConvert.DeserializeObject<WorkFlowNodeData>(nodeData);
                        //找到start节点
                        var homeData = workFlowNodeData.Drawflow.Home.Data;
                        NodeData startData = homeData.Values.FirstOrDefault(x => x.Name == "start");
                        //查询start节点的参数是否有json模板
                        //寻找参数
                        string startOutputJson = string.Empty;
                        if (startData.Data is StartData startDataSpecific)
                        {
                            // 现在startDataSpecific.Output指向StartOutput对象
                            var startOutput = startDataSpecific.Output;

                            if (startOutput != null)
                            {
                                Dictionary<string, string> parameters = new Dictionary<string, string>();
                                if (startOutput.PrItems.Count > 0)//判断开始节点是否有参数
                                {
                                    foreach (var entry in fn.ParseArguments())
                                    {
                                        string pr_val = entry.Value.ToString();
                                        string key = entry.Key;
                                        var pr = startOutput.PrItems.Where(x => x.PrName.Replace(" ", "") == key).FirstOrDefault();
                                        if (pr != null)
                                        {
                                            if (!string.IsNullOrEmpty(pr.PrConst))//如果是常量
                                                parameters.Add(pr.PrName, pr.PrConst);
                                            else
                                                parameters.Add(pr.PrName, pr_val);
                                        }
                                    }
                                }
                                if (parameters.Count > 0)
                                {
                                    startOutputJson = GenerateJson("start", parameters);
                                }
                                else
                                {
                                    startOutputJson = "{}";
                                }
                                WorkflowEngine workflowEngine = new WorkflowEngine(workFlowNodeData, _aiServer, _systemService, _financeService, _context, account, _serviceProvider, _hubContext, chatId, senMethod, _redisService);
                                List<NodeOutput> workflowResult = await workflowEngine.Execute(startOutputJson);
                                //查询工作流结束模式
                                var endNodeData = (EndData)workFlowNodeData.Drawflow.Home.Data.Values.FirstOrDefault(x => x.Name == "end").Data;
                                pluginResDto.result = string.Empty;
                                string endAction = endNodeData.Output.EndAction;
                                if (endAction != "ai")
                                    pluginResDto.doubletreating = false;
                                pluginResDto.doubletype = endAction;
                                string jscode = workflowResult.Where(w => w.NodeName == "end").FirstOrDefault().OutputData;
                                if (endAction == "js")
                                    jscode = jscode + " end();";
                                pluginResDto.result = jscode;
                            }
                        }
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

        public async Task<string> GetWorkFlowNodeData(string workflowcode)
        {
            //尝试读取缓存
            var nodedata = string.Empty;
            nodedata = _redisService.GetAsync(workflowcode).Result;
            if (string.IsNullOrEmpty(nodedata))
            {
                //从数据库读取
                nodedata = _context.WorkFlows.Where(x => x.FlowCode == workflowcode).Select(x => x.FlowJson).FirstOrDefault();
            }
            return nodedata;
        }
        public bool SetMandatoryHit(string account, int id, bool mustHit)
        {
            //设置插件必中
            var plugin = _context.PluginsInstalls.Where(x => x.Account == account && x.Id == id).FirstOrDefault();
            if (plugin != null)
            {
                if (mustHit)
                {
                    //其他插件全部设置为非必中
                    var otherInstalls = _context.PluginsInstalls.Where(x => x.Account == account && x.Id != id).ToList();
                    foreach (var otherPlugin in otherInstalls)
                    {
                        otherPlugin.MustHit = false;
                    }
                }
                plugin.MustHit = mustHit;
                _context.SaveChanges();
                return true;
            }
            return false;
        }
        public async Task<List<OpenAPIModelSetting>> GetOpenAPIModelSetting(string account)
        {
            List<OpenAPIModelSetting> openAPIModelSettings = new List<OpenAPIModelSetting>();
            //获取缓存中的设置
            string openapiKey = $"OpenAPI_{account}";
            var openApiSetting = await _redisService.GetAsync(openapiKey);
            if (openApiSetting == null)
            {
                openAPIModelSettings = _context.OpenAPIModelSettings.AsNoTracking().Where(x => x.Account == account).ToList();
                if (openAPIModelSettings != null && openAPIModelSettings.Count > 0)
                {
                    //写入缓存
                    await _redisService.SetAsync(openapiKey, JsonConvert.SerializeObject(openAPIModelSettings));
                }
                return openAPIModelSettings;
            }
            else
            {
                openAPIModelSettings = JsonConvert.DeserializeObject<List<OpenAPIModelSetting>>(openApiSetting);
                return openAPIModelSettings;
            }
        }
        public async Task<bool> SaveOpenAPIModelSetting(string account, List<OpenAPIModelSetting> openAPIModelSetting)
        {
            string openapiKey = $"OpenAPI_{account}";
            //删除用户原有的设置
            _context.OpenAPIModelSettings.RemoveRange(_context.OpenAPIModelSettings.Where(x => x.Account == account));
            //写入新的配置
            foreach (var item in openAPIModelSetting)
            {
                OpenAPIModelSetting openAPIModel = new OpenAPIModelSetting
                {
                    Account = account,
                    FromModelName = item.FromModelName,
                    ToModelName = item.ToModelName
                };
                _context.OpenAPIModelSettings.Add(openAPIModel);
            }
            _context.SaveChanges();
            //更新缓存
            var newSettings = _context.OpenAPIModelSettings.Where(x => x.Account == account);
            await _redisService.SetAsync(openapiKey, JsonConvert.SerializeObject(newSettings));
            return true;
        }
        #region workflow通用函数
        private static string FillJsonTemplate(string jsonTemplate, Dictionary<string, string> parameters)
        {
            string pattern = @"{{(\w+)}}";

            string filledJson = Regex.Replace(jsonTemplate, pattern, match =>
            {
                string key = match.Groups[1].Value;
                if (parameters.TryGetValue(key, out string value))
                {
                    return value;
                }
                else
                {
                    return match.Value; // 如果字典中没有对应的值,保留原样
                }
            });

            return filledJson;
        }
        private static string GenerateJson(string objectName, Dictionary<string, string> data)
        {
            var jsonBuilder = new StringBuilder();
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"{objectName}\":");
            jsonBuilder.Append("{");

            int count = 0;
            foreach (var pair in data)
            {
                jsonBuilder.Append($"\"{pair.Key}\":");

                if (int.TryParse(pair.Value, out int intValue))
                {
                    jsonBuilder.Append(intValue);
                }
                else
                {
                    jsonBuilder.Append($"\"{pair.Value}\"");
                }

                count++;
                if (count < data.Count)
                {
                    jsonBuilder.Append(",");
                }
            }

            jsonBuilder.Append("}");
            jsonBuilder.Append("}");

            return jsonBuilder.ToString();
        }
        #endregion
    }
}
