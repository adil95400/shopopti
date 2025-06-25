import React from 'react';
import { BarChart3, FileText, TrendingUp } from 'lucide-react';

interface SeoStats {
  audits: number;
  averageScore: number;
  keywords: number;
}

const SeoStatsWidgets: React.FC<{ stats: SeoStats }> = ({ stats }) => {
  const items = [
    {
      label: 'Pages Audited',
      value: stats.audits.toLocaleString(),
      icon: <FileText className="h-5 w-5 text-blue-500" />
    },
    {
      label: 'Average Score',
      value: `${stats.averageScore}%`,
      icon: <TrendingUp className="h-5 w-5 text-green-500" />
    },
    {
      label: 'Keywords Analyzed',
      value: stats.keywords.toLocaleString(),
      icon: <BarChart3 className="h-5 w-5 text-purple-500" />
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map(item => (
        <div
          key={item.label}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-medium text-gray-500">{item.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
          </div>
          <div className="p-2 bg-gray-100 rounded-full">{item.icon}</div>
        </div>
      ))}
    </div>
  );
};

export default SeoStatsWidgets;
