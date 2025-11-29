import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../shared/Navbar";
import { useAuth } from "../auth/AuthContext";
import type { JSX } from "react/jsx-runtime";

export default function AppLayout(): JSX.Element {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const isAuthRoute =
    pathname === "/login" || pathname === "/signup" || pathname === "/reset";
  const useGray = !user || isAuthRoute;

  return (
    <div
      className={`min-h-dvh flex flex-col ${
        useGray ? "bg-gray-100" : "bg-gray-100"
      } text-gray-900`}
    >
      <Navbar />
      <main className='mx-auto w-full'>
        <Outlet />
      </main>
    </div>
  );
}
