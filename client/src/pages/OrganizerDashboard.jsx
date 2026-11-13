import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Alert, EmptyState, PageLoader } from "../components/ui.jsx";
import { dateBadgeParts, formatEventDate, isPast } from "../utils.js";

const primarySmall =
  "inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700";
const outlineSmall =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100";
const dangerSmall =
  "rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60";

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api("/events/mine")
      .then((data) => {
        if (!cancelled) setEvents(data.events);
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

  async function handleDelete(event) {
    const confirmed = window.confirm(
      `Delete "${event.title}"?\n\nThis also removes its ${event.registered_count} registration(s) and cannot be undone.`
    );
    if (!confirmed) return;

    setActionError("");
    setDeletingId(event.id);
    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      setEvents((list) => list.filter((item) => item.id !== event.id));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const totalRegistered = events.reduce((sum, e) => sum + e.registered_count, 0);
  const totalCheckedIn = events.reduce((sum, e) => sum + e.checked_in_count, 0);

  let content;
  if (loading) {
    content = <PageLoader label="Loading your events..." />;
  } else if (error) {
    content = (
      <EmptyState
        title="Could not load your events"
        message={error}
        action={
          <button onClick={() => setReloadKey((key) => key + 1)} className={primarySmall}>
            Try again
          </button>
        }
      />
    );
  } else if (events.length === 0) {
    content = (
      <EmptyState
        title="No events yet"
        message="Create your first event and students will be able to register for it."
        action={
          <Link to="/organizer/events/new" className={primarySmall}>
            Create event
          </Link>
        }
      />
    );
  } else {
    content = (
      <>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Events" value={events.length} />
          <StatCard label="Total registrations" value={totalRegistered} />
          <StatCard label="Total check-ins" value={totalCheckedIn} />
        </div>

        <ul className="mt-6 space-y-4">
          {events.map((event) => {
            const badge = dateBadgeParts(event.event_date);
            const ended = isPast(event.event_date);
            const percent = Math.min(100, Math.round((event.registered_count / event.seat_limit) * 100));
            return (
              <li
                key={event.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    <span className="text-[11px] font-semibold leading-none tracking-wide">{badge.month}</span>
                    <span className="mt-0.5 text-xl font-bold leading-none">{badge.day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{event.title}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ended ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        {ended ? "Ended" : "Upcoming"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {formatEventDate(event.event_date)} · {event.venue}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {event.registered_count} of {event.seat_limit} seats taken ·{" "}
                    {event.checked_in_count} checked in
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                
                 <Link to={`/organizer/events/${event.id}/scan`} className={primarySmall}>
                    Scan tickets
                  </Link>
                  <Link to={`/organizer/events/${event.id}`} className={outlineSmall}>
                    Attendance
                  </Link>
                  <Link to={`/organizer/events/${event.id}/edit`} className={outlineSmall}>
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(event)}
                    disabled={deletingId === event.id}
                    className={dangerSmall}
                  >
                    {deletingId === event.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My events</h1>
          <p className="mt-1 text-sm text-slate-500">Create events, track registrations and check-ins.</p>
        </div>
        <Link to="/organizer/events/new" className={primarySmall}>
          + Create event
        </Link>
      </div>

      {actionError && (
        <div className="mt-5">
          <Alert>{actionError}</Alert>
        </div>
      )}

      <div className="mt-6">{content}</div>
    </div>
  );
}