import React, { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { hasCompletedMfa } from '@/lib/auth/mfaPolicy';
import { Button } from '@/components/ui/button';

import MfaEnroll from './MfaEnroll';

interface Factor {
  id: string;
  factor_type: string;
  friendly_name?: string | null;
  status?: string | null;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const MfaSettings: React.FC = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      console.error('Unable to load MFA factors', error);
      setErrorMessage(error.message);
      return;
    }

    setFactors(data?.all ?? []);
  };

  useEffect(() => {
    void loadFactors();
  }, []);

  const removeFactor = async (id: string) => {
    setErrorMessage('');
    setRemovingId(id);

    try {
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (!hasCompletedMfa(aal?.currentLevel)) {
        throw new Error(
          'Please complete two-factor authentication before removing a verified factor.'
        );
      }

      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;

      await loadFactors();
    } catch (error: unknown) {
      console.error('Unable to remove factor', error);
      setErrorMessage(
        getErrorMessage(error, 'Unable to remove the authentication factor.')
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      {factors.length === 0 ? (
        <MfaEnroll onComplete={loadFactors} />
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {factors.map((factor) => (
              <li
                key={factor.id}
                className="flex justify-between items-center border p-2 rounded"
              >
                <div>
                  <span>{factor.friendly_name || factor.factor_type}</span>
                  {factor.status && (
                    <span className="ml-2 text-xs text-gray-500">
                      {factor.status}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={removingId === factor.id}
                  onClick={() => void removeFactor(factor.id)}
                >
                  {removingId === factor.id ? 'Removing...' : 'Remove'}
                </Button>
              </li>
            ))}
          </ul>
          <MfaEnroll onComplete={loadFactors} />
        </div>
      )}
    </div>
  );
};

export default MfaSettings;
