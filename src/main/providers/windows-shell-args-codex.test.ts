import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveWindowsShellLaunchArgs } from './windows-shell-args'

const hasBash = process.platform !== 'win32' && spawnSync('bash', ['--version']).status === 0
const itWithBash = hasBash ? it : it.skip

function quoteBashSingle(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function createFakeCodexBin(tempDir: string): string {
  const binDir = join(tempDir, 'bin')
  mkdirSync(binDir, { recursive: true })
  const codexPath = join(binDir, 'codex')
  writeFileSync(
    codexPath,
    `#!/usr/bin/env bash
printf 'CODEX_HOME=%s\\n' "$CODEX_HOME"
i=0
for arg in "$@"; do
  printf 'ARG%s=%s\\n' "$i" "$arg"
  i=$((i + 1))
done
`,
    'utf-8'
  )
  chmodSync(codexPath, 0o755)
  return binDir
}

function expectFakeCodexSafetyOutput(output: string): void {
  expect(output).toContain('CODEX_HOME=/orca-managed-home')
  expect(output).toContain('ARG0=-c')
  expect(output).toContain('ARG1=history.persistence="save-all"')
  expect(output).toContain('ARG4=-c')
  expect(output).toContain('ARG5=history.persistence="none"')
  expect(output.indexOf('ARG1=history.persistence="save-all"')).toBeLessThan(
    output.indexOf('ARG5=history.persistence="none"')
  )
}

function expectSafetyBeforeTerminatorOutput(output: string): void {
  expect(output).toContain('CODEX_HOME=/orca-managed-home')
  expect(output).toContain('ARG0=resume')
  expect(output).toContain('ARG1=-c')
  expect(output).toContain('ARG2=history.persistence="save-all"')
  expect(output).toContain('ARG3=-c')
  expect(output).toContain('ARG4=history.persistence="none"')
  expect(output).toContain('ARG5=--')
  expect(output).toContain('ARG6=--help')
}

function runBootstrapWithFakeCodex(bootstrap: string, fakeBin: string, tempDir: string) {
  return spawnSync('bash', ['-c', bootstrap], {
    env: {
      ...process.env,
      ORCA_CODEX_HOME: '/orca-managed-home',
      CODEX_HOME: '/initial-home',
      HOME: tempDir,
      PATH: `${fakeBin}:${process.env.PATH ?? '/usr/bin:/bin'}`
    },
    encoding: 'utf8'
  })
}

describe('Windows Codex shell launch wrappers', () => {
  itWithBash('Git Bash bootstrap restores CODEX_HOME when startup files reset it', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'orca-git-bash-codex-'))
    try {
      const fakeBin = createFakeCodexBin(tempDir)
      const result = resolveWindowsShellLaunchArgs(
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Users\\alice\\code',
        'C:\\Users\\alice'
      )
      const bootstrap = (result.shellArgs[1] ?? '').replace(
        '; exec bash --login -i',
        `; bash -l -c ${quoteBashSingle(
          'export CODEX_HOME=/profile-reset; codex -c \'history.persistence="save-all"\' resume session-1'
        )}`
      )
      const run = runBootstrapWithFakeCodex(bootstrap, fakeBin, tempDir)

      expect(run.status).toBe(0)
      expectFakeCodexSafetyOutput(run.stdout)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  itWithBash('Git Bash bootstrap sources login startup files once', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'orca-git-bash-profile-'))
    try {
      const counterPath = join(tempDir, 'profile-count')
      writeFileSync(
        join(tempDir, '.bash_profile'),
        `count=0
if [[ -f ${quoteBashSingle(counterPath)} ]]; then
  count=$(cat ${quoteBashSingle(counterPath)})
fi
printf '%s' "$((count + 1))" > ${quoteBashSingle(counterPath)}
`,
        'utf-8'
      )
      const result = resolveWindowsShellLaunchArgs(
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Users\\alice\\code',
        'C:\\Users\\alice'
      )
      const bootstrap = (result.shellArgs[1] ?? '').replace(
        'exec bash --login -i',
        'bash --login -i -c true'
      )
      const run = spawnSync('bash', ['-c', bootstrap], {
        env: {
          ...process.env,
          ORCA_CODEX_HOME: '/orca-managed-home',
          HOME: tempDir
        },
        encoding: 'utf8'
      })

      expect(run.status).toBe(0)
      expect(existsSync(counterPath)).toBe(true)
      expect(readFileSync(counterPath, 'utf8')).toBe('1')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  itWithBash('Git Bash bootstrap inserts the safety override before --', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'orca-git-bash-codex-'))
    try {
      const fakeBin = createFakeCodexBin(tempDir)
      const result = resolveWindowsShellLaunchArgs(
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Users\\alice\\code',
        'C:\\Users\\alice'
      )
      const bootstrap = (result.shellArgs[1] ?? '').replace(
        '; exec bash --login -i',
        `; bash -l -c ${quoteBashSingle(
          'codex resume -c \'history.persistence="save-all"\' -- --help'
        )}`
      )
      const run = runBootstrapWithFakeCodex(bootstrap, fakeBin, tempDir)

      expect(run.status).toBe(0)
      expectSafetyBeforeTerminatorOutput(run.stdout)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  itWithBash('WSL bootstrap restores CODEX_HOME inside the final login shell invocation', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'orca-wsl-codex-'))
    try {
      const fakeBin = createFakeCodexBin(tempDir)
      const result = resolveWindowsShellLaunchArgs('wsl.exe', '/tmp', 'C:\\Users\\alice', {
        distro: 'Ubuntu',
        treatPosixCwdAsWsl: true
      })
      const bootstrap = (result.shellArgs[5] ?? '').replace(/\\\$/g, '$').replace(
        'exec "$_orca_wsl_shell" -l',
        `bash -l -c ${quoteBashSingle(
          'export CODEX_HOME=/profile-reset; codex -c \'history.persistence="save-all"\' resume session-1'
        )}`
      )
      const run = runBootstrapWithFakeCodex(bootstrap, fakeBin, tempDir)

      expect(run.status).toBe(0)
      expectFakeCodexSafetyOutput(run.stdout)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  itWithBash('WSL bootstrap inserts the safety override before --', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'orca-wsl-codex-'))
    try {
      const fakeBin = createFakeCodexBin(tempDir)
      const result = resolveWindowsShellLaunchArgs('wsl.exe', '/tmp', 'C:\\Users\\alice', {
        distro: 'Ubuntu',
        treatPosixCwdAsWsl: true
      })
      const bootstrap = (result.shellArgs[5] ?? '').replace(/\\\$/g, '$').replace(
        'exec "$_orca_wsl_shell" -l',
        `bash -l -c ${quoteBashSingle(
          'codex resume -c \'history.persistence="save-all"\' -- --help'
        )}`
      )
      const run = runBootstrapWithFakeCodex(bootstrap, fakeBin, tempDir)

      expect(run.status).toBe(0)
      expectSafetyBeforeTerminatorOutput(run.stdout)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
