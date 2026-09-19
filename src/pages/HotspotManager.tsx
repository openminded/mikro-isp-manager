import { useState, useEffect, useCallback } from 'react';
import { useServers } from '@/context/ServerContext';
import { useData } from '@/context/DataContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { cn } from '@/lib/utils';
import {
    Wifi, Search, RefreshCw, Plus, Pencil, Trash2, Lock, Unlock,
    Users, Activity, Server, Layers, AlertCircle, CheckCircle2,
    Save, X, LogOut, ChevronLeft, ChevronRight, Eye, EyeOff, SearchX,
    Ticket, RotateCcw, UserCheck, Printer, Download, Copy
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { HotspotVoucherModal } from '@/components/hotspot/HotspotVoucherModal';

type TabKey = 'users' | 'active' | 'profiles' | 'servers' | 'vouchers';

function printCachedVouchers(vouchers: any[]) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cetak Voucher Hotspot Multi-Server</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; background: #fff; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
            .voucher-card { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; page-break-inside: avoid; }
            .header { border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; text-align: center; }
            .header h2 { margin: 0; font-size: 14px; color: #0f172a; text-transform: uppercase; font-weight: 800; }
            .server-name { font-size: 9px; color: #64748b; font-weight: 600; }
            .code-box { background: white; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px; margin: 6px 0; text-align: center; }
            .code-label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .code-val { font-family: 'Courier New', monospace; font-size: 15px; font-weight: bold; color: #0f172a; letter-spacing: 1px; }
            .specs { display: flex; justify-content: space-between; font-size: 9px; color: #475569; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0; }
            @media print { .no-print { display: none; } }
        </style>
    </head>
    <body>
        <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; background: #e2e8f0; padding: 12px; border-radius: 8px;">
            <strong style="font-size: 14px;">Total Voucher: ${vouchers.length} Keping</strong>
            <button onclick="window.print()" style="background: #ea580c; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">Print Sekarang</button>
        </div>
        <div class="grid">
            ${vouchers.map(v => `
                <div class="voucher-card">
                    <div class="header">
                        <h2>VOUCHER HOTSPOT</h2>
                        <div class="server-name">Server: ${v.Server?.name || v.server_id || 'MikroTik'}</div>
                    </div>
                    <div class="code-box">
                        <div class="code-label">Kode Voucher / Username</div>
                        <div class="code-val">${v.voucher_code}</div>
                        ${v.voucher_password ? `<div class="code-label" style="margin-top:4px;">Password</div><div class="code-val" style="font-size:12px;">${v.voucher_password}</div>` : ''}
                    </div>
                    <div class="specs">
                        <span>Paket: <strong>${v.profile_name || 'Standard'}</strong></span>
                        <span>Status: <strong>${(v.status || 'unused').toUpperCase()}</strong></span>
                    </div>
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
}

export function HotspotManager() {
    const { servers } = useServers();
    const { customers } = useData();
    const [selectedServerId, setSelectedServerId] = useState<string>('');
    const selectedServer = servers.find(s => s.id === selectedServerId);
    const [activeTab, setActiveTab] = useState<TabKey>('users');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Data states
    const [hotspotUsers, setHotspotUsers] = useState<any[]>([]);
    const [activeSessions, setActiveSessions] = useState<any[]>([]);
    const [hotspotProfiles, setHotspotProfiles] = useState<any[]>([]);
    const [hotspotServers, setHotspotServers] = useState<any[]>([]);
    
    // Multi-Server Voucher Cache States
    const [allVouchers, setAllVouchers] = useState<any[]>([]);
    const [voucherServerFilter, setVoucherServerFilter] = useState<string>('all');
    const [voucherStatusFilter, setVoucherStatusFilter] = useState<string>('all');
    const [selectedVoucherIds, setSelectedVoucherIds] = useState<Set<string>>(new Set());
    const [isSyncingAllVouchers, setIsSyncingAllVouchers] = useState<boolean>(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Search & Pagination
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(15);

    // Modal User CRUD
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);

    // Modal Voucher Generator
    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
    const [voucherTargetUser, setVoucherTargetUser] = useState<string | null>(null);

    // Bulk Selection State for Users Tab
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
    const [isBulkOperating, setIsBulkOperating] = useState(false);

    // Filters for Users Tab
    const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
    const [userProfileFilter, setUserProfileFilter] = useState<string>('all');

    // Auto-select first server
    useEffect(() => {
        if (servers.length > 0 && !selectedServerId) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId]);

    // Clear and reset data when switching server
    useEffect(() => {
        setHotspotUsers([]);
        setActiveSessions([]);
        setHotspotProfiles([]);
        setHotspotServers([]);
        setFetchError(null);
        setSearch('');
        setCurrentPage(1);
    }, [selectedServerId]);

    const showStatus = (type: 'success' | 'error', message: string) => {
        setStatus({ type, message });
        setTimeout(() => setStatus(null), 4000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        try {
            switch (activeTab) {
                case 'users': {
                    if (!selectedServerId) break;
                    const data = await MikrotikApi.getHotspotUsers(selectedServerId);
                    setHotspotUsers(Array.isArray(data) ? data : []);
                    MikrotikApi.getHotspotProfiles(selectedServerId)
                        .then(p => setHotspotProfiles(Array.isArray(p) ? p : []))
                        .catch(() => {});
                    MikrotikApi.getHotspotServers(selectedServerId)
                        .then(s => setHotspotServers(Array.isArray(s) ? s : []))
                        .catch(() => {});
                    break;
                }
                case 'active': {
                    if (!selectedServerId) break;
                    const data = await MikrotikApi.getHotspotActive(selectedServerId);
                    setActiveSessions(Array.isArray(data) ? data : []);
                    break;
                }
                case 'profiles': {
                    if (!selectedServerId) break;
                    const data = await MikrotikApi.getHotspotProfiles(selectedServerId);
                    setHotspotProfiles(Array.isArray(data) ? data : []);
                    break;
                }
                case 'servers': {
                    if (!selectedServerId) break;
                    const data = await MikrotikApi.getHotspotServers(selectedServerId);
                    setHotspotServers(Array.isArray(data) ? data : []);
                    break;
                }
                case 'vouchers': {
                    const data = await MikrotikApi.getCustomerVouchers({ limit: 'all' });
                    setAllVouchers(Array.isArray(data) ? data : []);
                    break;
                }
            }
        } catch (e: any) {
            const errMsg = e.message || 'Gagal mengambil data dari server';
            setFetchError(errMsg);
            showStatus('error', errMsg);
        } finally {
            setLoading(false);
        }
    }, [selectedServerId, activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset page on search/tab change
    useEffect(() => { setCurrentPage(1); }, [search, activeTab]);

    // --- CRUD Handlers ---
    const handleAdd = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user: any) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleOpenVoucherModal = (targetUser?: string) => {
        setVoucherTargetUser(targetUser || null);
        setIsVoucherModalOpen(true);
    };

    const handleSave = async (data: any) => {
        setLoading(true);
        try {
            if (editingUser) {
                await MikrotikApi.updateHotspotUser(selectedServerId, editingUser['.id'], data);
                showStatus('success', 'User berhasil diupdate');
            } else {
                await MikrotikApi.addHotspotUser(selectedServerId, data);
                showStatus('success', 'User berhasil ditambahkan');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (user: any) => {
        if (!confirm(`Yakin hapus user hotspot "${user.name}"?`)) return;
        setLoading(true);
        try {
            await MikrotikApi.deleteHotspotUser(selectedServerId, user['.id']);
            showStatus('success', `User "${user.name}" berhasil dihapus`);
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal hapus: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (user: any) => {
        const isCurrentlyDisabled = user.disabled === 'true' || user.disabled === 'yes' || user.disabled === true;
        setLoading(true);
        try {
            await MikrotikApi.toggleHotspotUser(selectedServerId, user['.id'], !isCurrentlyDisabled);
            showStatus('success', `User "${user.name}" ${isCurrentlyDisabled ? 'diaktifkan' : 'dinonaktifkan'}`);
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal toggle: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleResetCounters = async (user: any) => {
        if (!confirm(`Reset counter kuota & uptime untuk user '${user.name}'? User akan di-enable kembali agar voucher dapat digunakan.`)) return;
        setLoading(true);
        try {
            await MikrotikApi.resetHotspotUserCounters(selectedServerId, {
                id: user['.id'],
                username: user.name
            });
            showStatus('success', `Counter kuota & uptime user '${user.name}' berhasil di-reset ke 0!`);
            fetchData();
        } catch (e: any) {
            showStatus('error', e.message || 'Gagal reset counter user');
            setLoading(false);
        }
    };

    const handleKick = async (session: any) => {
        if (!confirm(`Kick user "${session.user}" dari hotspot?`)) return;
        setLoading(true);
        try {
            await MikrotikApi.kickHotspotUser(selectedServerId, session['.id']);
            showStatus('success', `User "${session.user}" berhasil di-kick`);
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal kick: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Bulk Action Handlers
    const handleSelectAllUsers = (checked: boolean) => {
        if (checked) {
            const ids = paginatedData.map((u: any) => u['.id']);
            setSelectedUserIds(new Set(ids));
        } else {
            setSelectedUserIds(new Set());
        }
    };

    const handleToggleSelectUser = (id: string) => {
        const next = new Set(selectedUserIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedUserIds(next);
    };

    const handleBulkDeleteUsers = async () => {
        const ids = Array.from(selectedUserIds);
        if (ids.length === 0) return;
        if (!confirm(`Yakin ingin menghapus ${ids.length} user hotspot terpilih dari router MikroTik?`)) return;

        setIsBulkOperating(true);
        try {
            for (const id of ids) {
                await MikrotikApi.deleteHotspotUser(selectedServerId, id);
            }
            showStatus('success', `${ids.length} user hotspot berhasil dihapus`);
            setSelectedUserIds(new Set());
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal menghapus user: ${e.message}`);
        } finally {
            setIsBulkOperating(false);
        }
    };

    const handleBulkToggleUsers = async (disabled: boolean) => {
        const ids = Array.from(selectedUserIds);
        if (ids.length === 0) return;

        setIsBulkOperating(true);
        try {
            for (const id of ids) {
                await MikrotikApi.toggleHotspotUser(selectedServerId, id, disabled);
            }
            showStatus('success', `${ids.length} user hotspot berhasil ${disabled ? 'dinonaktifkan' : 'diaktifkan'}`);
            setSelectedUserIds(new Set());
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal mengubah status: ${e.message}`);
        } finally {
            setIsBulkOperating(false);
        }
    };

    // Multi-Server Voucher Cache Handlers
    const handleSyncAllVouchersCache = async () => {
        setIsSyncingAllVouchers(true);
        try {
            const res = await MikrotikApi.syncAllVouchersCache();
            const purgedCount = res.totalPurged || 0;
            const purgedMsg = purgedCount > 0 ? ` (${purgedCount} voucher usang otomatis dibersihkan)` : '';
            showStatus('success', `Berhasil sinkronisasi cache: Total ${res.totalSynced} voucher di-cache${purgedMsg} dari ${res.servers.length} server!`);
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal sync cache: ${e.message}`);
        } finally {
            setIsSyncingAllVouchers(false);
        }
    };

    const handleSelectAllVouchers = (checked: boolean) => {
        if (checked) {
            const ids = paginatedData.map((v: any) => v.id);
            setSelectedVoucherIds(new Set(ids));
        } else {
            setSelectedVoucherIds(new Set());
        }
    };

    const handleToggleSelectVoucher = (id: string) => {
        const next = new Set(selectedVoucherIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedVoucherIds(next);
    };

    const handleDeleteSelectedVouchers = async () => {
        const ids = Array.from(selectedVoucherIds);
        if (ids.length === 0) return;
        if (!confirm(`Yakin ingin menghapus ${ids.length} voucher terpilih dari database & router MikroTik?`)) return;
        setLoading(true);
        try {
            await MikrotikApi.deleteBatchCustomerVouchers(ids);
            showStatus('success', `${ids.length} voucher berhasil dihapus!`);
            setSelectedVoucherIds(new Set());
            fetchData();
        } catch (e: any) {
            showStatus('error', `Gagal menghapus voucher: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePrintSelectedVouchers = () => {
        const ids = Array.from(selectedVoucherIds);
        const targetList = ids.length > 0 ? allVouchers.filter(v => ids.includes(v.id)) : filteredData;
        if (targetList.length === 0) {
            showStatus('error', 'Tidak ada voucher untuk dicetak');
            return;
        }
        printCachedVouchers(targetList);
    };

    const handleExportVouchersCSV = () => {
        if (filteredData.length === 0) return;
        const headers = ['Kode Voucher', 'Password', 'Server', 'Profile', 'Harga', 'Status', 'Pelanggan', 'No HP', 'Tanggal Dibuat'];
        const rows = filteredData.map(v => [
            `"${v.voucher_code || ''}"`,
            `"${v.voucher_password || ''}"`,
            `"${v.Server?.name || v.server_id || ''}"`,
            `"${v.profile_name || ''}"`,
            `"${v.price || 0}"`,
            `"${v.status || 'unused'}"`,
            `"${v.Customer?.real_name || v.Customer?.name || v.customer_name || ''}"`,
            `"${v.customer_phone || v.Customer?.phone_number || ''}"`,
            `"${v.createdAt ? new Date(v.createdAt).toLocaleString('id-ID') : ''}"`
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `voucher_cache_all_servers_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Helper to resolve Customer Name from CRM list / tag
    const getCustomerForUser = useCallback((u: any) => {
        if (!u) return null;
        const comment = u.comment || '';
        
        // 1. Try matching [CID:uuid]
        const cidMatch = comment.match(/\[CID:([0-9a-fA-F-]+)\]/i);
        if (cidMatch && cidMatch[1]) {
            const targetCid = cidMatch[1].toLowerCase();
            const found = customers.find((c: any) => 
                String(c.id).toLowerCase() === targetCid ||
                String(c.crmId || '').toLowerCase() === targetCid
            );
            if (found) return found;
        }

        // 2. Try matching username / mikrotik_name / phone
        const username = (u.name || '').toLowerCase().trim();
        if (username) {
            const foundByUsername = customers.find((c: any) => 
                (c.name && c.name.toLowerCase().trim() === username) ||
                (c.mikrotik_name && c.mikrotik_name.toLowerCase().trim() === username) ||
                (c.whatsapp && c.whatsapp.replace(/\D/g, '') === username.replace(/\D/g, '')) ||
                (c.phone_number && c.phone_number.replace(/\D/g, '') === username.replace(/\D/g, ''))
            );
            if (foundByUsername) return foundByUsername;
        }

        return null;
    }, [customers]);

    const getCustomerNameForUser = useCallback((u: any) => {
        const cust = getCustomerForUser(u);
        if (cust) return cust.realName || (cust as any).real_name || cust.name || 'Pelanggan';

        const comment = u.comment || '';
        if (comment) {
            const clean = comment.replace(/\[CID:[^\]]+\]/gi, '').trim();
            if (clean && !clean.toLowerCase().startsWith('counters') && !clean.toLowerCase().startsWith('terpakai:')) {
                return clean;
            }
        }
        return null;
    }, [getCustomerForUser]);

    // --- Filtering & Pagination ---
    const getFilteredData = () => {
        const q = (search || '').trim().toLowerCase();
        switch (activeTab) {
            case 'users':
                return (Array.isArray(hotspotUsers) ? hotspotUsers : []).filter(u => {
                    // Search
                    if (q) {
                        const matchName = (u.name || '').toLowerCase().includes(q);
                        const matchProfile = (u.profile || '').toLowerCase().includes(q);
                        const matchComment = (u.comment || '').toLowerCase().includes(q);
                        const matchServer = (u.server || '').toLowerCase().includes(q);
                        const custName = (getCustomerNameForUser(u) || '').toLowerCase();
                        const matchCustomer = custName.includes(q);
                        if (!matchName && !matchProfile && !matchComment && !matchServer && !matchCustomer) return false;
                    }

                    // Status Filter
                    const isDisabled = u.disabled === 'true' || u.disabled === 'yes' || u.disabled === true;
                    if (userStatusFilter === 'active' && isDisabled) return false;
                    if (userStatusFilter === 'disabled' && !isDisabled) return false;

                    // Profile Filter
                    if (userProfileFilter !== 'all' && u.profile !== userProfileFilter) return false;

                    return true;
                });
            case 'active':
                return (Array.isArray(activeSessions) ? activeSessions : []).filter(s =>
                    !q ||
                    (s.user || '').toLowerCase().includes(q) ||
                    (s.address || '').toLowerCase().includes(q) ||
                    (s['mac-address'] || '').toLowerCase().includes(q) ||
                    (s.server || '').toLowerCase().includes(q)
                );
            case 'profiles':
                return (Array.isArray(hotspotProfiles) ? hotspotProfiles : []).filter(p =>
                    !q ||
                    (p.name || '').toLowerCase().includes(q) ||
                    (p['address-pool'] || '').toLowerCase().includes(q) ||
                    (p['rate-limit'] || '').toLowerCase().includes(q)
                );
            case 'servers':
                return (Array.isArray(hotspotServers) ? hotspotServers : []).filter(s =>
                    !q ||
                    (s.name || '').toLowerCase().includes(q) ||
                    (s.interface || '').toLowerCase().includes(q) ||
                    (s.profile || '').toLowerCase().includes(q)
                );
            case 'vouchers':
                return (Array.isArray(allVouchers) ? allVouchers : []).filter(v => {
                    if (voucherServerFilter !== 'all' && v.server_id !== voucherServerFilter) return false;
                    if (voucherStatusFilter !== 'all' && (v.status || 'unused') !== voucherStatusFilter) return false;
                    if (q) {
                        const matchCode = (v.voucher_code || '').toLowerCase().includes(q);
                        const matchPwd = (v.voucher_password || '').toLowerCase().includes(q);
                        const matchProfile = (v.profile_name || '').toLowerCase().includes(q);
                        const matchComment = (v.comment || '').toLowerCase().includes(q);
                        const matchServer = (v.Server?.name || v.server_id || '').toLowerCase().includes(q);
                        const matchCustomer = (v.Customer?.real_name || v.Customer?.name || v.customer_name || '').toLowerCase().includes(q);
                        const matchPhone = (v.customer_phone || v.Customer?.phone_number || '').includes(q);
                        if (!matchCode && !matchPwd && !matchProfile && !matchComment && !matchServer && !matchCustomer && !matchPhone) return false;
                    }
                    return true;
                });
            default:
                return [];
        }
    };

    const filteredData = getFilteredData();
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const tabs: { key: TabKey; label: string; icon: any; count: number }[] = [
        { key: 'users', label: 'Users', icon: Users, count: Array.isArray(hotspotUsers) ? hotspotUsers.length : 0 },
        { key: 'active', label: 'Active Sessions', icon: Activity, count: Array.isArray(activeSessions) ? activeSessions.length : 0 },
        { key: 'profiles', label: 'Profiles', icon: Layers, count: Array.isArray(hotspotProfiles) ? hotspotProfiles.length : 0 },
        { key: 'servers', label: 'Hotspot Servers', icon: Server, count: Array.isArray(hotspotServers) ? hotspotServers.length : 0 },
        { key: 'vouchers', label: 'Cache Voucher Multi-Server', icon: Ticket, count: Array.isArray(allVouchers) ? allVouchers.length : 0 },
    ];

    const formatBytes = (bytes: string | number | undefined | null) => {
        if (bytes === undefined || bytes === null || bytes === '') return '0 B';
        const b = Number(bytes);
        if (isNaN(b) || b <= 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), sizes.length - 1);
        return (b / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl text-white shadow-lg shadow-orange-500/20">
                            <Wifi className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        Hotspot Manager
                    </h1>
                    <p className="text-slate-500 text-xs sm:text-sm mt-1">Kelola layanan Hotspot MikroTik di setiap server & voucher pelanggan</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    <div className="w-full sm:w-[220px] flex-1 sm:flex-none">
                        <SearchableSelect
                            value={selectedServerId}
                            onChange={(val) => setSelectedServerId(val)}
                            options={servers.map(s => ({ label: `${s.name} (${s.ip})`, value: s.id }))}
                            placeholder="Pilih Server..."
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading || !selectedServerId}
                        className={cn(
                            "flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-50 transition-all disabled:opacity-50 shadow-sm text-xs sm:text-sm font-medium",
                            loading && "animate-pulse"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                        Refresh
                    </button>
                    <button
                        onClick={() => handleOpenVoucherModal()}
                        disabled={!selectedServerId}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
                        title="Generate Voucher Berkuota Bulanan"
                    >
                        <Ticket className="w-4 h-4" />
                        Generate Voucher
                    </button>
                    {activeTab === 'users' && (
                        <button
                            onClick={handleAdd}
                            disabled={!selectedServerId}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-all shadow-md disabled:opacity-50 font-medium text-xs sm:text-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            Add User
                        </button>
                    )}
                </div>
            </div>

            {/* Status Alert */}
            {status && (
                <div className={cn(
                    "p-4 rounded-xl flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300",
                    status.type === 'success'
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                )}>
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {status.message}
                </div>
            )}

            {/* No Server Selected */}
            {!selectedServerId && (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                    <Wifi className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700">Pilih Server</h3>
                    <p className="text-slate-500 mt-1">Pilih server MikroTik untuk mengelola hotspot</p>
                </div>
            )}

            {selectedServerId && (
                <>
                    {/* Server Info Badge */}
                    <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-slate-600">
                            <Server className="w-3.5 h-3.5" />
                            <span className="font-medium">{selectedServer?.name}</span>
                            <span className="text-slate-400">•</span>
                            <span className="font-mono text-xs">{selectedServer?.ip}:{selectedServer?.port || 8728}</span>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto max-w-full">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
                                    activeTab === tab.key
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-semibold transition-colors",
                                    activeTab === tab.key
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-slate-200/80 text-slate-500"
                                )}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Search & Filter Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                            <div className="relative flex-1 min-w-[200px] max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all bg-white text-xs"
                                    placeholder={`Cari ${activeTab === 'users' ? 'user hotspot / pelanggan' : activeTab === 'active' ? 'sesi aktif' : activeTab === 'profiles' ? 'profile' : activeTab === 'vouchers' ? 'kode / paket / server' : 'server'}...`}
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                                        title="Hapus pencarian"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {activeTab === 'users' && (
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                    {/* Status Filter */}
                                    <select
                                        value={userStatusFilter}
                                        onChange={e => {
                                            setUserStatusFilter(e.target.value as any);
                                            setCurrentPage(1);
                                        }}
                                        className="flex-1 sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 text-slate-700"
                                    >
                                        <option value="all">Semua Status</option>
                                        <option value="active">Active (Aktif)</option>
                                        <option value="disabled">Disabled (Nonaktif)</option>
                                    </select>

                                    {/* Profile Filter */}
                                    <select
                                        value={userProfileFilter}
                                        onChange={e => {
                                            setUserProfileFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="flex-1 sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 text-slate-700"
                                    >
                                        <option value="all">Semua Profile</option>
                                        {hotspotProfiles.map(p => (
                                            <option key={p['.id'] || p.name} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {activeTab === 'vouchers' && (
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                                    {/* Server Filter */}
                                    <select
                                        value={voucherServerFilter}
                                        onChange={e => {
                                            setVoucherServerFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="flex-1 sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 text-slate-700"
                                    >
                                        <option value="all">Semua Server MikroTik</option>
                                        {servers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                        ))}
                                    </select>

                                    {/* Status Filter */}
                                    <select
                                        value={voucherStatusFilter}
                                        onChange={e => {
                                            setVoucherStatusFilter(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="flex-1 sm:w-auto px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-orange-500/20 text-slate-700"
                                    >
                                        <option value="all">Semua Status</option>
                                        <option value="unused">Belum Terpakai</option>
                                        <option value="active">Sedang Aktif (Online)</option>
                                        <option value="expired">Expired (Kadaluarsa)</option>
                                        <option value="used">Sudah Terpakai</option>
                                    </select>

                                    <button
                                        onClick={handleSyncAllVouchersCache}
                                        disabled={isSyncingAllVouchers}
                                        className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        title="Scan & Sync Voucher dari Semua Server Router MikroTik"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAllVouchers ? 'animate-spin' : ''}`} />
                                        {isSyncingAllVouchers ? 'Syncing...' : 'Sync All Server'}
                                    </button>

                                    <button
                                        onClick={handleExportVouchersCSV}
                                        disabled={filteredData.length === 0}
                                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
                                        title="Ekspor Data Cache Voucher ke CSV"
                                    >
                                        <Download className="w-3.5 h-3.5 text-slate-500" />
                                        Export CSV
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bulk Action Bar (When users are selected) */}
                    {activeTab === 'users' && selectedUserIds.size > 0 && (
                        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 fade-in duration-200">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-500/20 text-orange-300 border border-orange-500/40 px-3 py-1 rounded-lg text-xs font-bold">
                                    {selectedUserIds.size} User Terpilih
                                </div>
                                <span className="text-xs text-slate-400 hidden sm:inline">
                                    Aksi massal untuk user hotspot yang dicentang di halaman ini:
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleBulkToggleUsers(false)}
                                    disabled={isBulkOperating}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Unlock className="w-3.5 h-3.5" />
                                    Aktifkan
                                </button>
                                <button
                                    onClick={() => handleBulkToggleUsers(true)}
                                    disabled={isBulkOperating}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Lock className="w-3.5 h-3.5" />
                                    Nonaktifkan
                                </button>
                                <button
                                    onClick={handleBulkDeleteUsers}
                                    disabled={isBulkOperating}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Hapus Terpilih
                                </button>
                                <button
                                    onClick={() => setSelectedUserIds(new Set())}
                                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="flex items-center gap-3 text-slate-500">
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                <span className="font-medium">Memuat data dari router...</span>
                            </div>
                        </div>
                    )}

                    {/* Tables */}
                    {!loading && (
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                {/* USERS TAB */}
                                {activeTab === 'users' && (
                                    <table className="w-full text-left text-sm min-w-[1100px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="w-10 px-4 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                        checked={paginatedData.length > 0 && paginatedData.every((u: any) => selectedUserIds.has(u['.id']))}
                                                        onChange={e => handleSelectAllUsers(e.target.checked)}
                                                        title="Pilih Semua User di Halaman Ini"
                                                    />
                                                </th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Pelanggan</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Username</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Password</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Profile</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Server</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Limit Uptime</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Limit Bytes</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Sisa Kuota</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Comment</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                                                <th className="px-5 py-3 font-medium text-slate-500 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {fetchError ? (
                                                <tr>
                                                    <td colSpan={12} className="p-0">
                                                        <ErrorTableState error={fetchError} onRetry={fetchData} />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={12} className="p-0">
                                                        <EmptyTableState
                                                            icon={Users}
                                                            title="Belum Ada User Hotspot"
                                                            description="Tidak ditemukan user atau voucher hotspot di server MikroTik ini. Anda dapat membuat user baru untuk mulai melayani pelanggan."
                                                            actionButton={
                                                                <button
                                                                    onClick={handleAdd}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-orange-500/20"
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                    Tambah User Hotspot
                                                                </button>
                                                            }
                                                            isSearch={!!search.trim() || userStatusFilter !== 'all' || userProfileFilter !== 'all'}
                                                            searchQuery={search}
                                                            onResetSearch={() => {
                                                                setSearch('');
                                                                setUserStatusFilter('all');
                                                                setUserProfileFilter('all');
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.map((u: any) => {
                                                const isDisabled = u.disabled === 'true' || u.disabled === 'yes' || u.disabled === true;
                                                const isChecked = selectedUserIds.has(u['.id']);
                                                const bytesIn = Number(u['bytes-in'] || 0);
                                                const bytesOut = Number(u['bytes-out'] || 0);
                                                const bytesUsed = bytesIn + bytesOut;
                                                const limitBytesTotal = Number(u['limit-bytes-total'] || 0);
                                                const isQuotaExhausted = limitBytesTotal > 0 && bytesUsed >= limitBytesTotal;
                                                const customerName = getCustomerNameForUser(u);

                                                return (
                                                    <tr
                                                        key={u['.id']}
                                                        className={cn(
                                                            "hover:bg-slate-50/80 group transition-colors",
                                                            isChecked ? "bg-amber-50/60" : "",
                                                            isDisabled && "opacity-60"
                                                        )}
                                                    >
                                                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                                checked={isChecked}
                                                                onChange={() => handleToggleSelectUser(u['.id'])}
                                                            />
                                                        </td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            {customerName ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-200/60 font-medium text-xs">
                                                                    <UserCheck className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                                                                    <span className="truncate max-w-[150px]" title={customerName}>{customerName}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-xs italic">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 font-medium text-slate-900">{u.name || '-'}</td>
                                                        <td className="px-5 py-3">
                                                            <PasswordCell password={u.password} />
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                                                                {u.profile || 'default'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            {u.server ? (
                                                                <span className="text-slate-700 text-xs font-medium">{u.server}</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">Semua Server</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 font-mono text-xs">
                                                            {u['limit-uptime'] && u['limit-uptime'] !== '0s' ? (
                                                                <span className="text-slate-700">{u['limit-uptime']}</span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">Unlimited</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 font-mono text-xs">
                                                            {u['limit-bytes-total'] && u['limit-bytes-total'] !== '0' ? (
                                                                <span className="text-slate-700">{formatBytes(u['limit-bytes-total'])}</span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">Unlimited</span>
                                                            )}
                                                        </td>
                                                        {/* Sisa Kuota Column */}
                                                        <td className="px-5 py-3 text-xs min-w-[140px]">
                                                            {limitBytesTotal > 0 ? (
                                                                <div>
                                                                    <div className="flex items-center justify-between gap-1 font-mono mb-1">
                                                                        <span className={cn("font-bold text-[11px]", isQuotaExhausted ? "text-red-600 font-extrabold" : "text-slate-800")}>
                                                                            {formatBytes(Math.max(0, limitBytesTotal - bytesUsed))} sisa
                                                                        </span>
                                                                        <span className="text-slate-400 text-[10px]">
                                                                            {Math.min(100, Math.round((bytesUsed / limitBytesTotal) * 100))}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                                        <div
                                                                            className={cn(
                                                                                "h-full rounded-full transition-all",
                                                                                isQuotaExhausted ? "bg-red-600" : (bytesUsed / limitBytesTotal) > 0.8 ? "bg-amber-500" : "bg-emerald-500"
                                                                            )}
                                                                            style={{ width: `${Math.min(100, Math.round((bytesUsed / limitBytesTotal) * 100))}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 font-mono text-xs">
                                                                    {bytesUsed > 0 ? `Terpakai: ${formatBytes(bytesUsed)}` : 'Unlimited'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-xs max-w-[150px] truncate">
                                                            {u.comment ? (
                                                                <span className="text-slate-600 block truncate" title={u.comment}>{u.comment}</span>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            {isQuotaExhausted ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-700 border border-red-200 shadow-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                                                    KUOTA HABIS
                                                                </span>
                                                            ) : isDisabled ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                                    Disabled
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                    Active
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <div className="flex items-center gap-1 justify-end opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleResetCounters(u)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Reset Counter Kuota & Uptime (Aktifkan Kembali)">
                                                                    <RotateCcw className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleOpenVoucherModal(u.name)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Beri Kuota / Voucher Bulanan">
                                                                    <Ticket className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleToggle(u)} className={cn("p-1.5 rounded-lg transition-colors", isDisabled ? "text-emerald-500 hover:bg-emerald-50" : "text-amber-500 hover:bg-amber-50")} title={isDisabled ? 'Enable' : 'Disable'}>
                                                                    {isDisabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                                </button>
                                                                <button onClick={() => handleEdit(u)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                                    <Pencil className="w-4 h-4" />
                                                                </button>
                                                                <button onClick={() => handleDelete(u)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}

                                {/* ACTIVE SESSIONS TAB */}
                                {activeTab === 'active' && (
                                    <table className="w-full text-left text-sm min-w-[800px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3 font-medium text-slate-500">User</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">IP Address</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">MAC Address</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Uptime</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Bytes In</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Bytes Out</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Server</th>
                                                <th className="px-5 py-3 font-medium text-slate-500 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {fetchError ? (
                                                <tr>
                                                    <td colSpan={8} className="p-0">
                                                        <ErrorTableState error={fetchError} onRetry={fetchData} />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="p-0">
                                                        <EmptyTableState
                                                            icon={Activity}
                                                            title="Tidak Ada Sesi Aktif"
                                                            description="Saat ini belum ada user yang sedang login atau terhubung ke layanan hotspot di server MikroTik ini."
                                                            actionButton={
                                                                <button
                                                                    onClick={fetchData}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                                >
                                                                    <RefreshCw className="w-4 h-4" />
                                                                    Segarkan Sesi
                                                                </button>
                                                            }
                                                            isSearch={!!search.trim()}
                                                            searchQuery={search}
                                                            onResetSearch={() => setSearch('')}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.map((s: any) => (
                                                <tr key={s['.id']} className="hover:bg-slate-50/80 group transition-colors">
                                                    <td className="px-5 py-3 font-medium text-slate-900">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                            {s.user || '-'}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{s.address || '-'}</td>
                                                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{s['mac-address'] || '-'}</td>
                                                    <td className="px-5 py-3 text-slate-600 text-xs">{s.uptime || '-'}</td>
                                                    <td className="px-5 py-3 text-emerald-600 font-mono text-xs">{formatBytes(s['bytes-in'])}</td>
                                                    <td className="px-5 py-3 text-blue-600 font-mono text-xs">{formatBytes(s['bytes-out'])}</td>
                                                    <td className="px-5 py-3 text-slate-500 text-xs">{s.server || <span className="text-slate-400 italic">default</span>}</td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleOpenVoucherModal(s.user)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors shadow-xs"
                                                                title="Generate / Beri Kuota Bulanan untuk user ini"
                                                            >
                                                                <Ticket className="w-3.5 h-3.5 text-amber-600" />
                                                                Voucher Kuota
                                                            </button>
                                                            <button
                                                                onClick={() => handleKick(s)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                            >
                                                                <LogOut className="w-3.5 h-3.5" />
                                                                Kick
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                {/* PROFILES TAB */}
                                {activeTab === 'profiles' && (
                                    <table className="w-full text-left text-sm min-w-[800px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3 font-medium text-slate-500">Name</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Address Pool</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Rate Limit (rx/tx)</th>
                                                <th className="px-5 py-3 font-medium text-slate-500 text-center">Shared Users</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Session Timeout</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Idle Timeout</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Keepalive</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {fetchError ? (
                                                <tr>
                                                    <td colSpan={7} className="p-0">
                                                        <ErrorTableState error={fetchError} onRetry={fetchData} />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="p-0">
                                                        <EmptyTableState
                                                            icon={Layers}
                                                            title="Tidak Ada User Profile"
                                                            description="Tidak ditemukan profile user hotspot di server ini. Profile default biasanya dibuat otomatis oleh RouterOS saat hotspot pertama kali dikonfigurasi."
                                                            actionButton={
                                                                <button
                                                                    onClick={fetchData}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                                >
                                                                    <RefreshCw className="w-4 h-4" />
                                                                    Periksa Kembali
                                                                </button>
                                                            }
                                                            isSearch={!!search.trim()}
                                                            searchQuery={search}
                                                            onResetSearch={() => setSearch('')}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.map((p: any) => (
                                                <tr key={p['.id']} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-3 font-medium text-slate-900">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                            {p.name || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                                        {p['address-pool'] && p['address-pool'] !== 'none' ? p['address-pool'] : <span className="text-slate-400 italic">none</span>}
                                                    </td>
                                                    <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                                        {p['rate-limit'] ? p['rate-limit'] : <span className="text-slate-400 italic">Unlimited</span>}
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-700 font-bold text-xs">
                                                            {p['shared-users'] || '1'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-600 text-xs">
                                                        {p['session-timeout'] && p['session-timeout'] !== '0s' ? p['session-timeout'] : <span className="text-slate-400 italic">Unlimited</span>}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-600 text-xs">
                                                        {p['idle-timeout'] && p['idle-timeout'] !== 'none' ? p['idle-timeout'] : <span className="text-slate-400 italic">none</span>}
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-600 text-xs">
                                                        {p['keepalive-timeout'] && p['keepalive-timeout'] !== 'none' ? p['keepalive-timeout'] : <span className="text-slate-400 italic">none</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                 {/* SERVERS TAB */}
                                {activeTab === 'servers' && (
                                    <table className="w-full text-left text-sm min-w-[800px]">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="px-5 py-3 font-medium text-slate-500">Name</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Interface</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Address Pool</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Profile</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Addresses Per MAC</th>
                                                <th className="px-5 py-3 font-medium text-slate-500">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {fetchError ? (
                                                <tr>
                                                    <td colSpan={6} className="p-0">
                                                        <ErrorTableState error={fetchError} onRetry={fetchData} />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-0">
                                                        <EmptyTableState
                                                            icon={Server}
                                                            title="Hotspot Server Belum Dikonfigurasi"
                                                            description="Layanan Hotspot belum diaktifkan atau tidak ada hotspot server yang berjalan di MikroTik ini. Anda dapat menjalankan setup hotspot di MikroTik terlebih dahulu."
                                                            actionButton={
                                                                <button
                                                                    onClick={fetchData}
                                                                    className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                                >
                                                                    <RefreshCw className="w-4 h-4" />
                                                                    Cek Ulang Server
                                                                </button>
                                                            }
                                                            isSearch={!!search.trim()}
                                                            searchQuery={search}
                                                            onResetSearch={() => setSearch('')}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : paginatedData.map((s: any) => {
                                                const isDisabled = s.disabled === 'true' || s.disabled === 'yes' || s.disabled === true;
                                                return (
                                                    <tr key={s['.id']} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-3 font-medium text-slate-900">
                                                            <span className="inline-flex items-center gap-2">
                                                                <Wifi className="w-4 h-4 text-orange-500" />
                                                                {s.name || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                                            {s.interface || <span className="text-slate-400 italic">none</span>}
                                                        </td>
                                                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                                                            {s['address-pool'] && s['address-pool'] !== 'none' ? s['address-pool'] : <span className="text-slate-400 italic">none</span>}
                                                        </td>
                                                        <td className="px-5 py-3 text-slate-600 text-xs">
                                                            {s.profile || <span className="text-slate-400 italic">default</span>}
                                                        </td>
                                                        <td className="px-5 py-3 text-slate-600 text-xs">
                                                            {s['addresses-per-mac'] && s['addresses-per-mac'] !== 'unlimited' ? s['addresses-per-mac'] : <span className="text-slate-400 italic">unlimited</span>}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <span className={cn(
                                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                                                isDisabled ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                                                            )}>
                                                                <span className={cn("w-1.5 h-1.5 rounded-full", isDisabled ? "bg-red-500" : "bg-emerald-500")} />
                                                                {isDisabled ? 'Disabled' : 'Running'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}

                                {/* VOUCHERS CACHE TAB (MULTI-SERVER) */}
                                {activeTab === 'vouchers' && (
                                    <div className="space-y-4">
                                        {/* Metric Summary Cards */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 border-b border-slate-200">
                                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                                                <div className="text-xs text-slate-500 font-medium">Total Voucher Cache</div>
                                                <div className="text-xl font-bold text-slate-900 mt-1">{allVouchers.length}</div>
                                            </div>
                                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                                                <div className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    Belum Dipakai (Unused)
                                                </div>
                                                <div className="text-xl font-bold text-emerald-700 mt-1">
                                                    {allVouchers.filter(v => (v.status || 'unused') === 'unused').length}
                                                </div>
                                            </div>
                                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                                                <div className="text-xs text-blue-600 font-medium flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                    Sedang Aktif
                                                </div>
                                                <div className="text-xl font-bold text-blue-700 mt-1">
                                                    {allVouchers.filter(v => v.status === 'active').length}
                                                </div>
                                            </div>
                                            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                                                <div className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                                    Expired / Terpakai
                                                </div>
                                                <div className="text-xl font-bold text-amber-700 mt-1">
                                                    {allVouchers.filter(v => v.status === 'expired' || v.status === 'used').length}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bulk Action Toolbar for Vouchers */}
                                        {selectedVoucherIds.size > 0 && (
                                            <div className="mx-4 p-3 bg-slate-900 text-white rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-orange-500/20 text-orange-300 border border-orange-500/40 px-3 py-1 rounded-lg text-xs font-bold">
                                                        {selectedVoucherIds.size} Voucher Terpilih
                                                    </div>
                                                    <span className="text-xs text-slate-400 hidden sm:inline">
                                                        Pilih aksi untuk voucher yang dicentang:
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={handlePrintSelectedVouchers}
                                                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        Cetak Terpilih
                                                    </button>
                                                    <button
                                                        onClick={handleDeleteSelectedVouchers}
                                                        disabled={loading}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Hapus Terpilih
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <table className="w-full text-left text-sm min-w-[900px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 w-10 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                            checked={paginatedData.length > 0 && paginatedData.every((v: any) => selectedVoucherIds.has(v.id))}
                                                            onChange={e => handleSelectAllVouchers(e.target.checked)}
                                                        />
                                                    </th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Kode Voucher / Password</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Server MikroTik</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Profile / Paket</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Pelanggan Terhubung</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500">Waktu Dibuat</th>
                                                    <th className="px-4 py-3 font-medium text-slate-500 text-right">Aksi</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {fetchError ? (
                                                    <tr>
                                                        <td colSpan={8} className="p-0">
                                                            <ErrorTableState error={fetchError} onRetry={fetchData} />
                                                        </td>
                                                    </tr>
                                                ) : paginatedData.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="p-0">
                                                            <EmptyTableState
                                                                icon={Ticket}
                                                                title="Belum Ada Cache Voucher"
                                                                description="Voucher dari semua server belum di-cache atau tidak ada voucher yang cocok dengan filter."
                                                                actionButton={
                                                                    <button
                                                                        onClick={handleSyncAllVouchersCache}
                                                                        disabled={isSyncingAllVouchers}
                                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                                                                    >
                                                                        <RefreshCw className={cn("w-4 h-4", isSyncingAllVouchers && "animate-spin")} />
                                                                        Scan & Cache Semua Server
                                                                    </button>
                                                                }
                                                                isSearch={!!search.trim()}
                                                                searchQuery={search}
                                                                onResetSearch={() => setSearch('')}
                                                            />
                                                        </td>
                                                    </tr>
                                                ) : paginatedData.map((v: any) => {
                                                    const isSelected = selectedVoucherIds.has(v.id);
                                                    const serverObj = v.Server || servers.find(s => s.id === v.server_id);
                                                    const statusVal = (v.status || 'unused').toLowerCase();

                                                    let statusBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                                                    let statusDotClass = "bg-emerald-500";
                                                    let statusLabel = "Belum Dipakai";

                                                    if (statusVal === 'active') {
                                                        statusBadgeClass = "bg-blue-50 text-blue-700 border-blue-200";
                                                        statusDotClass = "bg-blue-500 animate-pulse";
                                                        statusLabel = "Sedang Aktif";
                                                    } else if (statusVal === 'expired') {
                                                        statusBadgeClass = "bg-red-50 text-red-700 border-red-200";
                                                        statusDotClass = "bg-red-500";
                                                        statusLabel = "Kadaluarsa";
                                                    } else if (statusVal === 'used') {
                                                        statusBadgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                                                        statusDotClass = "bg-slate-400";
                                                        statusLabel = "Terpakai";
                                                    }

                                                    return (
                                                        <tr key={v.id} className={cn("hover:bg-slate-50/80 transition-colors group", isSelected && "bg-orange-50/50")}>
                                                            <td className="px-4 py-3 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                                    checked={isSelected}
                                                                    onChange={() => handleToggleSelectVoucher(v.id)}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-mono font-bold text-slate-900 text-sm">
                                                                        {v.voucher_code}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(v.voucher_code);
                                                                            setCopiedCode(v.voucher_code);
                                                                            setTimeout(() => setCopiedCode(null), 2000);
                                                                        }}
                                                                        className="p-1 text-slate-400 hover:text-orange-600 transition-colors"
                                                                        title="Salin Kode Voucher"
                                                                    >
                                                                        {copiedCode === v.voucher_code ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </div>
                                                                {v.voucher_password && (
                                                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                                                        Pwd: <span className="font-semibold text-slate-700">{v.voucher_password}</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 font-medium text-xs">
                                                                    <Server className="w-3 h-3 text-slate-500" />
                                                                    <span>{serverObj?.name || v.server_id || 'MikroTik'}</span>
                                                                </div>
                                                                {serverObj?.ip && (
                                                                    <div className="text-[11px] font-mono text-slate-400 mt-0.5 pl-1">
                                                                        {serverObj.ip}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-slate-800 text-xs">{v.profile_name || 'default'}</div>
                                                                {v.price > 0 && (
                                                                    <div className="text-xs font-semibold text-amber-600 mt-0.5">
                                                                        Rp {Number(v.price).toLocaleString('id-ID')}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border", statusBadgeClass)}>
                                                                    <span className={cn("w-1.5 h-1.5 rounded-full", statusDotClass)} />
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-xs">
                                                                {v.Customer || v.customer_name ? (
                                                                    <div>
                                                                        <div className="font-medium text-slate-900">{v.Customer?.real_name || v.Customer?.name || v.customer_name}</div>
                                                                        {(v.customer_phone || v.Customer?.phone_number) && (
                                                                            <div className="text-slate-500 font-mono">{v.customer_phone || v.Customer?.phone_number}</div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Voucher Bebas (Umum)</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                                                                {v.createdAt ? new Date(v.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button
                                                                        onClick={() => printCachedVouchers([v])}
                                                                        className="p-1.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                                        title="Cetak Voucher Card"
                                                                    >
                                                                        <Printer className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!confirm(`Hapus voucher "${v.voucher_code}"?`)) return;
                                                                            try {
                                                                                await MikrotikApi.deleteBatchCustomerVouchers([v.id]);
                                                                                showStatus('success', `Voucher "${v.voucher_code}" dihapus`);
                                                                                fetchData();
                                                                            } catch (e: any) {
                                                                                showStatus('error', e.message);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Hapus Voucher"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Pagination & Summary */}
                            {filteredData.length > 0 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50 gap-3">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>Show</span>
                                        <select
                                            value={itemsPerPage}
                                            onChange={e => {
                                                setItemsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs text-slate-700 font-medium focus:ring-1 focus:ring-orange-500/20"
                                        >
                                            <option value={10}>10</option>
                                            <option value={15}>15</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                        <span>entries</span>
                                        <span className="text-slate-400 mx-1">|</span>
                                        <span>
                                            Menampilkan <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> dari <span className="font-semibold text-slate-700">{filteredData.length}</span> data
                                        </span>
                                    </div>
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                disabled={currentPage === 1}
                                                className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 transition-colors border border-slate-200 disabled:border-transparent"
                                                title="Halaman Sebelumnya"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                                const page = currentPage <= 3 ? i + 1 : currentPage + i - 2;
                                                if (page > totalPages || page < 1) return null;
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => setCurrentPage(page)}
                                                        className={cn(
                                                            "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
                                                            currentPage === page
                                                                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
                                                                : "hover:bg-white text-slate-600"
                                                        )}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                disabled={currentPage === totalPages}
                                                className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30 transition-colors border border-slate-200 disabled:border-transparent"
                                                title="Halaman Selanjutnya"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Add/Edit Modal */}
            <HotspotUserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingUser}
                profiles={hotspotProfiles}
                hotspotServers={hotspotServers}
                loading={loading}
            />

            {/* Voucher Generator Modal */}
            <HotspotVoucherModal
                isOpen={isVoucherModalOpen}
                onClose={() => {
                    setIsVoucherModalOpen(false);
                    setVoucherTargetUser(null);
                }}
                serverId={selectedServerId}
                serverName={selectedServer?.name || 'MikroTik'}
                targetUsername={voucherTargetUser}
                onSuccess={() => {
                    fetchData();
                    showStatus('success', 'Voucher kuota berhasil diproses di MikroTik');
                }}
            />
        </div>
    );
}

// --- Empty State Component ---
function EmptyTableState({
    icon: Icon,
    title,
    description,
    actionButton,
    isSearch,
    searchQuery,
    onResetSearch
}: {
    icon: any;
    title: string;
    description: string;
    actionButton?: React.ReactNode;
    isSearch?: boolean;
    searchQuery?: string;
    onResetSearch?: () => void;
}) {
    if (isSearch) {
        return (
            <div className="py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-3 border border-amber-100">
                    <SearchX className="w-7 h-7" />
                </div>
                <h4 className="text-base font-semibold text-slate-800">Tidak ada hasil ditemukan</h4>
                <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                    Tidak ada data yang cocok dengan kata kunci <span className="font-semibold text-slate-700">"{searchQuery}"</span>.
                </p>
                {onResetSearch && (
                    <button
                        onClick={onResetSearch}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-100/70 hover:bg-amber-100 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset Filter Pencarian
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                <Icon className="w-8 h-8 opacity-60" />
            </div>
            <h4 className="text-base font-semibold text-slate-800">{title}</h4>
            <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                {description}
            </p>
            {actionButton && (
                <div className="mt-5 flex justify-center gap-3">
                    {actionButton}
                </div>
            )}
        </div>
    );
}

// --- Error State Component ---
function ErrorTableState({
    error,
    onRetry
}: {
    error: string;
    onRetry: () => void;
}) {
    return (
        <div className="py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 mx-auto flex items-center justify-center mb-4 border border-red-100 shadow-sm">
                <AlertCircle className="w-8 h-8" />
            </div>
            <h4 className="text-base font-semibold text-slate-800">Gagal Mengambil Data MikroTik</h4>
            <div className="mt-2 max-w-md mx-auto">
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 font-mono break-all text-left">
                    {error}
                </p>
            </div>
            <p className="text-xs text-slate-400 mt-3 max-w-md mx-auto">
                Pastikan router online, port API RouterOS yang terdaftar di menu Servers aktif, dan akun server memiliki izin akses.
            </p>
            <div className="mt-5">
                <button
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-md shadow-red-500/20"
                >
                    <RefreshCw className="w-4 h-4" />
                    Coba Hubungkan Ulang
                </button>
            </div>
        </div>
    );
}

// --- Password cell with show/hide ---
function PasswordCell({ password }: { password?: string }) {
    const [show, setShow] = useState(false);
    if (!password) return <span className="text-slate-400 italic text-xs">Tanpa password</span>;
    return (
        <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-slate-600">{show ? password : '••••••'}</span>
            <button onClick={() => setShow(!show)} className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors" title={show ? "Sembunyikan" : "Lihat"}>
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}

// --- Add/Edit Modal ---
function HotspotUserModal({ isOpen, onClose, onSave, initialData, profiles, hotspotServers, loading }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: any;
    profiles: any[];
    hotspotServers: any[];
    loading: boolean;
}) {
    const [formData, setFormData] = useState({
        name: '', password: '', profile: 'default', server: '',
        'limit-uptime': '', 'limit-bytes-total': '', comment: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                password: initialData.password || '',
                profile: initialData.profile || 'default',
                server: initialData.server || '',
                'limit-uptime': initialData['limit-uptime'] || '',
                'limit-bytes-total': initialData['limit-bytes-total'] || '',
                comment: initialData.comment || '',
            });
        } else {
            setFormData({
                name: '', password: '', profile: 'default', server: '',
                'limit-uptime': '', 'limit-bytes-total': '', comment: ''
            });
        }
    }, [initialData, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {};
        Object.entries(formData).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                payload[key] = value;
            }
        });
        onSave(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg text-white">
                                <Wifi className="w-4 h-4" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {initialData ? 'Edit User Hotspot' : 'Tambah User Hotspot'}
                            </h2>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Username <span className="text-red-400">*</span></label>
                            <input
                                required
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="hotspot_user1"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Password</label>
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                placeholder="password"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Profile</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white transition-all"
                                value={formData.profile}
                                onChange={e => setFormData({ ...formData, profile: e.target.value })}
                            >
                                <option value="default">default</option>
                                {profiles.map(p => (
                                    <option key={p['.id'] || p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Hotspot Server</label>
                            <select
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white transition-all"
                                value={formData.server}
                                onChange={e => setFormData({ ...formData, server: e.target.value })}
                            >
                                <option value="">All (any)</option>
                                {hotspotServers.map(s => (
                                    <option key={s['.id'] || s.name} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Limit Uptime</label>
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                                value={formData['limit-uptime']}
                                onChange={e => setFormData({ ...formData, 'limit-uptime': e.target.value })}
                                placeholder="e.g. 1h / 1d"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700">Limit Bytes Total</label>
                            <input
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                                value={formData['limit-bytes-total']}
                                onChange={e => setFormData({ ...formData, 'limit-bytes-total': e.target.value })}
                                placeholder="e.g. 1073741824 (1GB)"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700">Comment</label>
                        <input
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                            value={formData.comment}
                            onChange={e => setFormData({ ...formData, comment: e.target.value })}
                            placeholder="Keterangan..."
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-orange-500/20 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {initialData ? 'Simpan Perubahan' : 'Tambah User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
