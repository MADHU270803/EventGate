import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function WelcomeCard({ label, message }) {
  const { user } = useAuth();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
      <p className="text-sm font-medium text-indigo-600">{label}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Welcome, {user.name}</h1>
      <p className="mt-2 max-w-xl text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function StudentHome() {
  return (
    <WelcomeCard
      label="Student dashboard"
      message="Login and role checks are working. The event discovery page arrives in Step 7."
    />
  );
}

export function OrganizerHome() {
  return (
    <WelcomeCard
      label="Organizer dashboard"
      message="Login and role checks are working. Your event dashboard arrives in Step 8."
    />
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-indigo-600">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-slate-500">That address does not exist.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Go home
      </Link>
    </div>
  );
}