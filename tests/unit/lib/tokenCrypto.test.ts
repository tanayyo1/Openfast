import {
  decryptToken,
  encryptToken,
  redactSecret,
  TokenCryptoError,
} from "@/lib/security/tokenCrypto";

function keyring(keys: Record<string, Buffer>) {
  return keys;
}

describe("tokenCrypto", () => {
  test("encrypt/decrypt roundtrip", () => {
    const keys = keyring({ v1: Buffer.alloc(32, 1) });
    const payload = encryptToken("hello", { keyId: "v1", keyring: keys });
    expect(payload.startsWith("rfenc.v1.")).toBe(true);
    expect(decryptToken(payload, { keyring: keys })).toBe("hello");
  });

  test("decrypt fails with wrong key", () => {
    const keys = keyring({ v1: Buffer.alloc(32, 1), v2: Buffer.alloc(32, 2) });
    const payload = encryptToken("secret", { keyId: "v1", keyring: keys });
    expect(() => decryptToken(payload, { keyring: { v1: keys.v2 } })).toThrow(
      TokenCryptoError,
    );
  });

  test("invalid payload format throws", () => {
    const keys = keyring({ v1: Buffer.alloc(32, 1) });
    expect(() => decryptToken("bad", { keyring: keys })).toThrow(
      TokenCryptoError,
    );
  });

  test("redactSecret masks value", () => {
    expect(redactSecret("abcdefghijklmnopqrstuvwxyz")).toBe("abcd...wxyz");
    expect(redactSecret("short")).toBe("[REDACTED]");
  });
});
