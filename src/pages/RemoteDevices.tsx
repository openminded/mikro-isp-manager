
import { useState, useEffect } from 'react';
import { useServers } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { 
    Search, RefreshCw, Edit2, Trash2, 
    Monitor, Globe, Server as ServerIcon, 
    CheckCircle2, AlertCircle, X,
    ChevronRight, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface NatRule {
    id: string;
    comment: string;
    dst_port: string;
    to_address: string;
    to_ports: string;
    protocol: string;
    last_check_status?: string;
}

export function RemoteDevices() {
    const { user } = useAuth();
    const { servers } = useServers();
    
    const isSuperAdmin = user?.role === 'superadmin';
    const isAdmin = user?.role === 'admin';
    const canSync = isSuperAdmin || isAdmin;
    const canEdit = isSuperAdmin || isAdmin;
    const canDelete = isSuperAdmin;
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const [rules, setRules] = useState<NatRule[]>([]);
    const [loading, setLoading] = useState(false);
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<NatRule | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        comment: '',
        dstPort: '',
        toAddress: '',
        toPorts: '80',
        protocol: 'tcp'
    });

    useEffect(() => {
        if (servers.length > 0 && !selectedServerId) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers]);

    useEffect(() => {
        if (selectedServerId) {
            fetchRules();
        }
    }, [selectedServerId]);

    const fetchRules = async () => {
        if (!selectedServerId) return;
        setLoading(true);
        try {
            const data = await MikrotikApi.getNatRules(selectedServerId);
            setRules(data);
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to fetch NAT rules from database' });
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        if (!selectedServerId) return;
        setLoading(true);
        setStatus(null);
        try {
            const res = await MikrotikApi.syncNatRules(selectedServerId);
            setStatus({ type: 'success', message: `Successfully synced ${res.count} remote from Mikrotik` });
            fetchRules();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Sync failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = async (id: string) => {
        setCheckingId(id);
        try {
            const res = await fetch(`/api/mikrotik/nat/check?serverId=${selectedServerId}&id=${id}`);
            const data = await res.json();
            
            setRules(prev => prev.map(r => r.id === id ? { ...r, last_check_status: data.status } : r));
            
            if (data.status === 'offline') {
                setStatus({ type: 'error', message: 'NAT rule not found on Mikrotik!' });
            }
        } catch (e) {
            setStatus({ type: 'error', message: 'Connection check failed' });
        } finally {
            setCheckingId(null);
            setTimeout(() => setStatus(null), 3000);
        }
    };

    const handleOpenEdit = (rule: NatRule) => {
        setEditingRule(rule);
        setFormData({
            comment: rule.comment || '',
            dstPort: rule.dst_port || '',
            toAddress: rule.to_address || '',
            toPorts: rule.to_ports || '80',
            protocol: rule.protocol || 'tcp'
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRule) return;
        setLoading(true);
        setStatus(null);
        try {
            await MikrotikApi.updateNatRule({
                serverId: selectedServerId,
                id: editingRule.id,
                dstPort: formData.dstPort,
                toAddress: formData.toAddress,
                toPorts: formData.toPorts
            });
            setStatus({ type: 'success', message: 'Remote updated and synced to Mikrotik' });
            setIsModalOpen(false);
            fetchRules();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Update failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure? This will remove the rule from DB and Mikrotik.')) return;
        setLoading(true);
        try {
            await MikrotikApi.deleteNatRule(selectedServerId, id);
            setStatus({ type: 'success', message: 'Remote removed' });
            fetchRules();
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Delete failed' });
        } finally {
            setLoading(false);
        }
    };

    const filteredRules = rules.filter(r => 
        (r.comment?.toLowerCase() || '').includes(filter.toLowerCase()) ||
        (r.to_address || '').includes(filter) ||
        (r.dst_port || '').includes(filter)
    );

    const selectedServer = servers.find(s => s.id === selectedServerId);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                        <Monitor className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Remote</h1>
                        <p className="text-slate-500 text-sm">Auto-sync Mikrotik NAT containing "remote"</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {canSync && (
                        <button
                            onClick={handleSync}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium shadow-lg shadow-primary/20 transition-all w-full md:w-auto"
                        >
                            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
                            Sync from Mikrotik
                        </button>
                    )}
                </div>
            </div>

            {/* Status Messages */}
            {status && (
                <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300",
                    status.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="flex-1 font-medium">{status.message}</span>
                    <button onClick={() => setStatus(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
                </div>
            )}

            {/* Controls Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 relative group">
                    <ServerIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <select
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary text-slate-700 dark:text-slate-300 appearance-none shadow-sm transition-all"
                        value={selectedServerId}
                        onChange={(e) => setSelectedServerId(e.target.value)}
                    >
                        {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>)}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                </div>

                <div className="md:col-span-2 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary text-slate-700 dark:text-slate-300 shadow-sm transition-all placeholder:text-slate-400"
                        placeholder="Search by name, IP, or port..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 font-medium text-slate-500">Device Name / Comment</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Connection</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Target Internal</th>
                                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading && rules.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Loading data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRules.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        No remote accounts found. Click Sync to fetch from Mikrotik.
                                    </td>
                                </tr>
                            ) : (
                                filteredRules.map((rule) => (
                                    <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="relative p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded">
                                                    <Globe className="w-4 h-4" />
                                                    {rule.last_check_status && (
                                                        <div className={cn(
                                                            "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-950",
                                                            rule.last_check_status === 'online' ? "bg-emerald-500" : "bg-red-500"
                                                        )} />
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-900 dark:text-slate-200">{rule.comment}</span>
                                                    <button 
                                                        onClick={() => handleCheckStatus(rule.id)}
                                                        disabled={checkingId === rule.id}
                                                        className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                                                    >
                                                        <RefreshCw className={cn("w-2.5 h-2.5", checkingId === rule.id && "animate-spin")} />
                                                        Refresh Status
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                                    <span className="text-[10px] px-1 bg-slate-100 dark:bg-slate-800 rounded font-bold">{rule.protocol}</span>
                                                    <span className="font-mono">Port {rule.dst_port}</span>
                                                </div>
                                                <a 
                                                    href={`http://${selectedServer?.ip}:${rule.dst_port}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                                                >
                                                    {selectedServer?.ip}:{rule.dst_port}
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-mono text-slate-700 dark:text-slate-300">{rule.to_address}</span>
                                                <span className="text-[10px] text-slate-400">Target Port: {rule.to_ports}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleOpenEdit(rule)}
                                                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDelete(rule.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Dialog */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {editingRule ? 'Edit Remote' : 'Add New Remote'}
                                </h3>
                                <p className="text-xs text-slate-500">{selectedServer?.name}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Device Name / Comment (Identify on Mikrotik)</label>
                                <input
                                    required
                                    disabled={!!editingRule}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary dark:text-white transition-all disabled:opacity-60"
                                    placeholder="Enter exact comment from Mikrotik NAT"
                                    value={formData.comment}
                                    onChange={e => setFormData({ ...formData, comment: e.target.value })}
                                />
                                {!editingRule && (
                                    <p className="text-[10px] text-slate-400 ml-1 italic">* This will pull current settings from Mikrotik automatically.</p>
                                )}
                            </div>

                            {editingRule && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Public Port</label>
                                            <input
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary dark:text-white font-mono transition-all"
                                                placeholder="e.g., 2117"
                                                value={formData.dstPort}
                                                onChange={e => setFormData({ ...formData, dstPort: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Local Port</label>
                                            <input
                                                required
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary dark:text-white font-mono transition-all"
                                                placeholder="e.g., 80"
                                                value={formData.toPorts}
                                                onChange={e => setFormData({ ...formData, toPorts: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Target Internal IP</label>
                                        <input
                                            required
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary dark:text-white font-mono transition-all"
                                            placeholder="e.g., 192.168.1.100"
                                            value={formData.toAddress}
                                            onChange={e => setFormData({ ...formData, toAddress: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-[2] px-4 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : editingRule ? 'Update Mikrotik' : 'Import from Mikrotik'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
