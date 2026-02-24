import { supabase } from './supabase'
import type { CompletedStroke } from '@/types/drawing'

const TTL_MS = 86_400_000 // 24 hours

export interface StoredDrawing {
  strokes: CompletedStroke[]
  created_at: string
  updated_at: string
  expires_at: string
}

export async function getDrawing(id: string): Promise<StoredDrawing | null> {
  const { data, error } = await supabase
    .from('drawings')
    .select('strokes, created_at, updated_at, expires_at')
    .eq('id', id)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) return null
  return data as StoredDrawing
}

export async function createDrawing(id: string, strokes: CompletedStroke[]): Promise<string> {
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString()
  const { error } = await supabase.from('drawings').insert({
    id,
    strokes,
    expires_at: expiresAt,
  })
  if (error) throw new Error(error.message)
  return expiresAt
}

export async function updateDrawing(id: string, strokes: CompletedStroke[]): Promise<string | null> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_MS).toISOString()

  const { data, error } = await supabase
    .from('drawings')
    .update({
      strokes,
      updated_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .eq('id', id)
    .gt('expires_at', now.toISOString()) // reject if already expired
    .select('expires_at')
    .single()

  if (error || !data) return null
  return data.expires_at as string
}
