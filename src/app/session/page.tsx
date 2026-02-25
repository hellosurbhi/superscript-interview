'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

interface ToolCall { name: string; inputSummary: string }
interface Diff { file: string; removed: string[]; added: string[] }
interface TurnData {
  index: number; timestamp: string; userMessage: string; assistantText: string
  toolCalls: ToolCall[]; filesRead: string[]; filesWritten: string[]
  filesModified: string[]; bashCommands: string[]; diffs: Diff[]
}
interface SessionData {
  sessionId: string; slug: string; index: number
  startTime: string; endTime: string; durationHuman: string; turns: TurnData[]
}
interface Stats {
  totalSessions: number; totalTurns: number; totalToolCalls: number
  filesCreated: number; filesModified: number; linesAdded: number
  linesRemoved: number; durationHuman: string; firstActivity: string | null
}
interface SessionFile { generatedAt: string; stats: Stats; sessions: SessionData[] }

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((p, i) =>
    p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} style={{ background: '#facc15', color: '#000', borderRadius: 2 }}>{p}</mark>
      : p
  )
}

function truncateHeader(text: string): string {
  const firstLine = text.split('\n')[0]
  const isMultiline = text.includes('\n')
  if (firstLine.length <= 120 && !isMultiline) return firstLine
  return firstLine.slice(0, 120) + '…'
}

function TextBody({ text, query }: { text: string; query: string }) {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let codeLines: string[] = []
  let inCode = false

  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) {
      if (inCode) {
        nodes.push(
          <pre key={`c${i}`} style={{ background: '#111', borderLeft: '2px solid rgba(233,30,140,0.3)', borderRadius: 3, padding: '8px 12px', overflowX: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#ededed', margin: '6px 0', whiteSpace: 'pre' }}>
            {codeLines.join('\n')}
          </pre>
        )
        codeLines = []; inCode = false
      } else { inCode = true }
      return
    }
    if (inCode) { codeLines.push(line); return }
    if (!line.trim()) { nodes.push(<div key={i} style={{ height: 6 }} />); return }
    nodes.push(
      <div key={i} style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, lineHeight: 1.65, color: '#c9b8c4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {query ? highlight(line, query) : line}
      </div>
    )
  })

  if (inCode && codeLines.length) nodes.push(
    <pre key="trailing" style={{ background: '#111', borderLeft: '2px solid rgba(233,30,140,0.3)', borderRadius: 3, padding: '8px 12px', overflowX: 'auto', fontFamily: 'monospace', fontSize: 11, color: '#ededed', margin: '6px 0', whiteSpace: 'pre' }}>
      {codeLines.join('\n')}
    </pre>
  )
  return <>{nodes}</>
}

function Pill({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{ background: bg, border: `1px solid ${border}`, borderRadius: 3, padding: '2px 7px', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 10, color, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
      {label}
    </span>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ background: 'rgba(233,30,140,0.05)', border: '1px solid rgba(233,30,140,0.1)', borderRadius: 4, padding: '14px 16px' }}>
      <div className="font-pixel" style={{ fontSize: 'clamp(11px,2vw,18px)', color: '#ff006e', lineHeight: 1 }}>{value}</div>
      <div className="font-pixel" style={{ fontSize: 6, color: 'rgba(233,30,140,0.4)', marginTop: 8, letterSpacing: '0.06em' }}>{label}</div>
    </div>
  )
}

const btnStyle: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace", fontSize: 6, border: '1px solid rgba(233,30,140,0.25)', background: 'transparent', color: 'rgba(233,30,140,0.6)', borderRadius: 3, padding: '5px 10px', cursor: 'pointer', letterSpacing: '0.05em' }

