using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers
{
    public class WorkShopController : Controller
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IWorkShop _workShop;
        private readonly IUsersService _usersService;
        private readonly IRedisService _redisService;
        public WorkShopController(AIBotProContext context, ISystemService systemService, JwtTokenManager jwtTokenManager, IWorkShop workShop, IUsersService usersService, IRedisService redisService)
        {
            _context = context;
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _workShop = workShop;
            _usersService = usersService;
            _redisService = redisService;
        }

        public IActionResult WorkShopChat()
        {
            return View();
        }
        public IActionResult WorkShopMarket()
        {
            return View();
        }
        public IActionResult MyWork()
        {
            return View();
        }
        public IActionResult MyPlugins()
        {
            return View();
        }
        public IActionResult OpenAPI()
        {
            return View();
        }
        public IActionResult WorkFlow()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public IActionResult PostPlugin(WorkShopPlugin plugin)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            if (string.IsNullOrEmpty(username))
            {
                return Json(new
                {
                    success = false,
                    msg = "账号异常"
                });
            }
            bool isUpdate = false;
            //判断是否有plugincode
            if (string.IsNullOrEmpty(plugin.Pcode))
            {
                //没有则为新插件，查询方法名是否重复
                var oldPlugin = _context.Plugins.Where(x => x.Pfunctionname == plugin.Pfunctionname).FirstOrDefault();
                if (oldPlugin != null)
                {
                    return Json(new { success = false, msg = "方法名与其他插件重复" });
                }
                //没有则生成
                plugin.Pcode = Guid.NewGuid().ToString();
            }
            else
            {
                //判断用户是否为插件作者
                var oldPlugin = _context.Plugins.Where(x => x.Pcode == plugin.Pcode && x.Account == username).FirstOrDefault();
                if (oldPlugin == null)
                {
                    return Json(new { success = false, msg = "非法操作" });
                }
                //有则为更新插件
                isUpdate = true;
            }
            //如果是更新插件则删除原有插件
            if (isUpdate)
            {
                var oldPlugin = _context.Plugins.Where(x => x.Pcode == plugin.Pcode).FirstOrDefault();
                if (oldPlugin != null)
                {
                    _context.Plugins.Remove(oldPlugin);
                }
                //删除原有参数
                var oldParam = _context.PluginsParams.Where(x => x.PrCode == oldPlugin.ParamCode);
                if (oldParam != null)
                {
                    _context.PluginsParams.RemoveRange(oldParam);
                }
                //删除原有请求头
                var oldPheaders = _context.PluginsHeaders.Where(x => x.HdCode == oldPlugin.PheadersCode);
                if (oldPheaders != null)
                {
                    _context.PluginsHeaders.RemoveRange(oldPheaders);
                }
                //删除原有Cookie
                var oldPcookies = _context.PluginsCookies.Where(x => x.CkCode == oldPlugin.PcookiesCode);
                if (oldPcookies != null)
                {
                    _context.PluginsCookies.RemoveRange(oldPcookies);
                }
                //删除原有workFlow
                var oldWorkFlow = _context.WorkFlows.Where(x => x.Pcode == oldPlugin.Pcode).FirstOrDefault();
                if (oldWorkFlow != null)
                {
                    _context.WorkFlows.Remove(oldWorkFlow);
                }
                _context.SaveChanges();
            }
            string paramCode = string.Empty;
            string pheadersCode = string.Empty;
            string pcookiesCode = string.Empty;
            //判断是否有参数
            if (plugin.Param != null && plugin.Param.Count > 0)
            {
                paramCode = Guid.NewGuid().ToString();
            }
            //判断是否有请求头
            if (plugin.Pheaders != null && plugin.Pheaders.Count > 0)
            {
                pheadersCode = Guid.NewGuid().ToString();
            }
            //判断是否有Cookie
            if (plugin.Pcookies != null && plugin.Pcookies.Count > 0)
            {
                pcookiesCode = Guid.NewGuid().ToString();
            }
            try
            {
                //写入Plugin主表
                Plugin pluginEntity = new Plugin
                {
                    Pcode = plugin.Pcode,
                    Account = username,
                    Pavatar = plugin.Pavatar,
                    Pnickname = plugin.Pnickname,
                    Pfunctionname = plugin.Pfunctionname,
                    Pfunctioninfo = plugin.Pfunctioninfo,
                    Popensource = plugin.Popensource,
                    Pluginprice = plugin.Pluginprice,
                    Pcodemodel = plugin.Pcodemodel,
                    Papiurl = plugin.Papiurl,
                    Pmethod = plugin.Pmethod,
                    ParamCode = paramCode,
                    PheadersCode = pheadersCode,
                    PcookiesCode = pcookiesCode,
                    Pjscode = _systemService.EncodeBase64(plugin.Pjscode),
                    PrunLocation = plugin.PrunLocation,
                    Pusehtml = plugin.Pusehtml,
                    IsPublic = plugin.IsPublic,
                    CreateTime = DateTime.Now
                };
                _context.Plugins.Add(pluginEntity);
                //写入PluginParam表
                if (plugin.Param != null)
                {
                    foreach (var item in plugin.Param)
                    {
                        PluginsParam pluginsParam = new PluginsParam
                        {
                            PrCode = paramCode,
                            PrName = item.ParamName,
                            PrInfo = item.ParamInfo,
                            PrConst = item.ParamConst
                        };
                        _context.PluginsParams.Add(pluginsParam);
                    }
                }
                //写入PluginHeader表
                if (plugin.Pheaders != null)
                {
                    foreach (var item in plugin.Pheaders)
                    {
                        PluginsHeader pluginsHeader = new PluginsHeader
                        {
                            HdCode = pheadersCode,
                            HdName = item.PheadersName,
                            HdValue = item.PheadersValue
                        };
                        _context.PluginsHeaders.Add(pluginsHeader);
                    }
                }
                //写入PluginCookie表
                if (plugin.Pcookies != null)
                {
                    foreach (var item in plugin.Pcookies)
                    {
                        PluginsCookie pluginsCookie = new PluginsCookie
                        {
                            CkCode = pcookiesCode,
                            CkName = item.PcookiesName,
                            CkValue = item.PcookiesValue
                        };
                        _context.PluginsCookies.Add(pluginsCookie);
                    }
                }
                //写入JsonPr表
                if (!string.IsNullOrEmpty(plugin.JsonPr) && plugin.Pmethod != "get")
                {
                    PluginsJsonPr jsonPr = new PluginsJsonPr
                    {
                        PrCode = plugin.Pcode,
                        JsonContent = plugin.JsonPr
                    };
                    _context.PluginsJsonPrs.Add(jsonPr);
                }
                //如果是工作流插件则写入工作流表   
                if (!string.IsNullOrEmpty(plugin.WorkFlowCode))
                {
                    //从缓存中获取工作流数据
                    var nodeData = _redisService.GetAsync(plugin.WorkFlowCode).Result;
                    //如果缓存中没有，则抛出异常
                    if (string.IsNullOrEmpty(nodeData))
                    {
                        return Json(new { success = false, msg = "工作流数据未保存" });
                    }

                    WorkFlow workFlow = new WorkFlow
                    {
                        Account = username,
                        FlowCode = plugin.WorkFlowCode,
                        Pcode = plugin.Pcode,
                        FlowJson = nodeData,
                        CreateTime = DateTime.Now
                    };
                    _context.WorkFlows.Add(workFlow);
                }
                _context.SaveChanges();
                if (plugin.IsPublic == "yes")
                    return Json(new { success = true, msg = "插件已发布" });
                else
                    return Json(new { success = true, msg = "插件已存入草稿，请前往【我的制作】查看" });
            }
            catch (Exception e)
            {
                return Json(new { success = false, msg = e.Message });
            }
        }
        [Authorize]
        [HttpPost]
        //上传头像
        public IActionResult UploadAvatar([FromForm] IFormFile file)
        {
            //保存图片
            string path = Path.Combine("wwwroot/files/pluginavatar", $"{DateTime.Now.ToString("yyyyMMdd")}");   //$"wwwroot\\files\\pluginavatar\\{DateTime.Now.ToString("yyyyMMdd")}";
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            if (string.IsNullOrEmpty(username))
            {
                return Json(new
                {
                    success = false,
                    msg = "账号异常"
                });
            }
            string fileName = _systemService.SaveFiles(path, file, username);
            //返回文件名
            return Json(new
            {
                success = true,
                filePath = fileName
            });
        }
        [Authorize]
        [HttpPost]
        //分页获取插件列表
        public IActionResult GetWorkShopPlugins(int page, int pageSize, string name)
        {
            int total = 0;
            var list = _workShop.GetWorkShopPlugins(page, pageSize, name, out total);
            //去除list中的敏感信息
            foreach (var item in list)
            {
                item.Pjscode = string.Empty;
                item.Pcode = string.Empty;
                item.Account = string.Empty;
                item.Papiurl = string.Empty;
            }
            //返回数据
            return Json(new
            {
                success = true,
                data = list,
                total = total
            });

        }
        [Authorize]
        [HttpPost]
        //安装插件
        public IActionResult InstallPlugin(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _workShop.InstallPlugin(username, id, out string errormsg);
            if (result)
            {
                return Json(new { success = true, msg = "安装成功" });
            }
            else
            {
                return Json(new { success = false, msg = errormsg });
            }
        }
        [Authorize]
        [HttpPost]
        //安装自己的插件
        public IActionResult InstallMyPlugin(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _workShop.InstallMyPlugin(username, id, out string errormsg);
            if (result)
            {
                return Json(new { success = true, msg = "安装成功" });
            }
            else
            {
                return Json(new { success = false, msg = errormsg });
            }
        }

        [Authorize]
        [HttpPost]
        //查看插件
        public IActionResult SeePlugin(int id, string pcode)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var plugin = _workShop.GetPlugin(id, username, pcode);
            return Json(new { success = true, data = plugin });
        }
        [Authorize]
        [HttpPost]
        //卸载插件
        public IActionResult UninstallPlugin(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _workShop.UninstallPlugin(username, id, out string errormsg);
            if (result)
            {
                return Json(new { success = true, msg = "卸载成功" });
            }
            else
            {
                return Json(new { success = false, msg = errormsg });
            }
        }
        [Authorize]
        [HttpPost]
        //查看已安装插件列表
        public IActionResult GetMyInstall()
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var list = _workShop.GetPluginInstall(username);
            //去除list中的敏感信息
            foreach (var item in list)
            {
                item.Pjscode = string.Empty;
                item.Pcode = string.Empty;
                item.Account = string.Empty;
                item.Papiurl = string.Empty;
            }
            //返回数据
            return Json(new
            {
                success = true,
                data = list
            });
        }
        [Authorize]
        [HttpPost]
        //获取自己的插件列表
        public IActionResult GetMyPlugins()
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var list = _workShop.GetPlugins(username);
            //返回数据
            return Json(new
            {
                success = true,
                data = list
            });
        }
        [Authorize]
        [HttpPost]
        //作者删除插件
        public IActionResult DeletePlugin(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _workShop.DeletePlugin(username, id, out string errormsg);
            if (result)
            {
                return Json(new { success = true, msg = "删除成功" });
            }
            else
            {
                return Json(new { success = false, msg = errormsg });
            }
        }
        [Authorize]
        [HttpPost]
        //作者下架插件
        public IActionResult CloseRelease(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var plugin = _context.Plugins.Where(x => x.Id == id && x.Account == username).FirstOrDefault();
            if (plugin == null)
            {
                return Json(new { success = false, msg = "插件不存在" });
            }
            if (plugin.Account != username)
            {
                return Json(new { success = false, msg = "非法操作" });
            }
            plugin.IsPublic = "no";
            _context.SaveChanges();
            return Json(new { success = true, msg = "下架成功" });
        }



        [Authorize]
        [HttpPost]
        //获取插件基底模型
        public IActionResult GetWorkShopAImodel()
        {
            List<WorkShopAIModel> aiModel_lst = new List<WorkShopAIModel>();
            //查询是否有对话设置
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatSetting = _usersService.GetChatSetting(username);
            if (chatSetting != null && chatSetting.MyChatModel != null && chatSetting.MyChatModel.Count > 0)
            {
                foreach (var item in chatSetting.MyChatModel)
                {
                    WorkShopAIModel aiModel = new WorkShopAIModel();
                    aiModel.ModelNick = item.ChatNickName;
                    aiModel.ModelName = item.ChatModel;
                    aiModel.BaseUrl = item.ChatBaseURL;
                    aiModel.ApiKey = item.ChatApiKey;
                    aiModel_lst.Add(aiModel);
                }
            }
            else
                aiModel_lst = _systemService.GetWorkShopAImodel();
            //移除BaseURL和ApiKey
            aiModel_lst.ForEach(x =>
            {
                x.BaseUrl = string.Empty;
                x.ApiKey = string.Empty;
            });
            return Json(new
            {
                success = true,
                data = aiModel_lst
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SaveNodeDataToCache(string workflowcode, string nodeData)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            var workflowAccount = _context.WorkFlows.Where(x => x.FlowCode == workflowcode).Select(x => x.Account).FirstOrDefault();
            if (!string.IsNullOrEmpty(workflowAccount))
            {
                if (username == workflowAccount)
                    await _redisService.SetAsync(workflowcode, nodeData, TimeSpan.FromHours(2));
                else
                    return Json(new { success = false, msg = "非工作流作者无法保存" });
            }
            else
                await _redisService.SetAsync(workflowcode, nodeData, TimeSpan.FromHours(2));
            return Json(new
            {
                success = true
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> NodeIsMine(string workflowcode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            var workflowAccount = _context.WorkFlows.Where(x => x.FlowCode == workflowcode).Select(x => x.Account).FirstOrDefault();
            if (!string.IsNullOrEmpty(workflowAccount))
            {
                if (username == workflowAccount)
                    return Json(new { success = true });
                else
                    return Json(new { success = false });
            }
            else
                return Json(new { success = true });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetWorkFlowNodeData(string workflowcode)
        {
            var result = await _workShop.GetWorkFlowNodeData(workflowcode);
            return Json(new
            {
                success = true,
                data = result
            });
        }

    }
}
