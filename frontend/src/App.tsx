import type { JSX } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'


export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>

        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* Add future pages here as soon as they get made - currently: about, instruction, predictors */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Route>
    </Routes>
    )
}
