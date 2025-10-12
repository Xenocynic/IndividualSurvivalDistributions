import type { JSX } from "react/jsx-runtime";
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

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>

        {/* Public pages (redirect to dashboard if already logged in) */}
        <Route element={<GuestRoute />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="reset" element={<ResetPassword />} />
          <Route path="about" element={<About />} />
        </Route>
        {/* add the other pages here ^ - instructions, predictors / datasets */}

        {/* Protected pages */}
        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* fallback */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
