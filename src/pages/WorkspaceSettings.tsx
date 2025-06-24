import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useRole } from '../context/RoleContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { availableCurrencies } from '../contexts/CurrencyContext';
import { Button } from '../components/ui/button';

const timezones = [
  'UTC',
  'Europe/Paris',
  'America/New_York',
  'Asia/Tokyo'
];

const WorkspaceSettings: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { workspace, update, loading } = useWorkspace();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setTimezone(workspace.timezone);
      setCurrency(workspace.currency);
    }
  }, [workspace]);

  if (!roleLoading && !isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await update({ name, timezone, currency });
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Workspace Settings</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium mb-1">Store Name</label>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Time Zone</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
          >
            {timezones.map(tz => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
          >
            {availableCurrencies.map(cur => (
              <option key={cur} value={cur}>
                {cur}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={loading}>
          Save
        </Button>
      </form>
    </div>
  );
};

export default WorkspaceSettings;
