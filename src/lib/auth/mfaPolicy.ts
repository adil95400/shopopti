export interface MfaFactorSummary {
  id: string;
  factorType: string;
  friendlyName?: string;
}

export const requiresMfaChallenge = (
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined
): boolean => currentLevel === 'aal1' && nextLevel === 'aal2';

export const hasCompletedMfa = (
  currentLevel: string | null | undefined
): boolean => currentLevel === 'aal2';

export const toVerifiedFactorSummaries = (
  factors:
    | Array<{
        id: string;
        factor_type: string;
        friendly_name?: string | null;
        status?: string | null;
      }>
    | null
    | undefined
): MfaFactorSummary[] =>
  (factors ?? [])
    .filter((factor) => factor.status === 'verified')
    .map((factor) => ({
      id: factor.id,
      factorType: factor.factor_type,
      friendlyName: factor.friendly_name ?? undefined
    }));
