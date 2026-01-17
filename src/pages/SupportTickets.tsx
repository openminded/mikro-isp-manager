import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Clock, AlertTriangle, Wrench, X, FileText } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
// import { useServers } from '@/context/ServerContext'; // Unused
import type { Ticket, DamageType } from '@/types';
import { cn } from '@/lib/utils';

export function SupportTickets() {
    const { user } = useAuth();
    const isTech = user?.role === 'technician';
    const { customers } = useData();
    // const { servers } = useServers(); // Unused
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [damageTypes, setDamageTypes] = useState<DamageType[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [jobTitles, setJobTitles] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isAppearing, setIsAppearing] = useState(false);

    // Filter Logic
    // const [filterDateStart, setFilterDateStart] = useState(''); // Unused for now
    // const [filterDateEnd, setFilterDateEnd] = useState(''); // Unused for now

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isProcessOpen, setIsProcessOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

    // Form Data (New Ticket)
    const [formData, setFormData] = useState({
        customerId: '',
        damageTypeId: '',
        description: '',
    });

    // Process Data (Technician Assignment / Resolution)
    const [processData, setProcessData] = useState({
        technicianId: '',
        solution: '',
        status: '',
        notes: ''
    });

    useEffect(() => {
        setIsAppearing(true);
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [ticketRes, damageRes, empRes, titleRes] = await Promise.all([
                axios.get('/api/tickets'),
                axios.get('/api/damage-types'),
                axios.get('/api/employees'),
                axios.get('/api/job-titles')
            ]);
            setTickets(ticketRes.data);
            setDamageTypes(damageRes.data);
            setEmployees(empRes.data);
            setJobTitles(titleRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTickets = async () => {
        try {
            const res = await axios.get('/api/tickets');
            setTickets(res.data);
        } catch (error) {
            console.error("Failed to fetch tickets", error);
        }
    };

    const getTechnicians = () => {
        return employees.filter(e => {
            const title = jobTitles.find(t => t.id === e.jobTitleId);
            if (!title) return false;
            const titleName = title.name.toLowerCase();
            return titleName.includes('technician') || titleName.includes('teknisi') || titleName.includes('technical');
        });
    };

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        const customer = customers.find(c => c.id === formData.customerId); // Logic: find by ID (username or actual ID depending on unique key usage)
        // Wait, context customers might not be exhaustive if cached? Actually they are exhaustive per server cache.
        // Assuming customer search input logic later, for now simple dropdown or assuming customers context is populated.

        // Actually, customers ID in context is Mikrotik ID.
        // We probably need a smarter customer picker. For now, let's use a simple select which might be heavy if many customers.
        // Optimization: Use a searching combobox.

        if (!customer) return;

        const damageType = damageTypes.find(d => d.id === formData.damageTypeId);

        const newTicket = {
            ticketNumber: `T-${Date.now().toString().slice(-6)}`,
            customerId: customer.id, // Using whatever ID we have
            customerName: customer.comment || customer.name,
            customerPhone: customer.whatsapp || '-', // Fallback
            customerAddress: '-', // Needs extended data or registration data?
            // Since Customer interface in context has limited fields, we might need to rely on what we have or fetch more.
            // Currently generic Customer interface has: name, comment, serverName...
            // Let's use what is available.
            locationId: customer.serverName,
            damageTypeId: formData.damageTypeId,
            damageTypeName: damageType?.name || 'Unknown',
            description: formData.description,
            status: 'open',
        };

        try {
            await axios.post('/api/tickets', newTicket);
            fetchTickets();
            setIsFormOpen(false);
            setFormData({ customerId: '', damageTypeId: '', description: '' });
        } catch (error) {
            alert('Failed to create ticket');
        }
    };

    const openProcess = (ticket: Ticket) => {
        setSelectedTicket(ticket);
        setProcessData({
            technicianId: ticket.technicianId || '',
            solution: ticket.solution || '',
            status: ticket.status,
            notes: ''
        });
        setIsProcessOpen(true);
    };

    const handleProcessSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTicket) return;

        const technician = employees.find(e => e.id === processData.technicianId);

        const updates: any = {
            status: processData.status,
            technicianId: processData.technicianId,
            technician: technician?.name,
            solution: processData.solution
        };

        if (processData.status === 'resolved' || processData.status === 'closed') {
            if (!selectedTicket.resolvedAt) updates.resolvedAt = new Date().toISOString();
        }

        try {
            await axios.put(`/api/tickets/${selectedTicket.id}`, updates);
            fetchTickets();
            setIsProcessOpen(false);
        } catch (error) {
            alert('Failed to update ticket');
        }
    };

    // Filters
    const filteredTickets = tickets.filter(t => {
        const matchesSearch = t.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;

        // Date Logic (optional)

        return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className={`p-6 max-w-7xl mx-auto transition-opacity duration-500 ${isAppearing ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Support Tickets</h1>
                    <p className="text-slate-500">Manage customer repair requests</p>
                </div>
                {!isTech && (
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        New Ticket
                    </button>
                )}
            </div>

            {/* Stats Cards could go here */}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between">
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search ticket # or customer..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="w-[180px]">
                            <SearchableSelect
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={[
                                    { label: 'All Status', value: 'all' },
                                    { label: 'Open', value: 'open' },
                                    { label: 'In Progress', value: 'in_progress' },
                                    { label: 'Resolved', value: 'resolved' },
                                    { label: 'Closed', value: 'closed' }
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Ticket Info</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Issue</th>
                                <th className="px-6 py-4">Technician</th>
                                {!isTech && <th className="px-6 py-4">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : filteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <FileText className="w-8 h-8 text-slate-200" />
                                            <p>No tickets found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
                                                ticket.status === 'open' && "bg-slate-100 text-slate-700 border-slate-200",
                                                ticket.status === 'in_progress' && "bg-blue-50 text-blue-700 border-blue-200",
                                                ticket.status === 'resolved' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                                ticket.status === 'closed' && "bg-gray-100 text-gray-500 border-gray-200"
                                            )}>
                                                {ticket.status === 'in_progress' ? 'In Progress' : ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{ticket.ticketNumber}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(ticket.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{ticket.customerName}</div>
                                            <div className="text-xs text-slate-500">{ticket.locationId}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                                <span className="font-medium text-slate-700">{ticket.damageTypeName}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-1 max-w-[200px]" title={ticket.description}>
                                                {ticket.description}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {ticket.technician ? (
                                                <div className="flex items-center gap-1 text-slate-700">
                                                    <Wrench className="w-3 h-3 text-slate-400" />
                                                    {ticket.technician}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                                            )}
                                        </td>
                                        {!isTech && (
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => openProcess(ticket)}
                                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:border-primary/50 hover:text-primary rounded-lg text-xs font-medium transition-all shadow-sm"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg text-slate-900">New Support Ticket</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Customer <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    required
                                    value={formData.customerId}
                                    onChange={(val) => setFormData({ ...formData, customerId: val })}
                                    options={[
                                        { label: 'Select Customer...', value: '' },
                                        ...customers
                                            .sort((a, b) => (a.comment || a.name).localeCompare(b.comment || b.name))
                                            .map(c => ({
                                                label: `${c.comment || c.name} (${c.serverName})`,
                                                value: c.id
                                            }))
                                    ]}
                                    placeholder="Select Customer..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Damage Type <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    required
                                    value={formData.damageTypeId}
                                    onChange={(val) => setFormData({ ...formData, damageTypeId: val })}
                                    options={[
                                        { label: 'Select Type...', value: '' },
                                        ...damageTypes.map(d => ({ label: d.name, value: d.id }))
                                    ]}
                                    placeholder="Select Type..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Describe the issue..."
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">Create Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Process Modal */}
            {isProcessOpen && selectedTicket && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-semibold text-lg text-slate-900">Manage Ticket {selectedTicket.ticketNumber}</h3>
                                <p className="text-xs text-slate-500">{selectedTicket.customerName} - {selectedTicket.damageTypeName}</p>
                            </div>
                            <button onClick={() => setIsProcessOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleProcessSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign Technician</label>
                                    <SearchableSelect
                                        value={processData.technicianId}
                                        onChange={(val) => setProcessData({ ...processData, technicianId: val })}
                                        options={[
                                            { label: 'Unassigned', value: '' },
                                            ...getTechnicians().map(t => ({ label: t.name, value: t.id }))
                                        ]}
                                        placeholder="Unassigned"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                    <SearchableSelect
                                        value={processData.status}
                                        onChange={(val) => setProcessData({ ...processData, status: val })}
                                        options={[
                                            { label: 'Open', value: 'open' },
                                            { label: 'In Progress', value: 'in_progress' },
                                            { label: 'Resolved', value: 'resolved' },
                                            { label: 'Closed', value: 'closed' }
                                        ]}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Solution / Resolution Notes</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    rows={4}
                                    value={processData.solution}
                                    onChange={e => setProcessData({ ...processData, solution: e.target.value })}
                                    placeholder="Describe how the issue was resolved..."
                                ></textarea>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-500 border border-slate-100">
                                <div className="font-medium text-slate-700 mb-1">Issue Description</div>
                                "{selectedTicket.description}"
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsProcessOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">Update Ticket</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
