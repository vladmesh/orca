import { describe, expect, it } from 'vitest'
import { normalizeRepoSourceControlAiOverrides } from '../../../../shared/source-control-ai'
import { dropRepoLegacyInstructionForAction } from './RepositorySourceControlAiSection'

describe('dropRepoLegacyInstructionForAction', () => {
  it('prevents legacy text instructions from remigrating after an action override is cleared', () => {
    const next = dropRepoLegacyInstructionForAction(
      {
        instructionsByOperation: {
          commitMessage: 'Use repo style.',
          pullRequest: 'Use PR style.'
        },
        actionOverrides: {}
      },
      'commitMessage'
    )

    expect(next.instructionsByOperation).toEqual({ pullRequest: 'Use PR style.' })
    const normalized = normalizeRepoSourceControlAiOverrides(next)
    expect(normalized?.actionOverrides?.commitMessage).toBeUndefined()
    expect(normalized?.actionOverrides?.pullRequest).toEqual({
      commandInputTemplate: '{basePrompt}\n\nUse PR style.'
    })
  })

  it('leaves launch action recipes alone because they have no legacy instruction key', () => {
    const value = {
      instructionsByOperation: { commitMessage: 'Use repo style.' },
      actionOverrides: {
        fixChecks: { commandInputTemplate: '{basePrompt}' }
      }
    }

    expect(dropRepoLegacyInstructionForAction(value, 'fixChecks')).toBe(value)
  })
})
