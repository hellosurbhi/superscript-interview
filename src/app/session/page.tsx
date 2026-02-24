'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

interface Turn {
  index: number
  title: string
  body: string[]
}

function parseSession(text: string): Turn[] {
  const lines = text.split('\n')
  const turns: Turn[] = []
  let currentTitle = ''
  let currentBody: string[] = []
  let inTurn = false
  let turnIndex = 0

  for (const line of lines) {
    if (line.startsWith('❯')) {
      if (inTurn) {
        turns.push({ index: turnIndex++, title: currentTitle, body: currentBody })
      }
      currentTitle = line.slice(1).trim()
      currentBody = []
      inTurn = true
    } else if (inTurn) {
      currentBody.push(line)
    }
  }

  if (inTurn && (currentTitle || currentBody.length > 0)) {
    turns.push({ index: turnIndex, title: currentTitle, body: currentBody })
  }

  return turns
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: '#facc15', color: '#000', borderRadius: '2px' }}>{part}</mark>
      : part
  )
}

interface BodyProps {
  lines: string[]
  showAll: boolean
  searchQuery: string
}

function TurnBody({ lines, showAll, searchQuery }: BodyProps) {
  const visibleLines = showAll ? lines : lines.slice(0, 50)
  const nodes: React.ReactNode[] = []
  let codeBuffer: string[] = []
  let inCode = false

  const flushCode = (key: string) => {
    if (codeBuffer.length === 0) return
    nodes.push(
      <pre
        key={key}
        style={{
          background: '#111',
          borderLeft: '2px solid rgba(233,30,140,0.3)',
          borderRadius: '3px',
          padding: '10px 14px',
          overflowX: 'auto',
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: '11px',
          lineHeight: 1.7,
          color: '#ededed',
          margin: '6px 0',
          whiteSpace: 'pre',
        }}
      >
        {codeBuffer.join('\n')}
      </pre>
    )
    codeBuffer = []
  }

  visibleLines.forEach((line, i) => {
    const key = `line-${i}`

    if (/^\s*```/.test(line)) {
      if (inCode) {
        flushCode(`code-${i}`)
        inCode = false
      } else {
        inCode = true
      }
      return
    }

    if (inCode) {
      codeBuffer.push(line)
      return
    }

    // Strip ⏺ marker, use as a subtle divider
    let displayLine = line
    let isClaude = false
    if (line.startsWith('⏺')) {
      isClaude = true
      displayLine = line.slice(1).trimStart()
    }

    // Git diff coloring
    const isDiffAdd = /^\+(?!\+\+)/.test(displayLine)
    const isDiffDel = /^-(?!--|--)/.test(displayLine) && !/^-->/.test(displayLine)

    const color = isDiffAdd ? '#4ade80' : isDiffDel ? '#f87171' : '#ededed'

    nodes.push(
      <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        {isClaude && (
          <span style={{ color: 'rgba(233,30,140,0.4)', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0, paddingTop: '1px' }}>⏺</span>
        )}
        <span
          style={{
            color,
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: '12px',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            flex: 1,
          }}
        >
          {searchQuery ? highlightText(displayLine, searchQuery) : displayLine}
        </span>
      </div>
    )
  })

  // Flush any trailing code block
  if (inCode && codeBuffer.length > 0) {
    flushCode('code-trailing')
  }

  return <>{nodes}</>
}

export default function SessionPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [openStates, setOpenStates] = useState<boolean[]>([])
  const [showMoreStates, setShowMoreStates] = useState<boolean[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetch('/session.txt')
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.text()
      })
      .then((text) => {
        const parsed = parseSession(text)
        setTurns(parsed)
        setOpenStates(new Array(parsed.length).fill(false))
        setShowMoreStates(new Array(parsed.length).fill(false))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const filteredTurns = useMemo(() => {
    if (!searchQuery) return turns
    const q = searchQuery.toLowerCase()
    return turns.filter((t) =>
      (t.title + '\n' + t.body.join('\n')).toLowerCase().includes(q)
    )
  }, [turns, searchQuery])

  const toggle = useCallback((originalIndex: number) => {
    setOpenStates((prev) => {
      const next = [...prev]
      next[originalIndex] = !next[originalIndex]
      return next
    })
  }, [])

  const toggleShowMore = useCallback((originalIndex: number) => {
    setShowMoreStates((prev) => {
      const next = [...prev]
      next[originalIndex] = !next[originalIndex]
      return next
    })
  }, [])

  const expandAll = useCallback(() => setOpenStates(new Array(turns.length).fill(true)), [turns.length])
  const collapseAll = useCallback(() => setOpenStates(new Array(turns.length).fill(false)), [turns.length])

  const btnStyle: React.CSSProperties = {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '6px',
    border: '1px solid rgba(233,30,140,0.25)',
    background: 'transparent',
    color: 'rgba(233,30,140,0.6)',
    borderRadius: '3px',
    padding: '5px 10px',
    cursor: 'pointer',
    letterSpacing: '0.05em',
    transition: 'background 150ms, color 150ms',
    lineHeight: 1,
  }

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: '#0a0a0a',
        color: '#ededed',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: '56px', paddingBottom: '32px', paddingLeft: '24px', paddingRight: '24px' }}>
        <h1
          className="font-pixel"
          style={{
            fontSize: 'clamp(9px, 2vw, 18px)',
            color: '#ff006e',
            textShadow: '0 0 20px rgba(233,30,140,0.3), 0 0 8px rgba(233,30,140,0.2)',
            letterSpacing: '0.04em',
            lineHeight: 1.8,
            marginBottom: '16px',
          }}
        >
          SurbhiDraw — Build Session
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: '13px',
            color: '#7a3550',
            lineHeight: 1.6,
          }}
        >
          Full Claude Code session log for this project
        </p>
      </div>

      {/* Controls — sticky */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(233,30,140,0.1)',
          padding: '10px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <span
          className="font-pixel"
          style={{ fontSize: '6px', color: 'rgba(233,30,140,0.45)', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}
        >
          {filteredTurns.length === turns.length
            ? `${turns.length} turns`
            : `${filteredTurns.length} / ${turns.length} turns`}
        </span>

        <input
          type="text"
          placeholder="search turns…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 160px',
            minWidth: '120px',
            background: '#111',
            border: '1px solid rgba(233,30,140,0.25)',
            borderRadius: '3px',
            color: '#ededed',
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: '12px',
            padding: '6px 10px',
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button style={btnStyle} onClick={expandAll}>
            EXPAND ALL
          </button>
          <button style={btnStyle} onClick={collapseAll}>
            COLLAPSE ALL
          </button>
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '16px 16px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {loading && (
          <p className="font-pixel neon-blink" style={{ fontSize: '8px', color: '#ff006e', textAlign: 'center', marginTop: '60px' }}>
            LOADING SESSION...
          </p>
        )}

        {error && (
          <p
            className="font-pixel"
            style={{ fontSize: '7px', color: 'rgba(233,30,140,0.5)', textAlign: 'center', marginTop: '60px', lineHeight: 2 }}
          >
            SESSION LOG NOT FOUND<br />
            drop session.txt in /public/
          </p>
        )}

        {!loading && !error && turns.length === 0 && (
          <p className="font-pixel" style={{ fontSize: '7px', color: 'rgba(233,30,140,0.5)', textAlign: 'center', marginTop: '60px' }}>
            NO TURNS FOUND
          </p>
        )}

        {filteredTurns.map((turn) => {
          const isOpen = openStates[turn.index] || (!!searchQuery && filteredTurns.length < turns.length)
          const isShowMore = showMoreStates[turn.index]
          const isLong = turn.body.length > 50

          return (
            <div
              key={turn.index}
              style={{
                border: '1px solid rgba(233,30,140,0.12)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              {/* Header — always visible, clickable */}
              <button
                onClick={() => toggle(turn.index)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: isOpen ? 'rgba(233,30,140,0.04)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  transition: 'background 150ms',
                }}
              >
                <span
                  className="font-pixel"
                  style={{ fontSize: '7px', color: '#ff006e', flexShrink: 0, marginTop: '2px', lineHeight: 1.5 }}
                >
                  ❯
                </span>
                <span
                  className="font-pixel"
                  style={{ fontSize: '6px', color: 'rgba(233,30,99,0.3)', flexShrink: 0, marginTop: '3px', lineHeight: 1.5, whiteSpace: 'nowrap' }}
                >
                  {String(turn.index + 1).padStart(2, '0')}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: '12px',
                    color: '#ededed',
                    lineHeight: 1.6,
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  {searchQuery ? highlightText(turn.title || '(empty)', searchQuery) : (turn.title || '(empty)')}
                </span>
                <span style={{ color: 'rgba(233,30,140,0.35)', fontSize: '10px', flexShrink: 0, marginTop: '2px' }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {/* Body — collapsible */}
              {isOpen && (
                <div
                  style={{
                    borderTop: '1px solid rgba(233,30,140,0.1)',
                    padding: '12px 14px 14px',
                    background: 'rgba(233,30,140,0.02)',
                  }}
                >
                  <TurnBody lines={turn.body} showAll={isShowMore} searchQuery={searchQuery} />

                  {isLong && (
                    <button
                      onClick={() => toggleShowMore(turn.index)}
                      style={{
                        marginTop: '10px',
                        background: 'transparent',
                        border: '1px solid rgba(233,30,140,0.2)',
                        borderRadius: '3px',
                        color: 'rgba(233,30,140,0.55)',
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: '6px',
                        padding: '5px 12px',
                        cursor: 'pointer',
                        letterSpacing: '0.04em',
                        display: 'block',
                      }}
                    >
                      {isShowMore
                        ? '▲ show less'
                        : `▼ show more (${turn.body.length - 50} more lines)`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingBottom: '40px' }}>
        <a
          href="/"
          className="font-pixel"
          style={{
            fontSize: '7px',
            color: 'rgba(233,30,140,0.4)',
            textDecoration: 'none',
            letterSpacing: '0.08em',
            transition: 'color 200ms',
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ff006e')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(233,30,140,0.4)')}
        >
          ← back to drawing
        </a>
      </div>
    </main>
  )
}
