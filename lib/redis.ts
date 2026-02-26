import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    if (!REDIS_URL) {
      throw new Error('REDIS_URL 环境变量未配置');
    }
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('error', (err) => {
      console.error('[Redis] 连接错误:', err.message);
    });
  }
  return redis;
}
