import type { JSX } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'


export default function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Add future pages here as soon as they get made - currently: dashboard, about, instruction, predictors */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    )
}
