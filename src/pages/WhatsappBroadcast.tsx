
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useData } from '@/context/DataContext';
import { useServers } from '@/context/ServerContext'; // To access server names logic
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Search, MessageSquare, Send, Users, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";

export function WhatsappBroadcast() {
    const { customers, profiles, refreshCustomers, refreshProfiles, loadingCustomers } = useData();
    const { servers } = useServers();

    useEffect(() => {
        refreshProfiles();
    }, []);

    // Filters (replicated from Customers.tsx)
    const [filter, setFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [serverFilter, setServerFilter] = useState<string>('all');
    const [profileFilter, setProfileFilter] = useState<string>('all');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Broadcast State
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

    // Logs State
    const [logs, setLogs] = useState<any[]>([]);

    const fetchLogs = async () => {
        try {
            const res = await axios.get('/api/whatsapp/logs');
            setLogs(res.data);
        } catch (e) { console.error("Failed to fetch logs", e); }
    };

    const clearLogs = async () => {
        if (!confirm('Clear all broadcast history?')) return;
        try {
            await axios.delete('/api/whatsapp/logs');
            setLogs([]);
        } catch (e) { alert('Failed to clear logs'); }
    };

    // Load templates
    useEffect(() => {
        axios.get('/api/whatsapp/templates')
            .then(res => setTemplates(res.data))
            .catch(console.error);

        // Ensure customers are loaded
        refreshCustomers(false);
        fetchLogs();

        // Poll logs every 5s if there is an active broadcast
        const interval = setInterval(() => {
            fetchLogs();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Derived Data
    const uniqueProfiles = Array.from(new Set(
        customers
            .filter(c => serverFilter === 'all' || c.serverId === serverFilter)
            .map(c => c.profile)
    )).sort();

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(filter.toLowerCase()) ||
            (c.comment || '').toLowerCase().includes(filter.toLowerCase()) ||
            c.serverName.toLowerCase().includes(filter.toLowerCase());

        const matchesStatus = statusFilter === 'all'
            ? true
            : statusFilter === 'active' ? !c.disabled : c.disabled;

        const matchesServer = serverFilter === 'all' ? true : c.serverId === serverFilter;
        const matchesProfile = profileFilter === 'all' ? true : c.profile === profileFilter;

        // Only include customers with WhatsApp numbers
        const hasWhatsapp = !!c.whatsapp;

        return matchesSearch && matchesStatus && matchesServer && matchesProfile && hasWhatsapp;
        return matchesSearch && matchesStatus && matchesServer && matchesProfile && hasWhatsapp;
    });

    // Selection Handlers
    const isAllSelected = filteredCustomers.length > 0 && filteredCustomers.every(c => selectedIds.has(c.id));
    const isIndeterminate = filteredCustomers.some(c => selectedIds.has(c.id)) && !isAllSelected;

    const handleSelectAll = () => {
        const newSelected = new Set(selectedIds);
        if (isAllSelected) {
            filteredCustomers.forEach(c => newSelected.delete(c.id));
        } else {
            filteredCustomers.forEach(c => newSelected.add(c.id));
        }
        setSelectedIds(newSelected);
    };

    const handleSelectOne = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleTemplateSelect = (id: string) => {
        setSelectedTemplate(id);
        const t = templates.find(temp => temp.id === id);
        if (t) setCustomMessage(t.content);
    };

    const handleBroadcast = async () => {
        // Fix: Only send to selected IDs that are ALSO visible in filter
        const targetCustomers = filteredCustomers.filter(c => selectedIds.has(c.id));

        if (targetCustomers.length === 0) return alert('No customers selected in current view');
        if (!customMessage) return alert('Please enter a message');
        if (!confirm(`Send message to ${targetCustomers.length} selected customers?`)) return;

        setSending(true);
        setProgress({ type: 'info', message: 'Initiating broadcast...' });

        try {
            const targets = targetCustomers.map(c => {
                const profile = profiles.find(p => p.serverId === c.serverId && p.name === c.profile);
                const price = profile?.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(profile.price) : 'N/A';

                return {
                    // Prepend 62 if sticking to ID format, or just ensure it's not empty. 
                    // The Customer Add form shows "62" as static prefix, so stored value is likely without it.
                    // Prepend 62 if sticking to ID format, or just ensure it's not empty. 
                    // The Customer Add form shows "62" as static prefix, so stored value is likely without it.
                    phone: (c.whatsapp || '').startsWith('62') ? (c.whatsapp || '') : `62${(c.whatsapp || '').replace(/^0+/, '')}`,
                    name: c.realName || c.name, // Use Real Name if available, otherwise Username
                    server: c.serverName,
                    profile: c.profile,
                    price: price
                };
            });

            const res = await axios.post('/api/whatsapp/broadcast', {
                targets,
                message: customMessage
            });

            setProgress({ type: 'success', message: res.data.message });
            setCustomMessage('');
            setSelectedTemplate('');
            setSelectedIds(new Set()); // Reset selection after send
            fetchLogs(); // Refresh logs immediately
        } catch (error: any) {
            setProgress({ type: 'error', message: error.response?.data?.error || 'Broadcast failed' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Broadcast Messages</h1>
                    <p className="text-slate-500">Send bulk messages to filtered customers</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Filter & List */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Filters Section */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Search..."
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                />
                            </div>
                            <div className="w-full md:w-[150px]">
                                <SearchableSelect
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={[
                                        { label: 'All Status', value: 'all' },
                                        { label: 'Active', value: 'active' },
                                        { label: 'Blocked', value: 'blocked' }
                                    ]}
                                    placeholder="Status"
                                />
                            </div>
                            <div className="w-full md:w-[200px]">
                                <SearchableSelect
                                    value={serverFilter}
                                    onChange={setServerFilter}
                                    options={[
                                        { label: 'All Servers', value: 'all' },
                                        ...servers.map(s => ({ label: s.name, value: s.id }))
                                    ]}
                                    placeholder="Server"
                                />
                            </div>
                            <div className="w-full md:w-[200px]">
                                <SearchableSelect
                                    value={profileFilter}
                                    onChange={setProfileFilter}
                                    options={[
                                        { label: 'All Profiles', value: 'all' },
                                        ...uniqueProfiles.map(p => ({ label: p, value: p }))
                                    ]}
                                    placeholder="Profile"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-slate-500 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>Recipients:
                                    <strong className="text-slate-900 ml-1">{filteredCustomers.length}</strong> filtered
                                    <span className="text-slate-300 mx-2">|</span>
                                    <strong className="text-primary">{selectedIds.size}</strong> selected
                                </span>
                            </div>
                            {loadingCustomers && <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Loading data...</span>}
                        </div>
                    </div>

                    {/* Preview List (Truncated) */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 w-[50px]">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-primary focus:ring-primary"
                                            checked={isAllSelected}
                                            ref={input => { if (input) input.indeterminate = isIndeterminate; }}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-3 font-medium text-slate-500">Name</th>
                                    <th className="px-6 py-3 font-medium text-slate-500">WhatsApp</th>
                                    <th className="px-6 py-3 font-medium text-slate-500">Profile</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCustomers.slice(0, 100).map(c => (
                                    <tr key={c.id} className={selectedIds.has(c.id) ? "bg-blue-50/50" : ""}>
                                        <td className="px-6 py-3">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-primary focus:ring-primary"
                                                checked={selectedIds.has(c.id)}
                                                onChange={() => handleSelectOne(c.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                                        <td className="px-6 py-3 text-slate-600 font-mono">{c.whatsapp}</td>
                                        <td className="px-6 py-3 text-slate-500">{c.profile}</td>
                                    </tr>
                                ))}
                                {filteredCustomers.length > 100 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-3 text-center text-slate-400 italic">
                                            And {filteredCustomers.length - 100} more...
                                        </td>
                                    </tr>
                                )}
                                {filteredCustomers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                            No recipients found. Check your filters or ensure customers have WhatsApp numbers.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right: Composer */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6 sticky top-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-primary" />
                                Compose Message
                            </h2>
                            <p className="text-sm text-slate-500 mt-1">Select a template or type manually</p>
                            <div className="flex gap-2 flex-wrap mt-2">
                                {['{name}', '{server}', '{profile}', '{price}'].map(v => (
                                    <button
                                        key={v}
                                        onClick={() => { setCustomMessage(prev => prev + ' ' + v); setSelectedTemplate(''); }}
                                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-xs text-blue-600 rounded border border-slate-200 font-mono transition-colors"
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">Use Template</label>
                            <div className="flex flex-wrap gap-2">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTemplateSelect(t.id)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                                            selectedTemplate === t.id
                                                ? "bg-primary text-white border-primary"
                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50"
                                        )}
                                    >
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">Message Content</label>
                            <textarea
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[200px] resize-y text-slate-700 leading-relaxed"
                                placeholder="Type your broadcast message here..."
                                value={customMessage}
                                onChange={e => { setCustomMessage(e.target.value); setSelectedTemplate(''); }}
                            />
                            <div className="text-xs text-slate-400 text-right">
                                {customMessage.length} characters
                            </div>
                        </div>

                        <div className="pt-2">
                            {progress && (
                                <div className={cn(
                                    "mb-4 p-3 rounded-lg text-sm flex items-center gap-2",
                                    progress.type === 'success' ? "bg-emerald-50 text-emerald-800" :
                                        progress.type === 'error' ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"
                                )}>
                                    {progress.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                                        progress.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
                                            <RefreshCw className="w-4 h-4 animate-spin" />}
                                    {progress.message}
                                </div>
                            )}

                            <button
                                onClick={handleBroadcast}
                                disabled={sending || selectedIds.size === 0 || !customMessage}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                            >
                                {sending ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Broadcast Now
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-center text-slate-400 mt-3">
                                Messages are sent with a random delay (2-5s) to prevent spam detection.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Logs Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Broadcast History
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={fetchLogs} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="Refresh">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button onClick={clearLogs} className="text-sm text-red-500 hover:text-red-700 font-medium">Clear History</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 font-medium text-slate-500">Date</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Message</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Recipients</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-slate-400">No broadcast history found.</td>
                                </tr>
                            ) : (
                                logs.map((log: any) => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                                            {new Date(log.date).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 text-slate-900 max-w-[300px] truncate" title={log.messageSnippet}>
                                            {log.messageSnippet}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">
                                            <span className="text-emerald-600 font-medium">{log.success}</span> / {log.total}
                                            {log.failed > 0 && <span className="text-red-500 ml-2">({log.failed} failed)</span>}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium uppercase",
                                                log.status === 'completed' ? "bg-emerald-50 text-emerald-700" :
                                                    log.status === 'sending' ? "bg-blue-50 text-blue-700 animate-pulse" :
                                                        "bg-slate-100 text-slate-600"
                                            )}>
                                                {log.status === 'sending' ? 'Sending...' : log.status}
                                            </span>
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
