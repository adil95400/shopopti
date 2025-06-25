import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface MfaOtpFormProps {
  factorId: string;
  challengeId: string;
  onVerified: () => void;
}

const MfaOtpForm: React.FC<MfaOtpFormProps> = ({ factorId, challengeId, onVerified }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code
      });
      if (error) throw error;
      onVerified();
    } catch (err: any) {
      console.error('OTP verification failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <Input
        type="text"
        placeholder="Enter authentication code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading} className="w-full bg-primary text-white">
        {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Verify Code'}
      </Button>
    </form>
  );
};

export default MfaOtpForm;
