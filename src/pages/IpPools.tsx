import { useState, useEffect } from 'react';
import { useServers } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { DownloadCloud, Search, AlertCircle, CheckCircle2, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IpPool {
    id: string;
    name: string;
    ranges: string;
    "next-pool"?: string;
    serverName: string;
    serverId: string;
}

export function IpPools() {
    const { servers } = useServers();
    const [pools, setPools] = useState<IpPool[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [serverFilter, setServerFilter] = useState<string>('all');

    const handlePull = async () => {
        setLoading(true);
        setSyncStatus(null);
        const newPools: IpPool[] = [];

        try {
            if (servers.length === 0) {
                setSyncStatus({ type: 'error', message: "No servers available." });
                return;
            }

            await Promise.all(servers.map(async (server) => {
                if (!server.isOnline) return;
                try {
                    const data = await MikrotikApi.getIPPools(server);
                    data.forEach((p: any) => {
                        newPools.push({
                            id: p['.id'],
                            name: p.name,
                            ranges: p.ranges,
                            "next-pool": p['next-pool'],
                            serverName: server.name,
                            serverId: server.id
                        });
                    });
                } catch (e) {
                    console.error(`Failed to pull pools from ${server.name}`, e);
                }
            }));

            setPools(newPools);
            setSyncStatus({ type: 'success', message: `Pulled ${newPools.length} pools from ${servers.length} servers.` });
        } catch (e) {
            setSyncStatus({ type: 'error', message: "Failed to pull data." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handlePull();
    }, []);

    const filteredPools = pools.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(filter.toLowerCase()) ||
            p.ranges.includes(filter);
        const matchesServer = serverFilter === 'all' ? true : p.serverId === serverFilter;
        return matchesSearch && matchesServer;
    });

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">IP Pools</h1>
                    <p className="text-slate-500">Manage IP Address Pools across your network</p>
                </div>
                <button onClick={handlePull} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                    <DownloadCloud className={cn("w-4 h-4", loading && "animate-bounce")} />
                    Pull All
                </button>
            </div>

            {syncStatus && (
                <div className={cn("p-4 rounded-lg flex items-center gap-2 text-sm",
                    syncStatus.type === 'success' ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                    {syncStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {syncStatus.message}
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Search pool name or range..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-slate-700 min-w-[200px]"
                    value={serverFilter}
                    onChange={(e) => setServerFilter(e.target.value)}
                >
                    <option value="all">All Servers</option>
                    {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-3 font-medium text-slate-500">Pool Name</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Ranges</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Next Pool</th>
                            <th className="px-6 py-3 font-medium text-slate-500">Server</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredPools.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                    No IP Pools found.
                                </td>
                            </tr>
                        ) : (
                            filteredPools.map((pool) => (
                                <tr key={`${pool.serverId}-${pool.id}`} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-3 font-medium text-slate-900 flex items-center gap-2">
                                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded">
                                            <Network className="w-4 h-4" />
                                        </div>
                                        {pool.name}
                                    </td>
                                    <td className="px-6 py-3 font-mono text-xs text-slate-600">{pool.ranges}</td>
                                    <td className="px-6 py-3 text-slate-500">{pool["next-pool"] || '-'}</td>
                                    <td className="px-6 py-3 text-slate-500 text-xs">{pool.serverName}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
