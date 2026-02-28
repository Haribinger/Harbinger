import { describe, it, expect } from 'vitest'
import { parseJWT, isTokenExpired } from '../authStore'

// Helper: build a minimal 3-part JWT from an arbitrary payload object.
// The header and signature are synthetic — only the payload matters for
// client-side parsing and expiry checks.
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

// ---------------------------------------------------------------------------
// parseJWT
// ---------------------------------------------------------------------------

describe('parseJWT', () => {
  it('returns user data for valid token', () => {
    const token = makeToken({
      user_id: 'u1',
      username: 'testuser',
      email: 'test@example.com',
      provider: 'github',
    })

    const result = parseJWT(token)

    expect(result).not.toBeNull()
    expect(result?.success).toBe(true)
    if (result?.success) {
      expect(result.data!.id).toBe('u1')
      expect(result.data!.username).toBe('testuser')
      expect(result.data!.email).toBe('test@example.com')
      expect(result.data!.provider).toBe('github')
    }
  })

  it('returns null for token with wrong number of parts', () => {
    expect(parseJWT('abc')).toBeNull()
    expect(parseJWT('a.b')).toBeNull()
  })

  it('returns null for invalid base64 payload', () => {
    // Middle segment contains characters that are not valid base64
    const result = parseJWT('a.!!!invalid!!!.c')
    expect(result).toBeNull()
  })

  it('returns null for payload missing user_id', () => {
    const token = makeToken({ username: 'testuser', email: 'test@example.com' })
    expect(parseJWT(token)).toBeNull()
  })

  it('returns null for payload missing username', () => {
    const token = makeToken({ user_id: 'u1', email: 'test@example.com' })
    expect(parseJWT(token)).toBeNull()
  })

  it('fills empty email and provider with empty strings', () => {
    const token = makeToken({ user_id: 'u1', username: 'testuser' })

    const result = parseJWT(token)

    expect(result).not.toBeNull()
    expect(result?.success).toBe(true)
    if (result?.success) {
      expect(result.data!.email).toBe('')
      expect(result.data!.provider).toBe('')
    }
  })
})

// ---------------------------------------------------------------------------
// isTokenExpired
// ---------------------------------------------------------------------------

describe('isTokenExpired', () => {
  it('returns false for future exp', () => {
    const token = makeToken({
      user_id: 'u1',
      username: 'testuser',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    expect(isTokenExpired(token)).toBe(false)
  })

  it('returns true for past exp', () => {
    const token = makeToken({
      user_id: 'u1',
      username: 'testuser',
      exp: Math.floor(Date.now() / 1000) - 3600,
    })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true for invalid token', () => {
    expect(isTokenExpired('garbage')).toBe(true)
  })

  it('returns true when exp is missing', () => {
    const token = makeToken({ user_id: 'u1', username: 'testuser' })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true when exp is not a number', () => {
    const token = makeToken({ user_id: 'u1', username: 'testuser', exp: 'not-a-number' })
    expect(isTokenExpired(token)).toBe(true)
  })
})
