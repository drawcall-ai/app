import { db } from "./db/index.js";

export async function getJobRequestQuota(userId: string) {
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
  return Math.max(0, 50 - jobRequests);
}
