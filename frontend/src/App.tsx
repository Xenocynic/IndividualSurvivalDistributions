import type { JSX } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Landing from "./pages/Landing";


export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>

        <Route index element={<Landing />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Add future pages here as soon as they get made - currently: About, Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Route>
    </Routes>
    )
}
