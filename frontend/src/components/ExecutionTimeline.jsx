import { useI18n } from "../i18n/I18nProvider";

function formatValue(value, t) {
  return value === null || value === undefined ? t("common.notAvailable") : Number(value).toFixed(4);
}

function getRoleLabel(role, t) {
  if (role === "entry") return t("timeline.entry");
  if (role === "protection") return t("timeline.protection");
  if (role === "adjustment") return t("timeline.adjustment");
  if (role === "exit") return t("timeline.exit");
  return role || t("common.unknown");
}

function getTone(status) {
  if (status === "filled") return "border-emerald-400/15 bg-emerald-500/[0.06]";
  if (status === "open" || status === "pending") return "border-sky-400/15 bg-sky-500/[0.06]";
  if (status === "cancelled") return "border-amber-400/15 bg-amber-500/[0.06]";
  return "border-white/[0.06] bg-white/[0.02]";
}

function getStatusColor(status) {
  if (status === "filled") return "text-emerald-300";
  if (status === "open" || status === "pending") return "text-sky-300";
  if (status === "cancelled") return "text-amber-300";
  return "text-slate-300";
}

function ExecutionTimeline({ orders = [], loading = false, compact = false }) {
  const { t, formatDateTime } = useI18n();

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-6 text-center text-sm text-slate-500 animate-pulse-soft">
        {t("timeline.loading")}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-6 text-center text-sm text-slate-500">
        {t("timeline.empty")}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      {orders.map((order) => (
        <article key={order.id} className={`rounded-xl border p-3 ${getTone(order.status)}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-white">{getRoleLabel(order.role, t)}</span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase text-slate-300">{order.side}</span>
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase text-slate-300">{order.order_type}</span>
              <span className={`rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase font-bold ${getStatusColor(order.status)}`}>{order.status}</span>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-400">
              <span>{t("timeline.qty")}: <span className="text-slate-200">{formatValue(order.quantity, t)}</span></span>
              <span>{t("timeline.price")}: <span className="text-slate-200">{formatValue(order.price, t)}</span></span>
              {order.stop_price && <span>Stop: <span className="text-slate-200">{formatValue(order.stop_price, t)}</span></span>}
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-500">
            {t("timeline.opened", { time: formatDateTime(order.opened_at) })}
            {order.closed_at ? ` | ${t("timeline.closed", { time: formatDateTime(order.closed_at) })}` : ""}
          </p>
        </article>
      ))}
    </div>
  );
}

export default ExecutionTimeline;
