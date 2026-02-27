import type { Plan } from "@prisma/client";

export function planFromPolarProductId(
  productId: string | null | undefined,
): Plan | null {
  if (!productId) return null;
  if (productId === process.env.POLAR_PRODUCT_PRO) return "PRO";
  if (productId === process.env.POLAR_PRODUCT_ENTERPRISE) return "ENTERPRISE";
  return null;
}
