import React, { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';

import MfaEnroll from './MfaEnroll';

interface Factor {
  id: string;
  factor_type: string;
  friendly_name?: string;
}

const MfaSettings: React.FC = () => {
  const [factors, setFactors] = useState<Factor[]>([]);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.all ?? []);
  };

  useEffect(() => {
    loadFactors();
  }, []);

  const removeFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      console.error('Unable to remove factor', error);
    }
    loadFactors();
  };

  return (
    <div className="space-y-4">
      {factors.length === 0 ? (
        <MfaEnroll onComplete={loadFactors} />
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {factors.map((f) => (
              <li key={f.id} className="flex justify-between items-center border p-2 rounded">
                <span>{f.friendly_name || f.factor_type}</span>
                <Button size="sm" variant="ghost" onClick={() => removeFactor(f.id)}>
                  Remove
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
