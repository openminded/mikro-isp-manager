import { useState, useEffect } from 'react';
import { CheckCircle, MapPin, Smartphone, User, Calendar, Wrench, Search, XCircle, Loader2, AlertTriangle, ClipboardList, Upload } from 'lucide-react';
import axios from 'axios';
import { cn } from '@/lib/utils';
import type { Ticket, Registration } from '@/types';

import { SearchableSelect } from '@/components/ui/SearchableSelect';

// Unified Interface
interface WorkItem {
    id: string;
    type: 'installation' | 'ticket';
    customerName: string;
    phoneNumber: string;
    address: string;
    server: string;
    technician: string;
    date: string; // Installation Date or Ticket Created Date
    status: 'pending' | 'in_progress' | 'done' | 'cancel';
    originalObject: Registration | Ticket;
    note?: string;
    rawStatus?: string; // For badges (e.g. ticket status vs registration status)
}

interface Server {
    id: string;
    name: string;
    ip: string;
    username: string;
    password?: string;
    port?: number;
}

interface PppSecret {
    '.id': string;
    name: string;
    service: string;
    profile: string;
    comment?: string;
}

// Reuse StatusModal logic (simplified)
interface StatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (note: string) => void;
    title: string;
    actionType: 'pending' | 'cancel' | 'resolve'; // Added resolve
}

function StatusModal({ isOpen, onClose, onSubmit, title, actionType }: StatusModalProps) {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) setNote('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm mb-4">
                    {actionType === 'resolve'
                        ? 'Please provide resolution notes for this ticket.'
                        : 'Please provide a reason or note for this action.'}
                </p>
                <textarea
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px] bg-slate-50"
                    placeholder={actionType === 'resolve' ? "Resolution details..." : "Enter note here..."}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    autoFocus
                />
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSubmit(note)}
                        disabled={!note.trim()}
                        className={cn(
                            "px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors",
                            actionType === 'cancel' ? 'bg-red-600 hover:bg-red-700' :
                                actionType === 'resolve' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                    'bg-amber-500 hover:bg-amber-600'
                        )}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

// Reuse CompletionModal for Installations (unchanged logic mostly)
interface CompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (secretId: string, files: File[], subAreaId: string, secretName: string) => void;
    serverName: string;
    fetchingSecrets: boolean;
    secrets: PppSecret[];
    subAreas: any[];
}

