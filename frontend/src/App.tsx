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
import ResetConfirm from "./pages/ResetConfirm";

// Temporary placeholder until we build it:
const Predictors = () => <div className="p-6">Predictors page (coming soon)</div>;

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public for everyone */}
        <Route index element={<Landing />} />
        <Route path="about" element={<About />} />
        <Route path="instructions" element={<Instructions />} />
        <Route path="predictors" element={<Predictors />} />

        {/* Password reset confirm — support both patterns */}
        {/* UPDATE THIS LATER AND REMOVE THE WUERY TOKEN ONE */}
        <Route path="reset/confirm" element={<ResetConfirm />} />
        <Route path="reset/confirm/:uid/:token" element={<ResetConfirm />} />

        {/* Guest-only */}
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
