import React, { useState } from 'react';

import { Button } from '../../components/ui/button';

interface Invoice {
  id: string;
  date: string;
  amount: number;
}

const invoices: Invoice[] = [
  { id: 'inv_1', date: '2024-04-01', amount: 29 },
  { id: 'inv_2', date: '2024-05-01', amount: 29 }
];

const SubscriptionPage: React.FC = () => {
  const [plan, setPlan] = useState('Free');
  const [payment, setPayment] = useState('Visa **** 4242');

  const upgrade = (newPlan: string) => {
    setPlan(newPlan);
    alert(`Upgraded to ${newPlan}`);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Subscription</h1>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-medium">Current Plan</h2>
        <p className="text-gray-700">{plan}</p>
        <div className="space-x-2">
          <Button onClick={() => upgrade('Pro')}>Upgrade to Pro</Button>
          <Button variant="outline" onClick={() => upgrade('Free')}>Downgrade</Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <h2 className="text-lg font-medium">Payment Method</h2>
        <input className="w-full border rounded-md px-2 py-1" value={payment} onChange={e => setPayment(e.target.value)} />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-medium mb-2">Billing History</h2>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {invoices.map(inv => (
              <tr key={inv.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inv.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{inv.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${inv.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionPage;
