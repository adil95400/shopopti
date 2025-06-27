import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface EnrollResult {
  id: string;
  qr_code: string;
}

interface MfaEnrollProps {
  onComplete?: () => void;
}

const MfaEnroll: React.FC<MfaEnrollProps> = ({ onComplete }) => {
  const [enrollData, setEnrollData] = useState<EnrollResult | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const startEnrollment = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      console.error('Failed to enroll factor', error);
      return;
    }
    if (data?.totp) {
      setEnrollData({ id: data.id, qr_code: data.totp.qr_code });
    }
  };

  const verifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    try {
      setVerifying(true);
      const { data: challengeData, error: chalErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id
      });
      if (chalErr) throw chalErr;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code
      });
      if (error) throw error;
      setEnrollData(null);
      setCode('');
      if (onComplete) onComplete();
    } catch (err: any) {
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  if (!enrollData) {
    return (
      <Button onClick={startEnrollment} className="bg-primary text-white">
        Enable Authenticator App
      </Button>
    );
  }

  return (
    <form onSubmit={verifyEnrollment} className="space-y-4">
      <img src={enrollData.qr_code} alt="QR code" className="mx-auto" />
      <Input
        type="text"
        placeholder="Enter code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <Button type="submit" disabled={verifying} className="w-full bg-primary text-white">
        {verifying ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Verify'}
      </Button>
    </form>
  );
};

export default MfaEnroll;
