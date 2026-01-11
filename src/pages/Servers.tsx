import { useState, useEffect } from 'react';
import { useServers, type MikrotikServer } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { Plus, Server as ServerIcon, Trash2, Activity, Cpu, HardDrive, Pencil, DollarSign, Wallet, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to check if last logout was in the current month
const isActiveThisMonth = (lastLogout: string | undefined) => {
    if (!lastLogout) return false;
    const date = new Date(lastLogout);
    if (isNaN(date.getTime())) return false; // Invalid date

    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};


export function Servers() {
    const { servers, removeServer, addServer, editServer } = useServers();
    const [modalOpen, setModalOpen] = useState(false);

    const [editingServer, setEditingServer] = useState<MikrotikServer | undefined>(undefined);
    const [priceData, setPriceData] = useState<Record<string, any>>({});
    const [reloadTrigger, setReloadTrigger] = useState(0); // For Reload All

    // Fetch Price Data once

    useEffect(() => {
        const fetchPrices = async () => {
            const data = await MikrotikApi.getProfileExtendedData();
            setPriceData(data);
        };
        fetchPrices();
    }, []);

    const handleEdit = (server: MikrotikServer) => {
        setEditingServer(server);
        setModalOpen(true);
    };

    const handleAddStart = () => {
        setEditingServer(undefined);
        setModalOpen(true);
    };

    const handleSave = (data: any) => {
        if (editingServer) {
            editServer(editingServer.id, data);
        } else {
            addServer(data);
        }
        setModalOpen(false);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Servers & Revenue</h1>
                    <p className="text-slate-500 mt-1">Manage devices and monitor estimated revenue based on active profiles.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setReloadTrigger(prev => prev + 1)}
                        className="flex items-center gap-2 bg-white text-slate-600 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Reload All
                    </button>
                    <button
                        onClick={handleAddStart}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm shadow-blue-500/20"
                    >
                        <Plus className="w-5 h-5" />
                        Add Server
                    </button>
                </div>
            </div>

            <RevenueOverviewWidget servers={servers} priceData={priceData} reloadTrigger={reloadTrigger} />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {servers.map((server) => (
                    <ServerCard
                        key={server.id}
                        server={server}
                        priceData={priceData}
                        onRemove={() => removeServer(server.id)}
                        onEdit={() => handleEdit(server)}
                        reloadTrigger={reloadTrigger}
                    />
                ))}
                {servers.length === 0 && (
                    <div className="col-span-full border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-slate-400">
                        <ServerIcon className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-medium">No servers configured</p>
                        <p className="text-sm">Click "Add Server" to get started</p>
                    </div>
                )}
            </div>

            <ServerModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
                initialData={editingServer}
            />
        </div>
    );
}


// Helper to display currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
};

function RevenueOverviewWidget({ servers, priceData, reloadTrigger }: { servers: MikrotikServer[], priceData: Record<string, any>, reloadTrigger: number }) {
    const [metrics, setMetrics] = useState({
        activeRevenue: 0,
        blockedPotential: 0,
        totalPotential: 0,
        networkTotal: 0
    });
    // Removed unused lastUpdated state

    useEffect(() => {
        const fetchMetrics = async () => {
            if (servers.length === 0) {
                setMetrics({ activeRevenue: 0, blockedPotential: 0, totalPotential: 0, networkTotal: 0 });
                return;
            }

            // We need secrets to know the profile of each user
            const secretPromises = servers.map(server => MikrotikApi.getPPPSecrets(server).catch(() => []));
            const secretResults = await Promise.all(secretPromises);

            console.log('Price Data loaded:', priceData);
            console.log('Secrets fetched:', secretResults);

            let activeRev = 0;
            let blockedPot = 0;
            let netTotal = 0;

            secretResults.forEach((secrets, index) => {
                const server = servers[index];
                if (!server) return;

                secrets.forEach((s: any) => {
                    const isDisabled = s.disabled === 'true' || s.disabled === true;
                    // Look up price
                    const key = `${server.id}_${s.profile}`;
                    const price = priceData[key]?.price ? Number(priceData[key].price) : 0;

                    // Log failed lookups for active users to see mismatch
                    if (price === 0 && !isDisabled) {
                        console.log(`Missing price for key: ${key}. Available keys:`, Object.keys(priceData));
                    }

                    if (isDisabled) {
                        blockedPot += price;
                    } else if (isActiveThisMonth(s['last-logged-out'])) {
                        // Only count as Active Revenue if they have activity this month
                        activeRev += price;
                    }
                    netTotal++; // Client count
                });
            });

            setMetrics({
                activeRevenue: activeRev,
                blockedPotential: blockedPot,
                totalPotential: activeRev + blockedPot,
                networkTotal: netTotal
            });
        };

        fetchMetrics();
        // Removed setInterval to prevent auto-refresh active revenue load
    }, [servers, priceData, reloadTrigger]); // Re-run if prices change or reload triggered

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
                icon={DollarSign}
                iconColor="text-emerald-600"
                bgColor="bg-emerald-50"
                label="Monthly Revenue (Est.)"
                value={formatCurrency(metrics.activeRevenue)}
                subtext="From active customers"
            />
            <MetricCard
                icon={Wallet}
                iconColor="text-amber-600"
                bgColor="bg-amber-50"
                label="Unpaid / Blocked Potential"
                value={formatCurrency(metrics.blockedPotential)}
                subtext="Lost revenue from blocked users"
            />
            <MetricCard
                icon={Activity}
                iconColor="text-blue-600"
                bgColor="bg-blue-50"
                label="Total Potential Revenue"
                value={formatCurrency(metrics.totalPotential)}
                subtext={`Total Opportunity from ${metrics.networkTotal} clients`}
            />
        </div>
    );
}

