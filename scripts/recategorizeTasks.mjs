// ============================================================
// Come w' me — recategorize existing tasks using JS detection
// Run with:  node --env-file=.env scripts/recategorizeTasks.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { detectCategory } from '../src/lib/categoryDetector'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('\nMissing env vars. Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env\n')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  console.log('\nFetching all tasks...')

  const { data: tasks, error } = await sb
    .from('tasks')
    .select('id, title, description, category')
    .limit(1000)

  if (error) {
    console.error('Fetch failed:', error.message)
    process.exit(1)
  }

  if (!tasks || tasks.length === 0) {
    console.log('No tasks found.')
    return
  }

  console.log(`Found ${tasks.length} tasks.`)

  let updated = 0
  let skipped = 0

  for (const task of tasks) {
    const detected = detectCategory(task.title, task.description ?? '')

    // Only update if category is null, empty, or 'other'
    if (!task.category || task.category === '' || task.category === 'other') {
      const { error: updErr } = await sb
        .from('tasks')
        .update({ category: detected })
        .eq('id', task.id)

      if (updErr) {
        console.error(`Failed to update task ${task.id}:`, updErr.message)
      } else {
        updated++
        console.log(`  ${task.id.slice(0, 8)}... "${task.title.slice(0, 40)}" -> ${detected}`)
      }
    } else {
      skipped++
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already set): ${skipped}`)
}

main().catch((e) => {
  console.error('\nScript failed:', e.message, '\n')
  process.exit(1)
})
