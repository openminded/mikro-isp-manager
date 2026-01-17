import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Clock, Shield, Info, Monitor } from 'lucide-react';

interface LogEntry {
    id: string;
    timestamp: string;
    level: 'info' | 'warning' | 'error';
    username: string;
    role: string;
    action: string;
    details: string;
    ip: string;
}

export function ActivityLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('all');

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await axios.get('/api/logs');
                if (Array.isArray(res.data)) {
                    setLogs(res.data);
                } else {
                    console.error("Invalid log format received", res.data);
                    setLogs([]);
                }
            } catch (error) {
                console.error("Failed to fetch logs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.username.toLowerCase().includes(search.toLowerCase()) ||
            log.details.toLowerCase().includes(search.toLowerCase()) ||
            log.action.toLowerCase().includes(search.toLowerCase());

        const matchesAction = filterAction === 'all' || log.action === filterAction;

        return matchesSearch && matchesAction;
    });

    const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort();

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Activity Logs</h1>
                <p className="text-slate-500">Monitor system activities and user actions</p>
            </div>

            <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    value={filterAction}
                    onChange={e => setFilterAction(e.target.value)}
                >
                    <option value="all">All Actions</option>
                    {uniqueActions.map(action => (
                        <option key={action} value={action}>{action}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 font-medium text-slate-500">Time</th>
                                <th className="px-6 py-3 font-medium text-slate-500">User</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Action</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Details</th>
                                <th className="px-6 py-3 font-medium text-slate-500">IP Addr</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading logs...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No logs found</td></tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                {new Date(log.timestamp).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-slate-900">{log.username}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <Shield className="w-3 h-3" /> {log.role}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${log.action === 'LOGIN' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                log.action.includes('CREATE') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    log.action.includes('DELETE') ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="text-slate-600 flex items-start gap-2">
                                                <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                                {log.details}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-mono text-xs text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <Monitor className="w-3 h-3" /> {log.ip || '-'}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
