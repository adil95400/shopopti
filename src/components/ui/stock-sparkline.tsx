// src/components/ui/stock-sparkline.tsx
import { Line } from 'react-chartjs-2';

export const StockSparkline = ({ data }: { data: number[] }) => {
  return (
    <Line
      data={{
        labels: data.map((_, i) => `#${i}`),
        datasets: [{ data, borderWidth: 2 }]
      }}
      options={{
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }}
    />
  );
};
