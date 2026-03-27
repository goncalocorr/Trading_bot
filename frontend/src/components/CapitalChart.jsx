import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useI18n } from "../i18n/I18nProvider";

const ranges = ["1D", "1W", "1M", "ALL"];

function CapitalChart({ data = [], range = "ALL", onRangeChange, loading = false }) {
  const { locale, t, formatCurrency } = useI18n();

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{t("chart.title")}</h2>
          <p className="mt-1 text-sm text-slate-300">{t("chart.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRangeChange(item)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                item === range
                  ? "bg-amber-300 text-slate-900"
                  : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-80">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            {t("chart.loading")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric"
                  })
                }
              />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px"
                }}
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(value) => new Date(value).toLocaleString(locale)}
              />
              <Line
                type="monotone"
                dataKey="capitalValue"
                stroke="#fbbf24"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "#fbbf24" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default CapitalChart;
