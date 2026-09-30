import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EnrollResult {
  id: string;
  qr_code: string;
  secret?: string;
}

interface MfaEnrollProps {
  onComplete?: () => void;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const MfaEnroll: React.FC<MfaEnrollProps> = ({ onComplete }) => {
  const [enrollData, setEnrollData] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const startEnrollment = async () => {
    setErrorMessage('');
    setStarting(true);

    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp'
      });

      if (error) throw error;

      if (!data?.totp) {
        throw new Error('Authenticator enrollment data was not returned.');
      }

      setEnrollData({
        id: data.id,
        qr_code: data.totp.qr_code,
        secret: data.totp.secret
      });
    } catch (error: unknown) {
      console.error('Failed to enroll factor', error);
      setErrorMessage(
        getErrorMessage(error, 'Unable to start two-factor authentication setup.')
      );
    } finally {
      setStarting(false);
    }
  };

  const verifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;

    setErrorMessage('');

    try {
      setVerifying(true);

      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: enrollData.id
        });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code: code.trim()
      });

      if (verifyError) throw verifyError;

      setEnrollData(null);
      setCode('');
      onComplete?.();
    } catch (error: unknown) {
      console.error('Verification error:', error);
      setErrorMessage(
        getErrorMessage(error, 'The authentication code could not be verified.')
      );
    } finally {
      setVerifying(false);
    }
  };

  if (!enrollData) {
    return (
      <div className="space-y-3">
        <Button
          onClick={startEnrollment}
          disabled={starting}
          className="bg-primary text-white"
        >
          {starting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Enable Authenticator App'
          )}
        </Button>
        {errorMessage && (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={verifyEnrollment} className="space-y-4">
      <img src={enrollData.qr_code} alt="QR code" className="mx-auto" />

      {enrollData.secret && (
        <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium">Cannot scan the QR code?</p>
          <p className="mt-1 break-all font-mono">{enrollData.secret}</p>
        </div>
      )}

      <Input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="Enter code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        disabled={verifying}
        required
      />

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <Button
        type="submit"
        disabled={verifying || !code.trim()}
        className="w-full bg-primary text-white"
      >
        {verifying ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : (
          'Verify'
        )}
      </Button>
    </form>
  );
};

export default MfaEnroll;
