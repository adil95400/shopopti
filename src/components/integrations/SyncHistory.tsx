import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { platformService, type SyncHistoryRecord } from '@/services/platformService';

interface SyncHistoryProps {
  onRefresh: () => Promise<void>;
}

const SyncHistory: React.FC<SyncHistoryProps> = ({ onRefresh }) => {
  const [events, setEvents] = useState<SyncHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await platformService.getSyncHistory());
    } catch (loadError) {
      setEvents([]);
      setError(loadError instanceof Error ? loadError.message : 'Sync history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleRefresh = async () => {
    try {
      await onRefresh();
      await loadHistory();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Sync history refresh failed.');
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Sync history</h3>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="rounded-md border border-gray-200 p-4 text-sm text-gray-600">
          No server-confirmed synchronization has been recorded.
        </p>
      )}

      <div className="divide-y divide-gray-200">
        {events.map(event => (
          <div key={event.id} className="flex items-start gap-3 py-4">
            {event.status === 'success'
              ? <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
              : <XCircle className="mt-0.5 h-5 w-5 text-red-600" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">{event.type}</p>
              <p className="text-sm text-gray-600">
                {event.items_succeeded}/{event.items_processed} succeeded
                {event.items_failed > 0 ? `, ${event.items_failed} failed` : ''}
              </p>
              <p className="text-xs text-gray-500">{new Date(event.created_at).toLocaleString()}</p>
            </div>
            <span className="text-sm text-gray-600">{event.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SyncHistory;
