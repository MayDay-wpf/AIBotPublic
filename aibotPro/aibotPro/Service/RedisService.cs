using aibotPro.Interface;
using StackExchange.Redis;

namespace aibotPro.Service
{
    public class RedisService : IRedisService
    {
        private readonly IConnectionMultiplexer _redis;

        public RedisService(IConnectionMultiplexer redis)
        {
            _redis = redis;
        }

        public async Task SetAsync(string key, string value, TimeSpan? expiry = null)
        {
            var db = _redis.GetDatabase(5);
            await db.StringSetAsync(key, value, expiry);
        }

        public async Task<string?> GetAsync(string key)
        {
            var db = _redis.GetDatabase(5);
            return await db.StringGetAsync(key);
        }

        public async Task<bool> DeleteAsync(string key)
        {
            var db = _redis.GetDatabase(5);
            return await db.KeyDeleteAsync(key);
        }
    }
}
