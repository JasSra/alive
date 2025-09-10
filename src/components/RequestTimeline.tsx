"use client";
import { useEffect, useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

interface RequestData {
  t: number;
  status?: number;
  [key: string]: unknown;
}

interface RequestTimelineProps {
  requests: RequestData[];
  autoScroll?: boolean;
}

type TimelineChartData = ChartData<'line', number[], string>;

export default function RequestTimeline({ requests, autoScroll = true }: RequestTimelineProps) {
  const [timelineData, setTimelineData] = useState<TimelineChartData | null>(null);
  const chartRef = useRef<ChartJS<'line', number[], string> | null>(null);

  useEffect(() => {
    if (!requests.length) return;

    // Group requests by time intervals (1-minute buckets)
    const now = Date.now();
    const timeSlots: { [key: string]: { success: number; error: number; total: number; timestamp: number } } = {};
    
    // Create time slots for the last hour
    for (let i = 59; i >= 0; i--) {
      const slotTime = now - (i * 60 * 1000); // 1-minute intervals
      const timeKey = new Date(slotTime).toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
      timeSlots[timeKey] = { success: 0, error: 0, total: 0, timestamp: slotTime };
    }

    // Populate with actual request data
    requests.forEach(req => {
      const reqTime = new Date(req.t).toISOString().slice(0, 16);
      if (timeSlots[reqTime]) {
        timeSlots[reqTime].total += 1;
        if (req.status && req.status >= 200 && req.status < 400) {
          timeSlots[reqTime].success += 1;
        } else if (req.status && req.status >= 400) {
          timeSlots[reqTime].error += 1;
        }
      }
    });

    const sortedSlots = Object.values(timeSlots).sort((a, b) => a.timestamp - b.timestamp);
    
    const labels = sortedSlots.map(slot => 
      new Date(slot.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    );

    const data = {
      labels,
      datasets: [
        {
          label: 'Total Requests',
          data: sortedSlots.map(slot => slot.total),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.1,
        },
        {
          label: 'Successful',
          data: sortedSlots.map(slot => slot.success),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          tension: 0.1,
        },
        {
          label: 'Errors',
          data: sortedSlots.map(slot => slot.error),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          tension: 0.1,
        },
      ],
    };

    setTimelineData(data);
  }, [requests]);

  useEffect(() => {
    if (autoScroll && chartRef.current) {
      // Auto-scroll to the latest data
      const chart = chartRef.current;
      if (chart.options.scales?.x) {
        chart.options.scales.x.min = undefined;
        chart.options.scales.x.max = undefined;
        chart.update('none');
      }
    }
  }, [timelineData, autoScroll]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(229, 231, 235)',
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Request Timeline (Last Hour)',
        color: 'rgb(255, 255, 255)',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'rgb(255, 255, 255)',
        bodyColor: 'rgb(229, 231, 235)',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: 'rgb(156, 163, 175)',
          font: {
            size: 11,
          },
          maxTicksLimit: 12,
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
            size: 11,
          },
        },
      },
    },
  };

  if (!timelineData) {
    return (
      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading timeline...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
      <div className="h-64">
        <Line ref={chartRef} data={timelineData} options={options} />
      </div>
    </div>
  );
}