function MetricCard({ icon: Icon, iconColor, bgColor, label, value, subtext }: any) {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-lg", bgColor, iconColor)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-500">{label}</h3>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                        {value}
                    </p>
                </div>
            </div>
            {subtext && <div className="text-xs text-slate-400 text-right max-w-[120px]">{subtext}</div>}
        </div>
    );
}

function ServerCard({ server, priceData, onRemove, onEdit, reloadTrigger }: { server: MikrotikServer; priceData: Record<string, any>; onRemove: () => void; onEdit: () => void, reloadTrigger: number }) {
    const { updateServerStatus } = useServers();
    const [isReloading, setIsReloading] = useState(false);
    const [stats, setStats] = useState<any>({
        cpu: '-',
        uptimeRaw: '-',
        memory: { total: 0, free: 0, used: 0, percent: 0 },
        clients: { active: 0, blocked: 0, total: 0 },
        revenue: { active: 0, blocked: 0, total: 0 }
    });

    const fetchStats = async () => {
        try {
            const sys = await MikrotikApi.getSystemResource(server);
            const activeCount = await MikrotikApi.getActivePPP(server);
            const secrets = await MikrotikApi.getPPPSecrets(server);

            let blockedCount = 0;
            let activeRev = 0;
            let blockedPot = 0;

            secrets.forEach((s: any) => {
                const isDisabled = s.disabled === 'true' || s.disabled === true;
                const key = `${server.id}_${s.profile}`;
                const price = priceData[key]?.price ? Number(priceData[key].price) : 0;

                if (isDisabled) {
                    blockedCount++;
                    blockedPot += price;
                } else if (isActiveThisMonth(s['last-logged-out'])) {
                    activeRev += price;
                } else {
                    // Debug: Log why user was skipped for revenue
                    if (server.name === 'Pandan Wangi' && Math.random() < 0.01) {
                        console.log(`[${server.name}] User ${s.name} skipped. Disabled: ${isDisabled}, LastLogout: ${s['last-logged-out']}, Price: ${price}`);
                    }
                }
            });

            if (server.name === 'Pandan Wangi') {
                console.log(`[${server.name}] Stats Calc: ActiveRev=${activeRev}, Blocked=${blockedCount}, Secrets=${secrets.length}, PriceDataKeys=${Object.keys(priceData).length}`);
            }

            updateServerStatus(server.id, true);

            // Calculate Memory
            const totalMem = Number(sys["total-memory"]);
            const freeMem = Number(sys["free-memory"]);
            const usedMem = totalMem - freeMem;
            const usedMemPercent = totalMem > 0 ? ((usedMem / totalMem) * 100).toFixed(1) : 0;

            setStats({
                cpu: sys['cpu-load'] + '%',
                uptimeRaw: sys.uptime,
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: usedMem,
                    percent: usedMemPercent
                },
                clients: {
                    active: activeCount,
                    blocked: blockedCount,
                    total: activeCount + blockedCount
                },
                revenue: {
                    active: activeRev,
                    blocked: blockedPot,
                    total: activeRev + blockedPot
                }
            });
        } catch (e) {
            console.error("Failed to fetch stats", e);
            updateServerStatus(server.id, false);
            setStats((prev: any) => ({ ...prev, cpu: '-', uptimeRaw: '-' }));
            throw e;
        }
    };

    // Trigger reload when reloadTrigger changes (global reload)
    useEffect(() => {
        handleReload();
    }, [reloadTrigger]);


    const handleReload = async () => {
        setIsReloading(true);
        try {
            await fetchStats();
        } catch (e: any) {
            // Already handled in fetchStats
        } finally {
            setIsReloading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchStats().catch(() => { });
        // Removed setInterval for auto-refresh
    }, [server.id, priceData]);



    // Initial load handled above.


    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-shadow">
            <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full transition-all", server.isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-slate-300")} />
                    <div>
                        <h3 className="font-semibold text-slate-900">{server.name}</h3>
                        <p className="text-xs text-slate-500 font-mono">{server.ip}:{server.port}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                    <button
                        onClick={handleReload}
                        className={cn("p-2 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50 transition-colors", isReloading && "animate-spin text-primary")}
                        title="Reload Data"
                        disabled={isReloading}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={onEdit} className="text-slate-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg" title="Edit Server">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={onRemove} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg" title="Remove Server">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="p-5 space-y-6">

                {/* Revenue Stats */}
                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5" /> Est. Revenue
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                            <div className="text-slate-500 text-xs mb-1">Monthly</div>
                            <div className="text-emerald-700 font-bold">{server.isOnline ? formatCurrency(stats.revenue.active) : '-'}</div>
                        </div>
                        <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                            <div className="text-slate-500 text-xs mb-1">Unpaid/Blocked</div>
                            <div className="text-red-700 font-bold">{server.isOnline ? formatCurrency(stats.revenue.blocked) : '-'}</div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-xs px-1">
                        <span className="text-slate-400">Total Potential</span>
                        <span className="font-medium text-slate-600">{server.isOnline ? formatCurrency(stats.revenue.total) : '-'}</span>
                    </div>
                </div>

                <div className="h-px bg-slate-100" />

                <div className="grid grid-cols-2 gap-6">
                    {/* CPU */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wider">
                            <Cpu className="w-3.5 h-3.5" />
                            CPU
                        </div>
                        <span className="text-xl font-semibold text-slate-700">{server.isOnline ? stats.cpu : '-'}</span>
                    </div>

                    {/* Memory */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wider">
                            <HardDrive className="w-3.5 h-3.5" />
                            Memory
                        </div>
                        <div>
                            <span className="text-xl font-semibold text-slate-700">
                                {server.isOnline ? `${stats.memory.percent}%` : '-'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Client Stats Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                    <div className="text-slate-500 mb-1">Active Users</div>
                    <div className="font-bold text-blue-600 text-lg">{server.isOnline ? stats.clients.active : '-'}</div>
                </div>
                <div>
                    <div className="text-slate-500 mb-1">Blocked</div>
                    <div className="font-bold text-red-600 text-lg">{server.isOnline ? stats.clients.blocked : '-'}</div>
                </div>
                <div>
                    <div className="text-slate-500 mb-1">Total</div>
                    <div className="font-bold text-emerald-600 text-lg">{server.isOnline ? stats.clients.total : '-'}</div>
                </div>
            </div>
        </div>
    );
}

function ServerModal({ isOpen, onClose, onSave, initialData }: { isOpen: boolean; onClose: () => void; onSave: (data: any) => void, initialData?: MikrotikServer }) {
    if (!isOpen) return null;

    const [formData, setFormData] = useState({ name: '', ip: '', port: 8728, username: '', password: '' });

    // Load initial data for editing
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                ip: initialData.ip,
                port: initialData.port,
                username: initialData.username,
                password: initialData.password || '' // Note: Password might not be secure to populate like this in real apps, but for local storage app it is fine
            });
        } else {
            setFormData({ name: '', ip: '', port: 8728, username: '', password: '' });
        }
    }, [initialData, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{initialData ? 'Edit Server' : 'Add New Server'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Server Name</label>
                        <input required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Main Router" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                            <label className="text-sm font-medium text-slate-700">IP Address</label>
                            <input required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData.ip} onChange={e => setFormData({ ...formData, ip: e.target.value })} placeholder="192.168.88.1" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">API Port</label>
                            <div className="space-y-1">
                                <input required type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                    value={formData.port} onChange={e => setFormData({ ...formData, port: Number(e.target.value) })} placeholder="8728" />
                                <p className="text-[10px] text-slate-400">Default: 8728 (Binary API)</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Username</label>
                            <input required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Password</label>
                            <input type="password" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">{initialData ? 'Save Changes' : 'Add Server'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
