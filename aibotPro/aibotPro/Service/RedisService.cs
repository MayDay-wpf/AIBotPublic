using aibotPro.Dtos;
using aibotPro.Interface;
using StackExchange.Redis;

namespace aibotPro.Service;

public class RedisService : IRedisService
{
    private readonly IConfiguration _configuration;
    private readonly IDatabase _db;
    private readonly IConnectionMultiplexer _redis;

    public RedisService(IConnectionMultiplexer redis, IConfiguration configuration)
    {
        _redis = redis;
        _configuration = configuration;
        var dbIndex = Convert.ToInt32(configuration["Redis:DbIndex"]);
        _db = _redis.GetDatabase(dbIndex);
    }

    public bool CheckRedis()
    {
        try
        {
            var pingTime = _db.Ping();

            // 如果 PING 命令返回的时间间隔大于等于 TimeSpan.Zero,说明 Redis 连接成功
            return pingTime >= TimeSpan.Zero;
        }
        catch (Exception)
        {
            // 发生异常,说明连接失败
            return false;
        }
    }

    public async Task SetAsync(string key, string value,
        TimeSpan? expiry = null,
        AIBotProEnum.HashFieldOperationMode mode = AIBotProEnum.HashFieldOperationMode.Overwrite)
    {
        switch (mode)
        {
            case AIBotProEnum.HashFieldOperationMode.Overwrite:
                await _db.StringSetAsync(key, value, expiry, flags: CommandFlags.DemandMaster);
                break;
            case AIBotProEnum.HashFieldOperationMode.Append:
                var currentValue = await _db.StringGetAsync(key, flags: CommandFlags.PreferMaster);
                // 使用原始的字符串累积拼接方式
                var appendedValue = currentValue.IsNullOrEmpty ? value : $"{currentValue}{value}";
                await _db.StringSetAsync(key, appendedValue, expiry, flags: CommandFlags.DemandMaster);
                break;
            case AIBotProEnum.HashFieldOperationMode.NumericAdd:
                if (!double.TryParse(value, out double numberToAdd))
                {
                    throw new ArgumentException("Value must be a numeric string for NumericAdd operation.");
                }

                var currentNumericValue = await _db.StringGetAsync(key, flags: CommandFlags.PreferMaster);
                double currentNumber = currentNumericValue.IsNullOrEmpty ? 0 : double.Parse(currentNumericValue);
                double newNumber = currentNumber + numberToAdd;
                await _db.StringSetAsync(key, newNumber.ToString(), expiry, flags: CommandFlags.DemandMaster);
                break;
            default:
                throw new NotSupportedException($"Unsupported operation mode: {mode}");
        }
    }

    public async Task<string?> GetAsync(string key)
    {
        return await _db.StringGetAsync(key);
    }

    public async Task<bool> DeleteAsync(string key)
    {
        return await _db.KeyDeleteAsync(key, CommandFlags.DemandMaster);
    }

    // 新增或更新哈希表中的字段
    public async Task SetHashFieldAsync(string hashTableName, string field, string value,
        AIBotProEnum.HashFieldOperationMode mode = AIBotProEnum.HashFieldOperationMode.Overwrite)
    {
        switch (mode)
        {
            case AIBotProEnum.HashFieldOperationMode.Overwrite:
                await _db.HashSetAsync(hashTableName, field, value);
                break;
            case AIBotProEnum.HashFieldOperationMode.Append:
                var currentValue = await _db.HashGetAsync(hashTableName, field);
                var appendedValue = currentValue.IsNullOrEmpty ? value : $"{currentValue}{value}";
                await _db.HashSetAsync(hashTableName, field, appendedValue);
                break;
            case AIBotProEnum.HashFieldOperationMode.NumericAdd:
                double numberToAdd;
                if (!double.TryParse(value, out numberToAdd))
                {
                    throw new ArgumentException("Value must be a numeric string for NumericAdd operation.");
                }

                var currentNumericValue = await _db.HashGetAsync(hashTableName, field);
                double currentNumber = currentNumericValue.IsNullOrEmpty ? 0 : double.Parse(currentNumericValue);
                double newNumber = currentNumber + numberToAdd;
                await _db.HashSetAsync(hashTableName, field, newNumber.ToString());
                break;
            default:
                throw new NotSupportedException($"Unsupported operation mode: {mode}");
        }
    }

    // 通用的获取哈希表中的所有字段
    public async Task<HashEntry[]> GetHashFieldsAsync(string hashTableName)
    {
        return await _db.HashGetAllAsync(hashTableName);
    }

    // 根据特定字段名查询哈希表中的字段值
    public async Task<RedisValue> GetHashFieldAsync(string hashTableName, string field)
    {
        return await _db.HashGetAsync(hashTableName, field);
    }

    // 根据条件查询哈希表中的数据
    public async Task<Dictionary<string, string>> QueryHashFieldsAsync(string hashTableName,
        Func<HashEntry, bool> predicate)
    {
        var hashEntries = await _db.HashGetAllAsync(hashTableName);
        var result = hashEntries
            .Where(predicate)
            .ToDictionary(entry => (string)entry.Name, entry => (string)entry.Value);
        return result;
    }

    // 删除哈希表中的某个字段
    public async Task<bool> DeleteHashFieldAsync(string hashTableName, string field)
    {
        return await _db.HashDeleteAsync(hashTableName, field);
    }

    // 删除整个哈希表
    public async Task<bool> DeleteHashAsync(string hashTableName)
    {
        return await _db.KeyDeleteAsync(hashTableName);
    }
}