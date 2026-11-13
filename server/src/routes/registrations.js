import crypto from "crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Only logged-in students can use these routes.
router.use(requireAuth);
router.use(requireRole("student"));

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// A random, hard-to-guess code like EG-3F9A1C07B2D84E56
function makeTicketCode() {
  return "EG-" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

// POST /api/registrations   body: { "event_id": 1 }
router.post("/", async (req, res) => {
  const eventId = parseId((req.body || {}).event_id);
  if (!eventId) {
    return res.status(400).json({ message: "A valid event_id is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // FOR UPDATE locks this one event row. If another student is registering
    // for the same event right now, we wait here until they finish.
    const eventResult = await client.query(
      "SELECT id, event_date, seat_limit FROM events WHERE id = $1 FOR UPDATE",
      [eventId]
    );
    if (eventResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Event not found" });
    }
    const event = eventResult.rows[0];

    if (new Date(event.event_date) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This event has already happened" });
    }

    const already = await client.query(
      "SELECT 1 FROM registrations WHERE event_id = $1 AND user_id = $2",
      [eventId, req.user.id]
    );
    if (already.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "You are already registered for this event" });
    }

    const taken = await client.query(
      "SELECT COUNT(*)::int AS count FROM registrations WHERE event_id = $1",
      [eventId]
    );
    if (taken.rows[0].count >= event.seat_limit) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Sorry, this event is full" });
    }

    const inserted = await client.query(
      `INSERT INTO registrations (user_id, event_id, ticket_code)
       VALUES ($1, $2, $3)
       RETURNING id, event_id, ticket_code, created_at`,
      [req.user.id, eventId, makeTicketCode()]
    );

    await client.query("COMMIT");
    res.status(201).json({ registration: inserted.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    // 23505 = the table's own "one pass per student per event" rule fired
    if (error.code === "23505") {
      return res.status(409).json({ message: "You are already registered for this event" });
    }
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  } finally {
    client.release();
  }
});

// GET /api/registrations/mine   (the student's tickets)
// Must stay ABOVE "/:id", otherwise "mine" would be read as an id.
router.get("/mine", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.ticket_code, r.checked_in_at, r.created_at,
              e.id AS event_id, e.title, e.venue, e.event_date
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       WHERE r.user_id = $1
       ORDER BY e.event_date ASC`,
      [req.user.id]
    );
    res.json({ registrations: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/registrations/:id   (one ticket, only for its owner)
router.get("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ticket id" });

    const result = await pool.query(
      `SELECT r.id, r.ticket_code, r.checked_in_at, r.created_at,
              e.id AS event_id, e.title, e.venue, e.event_date,
              u.name AS student_name
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.user_id
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.json({ registration: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// DELETE /api/registrations/:id   (cancel your own registration)
router.delete("/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid ticket id" });

    const existing = await pool.query(
      "SELECT checked_in_at FROM registrations WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    if (existing.rows[0].checked_in_at) {
      return res.status(400).json({ message: "You cannot cancel after check-in" });
    }

    await pool.query("DELETE FROM registrations WHERE id = $1", [id]);
    res.json({ message: "Registration cancelled" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;