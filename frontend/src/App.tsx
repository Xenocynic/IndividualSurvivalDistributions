import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./auth/ProtectedRoute";
import GuestRoute from "./auth/GuestRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Instructions from "./pages/Instructions";
import Browse from "./pages/Browse";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public for everyone (including logged-in users) */}
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="browse" element={<Browse />} />

        {/* Guest-only (redirects to /dashboard if already logged in) */}
        <Route element={<GuestRoute />}>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="reset" element={<ResetPassword />} />
        </Route>

        {/* Auth-only */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
