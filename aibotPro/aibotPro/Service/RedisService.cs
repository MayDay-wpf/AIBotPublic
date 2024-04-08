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

        public bool CheckRedis()
        {
            try
            {
                IDatabase db = _redis.GetDatabase();

                // 执行一个简单的 Redis 命令,如 PING
                TimeSpan pingTime = db.Ping();

                // 如果 PING 命令返回的时间间隔大于等于 TimeSpan.Zero,说明 Redis 连接成功
                return pingTime >= TimeSpan.Zero;
            }
            catch (Exception)
            {
                // 发生异常,说明连接失败
                return false;
            }
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
