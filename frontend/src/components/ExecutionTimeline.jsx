import { useI18n } from "../i18n/I18nProvider";

function formatValue(value, t) {
  return value === null || value === undefined ? t("common.notAvailable") : Number(value).toFixed(4);
}

function getRoleLabel(role, t) {
  if (role === "entry") {
    return t("timeline.entry");
  }

  if (role === "protection") {
    return t("timeline.protection");
  }

  if (role === "adjustment") {
    return t("timeline.adjustment");
  }

  if (role === "exit") {
    return t("timeline.exit");
  }

  return role || t("common.unknown");
}

function getTone(status) {
  if (status === "filled") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "open" || status === "pending") {
    return "border-sky-400/20 bg-sky-500/10 text-sky-100";
  }

  if (status === "cancelled") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  }

  return "border-white/10 bg-slate-950/50 text-slate-200";
}

function ExecutionTimeline({ orders = [], loading = false, compact = false }) {
  const { t, formatDateTime } = useI18n();

  if (loading) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
        {t("timeline.loading")}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-[22px] border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">
        {t("timeline.empty")}
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {orders.map((order) => (
        <article
          key={order.id}
          className={`rounded-[22px] border p-4 ${getTone(order.status)}`}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{getRoleLabel(order.role, t)}</span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
                  {order.side}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
                  {order.order_type}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200">
                  {order.status}
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-300">
                {t("timeline.opened", { time: formatDateTime(order.opened_at) })}
                {order.closed_at ? ` | ${t("timeline.closed", { time: formatDateTime(order.closed_at) })}` : ""}
              </p>
            </div>

            <div className="grid gap-2 text-sm text-slate-200 md:text-right">
              <span>{t("timeline.qty")}: {formatValue(order.quantity, t)}</span>
              <span>{t("timeline.price")}: {formatValue(order.price, t)}</span>
              <span>{t("active.stop")}: {formatValue(order.stop_price, t)}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default ExecutionTimeline;
