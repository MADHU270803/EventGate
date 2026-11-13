import { Link } from "react-router-dom";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100";

export const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";

export function Logo({ light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${
          light ? "bg-white text-indigo-700" : "bg-indigo-600 text-white"
        }`}
      >
        E
      </span>
      <span
        className={`text-lg font-semibold tracking-tight ${
          light ? "text-white" : "text-slate-900"
        }`}
      >
        EventGate
      </span>
    </Link>
  );
}

export function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader({ label = "Loading..." }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-6 w-6 text-indigo-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

const ALERT_STYLES = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

export function Alert({ type = "error", children }) {
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${ALERT_STYLES[type]}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {message && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}