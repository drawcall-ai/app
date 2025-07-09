import { polarClient } from "./auth.js";
import { db } from "./db/index.js";
import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URL });
await client.connect();

export async function getJobRequestQuota(userId: string) {
  const monthlyRequestQuota = (await hasPolarAppBenefit(userId)) ? 50 : 1;

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

export async function hasPolarAppBenefit(userId: string) {
  const key = `${userId}:polar-app-benefit`;
  const polarAppBenefitEntry = await client.get(key);
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
  client.setEx(key, 5 * 60, hasPolarAppBenefit ? "true" : "false");
  return hasPolarAppBenefit;
}
