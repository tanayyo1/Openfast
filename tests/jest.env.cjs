const fs = require("fs");
const path = require("path");

function parseEnvFile(contents) {
  const lines = contents.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    if (!key) continue;

    let value = line.slice(idx + 1).trim();
    // Strip surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadIfExists(relPath) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  parseEnvFile(fs.readFileSync(fullPath, "utf8"));
}

// Load order: test-specific overrides first, then local developer values.
loadIfExists(".env.test");
loadIfExists(".env.local");
