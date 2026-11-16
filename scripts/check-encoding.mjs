#!/usr/bin/env node
/**
 * Fails loudly on any non-UTF-8 or mojibake-like garbage in source files.
 * Run: node scripts/check-encoding.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.json', '.md', '.yml', '.yaml', '.svg'])
const SKIP = new Set(['node_modules', 'dist', '.vercel', '.git'])

const BAD_HINTS = [
  [0x00e2, 0x20ac], // classic em-dash mojibake (â + €)
  [0x00c3, 0x009f, 0x00c2, 0x009e], // double-encoded variants
].map((cps) => cps.map((cp) => String.fromCharCode(cp)).join(''))

let scanned = 0
let bad = []
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (EXTS.has(entry.name.slice(entry.name.lastIndexOf('.')))) yield p
  }
}

for (const file of walk(ROOT)) {
  scanned += 1
  const text = readFileSync(file, 'utf8')
  for (const hint of BAD_HINTS) {
    if (text.includes(hint)) {
      bad.push({ file: relative(ROOT, file), hint })
      break
    }
  }
}

if (bad.length > 0) {
  console.error('Mojibake / broken encoding detected in:')
  for (const b of bad) console.error(`  ${b.file}  (${JSON.stringify(b.hint)})`)
  process.exit(1)
}

console.log(`OK - scanned ${scanned} files, no mojibake found.`)
