import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { RefreshCw, Server as ServerIcon, User, ArrowRight, History, AlertCircle, Search } from 'lucide-react';
import { cn } from "@/lib/utils";

interface PppSecret {
    '.id': string;
    name: string;
    profile: string;
    comment?: string;
    disabled: string;
    'remote-address'?: string;
}

interface OnuLog {
    id: string;
    old_username: string;
    new_username: string;
    old_comment: string;
    user_name: string;
    timestamp: string;
    Server?: {
        name: string;
    };
}

export function ChangeOnu() {
    const { user } = useAuth();
    const [servers, setServers] = useState<any[]>([]);
    const [selectedServer, setSelectedServer] = useState('');
    const [secrets, setSecrets] = useState<PppSecret[]>([]);
    const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
    
    const [oldUsername, setOldUsername] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [logs, setLogs] = useState<OnuLog[]>([]);
    
    const [searchTermOld, setSearchTermOld] = useState('');
    const [searchTermNew, setSearchTermNew] = useState('');

    useEffect(() => {
        fetchServers();
        fetchLogs();
    }, []);

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/servers');
            const data = await res.json();
            if (Array.isArray(data)) setServers(data);
        } catch (e) { console.error(e); }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/mikrotik/onu-logs');
            const data = await res.json();
            if (Array.isArray(data)) setLogs(data);
        } catch (e) { console.error(e); }
    };

    const fetchSecrets = async (serverId: string) => {
        if (!serverId) return;
        setIsLoadingSecrets(true);
        try {
            const res = await fetch(`/api/mikrotik/secrets/${serverId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setSecrets(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingSecrets(false);
        }
    };

    useEffect(() => {
        if (selectedServer) {
            fetchSecrets(selectedServer);
            setOldUsername('');
            setNewUsername('');
        }
    }, [selectedServer]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedServer || !oldUsername || !newUsername) {
            alert('Please fill all fields');
            return;
        }

        if (oldUsername === newUsername) {
            alert('Old and New username cannot be the same');
            return;
        }

        if (!confirm(`Are you sure you want to change ONU from ${oldUsername} to ${newUsername}?`)) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/mikrotik/change-onu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: selectedServer,
                    oldUsername,
                    newUsername,
                    user
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Success: ONU changed successfully');
                setOldUsername('');
                setNewUsername('');
                fetchLogs();
                fetchSecrets(selectedServer); // Refresh secret list
            } else {
                alert('Error: ' + data.error);
            }
        } catch (e: any) {
            alert('Failed to submit: ' + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredSecrets = secrets.filter(s => 
        s.name.toLowerCase().includes(searchTermOld.toLowerCase()) || 
        (s.comment || '').toLowerCase().includes(searchTermOld.toLowerCase())
    );

    const filteredSecretsNew = secrets.filter(s => 
        s.name.toLowerCase().includes(searchTermNew.toLowerCase()) || 
        (s.comment || '').toLowerCase().includes(searchTermNew.toLowerCase())
    );

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin-slow" />
                    Change ONU Device
                </h1>
                <p className="text-slate-500 dark:text-slate-400">Migrate PPP Secret settings from an old device to a new one.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-2 mb-2">
                                    <ServerIcon className="w-4 h-4" />
                                    Select Mikrotik Server
                                </div>
                                <select 
                                    value={selectedServer}
                                    onChange={(e) => setSelectedServer(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    required
                                >
                                    <option value="">-- Choose Server --</option>
                                    {servers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                {/* Old Device */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Old PPP Secret (Source)
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            placeholder="Search source..."
                                            value={searchTermOld}
                                            onChange={(e) => setSearchTermOld(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mb-2"
                                        />
                                    </div>
                                    <div className="h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 bg-slate-50/50 dark:bg-slate-950/50">
                                        {isLoadingSecrets ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">Loading secrets...</div>
                                        ) : !selectedServer ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic text-center px-4">Select a server first</div>
                                        ) : filteredSecrets.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No matching secrets</div>
                                        ) : (
                                            filteredSecrets.map(s => (
                                                <div 
                                                    key={s['.id']}
                                                    onClick={() => setOldUsername(s.name)}
                                                    className={cn(
                                                        "p-3 rounded-lg cursor-pointer transition-all border",
                                                        oldUsername === s.name 
                                                            ? "bg-primary/10 border-primary text-primary" 
                                                            : "bg-white dark:bg-slate-900 border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                                                    )}
                                                >
                                                    <div className="text-sm font-bold truncate">{s.name}</div>
                                                    <div className="flex justify-between items-center text-[10px] opacity-60">
                                                        <span className="truncate">{s.comment || 'No comment'}</span>
                                                        {s['remote-address'] && <span className="font-bold text-blue-600 dark:text-blue-400">{s['remote-address']}</span>}
                                                    </div>
                                                    <div className="text-[10px] mt-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md inline-block">{s.profile}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* New Device */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        New PPP Secret (Destination)
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input 
                                            type="text"
                                            placeholder="Search replacement..."
                                            value={searchTermNew}
                                            onChange={(e) => setSearchTermNew(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg mb-2"
                                        />
                                    </div>
                                    <div className="h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1 bg-slate-50/50 dark:bg-slate-950/50">
                                        {isLoadingSecrets ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">Loading secrets...</div>
                                        ) : !selectedServer ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic text-center px-4">Select a server first</div>
                                        ) : filteredSecretsNew.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No matching secrets</div>
                                        ) : (
                                            filteredSecretsNew.map(s => (
                                                <div 
                                                    key={s['.id']}
                                                    onClick={() => setNewUsername(s.name)}
                                                    className={cn(
                                                        "p-3 rounded-lg cursor-pointer transition-all border",
                                                        newUsername === s.name 
                                                            ? "bg-green-500/10 border-green-500 text-green-600" 
                                                            : "bg-white dark:bg-slate-900 border-transparent hover:border-slate-300 dark:hover:border-slate-600"
                                                    )}
                                                >
                                                    <div className="text-sm font-bold truncate">{s.name}</div>
                                                    <div className="flex justify-between items-center text-[10px] opacity-60">
                                                        <span className="truncate">{s.comment || 'No comment'}</span>
                                                        {s['remote-address'] && <span className="font-bold text-green-600 dark:text-green-400">{s['remote-address']}</span>}
                                                    </div>
                                                    <div className="text-[10px] mt-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md inline-block">{s.profile}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Visualization */}
                        {(oldUsername || newUsername) && (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 flex items-center justify-center gap-8 border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Source</span>
                                    <div className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border font-medium text-sm">
                                        {oldUsername || '???'}
                                    </div>
                                </div>
                                <ArrowRight className="w-6 h-6 text-slate-400" />
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Target</span>
                                    <div className="px-4 py-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border font-medium text-sm border-green-200 dark:border-green-900">
                                        {newUsername || '???'}
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !oldUsername || !newUsername}
                            className="w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : <RefreshCw className="w-5 h-5" />}
                            {isSubmitting ? 'Processing Change...' : 'Apply ONU Change'}
                        </button>
                    </form>
                </div>

                {/* Rules Section */}
                <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
                        <h3 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2 mb-4 text-sm">
                            <AlertCircle className="w-4 h-4" /> Migration Rules
                        </h3>
                        <ul className="space-y-3 text-xs text-blue-800 dark:text-blue-300">
                            <li className="flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                                <span><b>Target Device:</b> Will receive Old Device's <b>Profile</b> and <b>Comment</b>.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                                <span><b>Source Device:</b> Profile set to <b>"BELUM AKTIF"</b>. Comment reset to its own username.</span>
                            </li>
                            <li className="flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                                <span><b>History:</b> Every change is logged with timestamp and user account.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-sm">
                            <History className="w-4 h-4" /> Recent Changes
                        </h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {logs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs italic">No logs available</div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 relative group">
                                        <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                                            <span>{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                                            <span className="font-medium text-primary uppercase">{log.Server?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                            <span className="truncate max-w-[80px]">{log.old_username}</span>
                                            <ArrowRight className="w-3 h-3 text-slate-400" />
                                            <span className="truncate max-w-[80px] text-green-600">{log.new_username}</span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-1">
                                            <User className="w-2.5 h-2.5" /> {log.user_name}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
