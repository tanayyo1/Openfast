import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scrypt = promisify(_scrypt)

type PasswordHashParts = {
  salt: Buffer
  hash: Buffer
}

function parsePasswordHash(stored: string): PasswordHashParts | null {
  // Format: scrypt$<saltHex>$<hashHex>
  const [algo, saltHex, hashHex] = stored.split('$')
  if (algo !== 'scrypt' || !saltHex || !hashHex) return null

  try {
    return {
      salt: Buffer.from(saltHex, 'hex'),
      hash: Buffer.from(hashHex, 'hex'),
    }
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = parsePasswordHash(stored)
  if (!parts) return false

  const derived = (await scrypt(password, parts.salt, 64)) as Buffer
  if (derived.length !== parts.hash.length) return false
  return timingSafeEqual(derived, parts.hash)
}

