import { Logo } from "./ui.jsx";

const POINTS = [
  "Register in one tap and get a QR ticket",
  "Scan tickets at the gate with any phone camera",
  "See attendance update live and export it to CSV",
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-linear-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex">
        <Logo light />
        <div>
          <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Run campus events without the paperwork.
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-indigo-100">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-indigo-200">Built for college clubs and their volunteers.</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}