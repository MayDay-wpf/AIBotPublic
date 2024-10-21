using COSXML.Model.Object;

namespace aibotPro.Interface
{
    public interface ICOSService
    {
        string PutObject(string key, string srcPath, string fileName);
        bool DeleteObject(string key);
    }
}
