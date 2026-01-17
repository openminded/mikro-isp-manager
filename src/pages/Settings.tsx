import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun, Laptop, Download, Upload, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useState } from "react";

export function Settings() {
    const { theme, setTheme } = useTheme();
    const [backupProgress, setBackupProgress] = useState<number | null>(null);
    const [restoreProgress, setRestoreProgress] = useState<number | null>(null);

    const handleBackup = async () => {
        setBackupProgress(0);
        try {
            const response = await axios.get('/api/backup', {
                responseType: 'blob',
                onDownloadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 0));
                    setBackupProgress(percentCompleted);
                },
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `backup-${dateStr}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setBackupProgress(null);
        } catch (error) {
            console.error(error);
            alert('Backup Download Failed');
            setBackupProgress(null);
        }
    };

    const handleReset = async () => {
        if (!confirm('DANGER AREA: This will delete all APP DATA (Invoices, Registrations, Tickets) but will KEEP database connections and Mikrotik configurations. Are you absolute sure?')) return;

        try {
            await axios.post('/api/reset');
            alert('System reset successful. Page will reload.');
            window.location.reload();
        } catch (error) {
            alert('Reset failed');
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Settings</h1>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Appearance</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Customize how TelajuApp looks on your device</p>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Theme Preference</label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => setTheme("light")}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                                    theme === "light"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400"
                                )}
                            >
                                <Sun className="w-5 h-5" />
                                <span className="font-medium">Light</span>
                            </button>

                            <button
                                onClick={() => setTheme("dark")}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                                    theme === "dark"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400"
                                )}
                            >
                                <Moon className="w-5 h-5" />
                                <span className="font-medium">Dark</span>
                            </button>

                            <button
                                onClick={() => setTheme("system")}
                                className={cn(
                                    "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                                    theme === "system"
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400"
                                )}
                            >
                                <Laptop className="w-5 h-5" />
                                <span className="font-medium">System</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Management Section */}
            <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Data Management</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Backup and restore your system data</p>
                </div>
                <div className="p-6">
                    <div className="space-y-6">
                        {/* Backup */}
                        <div className="flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                        <Download className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900 dark:text-white">Backup Data</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Download a full backup of your system data and uploads.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBackup}
                                    disabled={backupProgress !== null}
                                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    {backupProgress !== null ? `${backupProgress}%` : 'Download Backup'}
                                </button>
                            </div>
                            {backupProgress !== null && (
                                <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700 mt-2">
                                    <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${backupProgress}%` }}></div>
                                </div>
                            )}
                        </div>

                        {/* Restore */}
                        <div className="flex flex-col gap-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-900/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-slate-900 dark:text-white">Restore Data</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Restore system data from a backup file. <span className="font-bold text-amber-600">Warning: Existing data will be overwritten.</span></p>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".zip"
                                        disabled={restoreProgress !== null}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            if (!confirm('WARNING: restoring data will OVERWRITE all current data. Do you want to continue?')) {
                                                e.target.value = '';
                                                return;
                                            }

                                            const formData = new FormData();
                                            formData.append('backup', file);

                                            setRestoreProgress(0);
                                            try {
                                                await axios.post('/api/restore', formData, {
                                                    headers: { 'Content-Type': 'multipart/form-data' },
                                                    onUploadProgress: (progressEvent) => {
                                                        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 0));
                                                        setRestoreProgress(percentCompleted);
                                                    }
                                                });
                                                alert('Restore successful! The page will now reload.');
                                                window.location.reload();
                                            } catch (error: any) {
                                                alert('Restore failed: ' + (error.response?.data?.error || error.message));
                                                e.target.value = '';
                                                setRestoreProgress(null);
                                            }
                                        }}
                                    />
                                    <button
                                        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={cn("w-4 h-4", restoreProgress !== null && "animate-spin")} />
                                        {restoreProgress !== null ? `Restoring ${restoreProgress}%` : 'Restore Backup'}
                                    </button>
                                </div>
                            </div>
                            {restoreProgress !== null && (
                                <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700 mt-2">
                                    <div className="bg-amber-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${restoreProgress}%` }}></div>
                                </div>
                            )}
                        </div>

                        {/* Reset Data */}
                        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900/50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-slate-900 dark:text-white">Clear App Data</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Reset registrations and invoices. <span className="font-bold text-red-600">Keeps Mikrotik Configs.</span></p>
                                </div>
                            </div>
                            <button
                                onClick={handleReset}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Reset Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
