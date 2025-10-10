import { Link, NavLink } from "react-router-dom";
import { User } from "lucide-react";

function NavItem({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-white/10 text-white"
            : "text-white/80 hover:text-white hover:bg-white/10"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/20 bg-black">
      <div className="container mx-auto max-w-6xl h-14 md:h-16 px-3 md:px-4 flex items-center justify-between">
        <div className="flex items-center">
            {/* LEFT - Website name */}
            <Link
                to="/"
                className="text-white font-semibold tracking-tight mr-6 md:mr-8"  // add margin-right
            >
                ISD | Individual Survival Distributions
            </Link>

            {/* LEFT - Buttons */}
            <nav className="hidden sm:flex items-center gap-2 md:gap-3">
                <NavItem to="/about">About</NavItem>
                <NavItem to="/instruction">Instruction</NavItem>
                <NavItem to="/predictors">Predictors</NavItem>
            </nav>
        </div>

        {/* RIGHT: Dashboard + user icon */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="hidden sm:inline-flex items-center rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20"
          >
            Dashboard
          </Link>
          <button
            aria-label="Profile"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
