import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { EmptyState, PageLoader } from "../components/ui.jsx";
import { dateBadgeParts, formatEventDate, isPast } from "../utils.js";

function statusOf(ticket) {
  if (ticket.checked_in_at) return { label: "Checked in", style: "bg-emerald-50 text-emerald-700" };
  if (isPast(ticket.event_date)) return { label: "Ended", style: "bg-slate-100 text-slate-500" };
  return { label: "Upcoming", style: "bg-indigo-50 text-indigo-700" };
}

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api("/registrations/mine")
      .then((data) => {
        if (!cancelled) setTickets(data.registrations);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  let content;
  if (loading) {
    content = <PageLoader label="Loading your tickets..." />;
  } else if (error) {
    content = (
      <EmptyState
        title="Could not load your tickets"
        message={error}
        action={
          <button
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Try again
          </button>
        }
      />
    );
  } else if (tickets.length === 0) {
    content = (
      <EmptyState
        title="No tickets yet"
        message="When you register for an event, your QR ticket will appear here."
        action={
          <Link
            to="/discover"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Discover events
          </Link>
        }
      />
    );
  } else {
    content = (
      <ul className="space-y-3">
        {tickets.map((ticket) => {
          const badge = dateBadgeParts(ticket.event_date);
          const status = statusOf(ticket);
          return (
            <li key={ticket.id}>
              <Link
                to={`/tickets/${ticket.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:shadow-md"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                  <span className="text-[11px] font-semibold leading-none tracking-wide">{badge.month}</span>
                  <span className="mt-0.5 text-xl font-bold leading-none">{badge.day}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-semibold">{ticket.title}</h3>
                  <p className="truncate text-sm text-slate-500">
                    {formatEventDate(ticket.event_date)} · {ticket.venue}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.style}`}>
                  {status.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
      <p className="mt-1 text-sm text-slate-500">Show the QR code at the gate to check in.</p>
      <div className="mt-6">{content}</div>
    </div>
  );
}