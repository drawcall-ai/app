import { PrismaClient, type Prisma } from "prisma-client";

export { type Job } from "prisma-client";

export const db = new PrismaClient();

export type JobUpdateInput = Prisma.JobUpdateInput;
