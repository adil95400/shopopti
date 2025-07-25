// src/components/ui/stock-sparkline.tsx
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip
} from 'chart.js';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

export const StockSparkline = ({ data }: { data: number[] }) => {
  return (
    <div className="w-full h-12">
      <Line
        data={{
          labels: data.map((_, i) => i.toString()),
          datasets: [
            {
              data,
              borderColor: '#3b82f6',
              tension: 0.4
            }
          ]
        }}
        options={{
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } },
          elements: { point: { radius: 0 } }
        }}
      />
    </div>
  );
};
