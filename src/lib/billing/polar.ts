import { Polar } from "@polar-sh/sdk";

let polarClient: Polar | null = null;

export function getPolar(): Polar {
  if (polarClient) return polarClient;
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_NOT_CONFIGURED");
  polarClient = new Polar({
    accessToken: token,
    server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
  });
  return polarClient;
}
