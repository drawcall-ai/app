import { FastifyRequest } from "fastify";
import { redisClient, polarClient } from "./auth.js";
import { db } from "./db/index.js";

export async function getJobRequestQuota(
  userId: string,
  hasPolarAppBenefit: boolean
) {
  const monthlyRequestQuota = hasPolarAppBenefit ? 50 : 1;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const jobRequests = await db.job.count({
    where: {
      userId,
      createdAt: {
        gte: startOfMonth,
        lt: endOfMonth,
      },
    },
  });
  return Math.max(0, monthlyRequestQuota - jobRequests);
}

function buildHasPolarAppBenefitRedisKey(userId: string) {
  return `${userId}:polar-app-benefit`;
}

export async function invalidateHasPolarAppBenefit(userId: string) {
  await redisClient.del(buildHasPolarAppBenefitRedisKey(userId));
}

export async function hasPolarAppBenefit(userId: string, isAnonymous: boolean) {
  if (isAnonymous) {
    return false;
  }
  const polarAppBenefitEntry = await redisClient.get(
    buildHasPolarAppBenefitRedisKey(userId)
  );
  if (polarAppBenefitEntry != null) {
    return polarAppBenefitEntry === "true";
  }
  const customerState = await polarClient.customers.getStateExternal({
    externalId: userId,
  });
  const hasPolarAppBenefit = customerState.grantedBenefits.some(
    (benefit) => benefit.benefitId === process.env.POLAR_APP_BENEFIT_ID
  );
  //5 minute TTL
  redisClient.setEx(
    buildHasPolarAppBenefitRedisKey(userId),
    5 * 60,
    hasPolarAppBenefit ? "true" : "false"
  );
  return hasPolarAppBenefit;
}
