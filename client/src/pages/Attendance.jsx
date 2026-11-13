import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, downloadFile } from "../api.js";
import { Alert, EmptyState, PageLoader, Spinner } from "../components/ui.jsx";
import { formatDateTime, formatEventDate } from "../utils.js";

function StatCard({ label, value, tone = "text-slate-900" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

export default function Attendance() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  // Load now, then every 5 seconds, so counts move as people are scanned in.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await api(`/events/${id}/attendance`);
        if (!cancelled) {
          setData(result);
          setError("");
          setLastUpdated(new Date());
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

  async function handleDownload() {
    setDownloadError("");
    setDownloading(true);
    try {
      const slug = data.event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await downloadFile(`/events/${id}/attendance.csv`, `attendance-${slug || "event"}.csv`);
    } catch (err) {
      setDownloadError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <PageLoader label="Loading attendance..." />;

  if (!data) {
    return (
      <EmptyState
        title="Could not open the attendance report"
        message={error || "Something went wrong."}
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

  const { event, summary, attendees } = data;
  const percent = summary.registered ? Math.round((summary.checked_in / summary.registered) * 100) : 0;
  const needle = search.trim().toLowerCase();
  const visible = attendees.filter((a) =>
    `${a.student_name} ${a.student_email}`.toLowerCase().includes(needle)
  );

  return (
    <div>
      <Link to="/organizer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
        ← My events
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatEventDate(event.event_date)} · {event.venue}
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · updates every 5 seconds
            {lastUpdated && ` · last updated ${lastUpdated.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`}
          </p>
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-60"
        >
          {downloading && <Spinner className="h-4 w-4" />}
          {downloading ? "Preparing..." : "Download CSV"}
        </button>
      </div>

      {downloadError && (
        <div className="mt-4">
          <Alert>{downloadError}</Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Registered" value={`${summary.registered} / ${event.seat_limit}`} />
        <StatCard label="Checked in" value={summary.checked_in} tone="text-emerald-600" />
        <StatCard label="Not yet arrived" value={summary.not_checked_in} tone="text-amber-600" />
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">{percent}% of registered students have arrived</p>
      </div>

      <div className="mt-8">
        {attendees.length === 0 ? (
          <EmptyState
            title="No registrations yet"
            message="When students register for this event, they will appear here."
          />
        ) : (
          <>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              aria-label="Search attendees"
              className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-xs outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 sm:max-w-sm"
            />

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Ticket</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No one matches "{search.trim()}".
                      </td>
                    </tr>
                  ) : (
                    visible.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-medium">{a.student_name}</td>
                        <td className="px-4 py-3 text-slate-600">{a.student_email}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.ticket_code}</td>
                        <td className="px-4 py-3">
                          {a.checked_in_at ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Checked in · {formatDateTime(a.checked_in_at)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              Not arrived
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}