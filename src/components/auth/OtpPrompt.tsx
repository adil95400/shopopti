import React, { useState } from 'react';

import { Button } from '../ui/button';

interface OtpPromptProps {
  onSubmit: (code: string) => Promise<void>;
  loading?: boolean;
}

const OtpPrompt: React.FC<OtpPromptProps> = ({ onSubmit, loading = false }) => {
  const [code, setCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(code);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter OTP"
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
      />
      <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary-600 text-white py-2 px-4 rounded-md">
        {loading ? 'Verifying...' : 'Verify OTP'}
      </Button>
    </form>
  );
};

export default OtpPrompt;
