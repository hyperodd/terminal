import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const workerDir = 'dist/_worker.js'

if (!existsSync(workerDir)) process.exit(0)

const keep = new Set(['index.js', 'wrangler.json', 'chunks'])

for (const entry of readdirSync(workerDir)) {
  if (!keep.has(entry)) {
    rmSync(join(workerDir, entry), { recursive: true, force: true })
  }
}
