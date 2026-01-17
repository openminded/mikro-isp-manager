import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ClipboardList, Wrench, Filter, Users, Server, Briefcase } from 'lucide-react';
import type { Registration, Ticket } from '@/types';
import { useData } from '@/context/DataContext';

export function Dashboard() {
    const { user } = useAuth();
    const isTech = user?.role === 'technician';

    if (isTech) {
        return <TechnicianDashboard user={user} />;
    }

    return <AdminDashboard />;
}

function AdminDashboard() {
    const { customers: contextCustomers } = useData(); // Get customers from context if available
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [dbCustomers, setDbCustomers] = useState<any[]>([]); // Fallback if context not used or for full count
    const [servers, setServers] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch all necessary data
                // Note: Customers might be heavy if fetched fully, but let's assume it's okay for dashboard stats for now.
                // If using contextCustomers, we might skip fetching customers, but context might depend on sync.
                // Let's fetch lightweight list if possible, but distinct endpoints:
                const [regRes, ticketRes, serverRes, empRes] = await Promise.all([
                    axios.get('/api/registrations'),
                    axios.get('/api/tickets'),
                    axios.get('/api/servers'),
                    axios.get('/api/employees')
                ]);

                setRegistrations(regRes.data);
                setTickets(ticketRes.data);
                setServers(serverRes.data);
                setEmployees(empRes.data);
                if (contextCustomers.length > 0) {
                    setDbCustomers(contextCustomers);
                }

            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [contextCustomers.length]);

    // Update customers from context if it changes late
    useEffect(() => {
        if (contextCustomers.length > 0) {
            setDbCustomers(contextCustomers);
        }
    }, [contextCustomers]);

    // Filter Data by Date (Global)
    const filteredRegs = registrations.filter(r => {
        const dateStr = r.installation?.date || r.createdAt;
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    const filteredTickets = tickets.filter(t => {
        const date = new Date(t.createdAt);
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    // Global Stats
    const installationStats = {
        total: filteredRegs.length,
        pending: filteredRegs.filter(r => r.status === 'queue' || r.status === 'installation_process').length,
        done: filteredRegs.filter(r => r.status === 'done').length,
        cancel: filteredRegs.filter(r => r.status === 'cancel').length,
    };

    const ticketStats = {
        total: filteredTickets.length,
        open: filteredTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        resolved: filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                    <p className="text-slate-500">System Overview & Statistics</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <Filter className="w-4 h-4 text-slate-400 ml-2" />
                    <div className="w-[120px]">
                        <SearchableSelect
                            value={(selectedMonth + 1).toString()}
                            onChange={(value) => setSelectedMonth(Number(value) - 1)}
                            options={months.map((m, i) => ({ label: m, value: (i + 1).toString() }))}
                        />
                    </div>
                    <div className="w-[100px]">
                        <SearchableSelect
                            value={selectedYear.toString()}
                            onChange={(value) => setSelectedYear(Number(value))}
                            options={years.map(y => ({ label: y.toString(), value: y.toString() }))}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading dashboard...</div>
            ) : (
                <>
                    {/* Global Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Customers</p>
                                <p className="text-2xl font-bold text-slate-900">{dbCustomers.length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-violet-50 rounded-lg text-violet-600">
                                <Server className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Servers</p>
                                <p className="text-2xl font-bold text-slate-900">{servers.length}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                                <Briefcase className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Employees</p>
                                <p className="text-2xl font-bold text-slate-900">{employees.length}</p>
                            </div>
                        </div>
                    </div>

                    {/* Activity Stats for Selected Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Installation Activity */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                                <div className="flex items-center gap-2 font-semibold text-blue-900">
                                    <ClipboardList className="w-5 h-5 text-blue-600" />
                                    Installation Activity ({months[selectedMonth]})
                                </div>
                                <span className="text-2xl font-bold text-blue-600">{installationStats.total}</span>
                            </div>
                            <div className="p-6 grid grid-cols-3 gap-4 text-center">
                                <div className="space-y-1">
                                    <div className="text-sm text-slate-500 font-medium">Pending</div>
                                    <div className="text-xl font-bold text-amber-600">{installationStats.pending}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm text-slate-500 font-medium">Completed</div>
                                    <div className="text-xl font-bold text-emerald-600">{installationStats.done}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm text-slate-500 font-medium">Cancelled</div>
                                    <div className="text-xl font-bold text-red-500">{installationStats.cancel}</div>
                                </div>
                            </div>
                        </div>

                        {/* Ticket Activity */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                                <div className="flex items-center gap-2 font-semibold text-amber-900">
                                    <Wrench className="w-5 h-5 text-amber-600" />
                                    Ticket Activity ({months[selectedMonth]})
                                </div>
                                <span className="text-2xl font-bold text-amber-600">{ticketStats.total}</span>
                            </div>
                            <div className="p-6 grid grid-cols-2 gap-4 text-center">
                                <div className="space-y-1">
                                    <div className="text-sm text-slate-500 font-medium">Active (Open)</div>
                                    <div className="text-xl font-bold text-amber-600">{ticketStats.open}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm text-slate-500 font-medium">Resolved</div>
                                    <div className="text-xl font-bold text-emerald-600">{ticketStats.resolved}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function TechnicianDashboard({ user }: { user: any }) {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [regRes, ticketRes] = await Promise.all([
                    axios.get('/api/registrations'),
                    axios.get('/api/tickets')
                ]);
                setRegistrations(regRes.data);
                setTickets(ticketRes.data);
            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter Data by Technician Name and Date
    const filteredRegs = registrations.filter(r => {
        // Must be assigned to this tech
        if (r.installation?.technician !== user.name) return false;

        // Date Check (use Installation Date if available, else CreatedAt? 
        // Request says "Total Installation", usually based on when it was done or scheduled)
        // Let's use Installation Date if present.
        const dateStr = r.installation?.date;
        if (!dateStr) return false;

        const date = new Date(dateStr);
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    const filteredTickets = tickets.filter(t => {
        // Must be assigned to this tech (or maybe if they resolved it?)
        // Ticket has 'technician' name field.
        if (t.technician !== user.name) return false;

        // Date Check (CreatedAt or ResolvedAt?)
        // Usually workload stats are based on when it was created or assigned. Let's start with CreatedAt.
        const date = new Date(t.createdAt);
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });

    // Stats Calculation
    const installationStats = {
        total: filteredRegs.length,
        pending: filteredRegs.filter(r => r.status === 'queue' || r.status === 'installation_process').length,
        done: filteredRegs.filter(r => r.status === 'done').length,
        cancel: filteredRegs.filter(r => r.status === 'cancel').length,
    };

    const ticketStats = {
        total: filteredTickets.length,
        open: filteredTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
        resolved: filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Technician Dashboard</h1>
                    <p className="text-slate-500">Welcome back, {user.name}</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                    <Filter className="w-4 h-4 text-slate-400 ml-2" />
                    <select
                        className="bg-transparent text-sm font-medium focus:outline-none"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select
                        className="bg-transparent text-sm font-medium focus:outline-none border-l border-slate-200 pl-2"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">Loading statistics...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Installation Stats */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/50">
                            <div className="flex items-center gap-2 font-semibold text-blue-900">
                                <ClipboardList className="w-5 h-5 text-blue-600" />
                                Installations
                            </div>
                            <span className="text-2xl font-bold text-blue-600">{installationStats.total}</span>
                        </div>
                        <div className="p-6 grid grid-cols-3 gap-4 text-center">
                            <div className="space-y-1">
                                <div className="text-sm text-slate-500 font-medium">Pending</div>
                                <div className="text-xl font-bold text-amber-600">{installationStats.pending}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm text-slate-500 font-medium">Completed</div>
                                <div className="text-xl font-bold text-emerald-600">{installationStats.done}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm text-slate-500 font-medium">Cancelled</div>
                                <div className="text-xl font-bold text-red-500">{installationStats.cancel}</div>
                            </div>
                        </div>
                    </div>

                    {/* Ticket Stats */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                            <div className="flex items-center gap-2 font-semibold text-amber-900">
                                <Wrench className="w-5 h-5 text-amber-600" />
                                Support Tickets
                            </div>
                            <span className="text-2xl font-bold text-amber-600">{ticketStats.total}</span>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4 text-center">
                            <div className="space-y-1">
                                <div className="text-sm text-slate-500 font-medium">Active (Open)</div>
                                <div className="text-xl font-bold text-amber-600">{ticketStats.open}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-sm text-slate-500 font-medium">Resolved</div>
                                <div className="text-xl font-bold text-emerald-600">{ticketStats.resolved}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
