import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Only logged-in organizers can use these routes.
// (Applied per route, because this router is mounted at /api.)
const organizerOnly = [requireAuth, requireRole("organizer")];

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Times are stored in UTC; reports show Indian Standard Time.
function formatIST(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Makes one value safe for a CSV file.
// A cell starting with = + - or @ could run as a formula in Excel,
// and student names are typed by users, so we defuse those.
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

// Finds an event and checks that the logged-in organizer owns it.
async function findOwnedEvent(eventId, userId) {
  const result = await pool.query(
    `SELECT id, title, venue, event_date, seat_limit, organizer_id
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (result.rows.length === 0) {
    return { status: 404, message: "Event not found" };
  }
  if (result.rows[0].organizer_id !== userId) {
    return { status: 403, message: "You can only manage your own events" };
  }
  return { event: result.rows[0] };
}

async function loadAttendees(eventId) {
  const result = await pool.query(
    `SELECT r.id, u.name AS student_name, u.email AS student_email,
            r.ticket_code, r.created_at AS registered_at, r.checked_in_at
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1
     ORDER BY u.name ASC`,
    [eventId]
  );
  return result.rows;
}

// POST /api/checkin   body: { "event_id": 2, "ticket_code": "EG-..." }
router.post("/checkin", ...organizerOnly, async (req, res) => {
  try {
    const body = req.body || {};
    const eventId = parseId(body.event_id);
    const ticketCode = String(body.ticket_code || "").trim().toUpperCase().slice(0, 64);

    if (!eventId || !ticketCode) {
      return res.status(400).json({ message: "event_id and ticket_code are required" });
    }

    const owned = await findOwnedEvent(eventId, req.user.id);
    if (owned.status) {
      return res.status(owned.status).json({ message: owned.message });
    }

    // "Tick the box only if it is still empty" in ONE command.
    // If two scans arrive together, only one can match checked_in_at IS NULL.
    const updated = await pool.query(
      `UPDATE registrations r
       SET checked_in_at = NOW()
       FROM users u
       WHERE u.id = r.user_id
         AND r.ticket_code = $1
         AND r.event_id = $2
         AND r.checked_in_at IS NULL
       RETURNING r.checked_in_at, u.name AS student_name, u.email AS student_email`,
      [ticketCode, eventId]
    );

    if (updated.rows.length > 0) {
      const row = updated.rows[0];
      return res.json({
        status: "checked_in",
        message: `Checked in: ${row.student_name}`,
        student_name: row.student_name,
        student_email: row.student_email,
        checked_in_at: row.checked_in_at,
      });
    }

    // Nothing was updated, so find out why and give a precise answer.
    const lookup = await pool.query(
      `SELECT r.event_id, r.checked_in_at, u.name AS student_name
       FROM registrations r
       JOIN users u ON u.id = r.user_id
       WHERE r.ticket_code = $1`,
      [ticketCode]
    );

    if (lookup.rows.length === 0) {
      return res.status(404).json({ message: "Ticket not recognised" });
    }
    const ticket = lookup.rows[0];
    if (ticket.event_id !== eventId) {
      return res.status(400).json({ message: "This ticket is for a different event" });
    }
    return res.status(409).json({
      status: "already_checked_in",
      message: `Already checked in: ${ticket.student_name} at ${formatIST(ticket.checked_in_at)}`,
      student_name: ticket.student_name,
      checked_in_at: ticket.checked_in_at,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/events/:id/attendance   (the attendance report as JSON)
router.get("/events/:id/attendance", ...organizerOnly, async (req, res) => {
  try {
    const eventId = parseId(req.params.id);
    if (!eventId) return res.status(400).json({ message: "Invalid event id" });

    const owned = await findOwnedEvent(eventId, req.user.id);
    if (owned.status) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const attendees = await loadAttendees(eventId);
    const checkedIn = attendees.filter((a) => a.checked_in_at).length;

    res.json({
      event: {
        id: owned.event.id,
        title: owned.event.title,
        venue: owned.event.venue,
        event_date: owned.event.event_date,
        seat_limit: owned.event.seat_limit,
      },
      summary: {
        registered: attendees.length,
        checked_in: checkedIn,
        not_checked_in: attendees.length - checkedIn,
      },
      attendees,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/events/:id/attendance.csv   (download for Excel / Google Sheets)
router.get("/events/:id/attendance.csv", ...organizerOnly, async (req, res) => {
  try {
    const eventId = parseId(req.params.id);
    if (!eventId) return res.status(400).json({ message: "Invalid event id" });

    const owned = await findOwnedEvent(eventId, req.user.id);
    if (owned.status) {
      return res.status(owned.status).json({ message: owned.message });
    }

    const attendees = await loadAttendees(eventId);

    const rows = [
      ["Name", "Email", "Ticket Code", "Registered At", "Checked In", "Checked In At"],
      ...attendees.map((a) => [
        a.student_name,
        a.student_email,
        a.ticket_code,
        formatIST(a.registered_at),
        a.checked_in_at ? "Yes" : "No",
        formatIST(a.checked_in_at),
      ]),
    ];
    const csv = rows.map((cells) => cells.map(csvCell).join(",")).join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-event-${owned.event.id}.csv"`
    );
    // The leading \uFEFF makes Excel read names (including Tamil) correctly.
    res.send("\uFEFF" + csv + "\r\n");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;