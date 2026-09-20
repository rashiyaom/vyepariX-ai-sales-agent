import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  enableOfflineQueue: false, // Do not hang HTTP requests when Redis is unavailable
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 5) {
      return 15000; // back off to 15s
    }
    return Math.min(times * 1000, 5000);
  },
  reconnectOnError() {
    return false;
  },
});

let loggedRedisWarn = false;
redis.on("connect", () => {
  console.log("[Redis] Connected");
  loggedRedisWarn = false;
});
redis.on("error", (err: Error) => {
  if (!loggedRedisWarn) {
    console.warn(`[Redis] Note: Local Redis not running (${err.message}). Queue workers will operate in standby.`);
    loggedRedisWarn = true;
  }
});
