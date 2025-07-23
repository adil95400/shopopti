import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Settings,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Bell,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

import { inventoryService, StockAlert, InventorySettings } from '@/modules/inventory';
import { Button } from '@/components/ui/button';
import { StockAlertCard } from '@/components/inventory/StockAlertCard';
import { SettingsCard } from '@/components/inventory/SettingsCard';
import { OverviewBox } from '@/components/inventory/OverviewBox';
import { NotificationSwitch } from '@/components/inventory/NotificationSwitch';

const InventoryPage: React.FC = () => {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [settings, setSettings] = useState<InventorySettings>({
    lowStockThreshold: 5,
    notifyOnLowStock: true,
    autoReorder: false,
    reorderQuantity: 10,
    trackInventoryChanges: true,
  });
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fetchedAlerts, fetchedSettings] = await Promise.all([
        inventoryService.getStockAlerts('active'),
        inventoryService.getInventorySettings(),
      ]);
      setAlerts(fetchedAlerts);
      setSettings(fetchedSettings);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await inventoryService.resolveStockAlert(alertId);
      setAlerts(alerts.filter((alert) => alert.id !== alertId));
      toast.success('Alert resolved successfully');
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };

  const handleIgnoreAlert = async (alertId: string) => {
    try {
      await inventoryService.ignoreStockAlert(alertId);
      setAlerts(alerts.filter((alert) => alert.id !== alertId));
      toast.success('Alert ignored');
    } catch (error) {
      console.error('Error ignoring alert:', error);
      toast.error('Failed to ignore alert');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await inventoryService.updateInventorySettings(settings);
      setSettingsOpen(false);
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold">Inventory Management</h1>
          <p className="text-gray-600">Monitor stock levels and manage inventory alerts</p>
        </div>
        <div className="flex space-x-2 mt-4 md:mt-0">
          <Button variant="outline" onClick={() => setSettingsOpen(!settingsOpen)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {settingsOpen && (
        <SettingsCard
          settings={settings}
          setSettings={setSettings}
          onSave={handleSaveSettings}
          onCancel={() => setSettingsOpen(false)}
        />
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h3 className="text-lg font-medium">Low Stock Alerts</h3>
          <div className="flex space-x-2 mt-4 md:mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">No low stock alerts</h3>
            <p className="text-gray-500">All your products have sufficient stock levels.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <StockAlertCard
                key={alert.id}
                alert={alert}
                onIgnore={handleIgnoreAlert}
                onResolve={handleResolveAlert}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OverviewBox alerts={alerts} />
        <NotificationSwitch />
      </div>
    </div>
  );
};

export default InventoryPage;
