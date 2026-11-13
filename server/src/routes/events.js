import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Every events route needs a logged-in user (a valid wristband).
router.use(requireAuth);

// Shared query: one row per event, with counts of registered and checked-in students.
const EVENT_SELECT = `
  SELECT e.id, e.title, e.description, e.venue, e.event_date, e.seat_limit,
         e.organizer_id, u.name AS organizer_name,
         COUNT(r.id)::int AS registered_count,
         COUNT(r.checked_in_at)::int AS checked_in_count,
         EXISTS (
           SELECT 1 FROM registrations x
           WHERE x.event_id = e.id AND x.user_id = $1
         ) AS is_registered
  FROM events e
  JOIN users u ON u.id = e.organizer_id
  LEFT JOIN registrations r ON r.event_id = e.id`;
const EVENT_GROUP = "GROUP BY e.id, u.name";

function withSeats(row) {
  return { ...row, seats_left: row.seat_limit - row.registered_count };
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateEvent(body, requireFuture) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const venue = String(body.venue || "").trim();
  const seatLimit = Number(body.seat_limit);
  const eventDate = new Date(body.event_date);
  const errors = [];

  if (title.length < 3 || title.length > 120) {
    errors.push("Title must be 3 to 120 characters");
  }
  if (venue.length < 2 || venue.length > 120) {
    errors.push("Venue must be 2 to 120 characters");
  }
  if (description.length > 2000) {
    errors.push("Description must be 2000 characters or fewer");
  }
  if (!body.event_date || Number.isNaN(eventDate.getTime())) {
    errors.push("Enter a valid event date and time");
  } else if (requireFuture && eventDate <= new Date()) {
    errors.push("Event date must be in the future");
  }
  if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 10000) {
    errors.push("Seat limit must be a whole number from 1 to 10000");
  }

  return { errors, values: { title, description, venue, eventDate, seatLimit } };
}

// GET /api/events?q=hack&upcoming=true   (event discovery)
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 100);
    const upcoming = req.query.upcoming === "true";

    const result = await pool.query(
      `${EVENT_SELECT}
       WHERE ($2::text = ''
              OR e.title ILIKE '%' || $2::text || '%'
              OR e.venue ILIKE '%' || $2::text || '%')
         AND ($3::boolean = false OR e.event_date >= NOW())
       ${EVENT_GROUP}
       ORDER BY e.event_date ASC`,
      [req.user.id, q, upcoming]
    );
    res.json({ events: result.rows.map(withSeats) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/events/mine   (organizer's own events)
// Must stay ABOVE "/:id", otherwise "mine" would be read as an id.
router.get("/mine", requireRole("organizer"), async (req, res) => {
  try {
    const result = await pool.query(
      `${EVENT_SELECT}
       WHERE e.organizer_id = $1
       ${EVENT_GROUP}
       ORDER BY e.event_date DESC`,
      [req.user.id]
    );
    res.json({ events: result.rows.map(withSeats) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/events/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid event id" });

    const result = await pool.query(
      `${EVENT_SELECT}
       WHERE e.id = $2
       ${EVENT_GROUP}`,
      [req.user.id, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json({ event: withSeats(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// POST /api/events   (organizers only)
router.post("/", requireRole("organizer"), async (req, res) => {
  try {
    const { errors, values } = validateEvent(req.body || {}, true);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const result = await pool.query(
      `INSERT INTO events (organizer_id, title, description, venue, event_date, seat_limit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        req.user.id,
        values.title,
        values.description,
        values.venue,
        values.eventDate.toISOString(),
        values.seatLimit,
      ]
    );

    const created = await pool.query(
      `${EVENT_SELECT}
       WHERE e.id = $2
       ${EVENT_GROUP}`,
      [req.user.id, result.rows[0].id]
    );
    res.status(201).json({ event: withSeats(created.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// PUT /api/events/:id   (only the organizer who created it)
router.put("/:id", requireRole("organizer"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid event id" });

    const existing = await pool.query(
      `SELECT e.organizer_id, COUNT(r.id)::int AS registered_count
       FROM events e
       LEFT JOIN registrations r ON r.event_id = e.id
       WHERE e.id = $1
       GROUP BY e.id`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }
    if (existing.rows[0].organizer_id !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own events" });
    }

    const { errors, values } = validateEvent(req.body || {}, false);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }
    if (values.seatLimit < existing.rows[0].registered_count) {
      return res.status(400).json({
        message: `Seat limit cannot be lower than the ${existing.rows[0].registered_count} students already registered`,
      });
    }

    await pool.query(
      `UPDATE events
       SET title = $1, description = $2, venue = $3, event_date = $4, seat_limit = $5
       WHERE id = $6`,
      [
        values.title,
        values.description,
        values.venue,
        values.eventDate.toISOString(),
        values.seatLimit,
        id,
      ]
    );

    const updated = await pool.query(
      `${EVENT_SELECT}
       WHERE e.id = $2
       ${EVENT_GROUP}`,
      [req.user.id, id]
    );
    res.json({ event: withSeats(updated.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// DELETE /api/events/:id   (only the organizer who created it)
router.delete("/:id", requireRole("organizer"), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid event id" });

    const existing = await pool.query(
      "SELECT organizer_id FROM events WHERE id = $1",
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }
    if (existing.rows[0].organizer_id !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own events" });
    }

    // The registrations for this event are removed automatically
    // (ON DELETE CASCADE in the table).
    await pool.query("DELETE FROM events WHERE id = $1", [id]);
    res.json({ message: "Event deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;