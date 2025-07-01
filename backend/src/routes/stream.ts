//TODO: receive stream from redis


const redisPublish: RedisClientType = createClient({
    url: process.env.REDIS_URL!,
  });
  const redisSubscribe: RedisClientType = createClient({
    url: process.env.REDIS_URL!,
  });
  redisPublish.on("error", (error) => logger.error(error, "Redis client error"));
  redisSubscribe.on("error", (error) =>
    logger.error(error, "Redis client error")
  );