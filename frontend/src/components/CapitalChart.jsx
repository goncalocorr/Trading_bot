import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useI18n } from "../i18n/I18nProvider";

const ranges = ["1D", "1W", "1M", "ALL"];

function CapitalChart({ data = [], range = "ALL", onRangeChange, loading = false }) {
  const { locale, t, formatCurrency } = useI18n();

  const firstValue = data.length > 0 ? Number(data[0].capitalValue || 0) : 0;
  const lastValue = data.length > 0 ? Number(data[data.length - 1].capitalValue || 0) : 0;
  const isPositive = lastValue >= firstValue;
  const strokeColor = isPositive ? "#34d399" : "#fb7185";
  const fillId = isPositive ? "fillGreen" : "fillRed";

  return (
    <section className="glass-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">{t("chart.title")}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{t("chart.subtitle")}</p>
        </div>
        <div className="flex gap-1">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRangeChange(item)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                item === range
                  ? "bg-amber-400/90 text-slate-900"
                  : "bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 animate-pulse-soft">
            {t("chart.loading")}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {t("chart.loading")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="fillGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" })
                }
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  fontSize: "12px"
                }}
                formatter={(value) => [formatCurrency(value), t("chart.title")]}
                labelFormatter={(value) => new Date(value).toLocaleString(locale)}
              />
              <Area
                type="monotone"
                dataKey="capitalValue"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${fillId})`}
                dot={false}
                activeDot={{ r: 5, fill: strokeColor, stroke: "#0f172a", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default CapitalChart;
