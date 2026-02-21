import { existsSync, readFileSync } from "fs";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const envLocalPath = `${process.cwd()}/.env.local`;
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

const { prisma } = require("@/lib/prisma");
const { closeRedis } = require("@/lib/redis");
const { closeAllQueues } = require("@/lib/queue/queues");

afterAll(async () => {
  await Promise.allSettled([
    closeAllQueues(),
    closeRedis(),
    prisma.$disconnect(),
  ]);
});
