import { useState } from 'react';
import { LayoutDashboard, Server, Settings, Users, Layers, Database, ChevronDown, ChevronRight, Network, ClipboardList, Wrench, Briefcase, BadgeCheck, CheckCircle } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Registration", href: "/registration", icon: ClipboardList },
    {
        name: "Working Order",
        icon: Wrench,
        children: [
            { name: "In Progress", href: "/working-order/progress", icon: Wrench },
            { name: "Completed", href: "/working-order/completed", icon: CheckCircle },
        ]
    },
    { name: "Employees", href: "/employees", icon: Briefcase },
    { name: "Servers", href: "/servers", icon: Server },
    { name: "Customers", href: "/customers", icon: Users },
    {
        name: "Data Master",
        icon: Database,
        children: [
            { name: "Job Titles", href: "/master/job-titles", icon: BadgeCheck },
            { name: "Profiles", href: "/master/profiles", icon: Layers },
            { name: "IP Pools", href: "/master/ip-pools", icon: Network },
        ]
    },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState<string[]>(['Data Master']); // Default open for visibility

    const toggleMenu = (name: string) => {
        setOpenMenus(prev =>
            prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
        );
    };

    return (
        <div className="flex flex-col w-64 border-r border-slate-200 bg-white h-screen">
            <div className="h-16 flex items-center px-6 border-b border-slate-200">
                <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
                    <Server className="w-6 h-6 text-primary" />
                    <span>MikroManager</span>
                </div>
            </div>
            <div className="flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto">
                {navigation.map((item) => {
                    if (item.children) {
                        const isOpen = openMenus.includes(item.name);
                        const isActive = item.children.some(child => location.pathname === child.href);

                        return (
                            <div key={item.name} className="flex flex-col gap-1">
                                <button
                                    onClick={() => toggleMenu(item.name)}
                                    className={cn(
                                        "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                        isActive ? "text-primary bg-primary/5" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-5 h-5" />
                                        {item.name}
                                    </div>
                                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                {isOpen && (
                                    <div className="flex flex-col gap-1 pl-9 border-l border-slate-100 ml-5">
                                        {item.children.map((child) => (
                                            <NavLink
                                                key={child.name}
                                                to={child.href}
                                                className={({ isActive }) =>
                                                    cn(
                                                        "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                                        isActive
                                                            ? "bg-primary/10 text-primary"
                                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                                    )
                                                }
                                            >
                                                <child.icon className="w-4 h-4" />
                                                <span>{child.name}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            {item.name}
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
}
