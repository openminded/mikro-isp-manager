import { useState } from 'react';
import { LayoutDashboard, Server, Settings, Users, Layers, Database, ChevronDown, ChevronRight, Network, ClipboardList, Wrench, Briefcase, BadgeCheck, CheckCircle, AlertTriangle, ScrollText, Map, MessageSquare, Smartphone, Send, Radio, FileText, CreditCard } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navigation = [
    {
        section: "Overview",
        items: [
            { name: "Dashboard", href: "/", icon: LayoutDashboard },
            { name: "Topology", href: "/monitoring", icon: Map },
        ]
    },
    {
        section: "Client Services",
        items: [
            { name: "Customers", href: "/customers", icon: Users },
            {
                name: "Registration",
                icon: ClipboardList,
                children: [
                    { name: "Active", href: "/registration/active", icon: ClipboardList },
                    { name: "Completed", href: "/registration/completed", icon: CheckCircle },
                ]
            },
            { name: "Support Tickets", href: "/tickets", icon: Wrench },
            {
                name: "Working Order",
                icon: ClipboardList,
                children: [
                    { name: "In Progress", href: "/working-order/progress", icon: Wrench },
                    { name: "Completed", href: "/working-order/completed", icon: CheckCircle },
                ]
            },
        ]
    },
    {
        section: "Communication",
        items: [
            {
                name: "WhatsApp",
                icon: MessageSquare,
                children: [
                    { name: "Manager", href: "/whatsapp/manager", icon: Smartphone },
                    { name: "Broadcast", href: "/whatsapp/broadcast", icon: Radio },
                    { name: "Templates", href: "/whatsapp/templates", icon: FileText },
                    { name: "Send Message", href: "/whatsapp/send", icon: Send },
                ]
            },
        ]
    },
    {
        section: "Finance",
        items: [
            { name: "Billing & Invoices", href: "/finance", icon: CreditCard },
        ]
    },
    {
        section: "Management",
        items: [
            { name: "Employees", href: "/employees", icon: Briefcase },
            { name: "Servers", href: "/servers", icon: Server },
            {
                name: "Data Master",
                icon: Database,
                children: [
                    { name: "Job Titles", href: "/master/job-titles", icon: BadgeCheck },
                    { name: "Profiles", href: "/master/profiles", icon: Layers },
                    { name: "IP Pools", href: "/master/ip-pools", icon: Network },
                    { name: "Payment Methods", href: "/master/payment-methods", icon: CreditCard },
                    { name: "Damage Types", href: "/master/damage-types", icon: AlertTriangle },
                    { name: "Sub Areas", href: "/master/sub-areas", icon: Map },
                ]
            },
        ]
    },
    {
        section: "System",
        items: [
            { name: "Activity Logs", href: "/logs", icon: ScrollText },
            { name: "Settings", href: "/settings", icon: Settings },
        ]
    }
];

import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react";

export function Sidebar() {
    const location = useLocation();
    const [openMenus, setOpenMenus] = useState<string[]>(['Data Master', 'Working Order']);
    const { user, logout } = useAuth();
    const isTech = user?.role === 'technician';

    const toggleMenu = (name: string) => {
        setOpenMenus(prev =>
            prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name]
        );
    };

    return (
        <div className="flex flex-col w-64 border-r border-slate-200 bg-white h-screen">
            <div className="h-16 flex items-center px-6 border-b border-slate-200 justify-between flex-shrink-0">
                <div className="flex items-center gap-2 font-bold text-xl text-slate-800">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
                    <span>TelajuApp</span>
                </div>
            </div>

            {/* User Profile Mini */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user?.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 py-4 flex flex-col gap-6 px-3 overflow-y-auto">
                {navigation.map((group) => {
                    // Filter items within the group
                    const filteredItems = group.items.filter(item => {
                        if (!user) return false;
                        if (isTech) {
                            const allowed = ['Dashboard', 'Working Order', 'Support Tickets', 'Topology'];
                            return allowed.includes(item.name);
                        }
                        return true;
                    });

                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={group.section} className="flex flex-col gap-1">
                            <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                                {group.section}
                            </h3>

                            {filteredItems.map((item) => {
                                if ('children' in item && item.children) {
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

                                // Standard Item
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={(item as any).href}
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
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-200">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
