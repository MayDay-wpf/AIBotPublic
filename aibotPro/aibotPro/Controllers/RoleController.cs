using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using System.Security.Principal;

namespace aibotPro.Controllers
{
    public class RoleController : Controller
    {
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly ISystemService _systemService;
        private readonly IRoleService _roleService;
        private readonly IRedisService _redisService;
        private readonly IAiServer _aiServer;
        public RoleController(JwtTokenManager jwtTokenManager, ISystemService systemService, IRoleService roleService, IRedisService redisService, IAiServer aiServer)
        {
            _jwtTokenManager = jwtTokenManager;
            _systemService = systemService;
            _roleService = roleService;
            _redisService = redisService;
            _aiServer = aiServer;
        }
        public IActionResult RoleChat()
        {
            return View();
        }
        public IActionResult RoleList()
        {
            return View();
        }
        public IActionResult CustomRole()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        //上传头像
        public IActionResult UploadAvatar([FromForm] IFormFile file)
        {
            //保存图片
            string path = Path.Combine("wwwroot/files/roleavatar", $"{DateTime.Now.ToString("yyyyMMdd")}");   //$"wwwroot\\files\\pluginavatar\\{DateTime.Now.ToString("yyyyMMdd")}";
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
        //保存角色设置
        public IActionResult SaveRole(RoleSettingDto roleSetting)
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
            string errormsg = string.Empty;
            if (_roleService.SaveRole(username, roleSetting, out errormsg))
            {
                return Json(new
                {
                    success = true,
                    msg = errormsg
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = errormsg
                });
            }
        }
        [Authorize]
        [HttpPost]
        //保存测试角色到缓存
        public IActionResult SaveTestRole(RoleSettingDto roleSetting)
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
            //序列化
            //await _redisService.SetAsync("TestRole", JsonConvert.SerializeObject(roleSetting));
            _redisService.SetAsync($"TestRole_{username}", JsonConvert.SerializeObject(roleSetting), TimeSpan.FromHours(24));
            return Json(new
            {
                success = true,
                msg = $"TestRole_{username}"
            });
        }
        [Authorize]
        [HttpPost]
        //获取测试角色
        public IActionResult GetTestRole()
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
            //反序列化
            var role = _redisService.GetAsync($"TestRole_{username}").Result;
            if (role != null)
            {
                return Json(new
                {
                    success = true,
                    data = JsonConvert.DeserializeObject<RoleSettingDto>(role)
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "未找到测试角色"
                });
            }
        }
        [Authorize]
        [HttpPost]
        //写入对话
        public async Task<IActionResult> WriteChats(List<Dtos.RoleChat> roleChat)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            if (string.IsNullOrEmpty(username))
            {
                return Json(new
                {
                    success = false,
                    msg = "账号异常"
                });
            }
            if (roleChat != null && roleChat.Count > 0)
            {
                string ip = HttpContext.Connection.RemoteIpAddress.ToString();
                string chatId = $"{Guid.NewGuid().ToString().Replace("-", "")}U{username}IP{ip}";
                foreach (var item in roleChat)
                {
                    await _aiServer.SaveChatHistory(username, chatId, item.UserInput, Guid.NewGuid().ToString().Replace("-", ""), item.RoleChatCode, "user", "roletest");
                    await _aiServer.SaveChatHistory(username, chatId, item.AssistantOutput, Guid.NewGuid().ToString().Replace("-", ""), item.RoleChatCode, "assistant", "roletest");
                }
                return Json(new
                {
                    success = true,
                    msg = chatId
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
        //获取角色列表
        public IActionResult GetRoleList(int page, int pageSize, string name)
        {
            int total = 0;
            var list = _roleService.GetRoleList(page, pageSize, name, out total);
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
        //获取角色列表中的角色
        public IActionResult GetMarketRole(string roleCode)
        {
            var role = _roleService.GetRole(roleCode);
            if (role != null)
            {
                return Json(new
                {
                    success = true,
                    data = role
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
    }
}
