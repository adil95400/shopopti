import React from 'react';
import { Button } from '@/components/ui/button';
import { StockAlert } from '@/modules/inventory';

export const OverviewBox = ({ alerts }: { alerts: StockAlert[] }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
    <div className="flex items-center mb-4">
      <div className="p-2 bg-blue-100 rounded-full mr-3">📦</div>
      <h3 className="text-lg font-medium">Inventory Overview</h3>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-gray-50 p-4 rounded-md">
        <p className="text-sm text-gray-500">Total Products</p>
        <p className="text-2xl font-bold">248</p>
      </div>
      <div className="bg-gray-50 p-4 rounded-md">
        <p className="text-sm text-gray-500">Out of Stock</p>
        <p className="text-2xl font-bold">12</p>
      </div>
      <div className="bg-gray-50 p-4 rounded-md">
        <p className="text-sm text-gray-500">Low Stock</p>
        <p className="text-2xl font-bold">{alerts.length}</p>
      </div>
      <div className="bg-gray-50 p-4 rounded-md">
        <p className="text-sm text-gray-500">Pending Reorders</p>
        <p className="text-2xl font-bold">5</p>
      </div>
    </div>
    <Button className="w-full mt-4">View Inventory Report</Button>
  </div>
);
