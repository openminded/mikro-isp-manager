import { useState, useEffect } from 'react';
import { useServers, type MikrotikServer } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { DownloadCloud, Search, AlertCircle, CheckCircle2, Pencil, Plus, Save, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
    id: string; // Mikrotik ID (*1)
    name: string;
    "local-address"?: string;
    "remote-address"?: string;
    "rate-limit"?: string;
    "dns-server"?: string;
    serverName: string;
    serverId: string;
    price?: number; // Extended data
}

const DEFAULT_PRICES: Record<string, number> = {
    "PPPoE Keluarga Bulanan": 135000,
    "PPPoE Keluarga Sultan": 250000,
    "PPPoE Keluarga Dekat": 100000,
    "PPPoE Keluarga Hemat": 100000
};

export function Profiles() {
    const { servers } = useServers();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

    const handlePull = async () => {
        setLoading(true);
        setSyncStatus(null);
        const newProfiles: Profile[] = [];

        try {
            if (servers.length === 0) {
                setSyncStatus({ type: 'error', message: "No servers available to pull from." });
                return;
            }

            // Fetch extended data
            const extendedData = await MikrotikApi.getProfileExtendedData();

            await Promise.all(servers.map(async (server) => {
                if (!server.isOnline) return;
                try {
                    const data = await MikrotikApi.getPPPProfiles(server);

                    // Process each profile
                    for (const p of data) {
                        const key = `${server.id}_${p.name}`;
                        let price = extendedData[key]?.price;

                        // Seeding Logic: If no price exists but we have a default for this name
                        if (price === undefined && DEFAULT_PRICES[p.name]) {
                            price = DEFAULT_PRICES[p.name];
                            // Auto-save the seeded price
                            MikrotikApi.updateProfileExtendedData(server.id, p.name, { price }).catch(console.error);
                        }

                        newProfiles.push({
                            id: p['.id'],
                            name: p.name,
                            "local-address": p['local-address'],
                            "remote-address": p['remote-address'],
                            "rate-limit": p['rate-limit'],
                            "dns-server": p['dns-server'],
                            serverName: server.name,
                            serverId: server.id,
                            price: price ? Number(price) : undefined
                        });
                    }
                } catch (e) {
                    console.error(`Failed to pull profiles from ${server.name}`, e);
                }
            }));

            setProfiles(newProfiles);
            setSyncStatus({ type: 'success', message: `Pulled ${newProfiles.length} profiles from ${servers.length} servers.` });
        } catch (e) {
            setSyncStatus({ type: 'error', message: "Failed to pull data." });
        } finally {
            setLoading(false);
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
        setLoading(true);
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
            handlePull();
        } catch (e: any) {
            setSyncStatus({ type: 'error', message: `Operation failed: ${e.message}` });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handlePull();
    }, []);

    const filteredProfiles = profiles.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.serverName.toLowerCase().includes(filter.toLowerCase())
    );

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
                <div className="flex gap-2">
                    <button onClick={handlePull} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                        <DownloadCloud className={cn("w-4 h-4", loading && "animate-bounce")} />
                        Pull All
                    </button>
                    <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm">
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
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Search profile name or server..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
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
