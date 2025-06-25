import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { askChatGPT } from '../../lib/openai';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';

const ProductGenerator: React.FC = () => {
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!idea) return;
    try {
      setLoading(true);
      const resp = await askChatGPT(`Create a product description for: ${idea}`);
      setResult(resp);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">AI Product Generator</h1>
      <Textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="Describe your product idea" />
      <Button onClick={generate} disabled={loading || !idea.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
      </Button>
      {result && <Textarea value={result} readOnly rows={10} />}
    </div>
  );
};

export default ProductGenerator;
