import React from 'react';
import { InventorySettings } from '@/modules/inventory';
import { Button } from '@/components/ui/button';

export const SettingsCard = ({
  settings,
  setSettings,
  onSave,
  onCancel,
}: {
  settings: InventorySettings;
  setSettings: (val: InventorySettings) => void;
  onSave: () => void;
  onCancel: () => void;
}) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
    <h3 className="text-lg font-medium mb-4">Inventory Settings</h3>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
        <input
          type="number"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          value={settings.lowStockThreshold}
          onChange={(e) =>
            setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value) })
          }
        />
      </div>
      <div className="flex items-center justify-between">
        <span>Notify on Low Stock</span>
        <input
          type="checkbox"
          checked={settings.notifyOnLowStock}
          onChange={(e) => setSettings({ ...settings, notifyOnLowStock: e.target.checked })}
        />
      </div>
      <div className="flex items-center justify-between">
        <span>Auto Reorder</span>
        <input
          type="checkbox"
          checked={settings.autoReorder}
          onChange={(e) => setSettings({ ...settings, autoReorder: e.target.checked })}
        />
      </div>
      {settings.autoReorder && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Quantity</label>
          <input
            type="number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={settings.reorderQuantity}
            onChange={(e) =>
              setSettings({ ...settings, reorderQuantity: parseInt(e.target.value) })
            }
          />
        </div>
      )}
    </div>
    <div className="mt-6 flex justify-end space-x-2">
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button onClick={onSave}>Save Settings</Button>
    </div>
  </div>
);
