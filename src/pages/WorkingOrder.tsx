import { useState, useEffect } from 'react';
import { CheckCircle, MapPin, Smartphone, User, Calendar, Wrench, Search, XCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

interface Registration {
    id: string;
    phoneNumber: string;
    fullName: string;
    address: string;
    locationId: string;
    status: 'queue' | 'installation_process' | 'done' | 'cancel';
    installation?: {
        technician: string;
        companion: string;
        date: string;
        finishDate?: string;
    };
    workingOrderStatus?: 'pending' | 'done';
    workingOrderNote?: string;
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

interface StatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (note: string) => void;
    title: string;
    actionType: 'pending' | 'cancel';
}

function StatusModal({ isOpen, onClose, onSubmit, title, actionType }: StatusModalProps) {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (isOpen) setNote('');
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 transform transition-all">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm mb-4">
                    Please provide a reason or note for this action.
                </p>
                <textarea
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px] bg-slate-50"
                    placeholder="Enter note here..."
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
                        className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${actionType === 'cancel'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-amber-500 hover:bg-amber-600'
                            }`}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

interface CompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (secretId: string) => void;
    serverName: string;
    fetchingSecrets: boolean;
    secrets: PppSecret[];
}

function CompletionModal({ isOpen, onClose, onConfirm, serverName, fetchingSecrets, secrets }: CompletionModalProps) {
    const [selectedSecretId, setSelectedSecretId] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        const secret = secrets.find(s => s['.id'] === selectedSecretId);
        if (secret) {
            onConfirm(secret['.id']);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 transform transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-slate-900">Complete Working Order</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                    <span className="font-semibold">Target Server:</span> {serverName}
                </div>

                <p className="text-slate-500 text-sm mb-4">
                    Please select the PPPoE account (username) created for this customer.
                    The comment will be automatically updated to: <br />
                    <code className="bg-slate-100 px-1 py-0.5 rounded text-xs mt-1 block w-fit">
                        [Server] - [Customer Name] - [Date]
                    </code>
                </p>

                {fetchingSecrets ? (
                    <div className="flex items-center justify-center p-8 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Fetching secrets from router...
                    </div>
                ) : (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select PPPoE Account</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none bg-white"
                            value={selectedSecretId}
                            onChange={(e) => setSelectedSecretId(e.target.value)}
                        >
                            <option value="">Select an account...</option>
                            {secrets.map((secret) => (
                                <option key={secret['.id']} value={secret['.id']}>
                                    {secret.name} {secret.comment ? `(${secret.comment})` : ''}
                                </option>
                            ))}
                        </select>
                        {secrets.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">No PPPoE secrets found on this server.</p>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedSecretId}
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
    const [orders, setOrders] = useState<Registration[]>([]);
    const [servers, setServers] = useState<Server[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    // const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all'); // Removed in favor of view prop
    const [sortConfig, setSortConfig] = useState<{ key: keyof Registration | 'date', direction: 'asc' | 'desc' } | null>(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
    const [modalAction, setModalAction] = useState<'pending' | 'cancel'>('pending');

    // Completion Modal State
    const [completionModalOpen, setCompletionModalOpen] = useState(false);
    const [completingOrder, setCompletingOrder] = useState<Registration | null>(null);
    const [fetchingSecrets, setFetchingSecrets] = useState(false);
    const [routerSecrets, setRouterSecrets] = useState<PppSecret[]>([]);


    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);

    useEffect(() => {
        fetchOrders();
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/servers');
            setServers(res.data);
        } catch (error) {
            console.error("Failed to fetch servers", error);
        }
    };

    const fetchOrders = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/registrations');
            // Filter only those in installation process or done, relevant for working orders
            const relevant = res.data.filter((r: Registration) =>
                r.status === 'installation_process' || (r.status === 'done' && r.workingOrderStatus === 'done')
            );
            setOrders(relevant);
        } catch (error) {
            console.error("Failed to fetch working orders", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteClick = async (order: Registration) => {
        setCompletingOrder(order);
        setCompletionModalOpen(true);
        setFetchingSecrets(true);
        setRouterSecrets([]);

        // Find server
        const server = servers.find(s => s.name === order.locationId);
        if (!server) {
            alert('Server not found for this order location.');
            setFetchingSecrets(false);
            return;
        }

        try {
            // Fetch secrets
            const response = await axios.post('http://localhost:3001/api/proxy', {
                host: server.ip,
                user: server.username,
                password: server.password,
                port: server.port,
                command: '/ppp/secret/print'
            });

            if (Array.isArray(response.data)) {
                setRouterSecrets(response.data);
            } else {
                console.error("Unexpected response from router:", response.data);
                alert("Failed to fetch secrets: Unexpected response format.");
            }
        } catch (error: any) {
            console.error("Failed to fetch secrets", error);
            alert(`Failed to connect to router: ${error.response?.data?.error || error.message}`);
        } finally {
            setFetchingSecrets(false);
        }
    };

    const handleCompletionConfirm = async (secretId: string) => {
        if (!completingOrder) return;

        const server = servers.find(s => s.name === completingOrder.locationId);
        if (!server) return;

        try {
            // 1. Update Mikrotik Comment
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const newComment = `${server.name} - ${completingOrder.fullName} - ${dateStr}`;

            await axios.post('http://localhost:3001/api/proxy', {
                host: server.ip,
                user: server.username,
                password: server.password,
                port: server.port,
                command: [
                    '/ppp/secret/set',
                    `=.id=${secretId}`,
                    `=comment=${newComment}`
                ]
            });

            // 2. Update Registration Status
            const installation = completingOrder.installation || {};
            await axios.put(`http://localhost:3001/api/registrations/${completingOrder.id}`, {
                workingOrderStatus: 'done',
                status: 'done',
                installation: {
                    ...installation,
                    finishDate: new Date().toISOString()
                }
            });

            setCompletionModalOpen(false);
            setCompletingOrder(null);
            fetchOrders();
            alert(`Order completed! Secret updated with comment: ${newComment}`);

        } catch (error: any) {
            console.error("Failed to complete order", error);
            alert(`Failed to update router or database: ${error.response?.data?.error || error.message}`);
        }
    };


    const openActionModal = (id: string, action: 'pending' | 'cancel') => {
        setSelectedOrder(id);
        setModalAction(action);
        setModalOpen(true);
    };

    const handleModalSubmit = async (note: string) => {
        if (!selectedOrder) return;

        try {
            const updates: any = { workingOrderNote: note };

            if (modalAction === 'pending') {
                updates.workingOrderStatus = 'pending';
                updates.status = 'installation_process'; // Ensure it stays active
            } else if (modalAction === 'cancel') {
                updates.status = 'cancel'; // Remove from active working orders
                // workingOrderStatus doesn't strictly matter if main status is cancel, but let's keep it consistent
                updates.workingOrderStatus = 'done'; // Effectively closes the ticket? Or maybe just leave as is.
            }

            await axios.put(`http://localhost:3001/api/registrations/${selectedOrder}`, updates);
            setModalOpen(false);
            fetchOrders();
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleReopen = async (id: string) => {
        if (!confirm('Reopen this ticket?')) return;
        try {
            await axios.put(`http://localhost:3001/api/registrations/${id}`, {
                workingOrderStatus: 'pending',
                status: 'installation_process'
            });
            fetchOrders();
        } catch (error) {
            alert('Failed to reopen');
        }
    };

    // Filter & Sort Logic
    // ... [Same logic as before]
    const filteredAndSortedOrders = orders
        .filter(order => {
            const matchesSearch = order.fullName.toLowerCase().includes(filter.toLowerCase()) ||
                order.phoneNumber.includes(filter) ||
                (order.installation?.technician || '').toLowerCase().includes(filter.toLowerCase()) ||
                (order.locationId || '').toLowerCase().includes(filter.toLowerCase());

            const matchesStatus = view === 'completed'
                ? order.workingOrderStatus === 'done'
                : order.workingOrderStatus !== 'done';

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            if (!sortConfig) {
                if (a.workingOrderStatus === 'pending' && b.workingOrderStatus !== 'pending') return -1;
                if (a.workingOrderStatus !== 'pending' && b.workingOrderStatus === 'pending') return 1;
                return 0;
            }

            const { key, direction } = sortConfig;
            let aValue: any = key === 'date' ? a.installation?.date : a[key as keyof Registration];
            let bValue: any = key === 'date' ? b.installation?.date : b[key as keyof Registration];

            if (!aValue) aValue = '';
            if (!bValue) bValue = '';

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key: keyof Registration | 'date') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Pagination Logic
    const totalPages = itemsPerPage === -1
        ? 1
        : Math.ceil(filteredAndSortedOrders.length / itemsPerPage);

    const startIndex = (currentPage - 1) * (itemsPerPage === -1 ? filteredAndSortedOrders.length : itemsPerPage);
    const paginatedOrders = itemsPerPage === -1
        ? filteredAndSortedOrders
        : filteredAndSortedOrders.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [filter, view, itemsPerPage]);

    return (
        <div className="p-8 space-y-6">
            <StatusModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSubmit={handleModalSubmit}
                title={modalAction === 'pending' ? 'Set as Pending' : 'Cancel Order'}
                actionType={modalAction}
            />

            <CompletionModal
                isOpen={completionModalOpen}
                onClose={() => { setCompletionModalOpen(false); setCompletingOrder(null); }}
                onConfirm={handleCompletionConfirm}
                serverName={completingOrder?.locationId || ''}
                fetchingSecrets={fetchingSecrets}
                secrets={routerSecrets}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {view === 'progress' ? 'Working Orders In Progress' : 'Completed Working Orders'}
                    </h1>
                    <p className="text-slate-500">
                        {view === 'progress' ? 'Track active technician installation tasks' : 'View history of completed installations'}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Search customer, phone, technician, or server..."
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
                                <th className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>Status</th>
                                <th className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('fullName')}>Customer</th>
                                <th className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('locationId')}>Server (Loc)</th>
                                <th className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('address')}>Address</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Installation Info</th>
                                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : paginatedOrders.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No working orders found</td></tr>
                            ) : paginatedOrders.map((order) => (
                                <tr key={order.id} className="hover:bg-slate-50/50 group transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${order.workingOrderStatus === 'done'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : order.workingOrderNote ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {order.workingOrderStatus === 'done' ? 'Completed' : 'Pending'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{order.fullName}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Smartphone className="w-3 h-3" /> {order.phoneNumber}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700 font-medium">{order.locationId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-start gap-2 max-w-[200px]">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                            <span className="text-slate-600 truncate" title={order.address}>{order.address}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <Wrench className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="font-medium">Tech:</span> {order.installation?.technician}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="font-medium">Partner:</span> {order.installation?.companion || '-'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {order.installation?.date ? new Date(order.installation.date).toLocaleString([], { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </div>
                                            {order.workingOrderNote && (
                                                <div className="mt-1 p-1.5 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-800 italic">
                                                    "{order.workingOrderNote}"
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {order.workingOrderStatus !== 'done' ? (
                                                <>
                                                    <button
                                                        onClick={() => handleCompleteClick(order)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                                                        title="Complete Order"
                                                    >
                                                        <CheckCircle className="w-3.5 h-3.5" /> Done
                                                    </button>
                                                    <button
                                                        onClick={() => openActionModal(order.id, 'pending')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors"
                                                        title="Set as Pending (Add Note)"
                                                    >
                                                        Pending
                                                    </button>
                                                    <button
                                                        onClick={() => openActionModal(order.id, 'cancel')}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
                                                        title="Cancel Order"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleReopen(order.id)}
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
                        <select
                            className="bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={-1}>All</option>
                        </select>
                        <span>entries</span>
                        <span className="text-slate-400 mx-2">|</span>
                        <span>
                            Showing {filteredAndSortedOrders.length === 0 ? 0 : startIndex + 1} to{' '}
                            {itemsPerPage === -1 ? filteredAndSortedOrders.length : Math.min(startIndex + itemsPerPage, filteredAndSortedOrders.length)} of {filteredAndSortedOrders.length} entries
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

