
import { useState, useEffect } from 'react';
import { useServers } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { Search, RefreshCw, CheckCircle2, AlertCircle, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';


// The original IpPool interface is now imported from '@/types'
// interface IpPool {
//     id: string;
//     name: string;
//     ranges: string;
//     "next-pool"?: string;
//     serverName: string;
//     serverId: string;
// }

export function IpPools() {
    const { servers } = useServers();
    const { pools, refreshPools } = useData();
    // const [pools, setPools] = useState<IpPool[]>([]); // Removed, now from DataContext
    const [syncLoading, setSyncLoading] = useState(false); // This state is for the manual sync button
    const [filter, setFilter] = useState('');
    const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [serverFilter, setServerFilter] = useState<string>('all');



    const handleSync = async () => {
        if (!confirm('This will fetch live data from all routers and update the local cache. Continue?')) return;

        setSyncLoading(true);
        setSyncStatus(null);
        try {
            await Promise.all(servers.map(server => MikrotikApi.syncPools(server)));
            setSyncStatus({ type: 'success', message: 'Data synced successfully' });
            refreshPools(true); // Use refreshPools from DataContext
        } catch (error) {
            console.error(error);
            setSyncStatus({ type: 'error', message: 'Failed to sync data from some routers' });
        } finally {
            setSyncLoading(false);
            setTimeout(() => setSyncStatus(null), 3000);
        }
    };

    useEffect(() => {
        refreshPools(false);
    }, [servers]);

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
                <button
                    onClick={handleSync}
                    disabled={syncLoading}
                    className={cn(
                        "flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 w-full md:w-auto",
                        syncLoading && "animate-pulse"
                    )}
                >
                    <RefreshCw className={cn("w-4 h-4", syncLoading && "animate-spin")} />
                    {syncLoading ? 'Syncing...' : 'Sync Data'}
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
                                <tr key={`${pool.serverId} -${pool.id} `} className="hover:bg-slate-50/50">
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
