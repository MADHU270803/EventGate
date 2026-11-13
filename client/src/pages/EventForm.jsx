import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import {
  Alert,
  EmptyState,
  PageLoader,
  Spinner,
  inputClass,
  primaryButtonClass,
} from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { toDateTimeLocal } from "../utils.js";

const EMPTY_FORM = { title: "", description: "", venue: "", eventDate: "", seatLimit: "" };

function Field({ id, label, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// Returns an error message, or "" when everything is fine.
function validate(form, editing, registeredCount) {
  const title = form.title.trim();
  const venue = form.venue.trim();
  const seats = Number(form.seatLimit);

  if (title.length < 3 || title.length > 120) return "Title must be 3 to 120 characters";
  if (venue.length < 2 || venue.length > 120) return "Venue must be 2 to 120 characters";
  if (form.description.trim().length > 2000) return "Description must be 2000 characters or fewer";
  if (!form.eventDate) return "Choose the date and time of the event";
  if (!editing && new Date(form.eventDate) <= new Date()) return "Event date must be in the future";
  if (!Number.isInteger(seats) || seats < 1 || seats > 10000) {
    return "Seat limit must be a whole number from 1 to 10000";
  }
  if (editing && seats < registeredCount) {
    return `Seat limit cannot be lower than the ${registeredCount} students already registered`;
  }
  return "";
}

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // When editing, load the event and fill the form.
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;

    api(`/events/${id}`)
      .then((data) => {
        if (cancelled) return;
        const event = data.event;
        if (event.organizer_id !== user.id) {
          setLoadError("You can only edit your own events");
          return;
        }
        setRegisteredCount(event.registered_count);
        setForm({
          title: event.title,
          description: event.description,
          venue: event.venue,
          eventDate: toDateTimeLocal(event.event_date),
          seatLimit: String(event.seat_limit),
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing, id, user.id]);

  function setField(name) {
    return (event) => setForm((current) => ({ ...current, [name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const problem = validate(form, editing, registeredCount);
    if (problem) {
      setError(problem);
      return;
    }

    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      venue: form.venue.trim(),
      event_date: new Date(form.eventDate).toISOString(),
      seat_limit: Number(form.seatLimit),
    };

    setSubmitting(true);
    try {
      if (editing) {
        await api(`/events/${id}`, { method: "PUT", body });
      } else {
        await api("/events", { method: "POST", body });
      }
      navigate("/organizer");
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoader label="Loading event..." />;

  if (loadError) {
    return (
      <EmptyState
        title="Could not open this event"
        message={loadError}
        action={
          <Link
            to="/organizer"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Back to my events
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/organizer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
        ← My events
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {editing ? "Edit event" : "Create event"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {editing
          ? "Changes are visible to students straight away."
          : "Students will see this on the discovery page."}
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        {error && <Alert>{error}</Alert>}

        <Field id="title" label="Event title">
          <input
            id="title"
            type="text"
            className={inputClass}
            value={form.title}
            onChange={setField("title")}
            disabled={submitting}
            placeholder="Hack Night 2026"
          />
        </Field>

        <Field id="description" label="Description" hint="Optional. What should students expect?">
          <textarea
            id="description"
            rows={4}
            className={`${inputClass} resize-y`}
            value={form.description}
            onChange={setField("description")}
            disabled={submitting}
          />
        </Field>

        <Field id="venue" label="Venue">
          <input
            id="venue"
            type="text"
            className={inputClass}
            value={form.venue}
            onChange={setField("venue")}
            disabled={submitting}
            placeholder="Main Auditorium"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="eventDate" label="Date and time">
            <input
              id="eventDate"
              type="datetime-local"
              className={inputClass}
              value={form.eventDate}
              onChange={setField("eventDate")}
              disabled={submitting}
            />
          </Field>

          <Field
            id="seatLimit"
            label="Number of seats"
            hint={editing ? `${registeredCount} already registered.` : undefined}
          >
            <input
              id="seatLimit"
              type="number"
              min="1"
              className={inputClass}
              value={form.seatLimit}
              onChange={setField("seatLimit")}
              disabled={submitting}
            />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Link
            to="/organizer"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className={`${primaryButtonClass} sm:w-auto`}>
            {submitting && <Spinner className="h-4 w-4" />}
            {submitting ? "Saving..." : editing ? "Save changes" : "Create event"}
          </button>
        </div>
      </form>
    </div>
  );
}