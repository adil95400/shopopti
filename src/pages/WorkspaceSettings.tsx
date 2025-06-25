import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { availableCurrencies } from '../contexts/CurrencyContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useRole } from '../context/RoleContext';

const WorkspaceSettings: React.FC = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { workspace, updateWorkspace, loading } = useWorkspace();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [currency, setCurrency] = useState('');

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setTimezone(workspace.timezone || '');
      setCurrency(workspace.currency || '');
    }
  }, [workspace]);

  if (roleLoading || loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateWorkspace({ name, timezone, currency });
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Workspace Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
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
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              />
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
            <Button type="submit">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkspaceSettings;

