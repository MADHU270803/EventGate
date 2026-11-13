import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import EventCard from "../components/EventCard.jsx";
import { Alert, EmptyState, PageLoader, inputClass } from "../components/ui.jsx";

export default function Discover() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [upcoming, setUpcoming] = useState(true);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [registeringId, setRegisteringId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Wait until the student stops typing for 300 ms before searching.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load events whenever the search, the filter or the reload counter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (upcoming) params.set("upcoming", "true");

    api(`/events?${params.toString()}`)
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
  }, [query, upcoming, reloadKey]);

  async function handleRegister(eventId) {
    setActionError("");
    setRegisteringId(eventId);
    try {
      const data = await api("/registrations", { method: "POST", body: { event_id: eventId } });
      navigate(`/tickets/${data.registration.id}`);
    } catch (err) {
      setActionError(err.message);
      setReloadKey((key) => key + 1); // refresh seat counts
    } finally {
      setRegisteringId(null);
    }
  }

  let content;
  if (loading) {
    content = <PageLoader label="Loading events..." />;
  } else if (error) {
    content = (
      <EmptyState
        title="Could not load events"
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
  } else if (events.length === 0) {
    content = (
      <EmptyState
        title="No events found"
        message={
          query
            ? `Nothing matches "${query}". Try a different word.`
            : "There are no events right now. Check back soon."
        }
      />
    );
  } else {
    content = (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onRegister={handleRegister}
            registering={registeringId === event.id}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Discover events</h1>
      <p className="mt-1 text-sm text-slate-500">Find something happening on campus and grab a ticket.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by event name or venue"
          aria-label="Search events"
          className={`${inputClass} sm:max-w-sm`}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={upcoming}
            onChange={(e) => setUpcoming(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
          />
          Upcoming only
        </label>
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