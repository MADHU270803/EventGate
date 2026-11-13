import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { GuestOnly, ProtectedRoute, RootRedirect } from "./components/RouteGuards.jsx";
import Attendance from "./pages/Attendance.jsx";
import Discover from "./pages/Discover.jsx";
import EventForm from "./pages/EventForm.jsx";
import Login from "./pages/Login.jsx";
import MyTickets from "./pages/MyTickets.jsx";
import OrganizerDashboard from "./pages/OrganizerDashboard.jsx";
import { NotFound } from "./pages/Placeholders.jsx";
import Register from "./pages/Register.jsx";
import ScanPage from "./pages/ScanPage.jsx";
import TicketPage from "./pages/TicketPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <Register />
          </GuestOnly>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute role="student" />}>
            <Route path="/discover" element={<Discover />} />
            <Route path="/my-tickets" element={<MyTickets />} />
            <Route path="/tickets/:id" element={<TicketPage />} />
          </Route>
          <Route element={<ProtectedRoute role="organizer" />}>
            <Route path="/organizer" element={<OrganizerDashboard />} />
            <Route path="/organizer/events/new" element={<EventForm />} />
            <Route path="/organizer/events/:id/edit" element={<EventForm />} />
            <Route path="/organizer/events/:id/scan" element={<ScanPage />} />
            <Route path="/organizer/events/:id" element={<Attendance />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}