'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface Props {
  data: { date: string; revenue: number }[];
}

export default function RevenueChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(217 91% 50%)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="hsl(217 91% 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 13% 91%)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(220 9% 46%)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={36}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid hsl(220 13% 91%)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
          formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          labelStyle={{ color: 'hsl(220 15% 10%)', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="hsl(217 91% 50%)"
          strokeWidth={2}
          fill="url(#revenueGrad)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
