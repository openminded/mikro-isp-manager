import { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Clock, Shield, Info, Monitor, Settings as SettingsIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';

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

interface LoggingConfig {
    [key: string]: boolean;
}

const LOG_CATEGORIES = [
    {
        name: 'Auth',
        actions: ['LOGIN', 'CREATE_USER', 'UPDATE_USER']
    },
    {
        name: 'Billing',
        actions: ['BULK_DELETE_INVOICES', 'BULK_UPDATE_INVOICES', 'PAY_INVOICE', 'GENERATE_INVOICES', 'CHECK_OVERDUE']
    },
    {
        name: 'Customer',
        actions: ['UPDATE_CUSTOMER_META', 'LINK_CUSTOMER', 'UPDATE_CUSTOMER']
    },
    {
        name: 'Network',
        actions: ['CREATE_NODE', 'UPDATE_NODE', 'DELETE_NODE']
    },
    {
        name: 'Registration',
        actions: ['CREATE_REGISTRATION', 'UPDATE_REGISTRATION', 'DELETE_REGISTRATION', 'COMPLETE_INSTALLATION']
    },
    {
        name: 'Server',
        actions: ['CREATE_SERVER', 'UPDATE_SERVER', 'DELETE_SERVER']
    },
    {
        name: 'System',
        actions: ['RESTORE_DATA', 'RESET_DATA']
    }
];

export function ActivityLogs() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [showSettings, setShowSettings] = useState(false);
    const [config, setConfig] = useState<LoggingConfig>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchLogs();
        fetchConfig();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/logs');
            if (Array.isArray(res.data)) {
                setLogs(res.data);
            } else {
                setLogs([]);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await axios.get('/api/logs/config');
            setConfig(res.data);
        } catch (error) {
            console.error("Failed to fetch config", error);
        }
    };

    const handleSaveConfig = async () => {
        try {
            setSaving(true);
            await axios.post('/api/logs/config', config);
            setShowSettings(false);
        } catch (error) {
            alert('Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const toggleAction = (action: string) => {
        setConfig(prev => ({
            ...prev,
            [action]: prev[action] === false ? true : false
        }));
    };

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
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Activity Logs</h1>
                    <p className="text-slate-500">Monitor system activities and user actions</p>
                </div>
                <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 font-medium transition-colors"
                >
                    <SettingsIcon className="w-4 h-4" />
                    Configure Logs
                </button>
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
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-slate-700"
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

            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Logging Configuration</h2>
                                <p className="text-sm text-slate-500">Enable or disable logging for specific system services</p>
                            </div>
                            <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                                <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                                <p>Disabled log types will no longer create entries in the activity log. This helps focus on critical actions and reduces server storage noise.</p>
                            </div>

                            {LOG_CATEGORIES.map(category => (
                                <div key={category.name} className="space-y-3">
                                    <h3 className="font-semibold text-slate-900 flex items-center gap-2 px-1">
                                        <div className="w-1.5 h-4 bg-primary rounded-full"></div>
                                        {category.name}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {category.actions.map(action => (
                                            <button
                                                key={action}
                                                onClick={() => toggleAction(action)}
                                                className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                                                    config[action] === false 
                                                    ? 'bg-slate-50 border-slate-200 text-slate-400 line-through grayscale' 
                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-primary/50 hover:bg-primary/5'
                                                }`}
                                            >
                                                <span>{action}</span>
                                                {config[action] === false ? 
                                                    <AlertCircle className="w-4 h-4 text-slate-300" /> : 
                                                    <CheckCircle2 className="w-4 h-4 text-primary" />
                                                }
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                disabled={saving}
                                className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