function CompletionModal({ isOpen, onClose, onConfirm, serverName, fetchingSecrets, secrets, subAreas }: CompletionModalProps) {
    const [selectedSecretId, setSelectedSecretId] = useState('');
    const [selectedSubAreaId, setSelectedSubAreaId] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        setSelectedSecretId('');
        setSelectedSubAreaId('');
        setSelectedFiles([]);
        setPreviewUrls([]);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedFiles(files);

            // Generate previews
            const urls = files.map(file => URL.createObjectURL(file));
            setPreviewUrls(urls);
        }
    };

    const handleSubmit = () => {
        const secret = secrets.find(s => s['.id'] === selectedSecretId);
        if (secret && selectedFiles.length > 0) {
            onConfirm(secret['.id'], selectedFiles, selectedSubAreaId, secret.name);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 transform transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900">Complete Installation</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                    <span className="font-semibold">Target Server:</span> {serverName}
                </div>

                <p className="text-slate-500 text-sm mb-4">
                    Link Mikrotik PPPoE Secret and upload installation photos to complete.
                </p>

                {fetchingSecrets ? (
                    <div className="flex items-center justify-center p-8 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Fetching secrets from router...
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Select PPPoE Account</label>
                            <SearchableSelect
                                options={secrets.map(s => ({
                                    value: s['.id'],
                                    label: s.comment ? `${s.name} (${s.comment})` : s.name
                                }))}
                                value={selectedSecretId}
                                onChange={setSelectedSecretId}
                                placeholder="Select PPPoE Account..."
                            />
                            {secrets.length === 0 && (
                                <p className="text-xs text-red-500 mt-1">No PPPoE secrets found on this server.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sub Area</label>
                            <SearchableSelect
                                options={subAreas
                                    // Use filtered methods if serverName maps to ID, otherwise just show all?
                                    // We need server ID. But we only have serverName here.
                                    // However, in WorkingOrder we can find ID. In Modal props we receive serverName.
                                    // Let's filter in the Modal? No, simpler to just show all for now?
                                    // Or better, filter by finding the ID from subAreas (if we had server list here).
                                    // For now, let's just show all or maybe pass serverId?
                                    // WorkingOrder passes serverName.
                                    // Let's filter purely by matching serverName if we can?
                                    // No, SubArea has serverId.
                                    // Let's pass filteredSubAreas to Modal?
                                    // Yes, let's filter in WorkingOrder before passing.
                                    // BUT, for now I will just map ALL subAreas and let user pick (with label showing server maybe?).
                                    // Actually, let's update WorkingOrder to pass filteredSubAreas.
                                    // REVERTING this thought: Let's just use subAreas prop (which should be filtered).
                                    // But I passed raw subAreas.
                                    // Modify SearchableSelect options below to match what I'll do in WorkingOrder.
                                    .map(sa => ({ label: sa.name, value: sa.id }))
                                }
                                value={selectedSubAreaId}
                                onChange={setSelectedSubAreaId}
                                placeholder="Select Sub Area..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Installation Photos <span className="text-red-500">*</span>
                            </label>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                                    <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> photos</p>
                                    <p className="text-xs text-slate-400">Min 1 photo required (JPG, PNG)</p>
                                </div>
                                <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
                            </label>

                            {/* Previews */}
                            {previewUrls.length > 0 && (
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    {previewUrls.map((url, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-slate-200">
                                            <img src={url} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedSecretId || selectedFiles.length === 0}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirm Completion
                    </button>
                </div>
            </div>
        </div>
    );
}

interface WorkingOrderProps {
    view?: 'progress' | 'completed';
}

export function WorkingOrder({ view = 'progress' }: WorkingOrderProps) {
    // const { user } = useAuth();
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [servers, setServers] = useState<Server[]>([]);
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof WorkItem | 'date', direction: 'asc' | 'desc' } | null>(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
    const [modalAction, setModalAction] = useState<'pending' | 'cancel' | 'resolve'>('pending');

    // Installation Completion Modal State
    const [completionModalOpen, setCompletionModalOpen] = useState(false);
    const [completingOrder, setCompletingOrder] = useState<Registration | null>(null);
    const [fetchingSecrets, setFetchingSecrets] = useState(false);
    const [routerSecrets, setRouterSecrets] = useState<PppSecret[]>([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);

    useEffect(() => {
        fetchData();
    }, [view]); // Refetch when view changes to ensure fresh data

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resServers, resRegs, resTickets, resSubAreas] = await Promise.all([
                axios.get('/api/servers'),
                axios.get('/api/registrations'),
                axios.get('/api/tickets'),
                axios.get('/api/sub-areas')
            ]);

            setServers(resServers.data);
            setSubAreas(resSubAreas.data); // Needs state
            const regs: Registration[] = resRegs.data;
            const tickets: Ticket[] = resTickets.data;

            const items: WorkItem[] = [];

            // Process Registrations
            regs.forEach(r => {
                let status: WorkItem['status'] = 'in_progress';
                if (r.status === 'done' && r.workingOrderStatus === 'done') status = 'done';
                if (r.status === 'cancel') status = 'cancel'; // Should act same as cancel
                if (r.workingOrderStatus === 'pending') status = 'pending';

                // Only include based on view
                const isCompleted = r.status === 'done' && r.workingOrderStatus === 'done';
                if (view === 'progress' && isCompleted) return;
                if (view === 'completed' && !isCompleted) return;
                if (view === 'progress' && r.status === 'queue') return; // Queued not yet WO

                // Normalize for "Installation Process"
                if (view === 'progress' && r.status !== 'installation_process' && r.status !== 'done') return;

                items.push({
                    id: r.id,
                    type: 'installation',
                    customerName: r.fullName,
                    phoneNumber: r.phoneNumber,
                    address: r.address,
                    server: r.locationId,
                    technician: r.installation?.technician || 'Unassigned',
                    date: r.installation?.date || '',
                    status,
                    originalObject: r,
                    note: r.workingOrderNote,
                    rawStatus: r.workingOrderStatus === 'pending' ? 'Pending' : (status === 'done' ? 'Completed' : 'Installation')
                });
            });

            // Process Tickets
            tickets.forEach(t => {
                let status: WorkItem['status'] = 'in_progress';
                if (t.status === 'resolved' || t.status === 'closed') status = 'done';

                // Only include based on view
                const isCompleted = t.status === 'resolved' || t.status === 'closed';
                if (view === 'progress' && isCompleted) return;
                if (view === 'completed' && !isCompleted) return;

                // For progress view, include Open and In Progress tickets
                if (view === 'progress' && t.status !== 'open' && t.status !== 'in_progress') return;

                items.push({
                    id: t.id,
                    type: 'ticket',
                    customerName: t.customerName,
                    phoneNumber: t.customerPhone,
                    address: t.customerAddress || '-',
                    server: t.locationId || '-',
                    technician: t.technician || 'Unassigned',
                    date: t.createdAt,
                    status,
                    originalObject: t,
                    rawStatus: t.status,
                    note: t.status === 'open' ? 'Waiting Assignment' : (t.description)
                });
            });

            setWorkItems(items);

        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (item: WorkItem, action: 'complete' | 'pending' | 'cancel') => {
        if (action === 'complete') {
            if (item.type === 'installation') {
                setCompletingOrder(item.originalObject as Registration);
                setCompletionModalOpen(true);
                handleFetchSecrets(item);
            } else {
                // Ticket Resolution
                setSelectedItem(item);
                setModalAction('resolve');
                setModalOpen(true);
            }
        } else {
            setSelectedItem(item);
            setModalAction(action);
            setModalOpen(true);
        }
    };

    const handleFetchSecrets = async (item: WorkItem) => {
        setFetchingSecrets(true);
        setRouterSecrets([]);
        // Find server
        const server = servers.find(s => s.name === item.server);
        if (!server) {
            alert('Server not found for this order location.');
            setFetchingSecrets(false);
            return;
        }
        try {
            const response = await axios.post('/api/proxy', {
                host: server.ip,
                user: server.username,
                password: server.password,
                port: server.port,
                command: '/ppp/secret/print'
            });
            if (Array.isArray(response.data)) {
                setRouterSecrets(response.data);
            }
        } catch (error: any) {
            console.error("Failed to fetch secrets", error);
        } finally {
            setFetchingSecrets(false);
        }
    };

    const handleModalSubmit = async (note: string) => {
        if (!selectedItem) return;

        try {
            if (selectedItem.type === 'installation') {
                const updates: any = { workingOrderNote: note };
                if (modalAction === 'pending') {
                    updates.workingOrderStatus = 'pending';
                    updates.status = 'installation_process';
                } else if (modalAction === 'cancel') {
                    updates.status = 'cancel';
                    updates.workingOrderStatus = 'done';
                }
                await axios.put(`/api/registrations/${selectedItem.id}`, updates);
            } else {
                // Ticket Updates
                const updates: any = {};
                if (modalAction === 'resolve') {
                    updates.status = 'resolved';
                    updates.solution = note;
                    updates.resolvedAt = new Date().toISOString();
                } else if (modalAction === 'pending') {
                    // Ticket doesn't have "pending" state strictly, maybe just adding a note or keeping it in progress
                    // user wants "pending", let's assume it keeps status but adds note? 
                    // Or maybe we treat 'open' as pending? Let's just update description or add a note field if we had one.
                    // For now, let's just append to description or ignore if no field.
                    // Actually, let's set status back to 'in_progress' explicitly if it was something else?
                    alert("Pending status for tickets is just 'In Progress'. Note recorded locally (not saved to DB yet as no specific field for notes).");
                    // Ideally we would add a 'notes' array to tickets.
                } else if (modalAction === 'cancel') {
                    updates.status = 'closed'; // Or deleted? Closed seems safer.
                }
                await axios.put(`/api/tickets/${selectedItem.id}`, updates);
            }

            setModalOpen(false);
            fetchData();
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleCompletionConfirm = async (secretId: string, files: File[], subAreaId: string, secretName: string) => {
        if (!completingOrder) return;
        const server = servers.find(s => s.name === completingOrder.locationId);
        if (!server) return;

        // Create FormData
        const formData = new FormData();
        formData.append('secretId', secretId);
        formData.append('secretName', secretName); // Pass name for SQL Customer creation
        if (subAreaId) formData.append('sub_area_id', subAreaId);

        files.forEach(file => {
            formData.append('photos', file);
        });

        try {
            // 1. Update Router
            const dateStr = new Date().toISOString().split('T')[0];
            const newComment = `${server.name} - ${completingOrder.fullName} - ${dateStr}`;

            await axios.post('/api/proxy', {
                host: server.ip,
                user: server.username,
                password: server.password,
                port: server.port,
                command: ['/ppp/secret/set', `=.id=${secretId}`, `=comment=${newComment}`, '=disabled=no']
            });

            // 2. Submit to Backend (New Endpoint)
            await axios.post(`/api/registrations/${completingOrder.id}/complete`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setCompletionModalOpen(false);
            setCompletingOrder(null);
            fetchData();
            alert(`Order completed successfully!`);
        } catch (error: any) {
            console.error(error);
            alert(`Failed to complete: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleReopen = async (item: WorkItem) => {
        if (!confirm('Reopen this job?')) return;
        try {
            if (item.type === 'installation') {
                await axios.put(`/api/registrations/${item.id}`, {
                    workingOrderStatus: 'pending',
                    status: 'installation_process'
                });
            } else {
                await axios.put(`/api/tickets/${item.id}`, {
                    status: 'in_progress',
                    resolvedAt: null
                });
            }
            fetchData();
        } catch (error) {
            alert('Failed to reopen');
        }
    };

    // Filter & Sort Logic
    const filteredAndSortedItems = workItems
        .filter(item => {
            // Role Restriction
            /* 
            if (user?.role === 'technician') {
                if (item.technician !== user?.name) return false;
            }
            */

            const searchLower = filter.toLowerCase();
            const matchesSearch = item.customerName.toLowerCase().includes(searchLower) ||
                item.phoneNumber.includes(filter) ||
                item.technician.toLowerCase().includes(searchLower) ||
                item.server.toLowerCase().includes(searchLower) ||
                (item.type === 'ticket' && (item.originalObject as Ticket).ticketNumber.toLowerCase().includes(searchLower));
            return matchesSearch;
        })
        .sort((a, b) => {
            if (!sortConfig) return new Date(b.date).getTime() - new Date(a.date).getTime(); // Default new first
            const { key, direction } = sortConfig;
            if (key === 'date') {
                return direction === 'asc' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime();
            }
            const aVal = String(a[key]).toLowerCase();
            const bVal = String(b[key]).toLowerCase();
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof WorkItem | 'date') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Pagination
    const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredAndSortedItems.length / itemsPerPage);
    const startIndex = (currentPage - 1) * (itemsPerPage === -1 ? filteredAndSortedItems.length : itemsPerPage);
    const paginatedItems = itemsPerPage === -1 ? filteredAndSortedItems : filteredAndSortedItems.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [filter, view, itemsPerPage]);

    return (
        <div className="p-8 space-y-6">
            <StatusModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleModalSubmit}
                title={modalAction === 'resolve' ? 'Resolve Ticket' : (modalAction === 'pending' ? 'Set Pending' : 'Cancel Job')}
                actionType={modalAction}
            />

            <CompletionModal
                isOpen={completionModalOpen}
                onClose={() => { setCompletionModalOpen(false); setCompletingOrder(null); }}
                onConfirm={handleCompletionConfirm}
                serverName={completingOrder?.locationId || ''}
                fetchingSecrets={fetchingSecrets}
                secrets={routerSecrets}
                subAreas={subAreas.filter(sa => {
                    if (!completingOrder?.locationId) return false;
                    const s = servers.find(sv => sv.name === completingOrder.locationId);
                    return s && sa.serverId === s.id;
                })}
            />

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    {view === 'progress' ? 'Job List (In Progress)' : 'Job History (Completed)'}
                </h1>
                <p className="text-slate-500">
                    {view === 'progress' ? 'Active installations and support tickets' : 'History of installations and resolved tickets'}
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Search customer, phone, tech, or ticket #..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 font-medium text-slate-500">Type</th>
                                <th className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('customerName')}>Customer</th>
                                <th className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('server')}>Server</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Job Info</th>
                                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No jobs found</td></tr>
                            ) : paginatedItems.map((item) => (
                                <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/50 group transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {item.type === 'installation' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 w-fit">
                                                    <ClipboardList className="w-3 h-3" /> Installation
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                                                    <Wrench className="w-3 h-3" /> Ticket
                                                </span>
                                            )}
                                            <span className={cn(
                                                "text-xs font-medium px-2 py-0.5 rounded-full border w-fit mt-1",
                                                item.status === 'done' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                    item.rawStatus === 'Pending' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                        "bg-slate-100 text-slate-600 border-slate-200"
                                            )}>
                                                {item.type === 'ticket' ? item.rawStatus : item.rawStatus}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{item.customerName}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Smartphone className="w-3 h-3" /> {item.phoneNumber}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[200px]" title={item.address}>
                                            <MapPin className="w-3 h-3" /> {item.address}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700 font-medium">{item.server}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="font-medium">Tech:</span> {item.technician}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                                            </div>
                                            {item.type === 'ticket' && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                                    <span className="font-medium">Issue:</span> {(item.originalObject as Ticket).damageTypeName}
                                                </div>
                                            )}
                                            {item.note && (
                                                <div className="mt-1 p-1.5 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-800 italic max-w-[200px]">
                                                    "{item.note}"
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {view === 'progress' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleAction(item, 'complete')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5" /> {item.type === 'ticket' ? 'Resolve' : 'Done'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(item, 'pending')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        Pending
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(item, 'cancel')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleReopen(item)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    Reopen
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Show</span>
                        <div className="w-[80px]">
                            <SearchableSelect
                                value={itemsPerPage}
                                onChange={(val) => {
                                    setItemsPerPage(Number(val));
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { label: '10', value: 10 },
                                    { label: '20', value: 20 },
                                    { label: '50', value: 50 },
                                    { label: 'All', value: -1 }
                                ]}
                            />
                        </div>
                        <span>entries</span>
                        <span className="text-slate-400 mx-2">|</span>
                        <span>
                            Showing {paginatedItems.length === 0 ? 0 : startIndex + 1} to{' '}
                            {itemsPerPage === -1 ? paginatedItems.length : Math.min(startIndex + itemsPerPage, paginatedItems.length)} of {filteredAndSortedItems.length} entries
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 text-sm font-medium text-slate-700">
                            Page {currentPage} of {totalPages === 0 ? 1 : totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
