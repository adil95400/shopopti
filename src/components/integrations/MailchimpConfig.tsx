import React, { useState } from 'react';
import { Key, Send, Save, Loader2, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../ui/button';
import { mailchimpService } from '../../modules/mailchimp';

const MailchimpConfig: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('mailchimpApiKey') || '');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSave = () => {
    if (!apiKey) {
      setStatus('error');
      setMessage('API key is required');
      return;
    }
    setSaving(true);
    try {
      localStorage.setItem('mailchimpApiKey', apiKey);
      mailchimpService.setApiKey(apiKey);
      setStatus('success');
      setMessage('API key saved');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!apiKey) {
      toast.error('Please provide an API key first');
      return;
    }
    setExporting(true);
    try {
      await mailchimpService.exportSubscribers([
        { email_address: 'test@example.com', status: 'subscribed' }
      ]);
      toast.success('Emails exported to Mailchimp');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-yellow-100 rounded-full mr-3">
          <Mail className="h-5 w-5 text-yellow-600" />
        </div>
        <h3 className="text-lg font-medium">Mailchimp</h3>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="mc_api_key"
            />
          </div>
        </div>
      </div>

      {status !== 'idle' && (
        <div className={`mb-6 p-4 rounded-md ${status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="flex items-center">
            {status === 'success' ? <CheckCircle className="h-5 w-5 mr-2" /> : <AlertCircle className="h-5 w-5 mr-2" />}
            <p>{message}</p>
          </div>
        </div>
      )}

      <div className="flex space-x-3">
        <Button variant="outline" onClick={handleSave} disabled={saving || !apiKey} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <><Save className="h-4 w-4 mr-2" />Save</>}
        </Button>
        <Button onClick={handleExport} disabled={exporting || !apiKey} className="flex-1">
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Export Emails</>}
        </Button>
      </div>
    </div>
  );
};

export default MailchimpConfig;
