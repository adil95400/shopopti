import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Factor } from '@supabase/auth-js';

import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';

import OtpPrompt from './OtpPrompt';

const TwoFactorSettings: React.FC = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [newFactorId, setNewFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const loadFactors = async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data) {
      setFactors(data.all);
    }
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const startTotp = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator',
      issuer: 'Shopopti'
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data?.totp?.qr_code) setQrCode(data.totp.qr_code);
    setNewFactorId(data.id);
  };

  const startPhone = async () => {
    if (!phone) return;
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'phone',
      phone,
      friendlyName: phone
    });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
      factorId: data.id,
      channel: 'sms'
    });
    setLoading(false);
    if (cErr) return toast.error(cErr.message);
    setNewFactorId(data.id);
    setChallengeId(challenge.id);
  };

  const verifyFactor = async (code: string) => {
    if (!newFactorId) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: newFactorId,
      challengeId: challengeId ?? undefined,
      code
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Two-factor authentication enabled');
    setQrCode(null);
    setPhone('');
    setNewFactorId(null);
    setChallengeId(null);
    loadFactors();
  };

  const disableFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast.error(error.message);
    else toast.success('Two-factor authentication disabled');
    loadFactors();
  };

  if (newFactorId && (qrCode || challengeId)) {
    return (
      <div className="space-y-4">
        {qrCode && (
          <div className="text-center">
            <p className="mb-2">Scan this QR code with your authenticator app</p>
            <img src={qrCode} alt="qr code" className="mx-auto" />
          </div>
        )}
        <OtpPrompt onSubmit={verifyFactor} loading={loading} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {factors.length > 0 ? (
        <div className="space-y-2">
          {factors.map(f => (
            <div key={f.id} className="flex justify-between items-center border p-2 rounded-md">
              <span>{f.friendly_name || f.factor_type}</span>
              <Button variant="secondary" onClick={() => disableFactor(f.id)}>
                Disable
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Button onClick={startTotp} disabled={loading} className="w-full bg-primary text-white">
            Enable Authenticator App
          </Button>
          <div className="flex space-x-2">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            />
            <Button onClick={startPhone} disabled={loading} className="bg-primary text-white">
              Enable SMS
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TwoFactorSettings;
