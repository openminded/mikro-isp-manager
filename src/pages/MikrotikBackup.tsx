import { useState, useEffect, useRef } from 'react';
import { useServers } from '@/context/ServerContext';
import { useAuth } from '@/context/AuthContext';
import {
    HardDrive, RefreshCw, Download, Upload, Plus, Server as ServerIcon,
    CheckCircle2, AlertCircle, X, ChevronRight, FileArchive, Clock, Database, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackupFile {
    name: string;
    size: string;
    type: string;
    'creation-time': string;
}

export function MikrotikBackup() {
    const { servers } = useServers();
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'superadmin';
    const isAdmin = user?.role === 'admin';
    const canWrite = isSuperAdmin || isAdmin;

    const [selectedServerId, setSelectedServerId] = useState('');
    const [files, setFiles] = useState<BackupFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
    const [restoringFile, setRestoringFile] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [backupName, setBackupName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (servers.length > 0 && !selectedServerId) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers]);

    useEffect(() => {
        if (selectedServerId) fetchFiles();
    }, [selectedServerId]);

    const showStatus = (type: 'success' | 'error', message: string) => {
        setStatus({ type, message });
        setTimeout(() => setStatus(null), 6000);
    };

    const fetchFiles = async () => {
        if (!selectedServerId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/mikrotik/backup/files?serverId=${selectedServerId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch files');
            setFiles(Array.isArray(data) ? data : []);
        } catch (e: any) {
            showStatus('error', e.message);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBackupNow = async () => {
        if (!selectedServerId) return;
        setBackingUp(true);
        try {
            const res = await fetch('/api/mikrotik/backup/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: selectedServerId, backupName: backupName || undefined })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Backup failed');
            showStatus('success', data.message || `Backup created: ${data.fileName}`);
            setBackupName('');
            setShowNameInput(false);
            setTimeout(() => fetchFiles(), 2000);
        } catch (e: any) {
            showStatus('error', e.message);
        } finally {
            setBackingUp(false);
        }
    };

    const handleDownload = async (fileName: string) => {
        setDownloadingFile(fileName);
        try {
            const res = await fetch(`/api/mikrotik/backup/download?serverId=${selectedServerId}&fileName=${encodeURIComponent(fileName)}`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Download failed');
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            showStatus('success', `Downloaded: ${fileName}`);
        } catch (e: any) {
            showStatus('error', e.message);
        } finally {
            setDownloadingFile(null);
        }
    };

    const handleRestoreLocal = async (file: File) => {
        if (!file.name.endsWith('.backup')) {
            showStatus('error', 'Only .backup files are supported');
            return;
        }
        if (!confirm(`⚠️ Restore backup "${file.name}" to selected server?\n\nThe router will REBOOT after restore. Are you sure?`)) return;

        setRestoringFile(file.name);
        try {
            const formData = new FormData();
            formData.append('serverId', selectedServerId);
            formData.append('backupFile', file);

            const res = await fetch('/api/mikrotik/backup/restore', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Restore failed');
            showStatus('success', data.message);
        } catch (e: any) {
            showStatus('error', e.message);
        } finally {
            setRestoringFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRestoreFromMikrotik = async (fileName: string) => {
        if (!confirm(`⚠️ Restore "${fileName}" on Mikrotik?\n\nThe router will REBOOT. Are you sure?`)) return;
        setRestoringFile(fileName);
        try {
            // Download first, then re-upload and restore
            const res = await fetch(`/api/mikrotik/backup/download?serverId=${selectedServerId}&fileName=${encodeURIComponent(fileName)}`);
            if (!res.ok) throw new Error('Download for restore failed');
            const blob = await res.blob();
            const file = new File([blob], fileName);

            const formData = new FormData();
            formData.append('serverId', selectedServerId);
            formData.append('backupFile', file);

            const restoreRes = await fetch('/api/mikrotik/backup/restore', { method: 'POST', body: formData });
            const data = await restoreRes.json();
            if (!restoreRes.ok) throw new Error(data.error || 'Restore failed');
            showStatus('success', data.message);
        } catch (e: any) {
            showStatus('error', e.message);
        } finally {
            setRestoringFile(null);
        }
    };

    const handleDeleteFile = async (fileName: string) => {
        if (!confirm(`⚠️ Delete backup file "${fileName}" from Mikrotik?\n\nThis cannot be undone. Are you sure?`)) return;
        try {
            const res = await fetch('/api/mikrotik/backup/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId: selectedServerId, fileName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete file');
            showStatus('success', data.message || `Deleted: ${fileName}`);
            fetchFiles();
        } catch (e: any) {
            showStatus('error', e.message);
        }
    };

    const formatSize = (size: string) => {
        const bytes = parseInt(size) || 0;
        if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${bytes} B`;
    };

    const selectedServer = servers.find(s => s.id === selectedServerId);

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl">
                        <Database className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mikrotik Backup</h1>
                        <p className="text-slate-500 text-sm">Manage backup & restore for each Mikrotik server</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button onClick={fetchFiles} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Refresh
                    </button>
                    {canWrite && (
                        <button onClick={() => setShowNameInput(!showNameInput)} disabled={backingUp}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all">
                            <Plus className="w-4 h-4" />
                            Backup Now
                        </button>
                    )}
                    {canWrite && (
                        <>
                            <input ref={fileInputRef} type="file" accept=".backup" className="hidden"
                                onChange={e => e.target.files?.[0] && handleRestoreLocal(e.target.files[0])} />
                            <button onClick={() => fileInputRef.current?.click()} disabled={!!restoringFile}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium shadow-lg shadow-amber-500/20 transition-all">
                                <Upload className="w-4 h-4" />
                                Restore Now
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Backup Name Input */}
            {showNameInput && (
                <div className="flex gap-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <input
                        type="text"
                        placeholder="Custom backup name (optional)..."
                        value={backupName}
                        onChange={e => setBackupName(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                    />
                    <button onClick={handleBackupNow} disabled={backingUp}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-60 hover:bg-indigo-700 transition-all">
                        {backingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
                        {backingUp ? 'Creating...' : 'Create Backup'}
                    </button>
                    <button onClick={() => setShowNameInput(false)} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-xl">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Status */}
            {status && (
                <div className={cn(
                    "p-4 rounded-2xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2 duration-300",
                    status.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span className="flex-1 font-medium">{status.message}</span>
                    <button onClick={() => setStatus(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
                </div>
            )}

            {/* Server Selector */}
            <div className="relative group max-w-sm">
                <ServerIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <select value={selectedServerId} onChange={e => setSelectedServerId(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-700 dark:text-slate-300 appearance-none shadow-sm transition-all">
                    {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>)}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
            </div>

            {/* Files Table */}
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileArchive className="w-5 h-5 text-indigo-500" />
                        <span className="font-semibold text-slate-800 dark:text-white">
                            Backup Files on {selectedServer?.name || 'Mikrotik'}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
                            {files.length} file{files.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 font-medium text-slate-500">File Name</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Size</th>
                                <th className="px-6 py-3 font-medium text-slate-500">Created</th>
                                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Scanning Mikrotik files...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : files.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <HardDrive className="w-8 h-8 opacity-30" />
                                            <p>No backup files found on this Mikrotik.</p>
                                            <p className="text-xs">Click "Backup Now" to create one.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                files.map((file) => (
                                    <tr key={file.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                                    <FileArchive className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 font-mono text-xs">{file.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">{formatSize(file.size)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                                <Clock className="w-3.5 h-3.5" />
                                                {file['creation-time'] || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleDownload(file.name)}
                                                    disabled={downloadingFile === file.name}
                                                    title="Download backup file"
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-60">
                                                    {downloadingFile === file.name
                                                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                        : <Download className="w-3.5 h-3.5" />}
                                                    Download
                                                </button>
                                                {canWrite && (
                                                    <button
                                                        onClick={() => handleRestoreFromMikrotik(file.name)}
                                                        disabled={!!restoringFile}
                                                        title="Restore this backup on Mikrotik"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-60">
                                                        {restoringFile === file.name
                                                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                            : <Upload className="w-3.5 h-3.5" />}
                                                        Restore
                                                    </button>
                                                )}
                                                {canWrite && (
                                                    <button
                                                        onClick={() => handleDeleteFile(file.name)}
                                                        title="Delete backup file"
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-lg transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Delete
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

            {/* Info Banner */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-500 space-y-1.5">
                <p className="font-semibold text-slate-700 dark:text-slate-300">ℹ️ About Backup & Restore</p>
                <p>• <strong>Backup Now</strong> — Triggers <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">/system/backup/save</code> on Mikrotik and saves to its flash memory.</p>
                <p>• <strong>Download</strong> — Downloads a <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">.backup</code> file from Mikrotik via FTP to your computer.</p>
                <p>• <strong>Restore (from list)</strong> — Loads a backup already on Mikrotik flash. The router will <strong>reboot</strong>.</p>
                <p>• <strong>Restore Now (upload)</strong> — Upload a local <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">.backup</code> file to Mikrotik via FTP then restores it. The router will <strong>reboot</strong>.</p>
            </div>
        </div>
    );
}
