import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import { pool } from "../db.js";

// Every account made by these tests has an email starting with this unique
// prefix, so the cleanup at the end deletes exactly (and only) the test data.
const RUN = Date.now().toString(36);
const EMAIL_PATTERN = `${RUN}-%@eventgate-test.local`;

const auth = (token) => ({ Authorization: `Bearer ${token}` });

function inDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function signup(role, label, name = `Test ${label}`) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name,
      email: `${RUN}-${label}@eventgate-test.local`,
      password: "password123",
      role,
    });
  expect(res.status).toBe(201);
  return { token: res.body.token, user: res.body.user };
}

async function createEvent(token, seats, title = "Test Event") {
  const res = await request(app)
    .post("/api/events")
    .set(auth(token))
    .send({
      title,
      description: "",
      venue: "Test Hall",
      event_date: inDays(3),
      seat_limit: seats,
    });
  expect(res.status).toBe(201);
  return res.body.event;
}

function register(token, eventId) {
  return request(app).post("/api/registrations").set(auth(token)).send({ event_id: eventId });
}

function scan(token, eventId, ticketCode) {
  return request(app)
    .post("/api/checkin")
    .set(auth(token))
    .send({ event_id: eventId, ticket_code: ticketCode });
}

afterAll(async () => {
  // Deleting the users also deletes their events and registrations (CASCADE).
  await pool.query("DELETE FROM users WHERE email LIKE $1", [EMAIL_PATTERN]);
  await pool.end();
});

