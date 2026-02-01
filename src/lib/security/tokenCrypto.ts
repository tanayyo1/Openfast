import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export class TokenCryptoError extends Error {
  code:
    | 'MISSING_KEY'
    | 'INVALID_KEY'
    | 'INVALID_PAYLOAD'
    | 'DECRYPT_FAILED'

  constructor(code: TokenCryptoError['code'], message: string) {
    super(message)
    this.code = code
  }
}

type Keyring = Record<string, Buffer>

function parseKeyring(envValue: string | undefined): Keyring {
  if (!envValue) return {}

  // Format:
  //   TOKEN_ENCRYPTION_KEYS="v1:<base64>,v2:<base64>"
  // Each key must decode to 32 bytes (AES-256).
  const keyring: Keyring = {}
  for (const part of envValue.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [keyId, b64] = part.split(':')
    if (!keyId || !b64) continue
    const key = Buffer.from(b64, 'base64')
    if (key.length !== 32) continue
    keyring[keyId] = key
  }
  return keyring
}

function base64urlEncode(buf: Buffer) {
  return buf.toString('base64url')
}

function base64urlDecode(value: string) {
  return Buffer.from(value, 'base64url')
}

export function getTokenKeyring() {
  return parseKeyring(process.env.TOKEN_ENCRYPTION_KEYS)
}

export function encryptToken(plaintext: string, opts?: { keyId?: string; keyring?: Keyring }) {
  const keyring = opts?.keyring ?? getTokenKeyring()
  const keyId = opts?.keyId ?? Object.keys(keyring)[0]
  if (!keyId) {
    throw new TokenCryptoError('MISSING_KEY', 'No token encryption keys configured')
  }

  const key = keyring[keyId]
  if (!key || key.length !== 32) {
    throw new TokenCryptoError('INVALID_KEY', `Invalid token encryption key: ${keyId}`)
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // Payload format:
  //   rfenc.<keyId>.<iv>.<ciphertext>.<tag>
  return `rfenc.${keyId}.${base64urlEncode(iv)}.${base64urlEncode(ciphertext)}.${base64urlEncode(tag)}`
}

export function decryptToken(payload: string, opts?: { keyring?: Keyring }) {
  const keyring = opts?.keyring ?? getTokenKeyring()
  const parts = payload.split('.')
  if (parts.length !== 5 || parts[0] !== 'rfenc') {
    throw new TokenCryptoError('INVALID_PAYLOAD', 'Invalid token payload format')
  }

  const [, keyId, ivB64u, ctB64u, tagB64u] = parts
  const key = keyring[keyId]
  if (!key || key.length !== 32) {
    throw new TokenCryptoError('MISSING_KEY', `Missing token encryption key: ${keyId}`)
  }

  let iv: Buffer
  let ciphertext: Buffer
  let tag: Buffer
  try {
    iv = base64urlDecode(ivB64u)
    ciphertext = base64urlDecode(ctB64u)
    tag = base64urlDecode(tagB64u)
  } catch {
    throw new TokenCryptoError('INVALID_PAYLOAD', 'Invalid token payload encoding')
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    return plaintext
  } catch {
    throw new TokenCryptoError('DECRYPT_FAILED', 'Failed to decrypt token payload')
  }
}

export function redactSecret(value: string, opts?: { head?: number; tail?: number }) {
  const head = opts?.head ?? 4
  const tail = opts?.tail ?? 4
  if (!value) return ''
  if (value.length <= head + tail + 3) return '[REDACTED]'
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

