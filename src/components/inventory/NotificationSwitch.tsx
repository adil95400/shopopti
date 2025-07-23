import React from 'react';
import { Button } from '@/components/ui/button';

export const NotificationSwitch = () => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
    <div className="flex items-center mb-4">
      <div className="p-2 bg-green-100 rounded-full mr-3">🔔</div>
      <h3 className="text-lg font-medium">Notification Settings</h3>
    </div>
    <div className="space-y-4">
      {['Email Notifications', 'Push Notifications', 'Daily Report'].map((label, i) => (
        <div key={i} className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-700">{label}</p>
            <p className="text-sm text-gray-500">Settings for {label.toLowerCase()}</p>
          </div>
          <div className="relative inline-block w-12 align-middle select-none">
            <input type="checkbox" checked={true} className="sr-only" />
            <label className="block overflow-hidden h-6 rounded-full cursor-pointer bg-blue-500">
              <span className="block h-6 w-6 rounded-full bg-white transform translate-x-6"></span>
            </label>
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full">Manage Notification Settings</Button>
    </div>
  </div>
);
