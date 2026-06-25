import { translate } from '@/i18n/i18n'
import { searchKeywords } from './settings-search-keywords'

export function getManagedAgentSkillBackgroundUpdatesTitle(): string {
  return translate(
    'auto.components.settings.managed.agent.skill.background.updates.title',
    'Automatically update verified Orca skills'
  )
}

export function getManagedAgentSkillBackgroundUpdatesDescription(): string {
  return translate(
    'auto.components.settings.managed.agent.skill.background.updates.description',
    'Experimental. When enabled, Orca can update verified Orca-managed global skills in the background when a workflow needs them. When off, Orca asks you to review updates manually.'
  )
}

export function getManagedAgentSkillBackgroundUpdatesSearchKeywords(): string[] {
  return searchKeywords([
    {
      key: 'auto.components.settings.managed.agent.skill.background.updates.search.experimental',
      fallback: 'experimental'
    },
    {
      key: 'auto.components.settings.managed.agent.skill.background.updates.search.automatic',
      fallback: 'automatic'
    },
    {
      key: 'auto.components.settings.managed.agent.skill.background.updates.search.update',
      fallback: 'update'
    },
    {
      key: 'auto.components.settings.managed.agent.skill.background.updates.search.skills',
      fallback: 'skills'
    },
    {
      key: 'auto.components.settings.managed.agent.skill.background.updates.search.manual',
      fallback: 'manual'
    }
  ])
}
