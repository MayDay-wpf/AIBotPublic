namespace aibotPro.Interface
{
    public interface IRedisService
    {
        Task SetAsync(string key, string value, TimeSpan? expiry = null);
        Task<string?> GetAsync(string key);
        Task<bool> DeleteAsync(string key);
    }
}
