using aibotPro.Dtos;
using StackExchange.Redis;

namespace aibotPro.Interface
{
    public interface IRedisService
    {
        Task SetAsync(string key, string value,
            TimeSpan? expiry = null,
            AIBotProEnum.HashFieldOperationMode mode = AIBotProEnum.HashFieldOperationMode.Overwrite);
        Task<string?> GetAsync(string key);
        Task<bool> DeleteAsync(string key);

        Task SetHashFieldAsync(string hashTableName, string field, string value,
            AIBotProEnum.HashFieldOperationMode mode = AIBotProEnum.HashFieldOperationMode.Overwrite);
        Task<HashEntry[]> GetHashFieldsAsync(string hashTableName);
        Task<RedisValue> GetHashFieldAsync(string hashTableName, string field);

        Task<Dictionary<string, string>> QueryHashFieldsAsync(string hashTableName,
            Func<HashEntry, bool> predicate);

        Task<bool> DeleteHashFieldAsync(string hashTableName, string field);
        Task<bool> DeleteHashAsync(string hashTableName);
        bool CheckRedis();
    }
}