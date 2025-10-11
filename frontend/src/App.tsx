// src/App.tsx
import type { JSX } from "react/jsx-runtime";
import { Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";

import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          {/* Public routes */}
          <Route index element={<Login />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="reset" element={<ResetPassword />} />
          {/* Add future pages here as soon as they get made - currently: about, instruction, predictors */}

          {/* Private routes */}
          {/* basically, the user object needs to exist to access these pages */}
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />  
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
