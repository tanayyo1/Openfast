import { prisma } from "@/lib/prisma";
import { closeRedis } from "@/lib/redis";
import { closeAllQueues } from "@/lib/queue/queues";

afterAll(async () => {
  await Promise.allSettled([
    closeAllQueues(),
    closeRedis(),
    prisma.$disconnect(),
  ]);
});
