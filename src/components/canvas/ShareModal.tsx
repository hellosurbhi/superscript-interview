'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ShareModalProps {
  shareUrl: string
  onClose: () => void
}

export default function ShareModal({ shareUrl, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select the text input
    }
  }, [shareUrl])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative flex flex-col gap-4 w-full max-w-sm mx-4 px-5 py-5 rounded"
        style={{
          background: '#f5f5f0',
          border: '1px solid rgba(0,0,0,0.10)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span
            className="font-pixel text-[9px] tracking-widest"
            style={{ color: '#1a1a2e' }}
          >
            SHARE DRAWING
          </span>
          <button
            onClick={onClose}
            className="text-black/30 hover:text-black/70 transition-colors text-base leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* URL row */}
        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 text-xs px-3 py-2 rounded border border-black/10 bg-white/70 text-black/60 font-mono select-all focus:outline-none"
            style={{ minWidth: 0 }}
          />
          <button
            onClick={handleCopy}
            className="shrink-0 px-3 py-2 rounded font-pixel text-[7px] tracking-widest transition-all duration-150"
            style={
              copied
                ? {
                    background: '#06d6a0',
                    color: '#fff',
                    border: '1px solid #06d6a0',
                  }
                : {
                    background: '#1a1a2e',
                    color: '#f5f5f0',
                    border: '1px solid #1a1a2e',
                  }
            }
          >
            {copied ? 'COPIED!' : 'COPY'}
          </button>
        </div>

        {/* Expiry note */}
        <p className="font-pixel text-[6px] text-black/35 leading-relaxed">
          This link expires in 24 hours.<br />Anyone with the link can view and edit.
        </p>
      </div>
    </div>
  )
}
