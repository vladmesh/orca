import type { Repo } from '../../../shared/types'
import { getRepoExecutionHostId } from '../../../shared/execution-host'

export function getRepoSettingsSectionId(
  repo: Pick<Repo, 'id' | 'connectionId' | 'executionHostId'>
): string {
  return `repo-${encodeURIComponent(getRepoExecutionHostId(repo))}:${encodeURIComponent(repo.id)}`
}

export function parseRepoSettingsSectionId(
  sectionId: string
): { repoId: string; repoHostId: string } | null {
  if (!sectionId.startsWith('repo-')) {
    return null
  }
  const payload = sectionId.slice('repo-'.length)
  const separatorIndex = payload.indexOf(':')
  if (separatorIndex <= 0 || separatorIndex >= payload.length - 1) {
    return null
  }
  const repoHostId = decodeURIComponent(payload.slice(0, separatorIndex))
  const repoId = decodeURIComponent(payload.slice(separatorIndex + 1))
  return repoId && repoHostId ? { repoId, repoHostId } : null
}
