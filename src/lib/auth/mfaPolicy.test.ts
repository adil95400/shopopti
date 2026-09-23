import { describe, expect, it } from 'vitest';

import {
  hasCompletedMfa,
  requiresMfaChallenge,
  toVerifiedFactorSummaries
} from './mfaPolicy';

describe('MFA policy', () => {
  it('requires a challenge only when aal1 must be upgraded to aal2', () => {
    expect(requiresMfaChallenge('aal1', 'aal2')).toBe(true);
    expect(requiresMfaChallenge('aal1', 'aal1')).toBe(false);
    expect(requiresMfaChallenge('aal2', 'aal2')).toBe(false);
    expect(requiresMfaChallenge(null, null)).toBe(false);
  });

  it('treats only aal2 as completed MFA', () => {
    expect(hasCompletedMfa('aal2')).toBe(true);
    expect(hasCompletedMfa('aal1')).toBe(false);
    expect(hasCompletedMfa(null)).toBe(false);
  });

  it('keeps only verified factors and normalizes their display fields', () => {
    expect(
      toVerifiedFactorSummaries([
        {
          id: 'verified-factor',
          factor_type: 'totp',
          friendly_name: 'Authenticator',
          status: 'verified'
        },
        {
          id: 'pending-factor',
          factor_type: 'totp',
          friendly_name: null,
          status: 'unverified'
        }
      ])
    ).toEqual([
      {
        id: 'verified-factor',
        factorType: 'totp',
        friendlyName: 'Authenticator'
      }
    ]);
  });
});
