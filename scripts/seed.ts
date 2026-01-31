import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";

const prisma = new PrismaClient();
const scrypt = promisify(_scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

async function main() {
  const email = "seed@reditfast.local";
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) return;

  const passwordHash = await hashPassword("password1234");

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: "Seed User",
      },
      select: { id: true },
    });

    const workspace = await tx.workspace.create({
      data: {
        name: "Seed Workspace",
        ownerId: user.id,
      },
      select: { id: true },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
      select: { id: true },
    });

    await tx.workspaceEntitlement.create({
      data: { workspaceId: workspace.id },
      select: { id: true },
    });
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
