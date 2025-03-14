﻿using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NuGet.Protocol.Plugins;

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
        private readonly IFinanceService _financeService;
        public WorkShopController(AIBotProContext context, ISystemService systemService, JwtTokenManager jwtTokenManager, IWorkShop workShop, IUsersService usersService, IRedisService redisService, IFinanceService financeService)
        {
            _context = context;
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _workShop = workShop;
            _usersService = usersService;
            _redisService = redisService;
            _financeService = financeService;
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
                //删除原有的Json模板
                var oldPrJson = _context.PluginsJsonPrs.Where(x => x.PrCode == oldPlugin.Pcode);
                if (oldPrJson != null)
                {
                    _context.PluginsJsonPrs.RemoveRange(oldPrJson);
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
                Models.Plugin pluginEntity = new Models.Plugin
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
                            PrType = item.ParamType,
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
                    _ = _redisService.DeleteAsync(plugin.WorkFlowCode).Result;
                }
                _context.SaveChanges();
                if (plugin.IsPublic == "yes")
                    return Json(new { success = true, msg = "插件已发布", pcode = plugin.Pcode });
                else
                    return Json(new { success = true, msg = "插件已存入草稿，请前往【我的制作】查看", pcode = plugin.Pcode });
            }
            catch (Exception e)
            {
                return Json(new { success = false, msg = e.Message });
            }
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> PushtoPlugin(string plugincode, string workflowcode)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            //从缓存中获取工作流数据
            var nodeData = await _redisService.GetAsync(workflowcode);
            //如果缓存中没有，则抛出异常
            if (string.IsNullOrEmpty(nodeData))
            {
                return Json(new { success = false, msg = "工作流数据未保存" });
            }
            //删除原有的流程数据
            var oldwork = _context.WorkFlows.Where(w => w.FlowCode == workflowcode && w.Pcode == plugincode).FirstOrDefault();
            if (oldwork == null)
                return Json(new { success = false, msg = "工作流与插件匹配错误" });
            _context.WorkFlows.Remove(oldwork);
            //写入新的数据
            WorkFlow workFlow = new WorkFlow
            {
                Account = username,
                FlowCode = workflowcode,
                Pcode = plugincode,
                FlowJson = nodeData,
                CreateTime = DateTime.Now
            };
            _context.WorkFlows.Add(workFlow);
            _context.SaveChanges();
            return Json(new { success = true, msg = "工作流已发布至插件" });
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
        public IActionResult SetMandatoryHit(int id, bool mustHit)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool status = _workShop.SetMandatoryHit(username, id, mustHit);
            //返回数据
            return Json(new
            {
                success = status,
                msg = status ? "更新成功" : "更新失败"
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
        public IActionResult ControlRelease(int id, string type)
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
            plugin.IsPublic = type;
            _context.SaveChanges();
            return Json(new { success = true, msg = "操作成功" });
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
            var aiModelSeq = _systemService.GetWorkShopAImodelSeq(username);
            //如果有设置模型顺序，则按照设置的顺序返回
            if (aiModelSeq != null && aiModelSeq.Count > 0)
            {
                foreach (var item in aiModelSeq)
                {
                    var model = aiModel_lst.Find(x => x.ModelName == item.ModelName);
                    if (model != null)
                        model.Seq = item.Seq;
                }
            }

            //重新排序
            aiModel_lst.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
            //移除BaseURL和ApiKey
            aiModel_lst.ForEach(x =>
            {
                x.BaseUrl = string.Empty;
                x.ApiKey = string.Empty;
                x.Delay = 0;
                x.AdminPrompt = string.Empty;
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
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetFreePlan()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = await _financeService.GetFreePlan(username);
            return Json(new
            {
                success = true,
                data = result
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetFreePlanInfo()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var systemCfg = _systemService.GetSystemCfgs();
            var freeModel = systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel").FirstOrDefault();
            var freeCount = systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_Count").FirstOrDefault();
            var freeCountVIP = systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_Count_VIP").FirstOrDefault();
            var freePlanUpdate = systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_UpdateHour").FirstOrDefault();
            var nextRefreshTime = await _financeService.GetFreePlan(username);
            DateTime dateTime = DateTime.MaxValue;
            if (nextRefreshTime != null)
            {
                dateTime = nextRefreshTime.ExpireTime;
            }
            if (freeModel != null && freeCount != null && freeCountVIP != null && freePlanUpdate != null)
            {
                return Json(new
                {
                    success = true,
                    freeCount = freeCount.CfgValue,
                    freeCountVIP = freeCountVIP.CfgValue,
                    freeModel = freeModel.CfgValue,
                    freePlanUpdate = freePlanUpdate.CfgValue,
                    nextRefreshTime = dateTime
                });
            }
            else
            {
                return Json(new
                {
                    success = false
                });
            }

        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> InstallOrUninstallSystemPlugins(string pluginName, bool status)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = await _workShop.InstallOrUninstallSystemPlugins(username, pluginName, status);
            return Json(new
            {
                success = result
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetSystemPluginsInstall()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = await _workShop.GetSystemPluginsInstall(username);
            return Json(new
            {
                success = true,
                data = result
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult SaveWorkShopModelSeq(List<ChatModelSeq> ChatModelSeq)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            return Json(new
            {
                success = _usersService.SaveWorkShopModelSeq(username, ChatModelSeq, out string errormsg),
                msg = errormsg
            });
        }

    }
}
