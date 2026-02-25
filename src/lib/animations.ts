import { supabaseServer } from './supabase-server'
import { nanoid } from 'nanoid'

const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface StoredAnimation {
  id: string
  drawing_id: string
  animation_code: string
  animation_prompt: string
  preview_image: string | null
  canvas_width: number | null
  canvas_height: number | null
  share_token: string
  created_at: string
  expires_at: string
}

export async function createAnimation(
  drawing_id: string,
  animation_code: string,
  animation_prompt: string,
  preview_image: string | null,
  canvas_width: number | null,
  canvas_height: number | null
): Promise<{ animation: StoredAnimation; expiresAt: string }> {
  const share_token = nanoid(10)
  const expires_at = new Date(Date.now() + TTL_MS).toISOString()

  const { data, error } = await supabaseServer
    .from('animations')
    .insert({
      drawing_id,
      animation_code,
      animation_prompt,
      preview_image,
      canvas_width,
      canvas_height,
      share_token,
      expires_at,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create animation')
  return { animation: data as StoredAnimation, expiresAt: expires_at }
}

export async function getAnimationByToken(token: string): Promise<StoredAnimation | null> {
  const { data } = await supabaseServer
    .from('animations')
    .select('*')
    .eq('share_token', token)
    .gt('expires_at', new Date().toISOString())
    .single()

  return (data as StoredAnimation | null) ?? null
}

export async function getAnimationsForDrawing(
  drawing_id: string
): Promise<Array<{ share_token: string; animation_prompt: string; created_at: string }>> {
  const { data } = await supabaseServer
    .from('animations')
    .select('share_token, animation_prompt, created_at')
    .eq('drawing_id', drawing_id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return (data as Array<{ share_token: string; animation_prompt: string; created_at: string }>) ?? []
}

export async function touchAnimation(token: string): Promise<void> {
  const expires_at = new Date(Date.now() + TTL_MS).toISOString()
  await supabaseServer
    .from('animations')
    .update({ expires_at })
    .eq('share_token', token)
}
