import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "../components/AuthShell.jsx";
import { Alert, Spinner, inputClass, primaryButtonClass } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = [
  { value: "student", title: "Student", text: "Discover events and get QR tickets" },
  { value: "organizer", title: "Organizer", text: "Create events and check guests in" },
];

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) return setError("Name must be at least 2 characters");
    if (!EMAIL_PATTERN.test(email.trim())) return setError("Enter a valid email address");
    if (password.length < 8) return setError("Password must be at least 8 characters");

    setSubmitting(true);
    try {
      // On success the app redirects automatically (see GuestOnly).
      await register({ name: name.trim(), email: email.trim(), password, role });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <Alert>{error}</Alert>}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">I am a</span>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={role === option.value}
                onClick={() => setRole(option.value)}
                disabled={submitting}
                className={`rounded-xl border p-3 text-left transition ${
                  role === option.value
                    ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-600/20"
                    : "border-slate-300 bg-white hover:border-slate-400"
                }`}
              >
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{option.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            placeholder="you@college.edu"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
        </div>

        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}