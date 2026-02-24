import { supabaseServer } from './supabase-server'
import type { CompletedStroke } from '@/types/drawing'

const TTL_MS = 86_400_000 // 24 hours

export interface StoredDrawing {
  id: string
  strokes: CompletedStroke[]
  animation_code: string | null
  animation_prompt: string | null
  created_at: string
  updated_at: string | null
  expires_at: string
}

export async function getDrawing(shareToken: string): Promise<StoredDrawing | null> {
  const { data, error } = await supabaseServer
    .from('drawings')
    .select('id, strokes, animation_code, animation_prompt, created_at, updated_at, expires_at')
    .eq('share_token', shareToken)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) return null
  return data as StoredDrawing
}

export async function createDrawing(
  id: string,
  shareToken: string,
  strokes: CompletedStroke[],
  canvasImage?: string | null
): Promise<string> {
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString()
  const { error } = await supabaseServer.from('drawings').insert({
    id,
    share_token: shareToken,
    strokes,
    canvas_image: canvasImage ?? null,
    expires_at: expiresAt,
  })
  if (error) throw new Error(error.message)
  return expiresAt
}

export async function updateDrawing(
  id: string,
  strokes: CompletedStroke[],
  animationCode?: string | null,
  animationPrompt?: string | null
): Promise<string | null> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TTL_MS).toISOString()

  const updatePayload: Record<string, unknown> = {
    strokes,
    updated_at: now.toISOString(),
    expires_at: expiresAt,
  }
  if (animationCode !== undefined) updatePayload.animation_code = animationCode
  if (animationPrompt !== undefined) updatePayload.animation_prompt = animationPrompt

  const { data, error } = await supabaseServer
    .from('drawings')
    .update(updatePayload)
    .eq('id', id)
    .gt('expires_at', now.toISOString()) // reject if already expired
    .select('expires_at')
    .single()

  if (error || !data) return null
  return data.expires_at as string
}
