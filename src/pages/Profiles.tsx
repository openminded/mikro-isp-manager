import { useState, useEffect } from 'react';
import { useServers, type MikrotikServer } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { Search, AlertCircle, CheckCircle2, Pencil, Plus, Save, Layers, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

import { useData } from '@/context/DataContext';
import { type Profile } from '@/types';

import { SearchableSelect } from '@/components/ui/SearchableSelect';

export function Profiles() {
    const { servers } = useServers();
    const { profiles, refreshProfiles } = useData();
    const [syncLoading, setSyncLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [serverFilter, setServerFilter] = useState('all');
    const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

    const handleSync = async () => {
        if (!confirm('This will fetch live data from all routers and update the local cache. Continue?')) return;

        setSyncLoading(true);
        setSyncStatus(null);
        try {
            await Promise.all(servers.map(server => MikrotikApi.syncProfiles(server)));
            setSyncStatus({ type: 'success', message: 'Data synced successfully' });
            refreshProfiles(true);
        } catch (error) {
            console.error(error);
            setSyncStatus({ type: 'error', message: 'Failed to sync data from some routers' });
        } finally {
            setSyncLoading(false);
            setTimeout(() => setSyncStatus(null), 3000);
        }
    };

    const handleEdit = (profile: Profile) => {
        setEditingProfile(profile);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingProfile(null);
        setIsModalOpen(true);
    };

    const handleSave = async (data: any, targetServerId: string) => {
        setSyncLoading(true);
        try {
            const server = servers.find(s => s.id === targetServerId);
            if (!server) throw new Error("Target server not found");

            // Separate Mikrotik data from Extended data
            const { price, ...mikrotikData } = data;

            if (editingProfile) {
                await MikrotikApi.updatePPPProfile(server, editingProfile.id, mikrotikData);
                // Update Extended Data
                if (price !== undefined) {
                    await MikrotikApi.updateProfileExtendedData(server.id, mikrotikData.name, { price });
                }
                setSyncStatus({ type: 'success', message: "Profile updated successfully." });
            } else {
                await MikrotikApi.addPPPProfile(server, mikrotikData);
                // Update Extended Data
                if (price !== undefined) {
                    await MikrotikApi.updateProfileExtendedData(server.id, mikrotikData.name, { price });
                }
                setSyncStatus({ type: 'success', message: "Profile created successfully." });
            }

            setIsModalOpen(false);
            refreshProfiles(true);
        } catch (e: any) {
            setSyncStatus({ type: 'error', message: `Operation failed: ${e.message}` });
        } finally {
            setSyncLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        refreshProfiles(false);
    }, [servers]); // Re-fetch when servers change

    const filteredProfiles = profiles.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(filter.toLowerCase()) ||
            p.serverName.toLowerCase().includes(filter.toLowerCase());

        const matchesServer = serverFilter === 'all' ? true : p.serverId === serverFilter;

        return matchesSearch && matchesServer;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-8 h-8 text-primary" />
                        Message Data Profiles
                    </h1>
                    <p className="text-slate-500">Manage PPP Profiles and pricing across all servers.</p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                        onClick={handleSync}
                        disabled={syncLoading}
                        className={cn(
                            "flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 flex-1 md:flex-none",
                            syncLoading && "animate-pulse"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4", syncLoading && "animate-spin")} />
                        {syncLoading ? 'Syncing...' : 'Sync Data'}
                    </button>
                    <button
                        onClick={handleAdd}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex-1 md:flex-none"
                    >
                        <Plus className="w-4 h-4" />
                        Add Profile
                    </button>
                </div>
            </div>

            {/* Status Bar */}
            {syncStatus && (
                <div className={cn("p-4 rounded-lg flex items-center gap-2 text-sm",
                    syncStatus.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                    {syncStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {syncStatus.message}
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Search profile name or server..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
                <div className="w-[250px]">
                    <SearchableSelect
                        value={serverFilter}
                        onChange={setServerFilter}
                        options={[
                            { label: 'All Servers', value: 'all' },
                            ...servers.map(s => ({ label: s.name, value: s.id }))
                        ]}
                        placeholder="Filter by Server"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 font-medium text-slate-500">Name</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Price (IDR)</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Local Address</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Remote Address</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Rate Limit</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Server</th>
                                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProfiles.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                        No profiles found. Try pulling data.
                                    </td>
                                </tr>
                            ) : (
                                filteredProfiles.map((p) => (
                                    <tr key={`${p.serverId}-${p.id}`} className="hover:bg-slate-50/50 group">
                                        <td className="px-6 py-3 font-medium text-slate-900">{p.name}</td>
                                        <td className="px-6 py-3 font-medium text-emerald-600">
                                            {p.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(p.price) : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 font-mono text-xs">{p["local-address"] || '-'}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono text-xs">{p["remote-address"] || '-'}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono text-xs">{p["rate-limit"] || '-'}</td>
                                        <td className="px-6 py-3 text-slate-500 text-xs">{p.serverName}</td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => handleEdit(p)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingProfile}
                servers={servers}
            />
        </div>
    );
}

function ProfileModal({ isOpen, onClose, onSave, initialData, servers }: { isOpen: boolean; onClose: () => void; onSave: (data: any, serverId: string) => void, initialData?: Profile | null, servers: MikrotikServer[] }) {
    if (!isOpen) return null;

    const [formData, setFormData] = useState({
        name: '',
        "local-address": '',
        "remote-address": '',
        "rate-limit": '',
        "dns-server": '',
        price: '',
        serverId: servers[0]?.id || ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                "local-address": initialData["local-address"] || '',
                "remote-address": initialData["remote-address"] || '',
                "rate-limit": initialData["rate-limit"] || '',
                "dns-server": initialData["dns-server"] || '',
                price: initialData.price ? String(initialData.price) : '',
                serverId: initialData.serverId
            });
        } else {
            setFormData({
                name: '',
                "local-address": '',
                "remote-address": '',
                "rate-limit": '',
                "dns-server": '',
                price: '',
                serverId: servers[0]?.id || ''
            });
        }
    }, [initialData, isOpen, servers]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name: formData.name,
            "local-address": formData["local-address"] || undefined,
            "remote-address": formData["remote-address"] || undefined,
            "rate-limit": formData["rate-limit"],
            "dns-server": formData["dns-server"] || undefined,
            price: formData.price ? Number(formData.price) : undefined
        }, formData.serverId);
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{initialData ? 'Edit Profile' : 'Add New Profile'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Server (Router)</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                            value={formData.serverId}
                            onChange={e => setFormData({ ...formData, serverId: e.target.value })}
                            disabled={!!initialData} // Lock server when editing
                        >
                            {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Profile Name</label>
                        <input required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Price (IDR)</label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                            placeholder="e.g. 150000"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Local Address</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData["local-address"]} onChange={e => setFormData({ ...formData, "local-address": e.target.value })} placeholder="Gateway IP" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Remote Address</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData["remote-address"]} onChange={e => setFormData({ ...formData, "remote-address": e.target.value })} placeholder="Pool Name / IP" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Rate Limit</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData["rate-limit"]} onChange={e => setFormData({ ...formData, "rate-limit": e.target.value })} placeholder="tx/rx (e.g. 5M/5M)" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">DNS Server</label>
                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData["dns-server"]} onChange={e => setFormData({ ...formData, "dns-server": e.target.value })} placeholder="8.8.8.8" />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                        <button type="submit" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">
                            <Save className="w-4 h-4" />
                            {initialData ? 'Save Changes' : 'Create Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
