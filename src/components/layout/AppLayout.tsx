import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

export function AppLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen w-full bg-background">
            {/* Desktop Sidebar */}
            <Sidebar className="hidden md:flex" />

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <Sidebar
                        className="absolute left-0 top-0 bottom-0 z-50 w-64 shadow-xl"
                        onClose={() => setIsMobileMenuOpen(false)}
                    />
                </div>
            )}

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile Header */}
                <div className="md:hidden h-16 border-b border-slate-200 bg-white flex items-center px-4 justify-between flex-shrink-0">
                    <div className="flex items-center gap-3 font-bold text-xl text-slate-800">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                        <span>TelajuApp</span>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-md"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                <main className="flex-1 overflow-auto bg-slate-50/50">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
