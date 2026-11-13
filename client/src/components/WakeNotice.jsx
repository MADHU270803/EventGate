import { useEffect, useState } from "react";
import { api } from "../api.js";

// Free hosting puts the API to sleep when nobody is using it.
// This wakes it up as soon as the site opens, and explains any wait.
export default function WakeNotice() {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) setWaiting(true);
    }, 3000);

    api("/health")
      .catch(() => {})
      .finally(() => {
        finished = true;
        clearTimeout(timer);
        setWaiting(false);
      });

    return () => {
      finished = true;
      clearTimeout(timer);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 bg-indigo-600 px-4 py-2 text-center text-sm text-white"
    >
      Waking up the server... the free hosting plan sleeps when idle, so the first load can take up
      to a minute.
    </div>
  );
}