describe("EventGate API", () => {
  let organizer;
  let otherOrganizer;
  let student;
  let student2;

  beforeAll(async () => {
    organizer = await signup("organizer", "org1");
    otherOrganizer = await signup("organizer", "org2");
    student = await signup("student", "stu1");
    student2 = await signup("student", "stu2");
  });

  it("health check reaches the database", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  describe("accounts and login", () => {
    it("rejects a duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Duplicate",
          email: `${RUN}-stu1@eventgate-test.local`,
          password: "password123",
          role: "student",
        });
      expect(res.status).toBe(409);
    });

    it("rejects a password that is too short", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Short Password",
          email: `${RUN}-short@eventgate-test.local`,
          password: "abc",
          role: "student",
        });
      expect(res.status).toBe(400);
    });

    it("rejects a wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `${RUN}-stu1@eventgate-test.local`, password: "wrong-password" });
      expect(res.status).toBe(401);
    });

    it("logs in and returns the current user", async () => {
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: `${RUN}-stu1@eventgate-test.local`, password: "password123" });
      expect(login.status).toBe(200);

      const me = await request(app).get("/api/auth/me").set(auth(login.body.token));
      expect(me.status).toBe(200);
      expect(me.body.user.role).toBe("student");
    });

    it("rejects requests without a token", async () => {
      const res = await request(app).get("/api/events");
      expect(res.status).toBe(401);
    });

    it("rejects broken JSON with a clear message", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send("{this is not json");
      expect(res.status).toBe(400);
    });
  });

  describe("roles and ownership", () => {
    let ownedEvent;

    beforeAll(async () => {
      ownedEvent = await createEvent(organizer.token, 10, "Owned Event");
    });

    it("a student cannot create an event", async () => {
      const res = await request(app)
        .post("/api/events")
        .set(auth(student.token))
        .send({
          title: "Sneaky Event",
          description: "",
          venue: "Hall",
          event_date: inDays(2),
          seat_limit: 5,
        });
      expect(res.status).toBe(403);
    });

    it("another organizer cannot edit the event", async () => {
      const res = await request(app)
        .put(`/api/events/${ownedEvent.id}`)
        .set(auth(otherOrganizer.token))
        .send({
          title: "Hijacked",
          description: "",
          venue: "Hall",
          event_date: inDays(2),
          seat_limit: 5,
        });
      expect(res.status).toBe(403);
    });

    it("another organizer cannot delete the event", async () => {
      const res = await request(app)
        .delete(`/api/events/${ownedEvent.id}`)
        .set(auth(otherOrganizer.token));
      expect(res.status).toBe(403);
    });

    it("another organizer cannot read the attendance report", async () => {
      const res = await request(app)
        .get(`/api/events/${ownedEvent.id}/attendance`)
        .set(auth(otherOrganizer.token));
      expect(res.status).toBe(403);
    });

    it("a student cannot read the attendance report", async () => {
      const res = await request(app)
        .get(`/api/events/${ownedEvent.id}/attendance`)
        .set(auth(student.token));
      expect(res.status).toBe(403);
    });
  });

  describe("events", () => {
    it("rejects an event in the past", async () => {
      const res = await request(app)
        .post("/api/events")
        .set(auth(organizer.token))
        .send({
          title: "Old Event",
          description: "",
          venue: "Hall",
          event_date: inDays(-1),
          seat_limit: 10,
        });
      expect(res.status).toBe(400);
    });

    it("rejects zero seats", async () => {
      const res = await request(app)
        .post("/api/events")
        .set(auth(organizer.token))
        .send({
          title: "No Seats",
          description: "",
          venue: "Hall",
          event_date: inDays(2),
          seat_limit: 0,
        });
      expect(res.status).toBe(400);
    });

    it("shows a new event to students with the right seat numbers", async () => {
      const event = await createEvent(organizer.token, 12, "Listed Event");
      const res = await request(app).get("/api/events").set(auth(student.token));
      expect(res.status).toBe(200);
      const found = res.body.events.find((e) => e.id === event.id);
      expect(found.seats_left).toBe(12);
      expect(found.is_registered).toBe(false);
    });

    it("will not lower the seat limit below the students already registered", async () => {
      const event = await createEvent(organizer.token, 5, "Shrinking Event");
      expect((await register(student.token, event.id)).status).toBe(201);
      expect((await register(student2.token, event.id)).status).toBe(201);

      const res = await request(app)
        .put(`/api/events/${event.id}`)
        .set(auth(organizer.token))
        .send({
          title: "Shrinking Event",
          description: "",
          venue: "Test Hall",
          event_date: inDays(3),
          seat_limit: 1,
        });
      expect(res.status).toBe(400);
    });
  });

  describe("registration rules", () => {
    let event;
    let firstTicket;

    beforeAll(async () => {
      event = await createEvent(organizer.token, 2, "Two Seat Event");
    });

    it("a student registers and gets a ticket code", async () => {
      const res = await register(student.token, event.id);
      expect(res.status).toBe(201);
      expect(res.body.registration.ticket_code).toMatch(/^EG-[0-9A-F]{16}$/);
      firstTicket = res.body.registration;
    });

    it("the same student cannot register twice", async () => {
      const res = await register(student.token, event.id);
      expect(res.status).toBe(409);
    });

    it("an organizer cannot register", async () => {
      const res = await register(organizer.token, event.id);
      expect(res.status).toBe(403);
    });

    it("an event that does not exist gives 404", async () => {
      const res = await register(student.token, 999999999);
      expect(res.status).toBe(404);
    });

    it("stops handing out tickets when the event is full", async () => {
      expect((await register(student2.token, event.id)).status).toBe(201);
      const third = await signup("student", "stu3");
      const res = await register(third.token, event.id);
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/full/i);
    });

    it("a cancelled ticket frees the seat", async () => {
      const cancel = await request(app)
        .delete(`/api/registrations/${firstTicket.id}`)
        .set(auth(student.token));
      expect(cancel.status).toBe(200);

      const fourth = await signup("student", "stu4");
      expect((await register(fourth.token, event.id)).status).toBe(201);
    });
  });

  describe("the last seat", () => {
    it("five students racing for ONE seat: exactly one wins", async () => {
      const racers = await Promise.all(
        [1, 2, 3, 4, 5].map((n) => signup("student", `racer${n}`))
      );
      const event = await createEvent(organizer.token, 1, "Last Seat Event");

      // All five requests are sent at the same moment.
      const results = await Promise.all(racers.map((r) => register(r.token, event.id)));

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);

      const count = await pool.query(
        "SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1",
        [event.id]
      );
      expect(count.rows[0].n).toBe(1);
    });
  });

  describe("check-in", () => {
    let eventA;
    let eventB;
    let ticketA;
    let ticket2;

    beforeAll(async () => {
      eventA = await createEvent(organizer.token, 10, "Check-in A");
      eventB = await createEvent(organizer.token, 10, "Check-in B");
      ticketA = (await register(student.token, eventA.id)).body.registration;
      ticket2 = (await register(student2.token, eventA.id)).body.registration;
    });

    it("checks a student in", async () => {
      const res = await scan(organizer.token, eventA.id, ticketA.ticket_code);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("checked_in");
    });

    it("rejects a second scan of the same ticket", async () => {
      const res = await scan(organizer.token, eventA.id, ticketA.ticket_code);
      expect(res.status).toBe(409);
      expect(res.body.status).toBe("already_checked_in");
    });

    it("rejects a code that does not exist", async () => {
      const res = await scan(organizer.token, eventA.id, "EG-0000000000000000");
      expect(res.status).toBe(404);
    });

    it("rejects a ticket that belongs to a different event", async () => {
      const res = await scan(organizer.token, eventB.id, ticket2.ticket_code);
      expect(res.status).toBe(400);
    });

    it("another organizer cannot check people in", async () => {
      const res = await scan(otherOrganizer.token, eventA.id, ticket2.ticket_code);
      expect(res.status).toBe(403);
    });

    it("a student cannot scan tickets", async () => {
      const res = await scan(student.token, eventA.id, ticket2.ticket_code);
      expect(res.status).toBe(403);
    });

    it("two scans of one ticket at the same instant: exactly one wins", async () => {
      const results = await Promise.all([
        scan(organizer.token, eventA.id, ticket2.ticket_code),
        scan(organizer.token, eventA.id, ticket2.ticket_code),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it("a student cannot cancel after being checked in", async () => {
      const res = await request(app)
        .delete(`/api/registrations/${ticketA.id}`)
        .set(auth(student.token));
      expect(res.status).toBe(400);
    });
  });

  describe("attendance report and CSV", () => {
    let event;

    beforeAll(async () => {
      event = await createEvent(organizer.token, 10, "Report Event");
      const odd = await signup("student", "csv", "=1+1");
      expect((await register(odd.token, event.id)).status).toBe(201);
    });

    it("the JSON report counts registered and checked-in students", async () => {
      const res = await request(app)
        .get(`/api/events/${event.id}/attendance`)
        .set(auth(organizer.token));
      expect(res.status).toBe(200);
      expect(res.body.summary.registered).toBe(1);
      expect(res.body.summary.checked_in).toBe(0);
    });

    it("the CSV has a header and neutralises spreadsheet formulas", async () => {
      const res = await request(app)
        .get(`/api/events/${event.id}/attendance.csv`)
        .set(auth(organizer.token));
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text).toContain('"Name","Email"');
      // The name "=1+1" must be stored as text, not as a formula.
      expect(res.text).toContain(`"'=1+1"`);
    });
  });
});