export default function SessionPage() {
  const [data, setData] = useState<SessionFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/session.json')
      .then((r) => { if (!r.ok) throw new Error('not found'); return r.json() as Promise<SessionFile> })
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const filteredSessions = useMemo(() => {
    if (!data) return []
    if (!searchQuery) return data.sessions
    const q = searchQuery.toLowerCase()
    return data.sessions.map((s) => ({
      ...s,
      turns: s.turns.filter((t) =>
        t.userMessage.toLowerCase().includes(q) || t.assistantText.toLowerCase().includes(q)
      ),
    })).filter((s) => s.turns.length > 0)
  }, [data, searchQuery])

  const totalVisible = filteredSessions.reduce((n, s) => n + s.turns.length, 0)

  const toggle = useCallback((key: string) => setOpenStates((p) => ({ ...p, [key]: !p[key] })), [])

  const expandAll = useCallback(() => {
    const next: Record<string, boolean> = {}
    filteredSessions.forEach((s) => s.turns.forEach((t) => { next[`${s.index}-${t.index}`] = true }))
    setOpenStates(next)
  }, [filteredSessions])

  const collapseAll = useCallback(() => setOpenStates({}), [])

  const s = data?.stats

  return (
    <main style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#0a0a0a', color: '#ededed' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', paddingTop: 56, paddingBottom: 32, paddingInline: 24 }}>
        <h1 className="font-pixel" style={{ fontSize: 'clamp(9px,2vw,18px)', color: '#ff006e', textShadow: '0 0 20px rgba(233,30,140,0.3)', letterSpacing: '0.04em', lineHeight: 1.8, marginBottom: 16 }}>
          SurbhiDraw — Build Session
        </h1>
        <p style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 13, color: '#7a3550', lineHeight: 1.6 }}>
          Full Claude Code session log for this project
        </p>
      </div>

      {/* Stats */}
      {s && (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          <StatCard value={s.totalSessions} label="SESSIONS" />
          <StatCard value={s.totalTurns} label="TURNS" />
          <StatCard value={s.totalToolCalls} label="TOOL CALLS" />
          <StatCard value={s.filesCreated} label="FILES CREATED" />
          <StatCard value={s.filesModified} label="FILES MODIFIED" />
          <StatCard value={`+${s.linesAdded}`} label="LINES ADDED" />
          <StatCard value={`-${s.linesRemoved}`} label="LINES REMOVED" />
          <StatCard value={s.durationHuman} label="TOTAL TIME" />
        </div>
      )}

      {/* Controls — sticky */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(233,30,140,0.1)', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <span className="font-pixel" style={{ fontSize: 6, color: 'rgba(233,30,140,0.45)', whiteSpace: 'nowrap' }}>
          {totalVisible === (data?.stats.totalTurns ?? 0) ? `${totalVisible} turns` : `${totalVisible} / ${data?.stats.totalTurns ?? 0} turns`}
        </span>
        <input type="text" placeholder="search turns…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: '1 1 160px', minWidth: 120, background: '#111', border: '1px solid rgba(233,30,140,0.25)', borderRadius: 3, color: '#ededed', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, padding: '6px 10px', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button style={btnStyle} onClick={expandAll}>EXPAND ALL</button>
          <button style={btnStyle} onClick={collapseAll}>COLLAPSE ALL</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 16px 80px' }}>
        {loading && <p className="font-pixel neon-blink" style={{ fontSize: 8, color: '#ff006e', textAlign: 'center', marginTop: 60 }}>LOADING SESSION...</p>}
        {error && <p className="font-pixel" style={{ fontSize: 7, color: 'rgba(233,30,140,0.5)', textAlign: 'center', marginTop: 60, lineHeight: 2 }}>SESSION NOT FOUND<br />run: node scripts/parse-sessions.js</p>}

        {filteredSessions.map((sess) => (
          <section key={sess.sessionId} style={{ marginBottom: 32 }}>
            {/* Session header */}
            <div style={{ borderLeft: '2px solid rgba(233,30,140,0.35)', paddingLeft: 12, marginBottom: 10 }}>
              <div className="font-pixel" style={{ fontSize: 7, color: '#ff006e', letterSpacing: '0.06em', marginBottom: 4 }}>
                Session {sess.index} — {fmtDate(sess.startTime)} · {sess.durationHuman}
              </div>
              <div style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 10, color: 'rgba(233,30,140,0.3)' }}>
                {sess.slug}
              </div>
            </div>

            {/* Turns */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sess.turns.map((turn) => {
                const key = `${sess.index}-${turn.index}`
                const isOpen = !!openStates[key] || (!!searchQuery && totalVisible < (data?.stats.totalTurns ?? 0))
                const hasFiles = turn.filesRead.length + turn.filesWritten.length + turn.filesModified.length > 0
                const hasContent = turn.assistantText.trim() || hasFiles || turn.bashCommands.length || turn.diffs.length

                return (
                  <div key={key} style={{ border: '1px solid rgba(233,30,140,0.12)', borderRadius: 4, overflow: 'hidden' }}>
                    {/* Turn header */}
                    <button onClick={() => toggle(key)} style={{ width: '100%', textAlign: 'left', background: isOpen ? 'rgba(233,30,140,0.04)' : 'transparent', border: 'none', cursor: 'pointer', padding: '9px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span className="font-pixel" style={{ fontSize: 7, color: '#ff006e', flexShrink: 0, marginTop: 2 }}>❯</span>
                      <span className="font-pixel" style={{ fontSize: 6, color: 'rgba(233,30,99,0.3)', flexShrink: 0, marginTop: 3, whiteSpace: 'nowrap' }}>{String(turn.index).padStart(2, '0')}</span>
                      <span style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 12, color: '#ededed', lineHeight: 1.6, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {searchQuery ? highlight(truncateHeader(turn.userMessage), searchQuery) : truncateHeader(turn.userMessage)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
                        {turn.toolCalls.length > 0 && (
                          <span className="font-pixel" style={{ fontSize: 5, color: 'rgba(233,30,140,0.4)', border: '1px solid rgba(233,30,140,0.15)', borderRadius: 2, padding: '2px 5px' }}>
                            {turn.toolCalls.length} tools
                          </span>
                        )}
                        <span style={{ color: 'rgba(233,30,140,0.35)', fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Turn body */}
                    {isOpen && (hasContent || !!turn.userMessage) && (
                      <div style={{ borderTop: '1px solid rgba(233,30,140,0.1)', padding: '12px 14px 14px', background: 'rgba(233,30,140,0.02)' }}>
                        {/* Full user prompt — pink left border */}
                        {turn.userMessage && (
                          <div style={{ borderLeft: '3px solid rgba(255,0,110,0.45)', background: 'rgba(255,0,110,0.03)', padding: '8px 12px', marginBottom: 14, borderRadius: '0 3px 3px 0' }}>
                            <div className="font-pixel" style={{ fontSize: 5, color: 'rgba(255,0,110,0.5)', letterSpacing: '0.1em', marginBottom: 6 }}>YOU</div>
                            <div style={{ fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 11, color: '#e0c8d0', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {searchQuery ? highlight(turn.userMessage, searchQuery) : turn.userMessage}
                            </div>
                          </div>
                        )}

                        {/* Claude's response — muted gray left border */}
                        {hasContent && (
                          <div style={{ borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 12 }}>
                            {/* File pills */}
                            {hasFiles && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                                {turn.filesWritten.map((f, i) => <Pill key={`w${i}`} label={`+ ${f}`} color="#4ade80" bg="rgba(74,222,128,0.08)" border="rgba(74,222,128,0.25)" />)}
                                {turn.filesModified.map((f, i) => <Pill key={`m${i}`} label={`✏ ${f}`} color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.25)" />)}
                                {turn.filesRead.slice(0, 5).map((f, i) => <Pill key={`r${i}`} label={`📖 ${f}`} color="#9ca3af" bg="rgba(156,163,175,0.08)" border="rgba(156,163,175,0.2)" />)}
                                {turn.filesRead.length > 5 && <Pill label={`+${turn.filesRead.length - 5} more`} color="#9ca3af" bg="rgba(156,163,175,0.06)" border="rgba(156,163,175,0.15)" />}
                              </div>
                            )}

                            {/* Bash commands */}
                            {turn.bashCommands.map((cmd, i) => (
                              <pre key={i} style={{ background: '#111', borderLeft: '2px solid rgba(233,30,140,0.2)', borderRadius: 3, padding: '6px 10px', fontSize: 11, fontFamily: 'monospace', color: '#c9b8c4', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: '0 0 8px' }}>
                                $ {cmd}
                              </pre>
                            ))}

                            {/* Diffs */}
                            {turn.diffs.map((diff, i) => (
                              <div key={i} style={{ marginBottom: 10 }}>
                                <div className="font-pixel" style={{ fontSize: 6, color: 'rgba(233,30,140,0.4)', marginBottom: 4 }}>{diff.file}</div>
                                <pre style={{ background: '#111', borderLeft: '2px solid rgba(233,30,140,0.2)', borderRadius: 3, padding: '6px 10px', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre', margin: 0 }}>
                                  {diff.removed.map((l, j) => <div key={`r${j}`} style={{ color: '#f87171' }}>- {l}</div>)}
                                  {diff.added.map((l, j) => <div key={`a${j}`} style={{ color: '#4ade80' }}>+ {l}</div>)}
                                </pre>
                              </div>
                            ))}

                            {/* Assistant text */}
                            {turn.assistantText.trim() && (
                              <TextBody text={turn.assistantText} query={searchQuery} />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingBottom: 40 }}>
        <a href="/" className="font-pixel" style={{ fontSize: 7, color: 'rgba(233,30,140,0.4)', textDecoration: 'none', letterSpacing: '0.08em' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#ff006e')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'rgba(233,30,140,0.4)')}>
          ← back to drawing
        </a>
      </div>
    </main>
  )
}
