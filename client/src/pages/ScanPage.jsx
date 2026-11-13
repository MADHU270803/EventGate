import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { api } from "../api.js";
import { Alert, EmptyState, PageLoader, Spinner, inputClass } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { formatEventDate } from "../utils.js";

const RESULT_STYLES = {
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: "✓" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-800", icon: "!" },
  error: { box: "border-red-200 bg-red-50 text-red-800", icon: "✕" },
};

function friendlyCameraError(error) {
  const name = error && error.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was blocked. Click the camera icon in the address bar, allow access, then press Try camera again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device. Use manual entry below.";
  }
  if (name === "NotReadableError") {
    return "The camera is being used by another app. Close it and press Try camera again.";
  }
  return (error && error.message) || "The camera could not be started.";
}

export default function ScanPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [paused, setPaused] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [manualCode, setManualCode] = useState("");

  // "busy" stops the camera from sending the same ticket twice
  // while we are still waiting for the server's answer.
  const busyRef = useRef(false);
  const resumeTimer = useRef(null);

  const loadEvent = useCallback(async () => {
    try {
      const data = await api(`/events/${id}`);
      setEvent(data.event);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
    return () => clearTimeout(resumeTimer.current);
  }, [loadEvent]);

  function resume() {
    clearTimeout(resumeTimer.current);
    busyRef.current = false;
    setResult(null);
    setPaused(false);
  }

  async function submitCode(rawCode) {
    const ticketCode = String(rawCode || "").trim();
    if (!ticketCode) return;

    busyRef.current = true;
    setPaused(true);
    setChecking(true);
    setResult(null);

    try {
      const data = await api("/checkin", {
        method: "POST",
        body: { event_id: Number(id), ticket_code: ticketCode },
      });
      setResult({ type: "success", message: data.message, detail: data.student_email });
      setManualCode("");
      loadEvent(); // refresh the "X of Y checked in" numbers
    } catch (err) {
      // 409 means "this ticket was already used"
      setResult({ type: err.status === 409 ? "warning" : "error", message: err.message });
    } finally {
      setChecking(false);
    }

    resumeTimer.current = setTimeout(resume, 3000);
  }

  function handleScan(codes) {
    if (busyRef.current) return;
    const value = codes && codes[0] && codes[0].rawValue;
    if (value) submitCode(value);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (busyRef.current) return;
    submitCode(manualCode);
  }

  if (loading) return <PageLoader label="Opening scanner..." />;

  if (!event || loadError) {
    return (
      <EmptyState
        title="Could not open the scanner"
        message={loadError || "Event not found"}
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

  if (event.organizer_id !== user.id) {
    return (
      <EmptyState
        title="Not your event"
        message="You can only scan tickets for events you created."
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

  const style = result ? RESULT_STYLES[result.type] : null;
  const percent = event.registered_count
    ? Math.round((event.checked_in_count / event.registered_count) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-lg">
      <Link to="/organizer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
        ← My events
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Scan tickets</h1>
      <p className="mt-1 text-sm text-slate-500">
        {event.title} · {formatEventDate(event.event_date)}
      </p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-slate-500">Checked in</p>
          <p className="text-sm font-semibold">
            {event.checked_in_count} of {event.registered_count}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-4">
        {cameraError ? (
          <div className="space-y-3">
            <Alert>{cameraError}</Alert>
            <button
              onClick={() => setCameraError("")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Try camera again
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black">
            <Scanner
              onScan={handleScan}
              onError={(error) => setCameraError(friendlyCameraError(error))}
              paused={paused}
              formats={["qr_code"]}
              constraints={{ facingMode: "environment" }}
              scanDelay={300}
            />
          </div>
        )}
      </div>

      <div aria-live="polite" className="mt-4 min-h-[96px]">
        {checking ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <Spinner className="h-5 w-5 text-indigo-600" />
            Checking ticket...
          </div>
        ) : result ? (
          <div className={`rounded-2xl border p-4 ${style.box}`}>
            <p className="text-base font-semibold">
              {style.icon} {result.message}
            </p>
            {result.detail && <p className="mt-0.5 text-sm opacity-80">{result.detail}</p>}
            <button onClick={resume} className="mt-3 text-sm font-medium underline">
              Scan next
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Point the camera at a student's QR ticket.</p>
        )}
      </div>

      <form
        onSubmit={handleManualSubmit}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
      >
        <label htmlFor="manualCode" className="block text-sm font-medium text-slate-700">
          Or type the ticket code
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="manualCode"
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="EG-XXXXXXXXXXXXXXXX"
            autoComplete="off"
            className={`${inputClass} font-mono`}
          />
          <button
            type="submit"
            disabled={checking || !manualCode.trim()}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Check in
          </button>
        </div>
      </form>
    </div>
  );
}