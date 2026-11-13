import { Link } from "react-router-dom";
import { Spinner, primaryButtonClass } from "./ui.jsx";
import { dateBadgeParts, formatEventDate, isPast } from "../utils.js";

const secondaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100";

const disabledButtonClass =
  "inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400";

function PinIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M10 18 L5 11 a6 6 0 1 1 10 0 Z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  );
}

export default function EventCard({ event, onRegister, registering }) {
  const past = isPast(event.event_date);
  const full = event.seats_left <= 0;
  const percent = Math.min(100, Math.round((event.registered_count / event.seat_limit) * 100));
  const badge = dateBadgeParts(event.event_date);

  let seatText = `${event.seats_left} of ${event.seat_limit} seats left`;
  let seatColor = "text-slate-500";
  if (full) {
    seatText = "Sold out";
    seatColor = "font-medium text-red-600";
  } else if (event.seats_left <= 5) {
    seatText = `Only ${event.seats_left} seat${event.seats_left === 1 ? "" : "s"} left`;
    seatColor = "font-medium text-amber-600";
  }

  let action;
  if (event.is_registered) {
    action = (
      <Link to="/my-tickets" className={secondaryButtonClass}>
        You are registered · View ticket
      </Link>
    );
  } else if (past) {
    action = <button disabled className={disabledButtonClass}>Event ended</button>;
  } else if (full) {
    action = <button disabled className={disabledButtonClass}>Sold out</button>;
  } else {
    action = (
      <button
        onClick={() => onRegister(event.id)}
        disabled={registering}
        className={primaryButtonClass}
      >
        {registering && <Spinner className="h-4 w-4" />}
        {registering ? "Registering..." : "Register"}
      </button>
    );
  }

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
      <div className="flex gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
          <span className="text-[11px] font-semibold leading-none tracking-wide">{badge.month}</span>
          <span className="mt-0.5 text-xl font-bold leading-none">{badge.day}</span>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{event.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{formatEventDate(event.event_date)}</p>
        </div>
      </div>

      {event.description && (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{event.description}</p>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
        <PinIcon />
        <span className="truncate">{event.venue}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">Organised by {event.organizer_name}</p>

      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${full ? "bg-red-400" : "bg-indigo-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className={`mt-1.5 text-xs ${seatColor}`}>{seatText}</p>
      </div>

      <div className="mt-auto pt-4">{action}</div>
    </article>
  );
}