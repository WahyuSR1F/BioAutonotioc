import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, rStr, pStr, saltB64, hashB64] = stored.split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = scryptSync(password, salt, expected.length, {
      N: parseInt(nStr, 10),
      r: parseInt(rStr, 10),
      p: parseInt(pStr, 10),
    })
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
