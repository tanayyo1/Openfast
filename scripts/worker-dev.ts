import { loadEnvConfig } from "@next/env";

// Match Next.js runtime env resolution so worker:dev can run without
// manually sourcing .env.local in the shell.
loadEnvConfig(process.cwd());

void import("../src/workers/index").catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
