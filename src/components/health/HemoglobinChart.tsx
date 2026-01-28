import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { HealthRecord } from "./HealthTimeline";

interface HemoglobinChartProps {
  records: HealthRecord[];
}

export const HemoglobinChart = ({ records }: HemoglobinChartProps) => {
  // Sort by date ascending for chart display
  const sortedRecords = [...records]
    .filter(r => r.hemoglobin_level !== null)
    .sort((a, b) => new Date(a.record_date).getTime() - new Date(b.record_date).getTime())
    .slice(-12); // Last 12 records

  const chartData = sortedRecords.map(record => ({
    date: format(new Date(record.record_date), "MMM d"),
    fullDate: format(new Date(record.record_date), "MMM d, yyyy"),
    hemoglobin: record.hemoglobin_level,
    status: getStatus(record.hemoglobin_level!),
  }));

  function getStatus(level: number): string {
    if (level < 12.0) return "Low";
    if (level < 12.5) return "Borderline";
    return "Normal";
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{data.fullDate}</p>
          <p className="text-lg font-bold text-primary">{data.hemoglobin} g/dL</p>
          <p className={`text-xs ${
            data.status === "Normal" ? "text-emerald-500" :
            data.status === "Borderline" ? "text-amber-500" : "text-red-500"
          }`}>
            {data.status}
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length < 2) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
        Add more records to see trend visualization
      </div>
    );
  }

  return (
    <div className="h-[160px] -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="hemoglobinGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[10, 18]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Reference lines for normal range */}
          <ReferenceLine
            y={12}
            stroke="#fbbf24"
            strokeDasharray="3 3"
            strokeOpacity={0.7}
          />
          <ReferenceLine
            y={12.5}
            stroke="#22c55e"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          
          <Area
            type="monotone"
            dataKey="hemoglobin"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#hemoglobinGradient)"
            dot={{
              stroke: "hsl(var(--primary))",
              strokeWidth: 2,
              fill: "hsl(var(--background))",
              r: 4,
            }}
            activeDot={{
              stroke: "hsl(var(--primary))",
              strokeWidth: 2,
              fill: "hsl(var(--primary))",
              r: 6,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
