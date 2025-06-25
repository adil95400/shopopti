import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { askChatGPT } from '../../lib/openai';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';

const SEOAudit: React.FC = () => {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    if (!url) return;
    try {
      setLoading(true);
      const resp = await askChatGPT(`Give me a short SEO audit for ${url}`);
      setResult(resp);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">SEO Audit</h1>
      <input className="w-full border rounded-md px-2 py-1" placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} />
      <Button onClick={runAudit} disabled={loading || !url}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Audit'}
      </Button>
      {result && <Textarea value={result} readOnly rows={10} />}
    </div>
  );
};

export default SEOAudit;
