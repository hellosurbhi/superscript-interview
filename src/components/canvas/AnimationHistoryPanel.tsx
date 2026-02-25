'use client'

import { useState, useCallback } from 'react'
import type { StoredAnimation } from '@/lib/animations'

interface AnimationHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  animations: StoredAnimation[]
  onPlay: (anim: StoredAnimation) => void
  onDelete: (id: string) => Promise<void>
}

function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function AnimationCard({
  anim,
  version,
  onPlay,
  onDelete,
}: {
  anim: StoredAnimation
  version: number
  onPlay: () => void
  onDelete: () => Promise<void>
}) {
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/share/animation/${anim.share_token}`
    : `/share/animation/${anim.share_token}`

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [shareUrl])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }, [onDelete])

  return (
    <div
      className="flex flex-col gap-2 p-2.5 rounded"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,0,110,0.08)',
        transition: 'border-color 150ms',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,0,110,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,0,110,0.08)')}
    >
      {/* Top row: thumbnail + meta */}
      <div className="flex gap-2.5 items-start">
        {/* Thumbnail */}
        <div
          className="shrink-0 rounded overflow-hidden"
          style={{ width: 48, height: 32 }}
        >
          {anim.preview_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={anim.preview_image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: 'linear-gradient(135deg, #ff006e22, #8338ec22)' }}
            />
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="font-pixel text-[6px] tracking-widest shrink-0 px-1 py-0.5 rounded"
              style={{
                background: 'rgba(255,0,110,0.15)',
                color: '#ff006e',
                border: '1px solid rgba(255,0,110,0.2)',
              }}
            >
              v{version}
            </span>
            <span className="text-white/60 text-[11px] truncate leading-tight">
              {anim.animation_prompt}
            </span>
          </div>
          <span className="font-pixel text-[5px] text-white/20 tracking-wider">
            {relativeTime(anim.created_at)}
          </span>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-1.5">
        <ActionButton
          onClick={onPlay}
          label="▶ Play"
          color="#ff006e"
        />
        <ActionButton
          onClick={handleShare}
          label={copied ? '✓ Copied!' : '↗ Share'}
          color={copied ? '#06d6a0' : '#8338ec'}
        />
        <div className="flex-1" />
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center justify-center w-7 h-7 rounded transition-all duration-150 text-xs"
          style={{
            color: deleting ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          title="Delete animation"
          onMouseEnter={e => {
            if (!deleting) (e.currentTarget as HTMLElement).style.color = '#ff006e'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = deleting
              ? 'rgba(255,255,255,0.2)'
              : 'rgba(255,255,255,0.25)'
          }}
        >
          {deleting ? '…' : '🗑'}
        </button>
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  label,
  color,
}: {
  onClick: () => void
  label: string
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-2.5 rounded font-pixel text-[6px] tracking-widest transition-all duration-150"
      style={{
        color,
        border: `1px solid ${color}33`,
        background: `${color}11`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = `${color}22`
        ;(e.currentTarget as HTMLElement).style.borderColor = `${color}55`
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = `${color}11`
        ;(e.currentTarget as HTMLElement).style.borderColor = `${color}33`
      }}
    >
      {label}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <div
        className="w-12 h-12 rounded flex items-center justify-center text-2xl"
        style={{ background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.1)' }}
      >
        ⚡
      </div>
      <p className="font-pixel text-[6px] text-white/25 tracking-wider leading-loose">
        No animations yet.<br />
        Draw something and hit<br />
        Animate to create your first one!
      </p>
    </div>
  )
}

export default function AnimationHistoryPanel({
  isOpen,
  onClose,
  animations,
  onPlay,
  onDelete,
}: AnimationHistoryPanelProps) {
  return (
    <div
      className="fixed top-0 right-0 h-full w-72 z-[90] flex flex-col"
      style={{
        background: '#0d0510',
        borderLeft: '1px solid rgba(255,0,110,0.1)',
        boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.5)' : 'none',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span
          className="font-pixel text-[7px] text-[#ff006e] tracking-widest"
          style={{ textShadow: '0 0 8px #ff006e44' }}
        >
          ⚡ ANIMATION HISTORY
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors leading-none text-base w-6 h-6 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      {animations.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {animations.map((anim, idx) => (
            <AnimationCard
              key={anim.id}
              anim={anim}
              version={animations.length - idx}
              onPlay={() => onPlay(anim)}
              onDelete={() => onDelete(anim.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
