// Where each kind of user lands after logging in.
export function homeFor(user) {
  return user && user.role === "organizer" ? "/organizer" : "/discover";
}

// Dates are stored in UTC and shown in Indian Standard Time.
const TIME_ZONE = "Asia/Kolkata";

export function formatEventDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// The small "NOV 14" badge on cards.
export function dateBadgeParts(value) {
  const date = new Date(value);
  return {
    month: date.toLocaleString("en-IN", { timeZone: TIME_ZONE, month: "short" }).toUpperCase(),
    day: date.toLocaleString("en-IN", { timeZone: TIME_ZONE, day: "numeric" }),
  };
}

export function isPast(value) {
  return new Date(value) < new Date();
}

// For <input type="datetime-local">: needs "YYYY-MM-DDTHH:mm" in the browser's own time zone.
export function toDateTimeLocal(value) {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

