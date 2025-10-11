import { Outlet } from 'react-router-dom'
import Navbar from "../shared/Navbar"
import type { JSX } from 'react/jsx-runtime'


export default function AppLayout(): JSX.Element {
    return (
        // Overall app background + vertical stacking
        <div className="min-h-dvh flex flex-col bg-white text-gray-900">
            <Navbar />
            <main className="container mx-auto w-full max-w-6xl px-4 md:px-6 py-8">
                <Outlet />
            </main>
        </div>
    )
}