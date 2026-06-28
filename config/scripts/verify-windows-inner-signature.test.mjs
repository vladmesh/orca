import { describe, expect, it } from 'vitest'
import {
  evaluateInnerSignature,
  parseAuthenticodeSignature,
  parseSigntoolOutput
} from './verify-windows-inner-signature.mjs'

describe('parseSigntoolOutput', () => {
  it('treats zero errors with a signer line as valid', () => {
    const output = [
      'Verifying: Orca.exe',
      '',
      'Signature Index: 0 (Primary Signature)',
      'Hash of file (sha256): ABC123',
      '',
      'Signing Certificate Chain:',
      '    Issued to: SignPath Foundation',
      '    Issued by: SSL.com Code Signing Intermediate CA RSA R1',
      '',
      'Successfully verified: Orca.exe',
      '',
      'Number of files successfully Verified: 1',
      'Number of warnings: 0',
      'Number of errors: 0'
    ].join('\r\n')

    expect(parseSigntoolOutput(output)).toEqual({
      valid: true,
      signerSubject: 'SignPath Foundation'
    })
  })

  it('treats a nonzero error count as invalid', () => {
    const output = [
      'Verifying: Orca.exe',
      'SignTool Error: No signature found.',
      '',
      'Number of errors: 1'
    ].join('\r\n')

    expect(parseSigntoolOutput(output)).toEqual({
      valid: false,
      signerSubject: null
    })
  })

  it('falls back to the success line when no error count is printed', () => {
    const output = ['Successfully verified: Orca.exe'].join('\n')
    expect(parseSigntoolOutput(output)).toEqual({
      valid: true,
      signerSubject: null
    })
  })

  it('reports invalid for empty or missing output', () => {
    expect(parseSigntoolOutput('')).toEqual({ valid: false, signerSubject: null })
    expect(parseSigntoolOutput(undefined)).toEqual({ valid: false, signerSubject: null })
  })
})

describe('parseAuthenticodeSignature', () => {
  it('maps a Valid status to a valid result and extracts the signer subject', () => {
    expect(
      parseAuthenticodeSignature({
        Status: 'Valid',
        SignerSubject: 'CN=SignPath Foundation, O=SignPath Foundation, C=US'
      })
    ).toEqual({
      valid: true,
      signerSubject: 'CN=SignPath Foundation, O=SignPath Foundation, C=US',
      status: 'Valid'
    })
  })

  it('maps a NotSigned status to invalid', () => {
    expect(parseAuthenticodeSignature({ Status: 'NotSigned', SignerSubject: null })).toEqual({
      valid: false,
      signerSubject: null,
      status: 'NotSigned'
    })
  })

  it('handles HashMismatch (tampered binary) as invalid', () => {
    expect(
      parseAuthenticodeSignature({ Status: 'HashMismatch', SignerSubject: 'CN=Whoever' })
    ).toEqual({
      valid: false,
      signerSubject: 'CN=Whoever',
      status: 'HashMismatch'
    })
  })

  it('tolerates non-object input', () => {
    expect(parseAuthenticodeSignature(null)).toEqual({
      valid: false,
      signerSubject: null,
      status: null
    })
    expect(parseAuthenticodeSignature('not-an-object')).toEqual({
      valid: false,
      signerSubject: null,
      status: null
    })
  })
})

describe('evaluateInnerSignature', () => {
  it('passes when valid and the signer matches the expected substring', () => {
    expect(
      evaluateInnerSignature(
        { valid: true, signerSubject: 'CN=SignPath Foundation, O=SignPath Foundation' },
        { expectedSignerSubstring: 'SignPath Foundation' }
      )
    ).toEqual({ ok: true, reason: null })
  })

  it('matches the expected signer case-insensitively', () => {
    expect(
      evaluateInnerSignature(
        { valid: true, signerSubject: 'CN=signpath foundation' },
        { expectedSignerSubstring: 'SignPath Foundation' }
      ).ok
    ).toBe(true)
  })

  it('fails when the signature is invalid even if a subject is present', () => {
    const verdict = evaluateInnerSignature(
      { valid: false, signerSubject: 'CN=SignPath Foundation' },
      { expectedSignerSubstring: 'SignPath Foundation' }
    )
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/valid Authenticode signature/)
  })

  it('fails a valid signature signed by an unexpected identity', () => {
    const verdict = evaluateInnerSignature(
      { valid: true, signerSubject: 'CN=Some Dev Cert' },
      { expectedSignerSubstring: 'SignPath Foundation' }
    )
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/does not contain expected/)
  })

  it('passes a valid signature when no expected signer is configured', () => {
    expect(
      evaluateInnerSignature({ valid: true, signerSubject: null }).ok
    ).toBe(true)
  })
})
