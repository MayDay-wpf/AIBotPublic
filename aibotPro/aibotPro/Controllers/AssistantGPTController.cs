using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers
{
    public class AssistantGPTController : Controller
    {
        // GET: AssistantGPTController
        public ActionResult AssistantChat()
        {
            return View();
        }
        public ActionResult AssistantSetting()
        {
            return View();
        }
    }
}
