#!/usr/bin/env node
/**
 * scripts/parse-sessions.js
 * Reads all Claude Code .jsonl session files for this project,
 * parses events into structured turns, and writes public/session.json.
 *
 * Run: node scripts/parse-sessions.js
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const SESSIONS_DIR = path.join(
  os.homedir(),
  '.claude/projects/-Users-surbhi-workspace-suprscript-interview'
)
const OUTPUT = path.join(__dirname, '..', 'public', 'session.json')
const PROJECT_ROOT = '/Users/surbhi/workspace/suprscript-interview/'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms) {
  if (!ms || ms < 0) return '0s'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function shorten(p) {
  if (!p) return ''
  return p.replace(PROJECT_ROOT, '')
}

function countUnique(arr) {
  return new Set(arr).size
}

function extractUserMessage(event) {
  let content = event.message?.content ?? ''
  if (Array.isArray(content)) {
    content = content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
  }
  if (typeof content !== 'string') content = JSON.stringify(content)
  return content
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .replace(/<fast_mode_info>[\s\S]*?<\/fast_mode_info>/g, '')
    .trim()
}

function summarizeInput(name, input) {
  if (!input) return ''
  switch (name) {
    case 'Read':    return input.file_path ? shorten(input.file_path) : ''
    case 'Write':   return input.file_path ? shorten(input.file_path) : ''
    case 'Edit':    return input.file_path ? shorten(input.file_path) : ''
    case 'MultiEdit': return input.file_path ? shorten(input.file_path) : ''
    case 'Bash':    return (input.command || '').slice(0, 120)
    case 'Glob':    return input.pattern || ''
    case 'Grep':    return input.pattern || ''
    case 'Task':    return input.description || ''
    default:        return JSON.stringify(input).slice(0, 100)
  }
}

function processToolCall(block, turn) {
  const { name, input } = block
  turn.toolCalls.push({ name, inputSummary: summarizeInput(name, input) })

  switch (name) {
    case 'Read':
      if (!turn.filesRead.includes(shorten(input?.file_path)))
        turn.filesRead.push(shorten(input?.file_path))
      break
    case 'Write':
      turn.filesWritten.push(shorten(input?.file_path))
      break
    case 'Edit':
    case 'MultiEdit': {
      const fp = shorten(input?.file_path)
      if (!turn.filesModified.includes(fp)) turn.filesModified.push(fp)
      if (input?.old_string != null && input?.new_string != null) {
        turn.diffs.push({
          file: fp,
          removed: input.old_string.split('\n'),
          added: input.new_string.split('\n'),
        })
      }
      break
    }
    case 'Bash':
      turn.bashCommands.push(input?.command ?? '')
      break
  }
}

function makeTurn(userEvent, index) {
  return {
    index,
    timestamp: userEvent.timestamp,
    userMessage: extractUserMessage(userEvent),
    assistantText: '',
    toolCalls: [],
    filesRead: [],
    filesWritten: [],
    filesModified: [],
    bashCommands: [],
    diffs: [],
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Read and parse all JSONL files
if (!fs.existsSync(SESSIONS_DIR)) {
  console.error(`Sessions dir not found: ${SESSIONS_DIR}`)
  process.exit(1)
}

const jsonlFiles = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.jsonl'))
console.log(`Found ${jsonlFiles.length} JSONL files`)

const allEvents = []
const unknownTypes = new Set()

for (const file of jsonlFiles) {
  const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8')
  const lines = raw.split('\n').filter((l) => l.trim())
  let parsed = 0
  let errors = 0
  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      allEvents.push(event)
      parsed++
    } catch {
      errors++
    }
  }
  console.log(`  ${file}: ${parsed} events${errors ? `, ${errors} parse errors` : ''}`)
}

// Sort all events by timestamp
allEvents.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1))

// Group by sessionId, preserving chronological order
const sessionMap = new Map()
for (const event of allEvents) {
  const sid = event.sessionId
  if (!sid) continue
  if (!sessionMap.has(sid)) sessionMap.set(sid, [])
  sessionMap.get(sid).push(event)
}

// Build sessions
const sessions = []
let sessionIndex = 1

for (const [sessionId, events] of sessionMap) {
  // Find slug from first event that has one
  const slug = events.find((e) => e.slug)?.slug ?? ''

  const turns = []
  let currentTurn = null
  let turnIndex = 1

  for (const event of events) {
    const { type } = event

    // Track unknown types (skip expected non-content types)
    const knownTypes = new Set([
      'user', 'assistant', 'direct', 'progress', 'system',
      'file-history-snapshot', 'update', 'message', 'text', 'thinking', 'tool_use', 'tool_result'
    ])
    if (!knownTypes.has(type)) unknownTypes.add(type)

    // Skip noise
    if (['progress', 'system', 'file-history-snapshot', 'update'].includes(type)) continue

    if (type === 'user' && event.message?.content !== undefined) {
      const rawContent = event.message.content
      // Skip tool_result messages (Claude API sends these back as "user" role)
      if (Array.isArray(rawContent) && rawContent.every((b) => b.type === 'tool_result')) continue
      if (Array.isArray(rawContent) && !rawContent.some((b) => b.type === 'text')) continue
      // Extract and skip empty messages after stripping system injections
      const msg = extractUserMessage(event)
      if (!msg.trim()) continue
      // Push completed turn
      if (currentTurn) turns.push(currentTurn)
      currentTurn = makeTurn(event, turnIndex++)
      continue
    }

    if ((type === 'assistant' || type === 'direct') && currentTurn) {
      const content = event.message?.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        if (block.type === 'text') {
          currentTurn.assistantText += block.text + '\n'
        } else if (block.type === 'tool_use') {
          processToolCall(block, currentTurn)
        }
        // skip 'thinking' blocks
      }
    }
  }

  // Push final turn
  if (currentTurn) turns.push(currentTurn)

  // Skip empty sessions (no turns)
  if (turns.length === 0) continue

  const startTime = events[0].timestamp
  const endTime = events[events.length - 1].timestamp
  const durationMs = new Date(endTime) - new Date(startTime)

  sessions.push({
    sessionId,
    slug,
    index: sessionIndex++,
    startTime,
    endTime,
    durationHuman: formatDuration(durationMs),
    turns,
  })
}

// ─── Stats ───────────────────────────────────────────────────────────────────

const allTurns = sessions.flatMap((s) => s.turns)
const allDiffs = allTurns.flatMap((t) => t.diffs)

const firstActivity = sessions[0]?.startTime ?? null
const lastActivity = sessions.at(-1)?.endTime ?? null
const totalDurationMs = firstActivity && lastActivity
  ? new Date(lastActivity) - new Date(firstActivity)
  : 0

const stats = {
  totalSessions: sessions.length,
  totalTurns: allTurns.length,
  totalToolCalls: allTurns.reduce((n, t) => n + t.toolCalls.length, 0),
  filesCreated: countUnique(allTurns.flatMap((t) => t.filesWritten)),
  filesModified: countUnique(allTurns.flatMap((t) => t.filesModified)),
  linesAdded: allDiffs.reduce((n, d) => n + d.added.length, 0),
  linesRemoved: allDiffs.reduce((n, d) => n + d.removed.length, 0),
  firstActivity,
  lastActivity,
  durationHuman: formatDuration(totalDurationMs),
}

// ─── Output ──────────────────────────────────────────────────────────────────

const output = {
  generatedAt: new Date().toISOString(),
  stats,
  sessions,
}

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2))

console.log(`\n✓ Wrote ${OUTPUT}`)
console.log(`  ${stats.totalSessions} sessions  |  ${stats.totalTurns} turns  |  ${stats.totalToolCalls} tool calls`)
console.log(`  ${stats.filesCreated} files created  |  ${stats.filesModified} files modified`)
console.log(`  +${stats.linesAdded} lines  /  -${stats.linesRemoved} lines`)
console.log(`  Total duration: ${stats.durationHuman}`)

if (unknownTypes.size > 0) {
  console.log(`\n⚠ Unrecognized event types: ${[...unknownTypes].join(', ')}`)
}
