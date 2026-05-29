import { useState, useEffect } from 'react';
import { MonitorOff, Server as ServerIcon, Search, RefreshCw, Clock, Activity, SearchX, User } from 'lucide-react';
import { cn } from "@/lib/utils";

interface OfflineUser {
    id: string;
    name: string;
    realName: string;
    profile: string;
    comment: string;
    lastLoggedOut: string;
    lastLoggedOutDate: string;
    offlineDurationMs: number;
    offlineDurationStr: string;
}

export function OfflineOnu() {
    const [servers, setServers] = useState<any[]>([]);
    const [selectedServer, setSelectedServer] = useState('');
    const [users, setUsers] = useState<OfflineUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [durationFilter, setDurationFilter] = useState('all'); // 'all', '24h', '48h', '72h'

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/servers');
            const data = await res.json();
            if (Array.isArray(data)) setServers(data);
        } catch (e) { console.error(e); }
    };

    const fetchOfflineUsers = async (serverId: string) => {
        if (!serverId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/mikrotik/offline-onu?serverId=${serverId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        if (!selectedServer) return;
        setIsSyncing(true);
        try {
            const server = servers.find(s => s.id === selectedServer);
            if (!server) return;
            // Sync active ppp and secrets
            await fetch('/api/mikrotik/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ server, resource: 'active_ppp' })
            });
            await fetch('/api/mikrotik/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ server, resource: 'secrets' })
            });
            // Fetch updated offline users
            await fetchOfflineUsers(selectedServer);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSyncing(false);
        }
    };

    useEffect(() => {
        if (selectedServer) {
            fetchOfflineUsers(selectedServer);
        } else {
            setUsers([]);
        }
    }, [selectedServer]);

    const filteredUsers = users.filter(u => {
        // Search Filter
        const matchesSearch = 
            u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (u.realName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (u.comment || '').toLowerCase().includes(searchQuery.toLowerCase());
            
        // Duration Filter
        let matchesDuration = true;
        const ONE_HOUR = 3600 * 1000;
        if (durationFilter === '24h') matchesDuration = u.offlineDurationMs <= 24 * ONE_HOUR;
        else if (durationFilter === '48h') matchesDuration = u.offlineDurationMs <= 48 * ONE_HOUR;
        else if (durationFilter === '72h') matchesDuration = u.offlineDurationMs <= 72 * ONE_HOUR;

        return matchesSearch && matchesDuration;
    });

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <MonitorOff className="w-8 h-8 text-red-500" />
                    Offline ONU Monitoring
                </h1>
                <p className="text-slate-500 dark:text-slate-400 max-w-3xl">
                    Monitor users whose ONU has been turned off by the user. This data excludes users whose PPPoE secret is disabled and users who have been disconnected for more than 3 days.
                </p>
            </div>

            {/* Controls Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="md:col-span-4 lg:col-span-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 pl-1 flex items-center gap-1.5">
                        <ServerIcon className="w-3.5 h-3.5" />
                        Select Server
                    </label>
                    <select 
                        value={selectedServer}
                        onChange={(e) => setSelectedServer(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-medium text-sm"
                    >
                        <option value="">-- Choose Server --</option>
                        {servers.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                        ))}
                    </select>
                </div>
                
                <div className="md:col-span-4 lg:col-span-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 pl-1 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Max Offline Duration
                    </label>
                    <select 
                        value={durationFilter}
                        onChange={(e) => setDurationFilter(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-medium text-sm"
                    >
                        <option value="all">Up to 3 Days (72 Hours)</option>
                        <option value="48h">Up to 2 Days (48 Hours)</option>
                        <option value="24h">Up to 1 Day (24 Hours)</option>
                    </select>
                </div>

                <div className="md:col-span-4 lg:col-span-4">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 pl-1 flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5" />
                        Search
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search by name, comment..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-medium text-sm"
                        />
                    </div>
                </div>

                <div className="md:col-span-12 lg:col-span-2 flex items-end">
                    <button
                        onClick={handleSync}
                        disabled={!selectedServer || isSyncing || isLoading}
                        className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
                    >
                        <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                        {isSyncing ? 'Syncing...' : 'Live Sync'}
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {!selectedServer ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <ServerIcon className="w-16 h-16 mb-4 opacity-20" />
                        <p className="font-semibold text-lg">Select a server to monitor</p>
                        <p className="text-sm">Choose a mikrotik server from the dropdown above to view offline ONUs.</p>
                    </div>
                ) : isLoading && users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <RefreshCw className="w-10 h-10 mb-4 animate-spin opacity-50 text-red-500" />
                        <p className="font-semibold text-lg text-slate-600">Analyzing Network Data...</p>
                        <p className="text-sm">Calculating offline durations from router data</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Activity className="w-16 h-16 mb-4 opacity-20 text-green-500" />
                        <p className="font-semibold text-lg text-slate-600">All Clear!</p>
                        <p className="text-sm">No recently offline ONUs found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Customer Info</th>
                                    <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Service Profile</th>
                                    <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Last Disconnected</th>
                                    <th className="py-4 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Offline Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 shrink-0">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                        {user.comment || user.realName || user.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                        {user.name}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                {user.profile}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                                {user.lastLoggedOut}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                Mikrotik Time
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                                                <Clock className="w-4 h-4" />
                                                <span className="text-sm font-bold">{user.offlineDurationStr}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                {/* Footer Count */}
                {users.length > 0 && selectedServer && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-medium text-slate-500">
                        <span>Showing {filteredUsers.length} of {users.length} offline ONUs</span>
                        {filteredUsers.length === 0 && searchQuery && (
                            <div className="flex items-center gap-1 text-amber-500">
                                <SearchX className="w-4 h-4" /> No results match your search
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
