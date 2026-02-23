import { loadEnvConfig } from "@next/env";

// Match Next.js runtime env resolution so worker:dev can run without
// manually sourcing .env.local in the shell.
loadEnvConfig(process.cwd());

async function main() {
  try {
    await import("../src/workers/index");
  } catch (err) {
    console.error("Worker startup failed:", err);
    process.exitCode = 1;
  }
}

void main();
