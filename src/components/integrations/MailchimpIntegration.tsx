import React, { useState } from 'react';
import { Mail, Key, Loader2 } from 'lucide-react';

import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { configureMailchimp, mailchimpService } from '../../modules/mailchimp';

const MailchimpIntegration: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('mailchimpApiKey')) || ''
  );
  const [server, setServer] = useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('mailchimpServerPrefix')) || ''
  );
  const [listId, setListId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = () => {
    try {
      configureMailchimp(apiKey, server);
      setMessage('Credentials saved');
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setMessage('');
    try {
      configureMailchimp(apiKey, server);
      const count = await mailchimpService.exportOrderEmails(listId);
      setMessage(`Exported ${count} emails`);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
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

      <div className="space-y-4 mb-4">
        <Input
          icon={<Key className="h-5 w-5 text-gray-400" />}
          placeholder="API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <Input
          placeholder="Server Prefix (e.g. us1)"
          value={server}
          onChange={(e) => setServer(e.target.value)}
        />
        <Input
          placeholder="List ID"
          value={listId}
          onChange={(e) => setListId(e.target.value)}
        />
      </div>

      {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}

      <div className="flex space-x-2">
        <Button onClick={handleSave} disabled={!apiKey || !server} className="flex-1">
          Save
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={loading || !listId}
          className="flex-1"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          Export Emails
        </Button>
      </div>
    </div>
  );
};

export default MailchimpIntegration;
