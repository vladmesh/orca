#!/usr/bin/env node

// Why: Windows Smart App Control (issue #6487) evaluates the inner application
// executable (Orca.exe), not just the outer NSIS installer. The release pipeline
// signs and verifies orca-windows-setup.exe, but nothing asserted that the
// Orca.exe extracted from that installer carries a valid Authenticode signature.
// SignPath must be configured server-side to recursively sign nested PE files
// (its artifact configuration must declare the inner exe / app-64.7z payload as
// signable; that lives in the SignPath dashboard, not this repo). This script is
// the CI gate that fails the release if recursive signing did not actually land
// on Orca.exe, so an unsigned inner binary can never reach users.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Why: signtool ships a localized "Successfully verified" line, but the
// structured, scriptable signal is the per-file "Number of ... errors: N"
// summary, which is emitted in the invariant (English) form regardless of UI
// language. We treat zero signing-cert errors as the success condition.
const SIGNTOOL_SUCCESS_PATTERN = /Successfully verified:/i
const SIGNTOOL_ERROR_COUNT_PATTERN = /Number of errors:\s*(\d+)/i

/**
 * Parse `signtool verify /pa /v <file>` output into a normalized result.
 * `signtool` exits non-zero on failure, so callers should also honor the exit
 * code; this parser exists so the verdict + signer can be asserted in tests and
 * surfaced in logs without depending on a live signed binary.
 *
 * @param {string} output combined stdout/stderr from signtool
 * @returns {{ valid: boolean, signerSubject: string | null }}
 */
export function parseSigntoolOutput(output) {
  const text = String(output ?? '')
  const errorCountMatch = text.match(SIGNTOOL_ERROR_COUNT_PATTERN)
  const errorCount = errorCountMatch ? Number.parseInt(errorCountMatch[1], 10) : null
  // Why: prefer the explicit error count when signtool prints it; otherwise fall
  // back to the success line so non-verbose invocations still parse.
  const valid =
    errorCount === 0 || (errorCount === null && SIGNTOOL_SUCCESS_PATTERN.test(text))
  return {
    valid,
    signerSubject: extractSigntoolSignerSubject(text)
  }
}

function extractSigntoolSignerSubject(text) {
  // signtool /v prints "Issued to: <subject>" for the leaf signing cert.
  const issuedTo = text.match(/Issued to:\s*(.+?)\s*$/im)
  if (issuedTo) {
    return issuedTo[1].trim()
  }
  return null
}

/**
 * Parse a JSON object emitted by PowerShell's Get-AuthenticodeSignature
 * (`... | Select-Object Status,@{...SignerCertificate.Subject...} | ConvertTo-Json`).
 * PowerShell's Authenticode Status enum is `Valid` (0) when the signature chains
 * to a trusted root and matches the file hash.
 *
 * @param {unknown} parsed already-JSON-parsed Get-AuthenticodeSignature object
 * @returns {{ valid: boolean, signerSubject: string | null, status: string | null }}
 */
export function parseAuthenticodeSignature(parsed) {
  if (parsed === null || typeof parsed !== 'object') {
    return { valid: false, signerSubject: null, status: null }
  }
  const record = /** @type {Record<string, unknown>} */ (parsed)
  const status = typeof record.Status === 'string' ? record.Status : null
  const signerSubject =
    typeof record.SignerSubject === 'string' && record.SignerSubject.length > 0
      ? record.SignerSubject
      : null
  return {
    valid: status === 'Valid',
    signerSubject,
    status
  }
}

/**
 * Assert that a parsed inner-signature result is acceptable for release.
 * `expectedSignerSubstring` guards against a valid-but-wrong-signer regression
 * (e.g. an ad-hoc or developer cert), mirroring the outer-installer gate that
 * pins `CN=SignPath Foundation`.
 *
 * @param {{ valid: boolean, signerSubject: string | null }} result
 * @param {{ expectedSignerSubstring?: string | null }} [options]
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function evaluateInnerSignature(result, options = {}) {
  const expected = options.expectedSignerSubstring ?? null
  if (!result.valid) {
    return {
      ok: false,
      reason: 'Inner Orca.exe does not carry a valid Authenticode signature.'
    }
  }
  if (expected) {
    const subject = result.signerSubject ?? ''
    if (!subject.toLowerCase().includes(expected.toLowerCase())) {
      return {
        ok: false,
        reason: `Inner Orca.exe signer "${result.signerSubject ?? '<unknown>'}" does not contain expected "${expected}".`
      }
    }
  }
  return { ok: true, reason: null }
}

function verifyWithSigntool(filePath) {
  // Why: /pa uses the "Default Authentication Verification Policy" (the same
  // chain SAC evaluates); /v gives the verbose "Issued to" signer line.
  const output = execFileSync('signtool', ['verify', '/pa', '/v', filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return parseSigntoolOutput(output)
}

function verifyWithPowerShell(filePath) {
  const script = [
    '$ErrorActionPreference = "Stop"',
    `$sig = Get-AuthenticodeSignature -LiteralPath "${filePath.replace(/"/g, '`"')}"`,
    '$obj = [PSCustomObject]@{',
    '  Status = $sig.Status.ToString()',
    '  SignerSubject = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }',
    '}',
    '$obj | ConvertTo-Json -Compress'
  ].join('\n')
  const output = execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return parseAuthenticodeSignature(JSON.parse(output))
}

/**
 * Run the available platform verifier against a PE file. Prefers signtool (the
 * tool SignPath/electron-builder use), falling back to PowerShell's
 * Get-AuthenticodeSignature. Only meaningful on Windows runners.
 *
 * @param {string} filePath
 * @returns {{ valid: boolean, signerSubject: string | null }}
 */
export function verifyInnerExecutableSignature(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Inner executable not found at ${filePath}`)
  }
  if (process.platform !== 'win32') {
    throw new Error(
      'verifyInnerExecutableSignature must run on a Windows runner (signtool/PowerShell required).'
    )
  }
  try {
    return verifyWithSigntool(filePath)
  } catch (signtoolError) {
    try {
      return verifyWithPowerShell(filePath)
    } catch (powershellError) {
      throw new Error(
        `Unable to verify Authenticode signature for ${filePath}. signtool: ${
          signtoolError instanceof Error ? signtoolError.message : signtoolError
        }; powershell: ${
          powershellError instanceof Error ? powershellError.message : powershellError
        }`
      )
    }
  }
}

function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    throw new Error('Usage: node config/scripts/verify-windows-inner-signature.mjs <orca-exe-path>')
  }
  const expectedSignerSubstring =
    process.env.ORCA_WINDOWS_EXPECTED_SIGNER || 'SignPath Foundation'
  const result = verifyInnerExecutableSignature(filePath)
  const verdict = evaluateInnerSignature(result, { expectedSignerSubstring })
  if (!verdict.ok) {
    throw new Error(
      `${verdict.reason}\nSigner subject: ${result.signerSubject ?? '<none>'}\n` +
        'SignPath must be configured to recursively sign nested PE files ' +
        '(the inner Orca.exe / app-64.7z payload) in its artifact configuration.'
    )
  }
  console.log(
    `Verified inner Orca.exe Authenticode signature (signer: ${result.signerSubject ?? '<unknown>'}).`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
