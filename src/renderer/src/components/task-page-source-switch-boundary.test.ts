import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const TASK_PAGE_SOURCE = readFileSync(join(__dirname, 'TaskPage.tsx'), 'utf8')

function sourceBetween(source: string, startPattern: string, endPattern: string): string {
  const start = source.indexOf(startPattern)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endPattern, start + startPattern.length)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('TaskPage source switching host boundary', () => {
  it('switches task source without mutating the focused run host', () => {
    const section = sourceBetween(
      TASK_PAGE_SOURCE,
      '{visibleSourceOptions.map((source) => {',
      "{taskSource === 'linear' && linearConnected ?"
    )

    expect(section).toContain('openTaskPage(')
    expect(section).toContain('taskSource: source.id')
    expect(section).toContain('defaultTaskSource: source.id')
    expect(section).not.toContain('activeRuntimeEnvironmentId')
    expect(section).not.toContain('projectHostSetupId')
    expect(section).not.toContain('workspaceRunContext')
  })
})
