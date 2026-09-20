import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { MfaFactorSummary } from '@/lib/auth/mfaPolicy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MfaOtpFormProps {
  factors: MfaFactorSummary[];
  onVerified: () => void | Promise<void>;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : 'The authentication code could not be verified.';

const MfaOtpForm: React.FC<MfaOtpFormProps> = ({ factors, onVerified }) => {
  const defaultFactorId = factors[0]?.id ?? '';
  const [factorId, setFactorId] = useState(defaultFactorId);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedFactor = useMemo(
    () => factors.find((factor) => factor.id === factorId),
    [factorId, factors]
  );

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = code.trim();
    if (!factorId || !normalizedCode) return;

    setErrorMessage('');

    try {
      setLoading(true);

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: normalizedCode
      });

      if (verifyError) throw verifyError;

      setCode('');
      await onVerified();
    } catch (error: unknown) {
      console.error('OTP verification failed:', error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (factors.length === 0) {
    return (
      <p className="text-sm text-red-600" role="alert">
        No verified authentication factor is available.
      </p>
    );
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      {factors.length > 1 && (
        <div className="space-y-2">
          <label htmlFor="mfa-factor" className="block text-sm font-medium text-gray-700">
            Authentication method
          </label>
          <select
            id="mfa-factor"
            value={factorId}
            onChange={(event) => {
              setFactorId(event.target.value);
              setCode('');
              setErrorMessage('');
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            disabled={loading}
          >
            {factors.map((factor) => (
              <option key={factor.id} value={factor.id}>
                {factor.friendlyName || factor.factorType}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedFactor && (
        <p className="text-sm text-gray-600">
          Enter the code from {selectedFactor.friendlyName || selectedFactor.factorType}.
        </p>
      )}

      <Input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="Enter authentication code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={loading}
        required
      />

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        disabled={loading || !factorId || !code.trim()}
        className="w-full bg-primary text-white"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Verify Code'}
      </Button>
    </form>
  );
};

export default MfaOtpForm;
