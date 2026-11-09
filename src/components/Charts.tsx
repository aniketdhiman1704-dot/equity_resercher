import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import type { FinancialYear } from '../lib/types';
import { ratios, type ForecastYear } from '../lib/finance';
import { money, percent } from '../lib/format';

const axis = { fontSize: 11, fill: '#627269', fontFamily: 'inherit' };
const tooltipStyle = {
  border: '1px solid #e2e8e4',
  borderRadius: 10,
  fontSize: 12,
  boxShadow: '0 8px 24px #1c3a2a12',
};
const formatAxis = (v: number) =>
  Math.abs(v) >= 1000
    ? `$${(v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`
    : `$${v}M`;

export function HistoryChart({
  years,
  mode,
}: {
  years: FinancialYear[];
  mode: 'earnings' | 'cash';
}) {
  const data = years.map((y) => ({
    year: `FY${String(y.fiscalYear).slice(2)}`,
    revenue: y.revenue,
    ebit: y.ebit,
    cfo: y.cashFromOperations,
    cashAfterCapex: ratios(y).find((m) => m.id === 'cashAfterCapex')!.value,
  }));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`${mode === 'earnings' ? 'Revenue and operating profit' : 'Operating cash flow and cash flow after CapEx'} from ${years[0].fiscalYear} to ${years.at(-1)!.fiscalYear}. Exact values are in Financials.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={5} margin={{ top: 15, right: 4, left: -15, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 4" />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={axis} dy={10} />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={axis}
            tickFormatter={formatAxis}
            width={67}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: '#f4f7f4' }}
            formatter={(value) => money(Number(value))}
          />
          <Bar
            isAnimationActive={false}
            dataKey={mode === 'earnings' ? 'revenue' : 'cfo'}
            name={mode === 'earnings' ? 'Revenue' : 'Operating cash flow'}
            fill="#277660"
            radius={[4, 4, 0, 0]}
            maxBarSize={35}
          />
          <Bar
            isAnimationActive={false}
            dataKey={mode === 'earnings' ? 'ebit' : 'cashAfterCapex'}
            name={mode === 'earnings' ? 'Operating profit' : 'Cash flow after CapEx'}
            fill="#b4d0c0"
            radius={[4, 4, 0, 0]}
            maxBarSize={35}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MarginsChart({ years }: { years: FinancialYear[] }) {
  const data = years.map((y) => ({
    year: String(y.fiscalYear).slice(2),
    operating: ratios(y).find((m) => m.id === 'operatingMargin')!.value,
    net: ratios(y).find((m) => m.id === 'netMargin')!.value,
  }));
  return (
    <div
      className="margin-chart"
      role="img"
      aria-label="Operating and net margin trends. Exact ratios are available in Financials."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 4" />
          <XAxis
            dataKey="year"
            axisLine={false}
            tickLine={false}
            tick={axis}
            tickFormatter={(v) => `FY${v}`}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={axis}
            tickFormatter={(v) => percent(v, 0)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => percent(Number(v))}
            labelFormatter={(v) => `FY${v}`}
          />
          <Line
            isAnimationActive={false}
            dataKey="operating"
            name="Operating margin"
            stroke="#277660"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#277660', strokeWidth: 0 }}
          />
          <Line
            isAnimationActive={false}
            dataKey="net"
            name="Net margin"
            stroke="#95815b"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 4"
          />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastChart({ forecast }: { forecast: ForecastYear[] }) {
  return (
    <div
      className="forecast-chart"
      role="img"
      aria-label="Projected unlevered free cash flow for the next five fiscal years. Exact figures appear in the forecast table."
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={forecast} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#277660" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#277660" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#edf0ed" strokeDasharray="3 4" />
          <XAxis
            dataKey="year"
            tickFormatter={(v) => `${v}E`}
            tick={axis}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxis}
            tick={axis}
            axisLine={false}
            tickLine={false}
            width={65}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => money(Number(v))}
            labelFormatter={(v) => `FY${v} · projected`}
          />
          <Area
            isAnimationActive={false}
            dataKey="fcff"
            name="FCFF"
            type="monotone"
            stroke="#277660"
            strokeWidth={2.5}
            fill="url(#cashFlowFill)"
            dot={{ r: 4, fill: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, gold = false }: { values: (number | null)[]; gold?: boolean }) {
  if (values.some((v) => v === null || !Number.isFinite(v)) || values.length < 2)
    return <span className="sparkline" />;
  const numbers = values as number[];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const points = numbers
    .map((v, i) => `${(i * 64) / (numbers.length - 1)},${27 - ((v - min) / (max - min || 1)) * 22}`)
    .join(' ');
  return (
    <svg className="sparkline" viewBox="0 0 68 32" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={gold ? '#ad9668' : '#54947a'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
