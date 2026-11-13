import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../api.js";
import { Alert, EmptyState, PageLoader } from "../components/ui.jsx";
import { formatDateTime, formatEventDate, isPast } from "../utils.js";

export default function TicketPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Load the ticket now, then ask again every 5 seconds so the page
  // notices by itself when the gate volunteer scans it.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api(`/registrations/${id}`);
        if (!cancelled) {
          setTicket(data.registration);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  async function handleCancel() {
    if (!window.confirm("Cancel this registration? Your seat will be released.")) return;
    setCancelling(true);
    setCancelError("");
    try {
      await api(`/registrations/${id}`, { method: "DELETE" });
      navigate("/my-tickets", { replace: true });
    } catch (err) {
      setCancelError(err.message);
      setCancelling(false);
    }
  }

  if (loading) return <PageLoader label="Loading your ticket..." />;

  if (!ticket) {
    return (
      <EmptyState
        title="Ticket not found"
        message={error || "This ticket does not exist or is not yours."}
        action={
          <Link
            to="/my-tickets"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Back to my tickets
          </Link>
        }
      />
    );
  }

  const checkedIn = Boolean(ticket.checked_in_at);
  const canCancel = !checkedIn && !isPast(ticket.event_date);

  return (
    <div className="mx-auto max-w-sm">
      <Link to="/my-tickets" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
        ← My tickets
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
        <div className="bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 text-white">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-200">Admit one</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug">{ticket.title}</h1>
          <p className="mt-3 text-sm text-indigo-100">{formatEventDate(ticket.event_date)}</p>
          <p className="text-sm text-indigo-100">{ticket.venue}</p>
        </div>

        {/* The dashed "tear here" line with two notches */}
        <div className="relative h-0 border-t-2 border-dashed border-slate-200">
          <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-slate-50" />
          <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-slate-50" />
        </div>

        <div className="flex flex-col items-center p-6">
          {checkedIn ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              ✓ Checked in · {formatDateTime(ticket.checked_in_at)}
            </span>
          ) : (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
              Valid ticket
            </span>
          )}

          <div
            className={`mt-4 rounded-2xl border border-slate-200 bg-white p-4 transition ${
              checkedIn ? "opacity-30 grayscale" : ""
            }`}
          >
            <QRCodeSVG value={ticket.ticket_code} size={200} level="M" marginSize={2} />
          </div>

          <p className="mt-4 font-mono text-sm tracking-widest text-slate-700">{ticket.ticket_code}</p>
          <p className="mt-1 text-sm text-slate-500">{ticket.student_name}</p>
          <p className="mt-4 text-center text-xs text-slate-400">
            Turn your screen brightness up when you scan at the gate.
          </p>
        </div>
      </div>

      {cancelError && (
        <div className="mt-4">
          <Alert>{cancelError}</Alert>
        </div>
      )}

      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {cancelling ? "Cancelling..." : "Cancel registration"}
        </button>
      )}
    </div>
  );
}