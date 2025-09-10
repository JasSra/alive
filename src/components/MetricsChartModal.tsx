"use client";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface MetricData {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

interface MetricsChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: MetricData[];
}

type BarChartData = ChartData<'bar', number[], string>;

export default function MetricsChartModal({ 
  isOpen, 
  onClose, 
  title, 
  data
}: MetricsChartModalProps) {
  if (!isOpen) return null;

  const chartData: BarChartData = {
    labels: data.map(item => item.label),
    datasets: [
      {
        label: title,
        data: data.map(item => item.value),
        backgroundColor: data.map(item => item.bgColor),
        borderColor: data.map(item => item.color),
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        color: 'rgb(255, 255, 255)',
        font: {
          size: 18,
          weight: 'bold',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'rgb(255, 255, 255)',
        bodyColor: 'rgb(229, 231, 235)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (title.toLowerCase().includes('rate') || title.toLowerCase().includes('percentage')) {
              return `${label}: ${value}%`;
            }
            return `${label}: ${value}`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 12,
          },
          callback: function(value) {
            if (title.toLowerCase().includes('rate') || title.toLowerCase().includes('percentage')) {
              return `${value}%`;
            }
            return value;
          }
        },
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">{title} Analytics</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            title="Close chart"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chart Content */}
        <div className="p-6">
          <div className="h-96">
            <Bar data={chartData} options={options} />
          </div>
          
          {/* Stats Summary */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.map((item, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-sm text-gray-400">{item.label}</div>
                <div className="text-lg font-bold text-white">
                  {title.toLowerCase().includes('rate') || title.toLowerCase().includes('percentage') 
                    ? `${item.value}%` 
                    : item.value.toLocaleString()
                  }
                </div>
                <div className={`w-full h-1 rounded-full mt-2 opacity-80 bg-current`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
