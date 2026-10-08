import { cookies } from 'next/headers'
import { queryOne, str, strOrNull } from '@/lib/turso/client'
import { readSessionPayload, sessionExists } from '@/lib/auth/session'

export type AuthUser = {
  id: string
  email: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  store_slug: string | null
}

export async function getUser(): Promise<AuthUser | null> {
  const payload = readSessionPayload()
  if (!payload) return null

  const valid = await sessionExists(payload)
  if (!valid) return null

  const row = await queryOne<{
    id: string
    email: string
    display_name: unknown
    bio: unknown
    avatar_url: unknown
    store_slug: unknown
  }>(
    `SELECT u.id, u.email, p.display_name, p.bio, p.avatar_url, p.store_slug
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = ?`,
    [payload.uid]
  )
  if (!row) return null

  return {
    id: str(row.id),
    email: str(row.email),
    display_name: strOrNull(row.display_name),
    bio: strOrNull(row.bio),
    avatar_url: strOrNull(row.avatar_url),
    store_slug: strOrNull(row.store_slug),
  }
}

/** Untuk route handler: baca user dari cookie pada request tertentu */
export async function getUserFromStore(cookieStore: ReturnType<typeof cookies>): Promise<AuthUser | null> {
  const payload = readSessionPayload(cookieStore)
  if (!payload) return null

  const valid = await sessionExists(payload)
  if (!valid) return null

  const row = await queryOne<{ id: string; email: string; display_name: unknown; bio: unknown; avatar_url: unknown; store_slug: unknown }>(
    `SELECT u.id, u.email, p.display_name, p.bio, p.avatar_url, p.store_slug
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = ?`,
    [payload.uid]
  )
  if (!row) return null

  return {
    id: str(row.id),
    email: str(row.email),
    display_name: strOrNull(row.display_name),
    bio: strOrNull(row.bio),
    avatar_url: strOrNull(row.avatar_url),
    store_slug: strOrNull(row.store_slug),
  }
}
