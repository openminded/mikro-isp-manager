import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useServers } from '@/context/ServerContext';
import { useData } from '@/context/DataContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import {
    Ticket, Search, Check, Copy, Printer, Download,
    X, AlertCircle, CheckCircle2, Users, Sparkles, Filter,
    MessageCircle, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HotspotVoucherModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId?: string;
    serverName?: string;
    targetUsername?: string | null;
    initialSelectedCustomerIds?: string[];
    onSuccess?: () => void;
}

// Helpers for printing, sharing, exporting
function printVouchers(vouchers: any[], quotaLabel: string, serverName: string) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Cetak Voucher Hotspot</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; color: #1e293b; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 15px; }
            .voucher-card { border: 2px dashed #cbd5e1; border-radius: 10px; padding: 14px; background: #f8fafc; page-break-inside: avoid; }
            .header { border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; text-align: center; }
            .header h2 { margin: 0; font-size: 15px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
            .server-name { font-size: 10px; color: #64748b; }
            .customer-badge { background: #e0e7ff; color: #3730a3; font-size: 10px; padding: 3px 6px; border-radius: 4px; margin-bottom: 8px; text-align: center; }
            .code-box { background: white; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 8px; margin: 8px 0; text-align: center; }
            .code-label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: bold; }
            .code-val { font-family: 'Courier New', monospace; font-size: 15px; font-weight: bold; color: #0f172a; letter-spacing: 1px; }
            .specs { display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0; }
            @media print {
                .no-print { display: none; }
                background: #f1f5f9;
                padding: 16px;
                color: #0f172a;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
                gap: 12px;
            }
            .voucher-card {
                background: #ffffff;
                border: 2px dashed #f59e0b;
                border-radius: 12px;
                padding: 12px;
                position: relative;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            }
            .header {
                border-bottom: 1px solid #fed7aa;
                padding-bottom: 6px;
                margin-bottom: 8px;
                text-align: center;
            }
            .header h2 {
                margin: 0;
                font-size: 13px;
                font-weight: 800;
                color: #d97706;
                letter-spacing: 0.5px;
            }
            .header .server-name {
                font-size: 10px;
                color: #64748b;
                margin-top: 2px;
            }
            .customer-badge {
                font-size: 10px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                padding: 3px 6px;
                margin-bottom: 6px;
                color: #334155;
            }
            .customer-badge strong {
                color: #0f172a;
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .quota-badge {
                background: #fef3c7;
                color: #b45309;
                padding: 3px 8px;
                border-radius: 9999px;
                font-size: 11px;
                font-weight: 700;
                display: inline-block;
                margin-bottom: 6px;
            }
            .code-box {
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-radius: 8px;
                padding: 8px;
                text-align: center;
                margin-bottom: 6px;
            }
            .code-label {
                font-size: 9px;
                color: #78716c;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
            }
            .code-value {
                font-size: 16px;
                font-weight: 800;
                color: #1e293b;
                letter-spacing: 1.5px;
                font-family: monospace;
            }
            .footer {
                font-size: 9px;
                color: #64748b;
                text-align: center;
                margin-top: 6px;
                border-top: 1px dotted #e2e8f0;
                padding-top: 4px;
            }
        </style>
    </head>
    <body>
        <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 16px; border-radius: 8px;">
            <div>
                <strong>Total Voucher: ${vouchers.length} Lembar</strong> | Kuota: ${quotaLabel} | Server: ${serverName}
            </div>
            <button onclick="window.print()" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                Print Sekarang
            </button>
        </div>
        <div class="grid">
            ${vouchers.map((v) => `
                <div class="voucher-card">
                    <div class="header">
                        <h2>VOUCHER HOTSPOT</h2>
                        <div class="server-name">${serverName}</div>
                    </div>
                    ${(v.customerName || v.customerUsername) ? `
                        <div class="customer-badge">
                            <strong>${v.customerName || v.customerUsername}</strong>
                            ${v.subAreaName ? `<span>Area: ${v.subAreaName}</span>` : ''}
                        </div>
                    ` : ''}
                    <div style="text-align: center;">
                        <span class="quota-badge">KUOTA ${v.quotaGb ? v.quotaGb + ' GB' : quotaLabel}</span>
                    </div>
                    <div class="code-box">
                        <div class="code-label">${v.password ? 'Username' : 'Kode Voucher'}</div>
                        <div class="code-value">${v.name || v.voucher_code}</div>
                        ${v.password ? `
                            <div class="code-label" style="margin-top: 4px;">Password</div>
                            <div class="code-value" style="font-size: 14px;">${v.password || v.voucher_password}</div>
                        ` : ''}
                    </div>
                    <div class="footer">
                        Masa Aktif: ${v.validity || '30 Hari (Bulanan)'}<br>
                        Hubungkan ke WiFi Hotspot & masukkan kode di atas.
                    </div>
                </div>
            `).join('')}
        </div>
    </body>
    </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function copyForWhatsApp(vouchers: any[], quotaLabel: string, serverName: string) {
    let text = `📶 *VOUCHER HOTSPOT INTERNET*\n`;
    text += `🏢 Server: *${serverName}*\n`;
    text += `📦 Kuota: *${quotaLabel} Bulanan*\n`;
    text += `--------------------------------\n`;

    vouchers.forEach((v, idx) => {
        if (vouchers.length > 1) {
            text += `\n*#${idx + 1}. ${v.customerName || v.name || 'Pelanggan'}*\n`;
        }
        text += `🔑 Kode Voucher: *${v.name || v.voucher_code}*\n`;
        if (v.password || v.voucher_password) {
            text += `🔒 Password: *${v.password || v.voucher_password}*\n`;
        }
        if (v.subAreaName) {
            text += `📍 Sub Area: ${v.subAreaName}\n`;
        }
        text += `⏳ Masa Aktif: ${v.validity || '30 Hari'}\n`;
    });

    text += `\n--------------------------------\n`;
    text += `📌 *Cara Pakai:*\n1. Hubungkan HP/Laptop ke WiFi Hotspot ${serverName}\n2. Buka browser (halaman login akan muncul otomatis)\n3. Masukkan kode voucher di atas lalu tekan Login.`;

    navigator.clipboard.writeText(text);
}

function downloadVouchersCsv(vouchers: any[], quotaLabel: string) {
    let csv = 'Nama Pelanggan,Username / Kode Voucher,Password,Kuota,Masa Aktif,Nomor WhatsApp,Sub Area\n';
    vouchers.forEach(v => {
        const cName = `"${(v.customerName || '').replace(/"/g, '""')}"`;
        const code = `"${(v.name || v.voucher_code || '').replace(/"/g, '""')}"`;
        const pass = `"${(v.password || v.voucher_password || '').replace(/"/g, '""')}"`;
        const quota = `"${v.quotaGb ? v.quotaGb + ' GB' : quotaLabel}"`;
        const val = `"${v.validity || '30d'}"`;
        const phone = `"${(v.customerPhone || '').replace(/"/g, '""')}"`;
        const area = `"${(v.subAreaName || '').replace(/"/g, '""')}"`;
        csv += `${cName},${code},${pass},${quota},${val},${phone},${area}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `voucher_pelanggan_${quotaLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

export function HotspotVoucherModal({
    isOpen,
    onClose,
    serverId: propServerId,
    serverName: propServerName,
    targetUsername,
    initialSelectedCustomerIds = [],
    onSuccess
}: HotspotVoucherModalProps) {
    const { servers } = useServers();
    const { customers } = useData();

    // Server State
    const [currentServerId, setCurrentServerId] = useState<string>(propServerId || (servers[0]?.id || ''));
    const currentServer = useServers().servers.find(s => s.id === currentServerId);
    const currentServerName = propServerName || currentServer?.name || 'Server';

    // Sub Areas
    const [subAreas, setSubAreas] = useState<any[]>([]);

    // Mode: 'customer' (Filter & Generate for Customers), 'batch' (Random anonymous batch), 'active_user' (Inject quota to single active user)
    const [mode, setMode] = useState<'customer' | 'batch' | 'active_user'>(
        targetUsername ? 'active_user' : 'customer'
    );

    // Active user single injection
    const [selectedActiveUser, setSelectedActiveUser] = useState<string>(targetUsername || '');

    // Filters for Customer Mode (similar to Customers.tsx)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('active');
    const [profileFilter, setProfileFilter] = useState<string>('all');
    const [subAreaFilter, setSubAreaFilter] = useState<string>('all');
    const [searchFilter, setSearchFilter] = useState<string>('');

    // Selected Customers (Set of customer identifiers)
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(
        new Set(initialSelectedCustomerIds)
    );

    // Customer selection table pagination
    const [custPage, setCustPage] = useState<number>(1);
    const [custPerPage, setCustPerPage] = useState<number>(10);

    // Quota Settings (1G, 5G, 10G, or custom increment per GB)
    const [quotaGb, setQuotaGb] = useState<number>(5);
    const [validity, setValidity] = useState<string>('30d');

    // Voucher format options
    const [codeOption, setCodeOption] = useState<'username' | 'random'>('random');
    const [prefix, setPrefix] = useState<string>('VC-');
    const [codeLength, setCodeLength] = useState<number>(6);
    const [voucherType, setVoucherType] = useState<'single' | 'dual'>('single');

    // Batch Anonymous settings
    const [batchQuantity, setBatchQuantity] = useState<number>(10);

    // Router Profiles & Servers
    const [hotspotProfiles, setHotspotProfiles] = useState<any[]>([]);
    const [hotspotServers, setHotspotServers] = useState<any[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string>('default');
    const [selectedHotspotServer, setSelectedHotspotServer] = useState<string>('');

    // State & Result
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [generatedVouchers, setGeneratedVouchers] = useState<any[] | null>(null);
    const [copiedWa, setCopiedWa] = useState<boolean>(false);

    // Fetch Sub Areas
    useEffect(() => {
        axios.get('/api/sub-areas')
            .then(res => {
                if (Array.isArray(res.data)) setSubAreas(res.data);
            })
            .catch(console.error);
    }, []);

    // Sync Server Id prop
    useEffect(() => {
        if (propServerId) {
            setCurrentServerId(propServerId);
        } else if (servers.length > 0 && !currentServerId) {
            setCurrentServerId(servers[0].id);
        }
    }, [propServerId, servers]);

    // Handle single target username prop
    useEffect(() => {
        if (targetUsername) {
            setMode('active_user');
            setSelectedActiveUser(targetUsername);
        }
    }, [targetUsername]);

    // Fetch Hotspot Profiles & Servers when Server changes
    useEffect(() => {
        if (!currentServerId) return;
        MikrotikApi.getHotspotProfiles(currentServerId)
            .then(res => {
                setHotspotProfiles(res);
                if (res.length > 0 && !res.find(p => p.name === selectedProfile)) {
                    setSelectedProfile(res[0].name || 'default');
                }
            })
            .catch(() => {});

        MikrotikApi.getHotspotServers(currentServerId)
            .then(res => setHotspotServers(res))
            .catch(() => {});
    }, [currentServerId]);

    // Reset results on close
    useEffect(() => {
        if (!isOpen) {
            setGeneratedVouchers(null);
            setErrorMsg(null);
            setCopiedWa(false);
        }
    }, [isOpen]);

    // Unique Customer Profiles on this server
    const uniqueCustomerProfiles = useMemo(() => {
        return Array.from(new Set(
            customers
                .filter(c => c.serverId === currentServerId)
                .map(c => c.profile)
                .filter(Boolean)
        )).sort();
    }, [customers, currentServerId]);

    // Filtered Customers based on server, status, profile, subArea, search
    const filteredCustomers = useMemo(() => {
        return customers.filter(c => {
            // Must belong to the selected server
            if (c.serverId !== currentServerId) return false;

            // Status filter
            if (statusFilter === 'active' && c.disabled) return false;
            if (statusFilter === 'disabled' && !c.disabled) return false;

            // Profile filter
            if (profileFilter !== 'all' && c.profile !== profileFilter) return false;

            // Sub Area filter
            if (subAreaFilter !== 'all' && c.sub_area_id !== subAreaFilter) return false;

            // Search filter
            if (searchFilter.trim() !== '') {
                const q = searchFilter.toLowerCase();
                const matchName = (c.name || '').toLowerCase().includes(q);
                const matchReal = (c.realName || '').toLowerCase().includes(q);
                const matchComment = (c.comment || '').toLowerCase().includes(q);
                const matchPhone = (c.whatsapp || '').includes(q);
                if (!matchName && !matchReal && !matchComment && !matchPhone) return false;
            }

            return true;
        });
    }, [customers, currentServerId, statusFilter, profileFilter, subAreaFilter, searchFilter]);

    // Customer table pagination derived data
    const totalCustPages = Math.max(1, Math.ceil(filteredCustomers.length / custPerPage));
    const paginatedFilteredCustomers = useMemo(() => {
        const start = (custPage - 1) * custPerPage;
        return filteredCustomers.slice(start, start + custPerPage);
    }, [filteredCustomers, custPage, custPerPage]);

    if (!isOpen) return null;

    const quotaLabel = `${quotaGb} GB`;
    const totalBytes = quotaGb * 1073741824;

    // Toggle customer selection
    const handleToggleSelectOne = (id: string) => {
        const next = new Set(selectedCustomerIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedCustomerIds(next);
    };

    const handleSelectAllFiltered = (checked: boolean) => {
        const next = new Set(selectedCustomerIds);
        if (checked) {
            filteredCustomers.forEach(c => next.add(c.id || c.name));
        } else {
            filteredCustomers.forEach(c => next.delete(c.id || c.name));
        }
        setSelectedCustomerIds(next);
    };

    const isAllFilteredSelected = filteredCustomers.length > 0 &&
        filteredCustomers.every(c => selectedCustomerIds.has(c.id || c.name));

    // Execute voucher generation
    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg(null);

        try {
            if (mode === 'active_user') {
                // Suntik kuota ke user aktif tertentu
                if (!selectedActiveUser) throw new Error('Pilih user aktif terlebih dahulu');

                const matchedCust = customers.find(c => c.name === selectedActiveUser);

                await MikrotikApi.setHotspotUserQuota(currentServerId, {
                    username: selectedActiveUser,
                    customerId: matchedCust?.crmId || matchedCust?.id,
                    limitBytesTotal: String(totalBytes),
                    limitUptime: validity,
                    comment: `[Voucher ${quotaLabel} Bulanan] User: ${selectedActiveUser}`
                });

                setGeneratedVouchers([{
                    name: selectedActiveUser,
                    password: '(Tetap)',
                    quotaGb: quotaGb,
                    validity: validity,
                    customerName: selectedActiveUser,
                    comment: `Kuota ${quotaLabel} Bulanan telah aktif di router`
                }]);

                if (onSuccess) onSuccess();
            } else if (mode === 'customer') {
                // Generate untuk customer yang terfilter & terpilih
                const targetCustomers = customers.filter(c => selectedCustomerIds.has(c.id || c.name));

                if (targetCustomers.length === 0) {
                    throw new Error('Pilih minimal 1 pelanggan dari tabel hasil filter');
                }

                const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
                const vouchersToCreate: any[] = [];

                targetCustomers.forEach(cust => {
                    let code = '';
                    if (codeOption === 'username') {
                        code = cust.name;
                    } else {
                        code = prefix;
                        for (let j = 0; j < codeLength; j++) {
                            code += chars.charAt(Math.floor(Math.random() * chars.length));
                        }
                    }

                    const pass = voucherType === 'single' ? code : (
                        chars.charAt(Math.floor(Math.random() * chars.length)) +
                        Math.floor(1000 + Math.random() * 9000).toString()
                    );

                    const subAreaObj = subAreas.find(s => s.id === cust.sub_area_id);
                    const displayName = cust.realName || cust.comment || cust.name;

                    vouchersToCreate.push({
                        name: code,
                        password: pass,
                        profile: selectedProfile,
                        server: selectedHotspotServer || undefined,
                        'limit-bytes-total': String(totalBytes),
                        'limit-uptime': validity,
                        comment: `[Kuota ${quotaLabel}] ${displayName} (${cust.name})`,
                        // Customer Metadata for DB linking & client-side access
                        customerId: cust.crmId || cust.id,
                        customerName: displayName,
                        customerUsername: cust.name,
                        customerPhone: cust.whatsapp || '',
                        subAreaName: subAreaObj?.name || '',
                        quotaGb: quotaGb,
                        validity: validity
                    });
                });

                const res = await MikrotikApi.generateHotspotVouchers(currentServerId, vouchersToCreate);
                if (!res.success || res.createdCount === 0) {
                    throw new Error(res.errors?.[0]?.error || 'Gagal membuat voucher di MikroTik');
                }

                setGeneratedVouchers(vouchersToCreate);
                if (onSuccess) onSuccess();
            } else {
                // Batch Anonymous Vouchers
                const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
                const vouchersToCreate: any[] = [];

                for (let i = 0; i < batchQuantity; i++) {
                    let code = prefix;
                    for (let j = 0; j < codeLength; j++) {
                        code += chars.charAt(Math.floor(Math.random() * chars.length));
                    }
                    const pass = voucherType === 'single' ? code : (
                        chars.charAt(Math.floor(Math.random() * chars.length)) +
                        Math.floor(1000 + Math.random() * 9000).toString()
                    );

                    vouchersToCreate.push({
                        name: code,
                        password: pass,
                        profile: selectedProfile,
                        server: selectedHotspotServer || undefined,
                        'limit-bytes-total': String(totalBytes),
                        'limit-uptime': validity,
                        comment: `[Voucher Batch ${quotaLabel}] ${new Date().toLocaleDateString('id-ID')}`,
                        quotaGb: quotaGb,
                        validity: validity
                    });
                }

                const res = await MikrotikApi.generateHotspotVouchers(currentServerId, vouchersToCreate);
                if (!res.success || res.createdCount === 0) {
                    throw new Error(res.errors?.[0]?.error || 'Gagal membuat voucher di MikroTik');
                }

                setGeneratedVouchers(vouchersToCreate);
                if (onSuccess) onSuccess();
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Terjadi kesalahan saat memproses voucher');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">
                                {generatedVouchers ? 'Voucher Berhasil Dibuat!' : 'Generate Voucher & Kuota Hotspot'}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {generatedVouchers
                                    ? `${generatedVouchers.length} voucher kuota telah aktif di router MikroTik dan tersimpan ke data pelanggan.`
                                    : `Pilih filter pelanggan pada server MikroTik untuk membuat voucher kuota bulanan.`
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                    <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {/* Body Content */}
                {generatedVouchers ? (
                    /* --- RESULT VIEW --- */
                    <div className="p-6 flex-1 overflow-y-auto space-y-4">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-emerald-900">
                                        {generatedVouchers.length} Voucher Kuota {quotaLabel} Siap Digunakan
                                    </h4>
                                    <p className="text-xs text-emerald-700">
                                        Server: <strong>{currentServerName}</strong> | Masa Aktif: <strong>{validity === '30d' ? '30 Hari (Bulanan)' : validity}</strong>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => printVouchers(generatedVouchers, quotaLabel, currentServerName)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                >
                                    <Printer className="w-4 h-4" /> Cetak Kartu
                                </button>
                                <button
                                    onClick={() => {
                                        copyForWhatsApp(generatedVouchers, quotaLabel, currentServerName);
                                        setCopiedWa(true);
                                        setTimeout(() => setCopiedWa(false), 2500);
                                    }}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                >
                                    {copiedWa ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copiedWa ? 'Tersalin!' : 'Salin WA'}
                                </button>
                                <button
                                    onClick={() => downloadVouchersCsv(generatedVouchers, quotaLabel)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4" /> CSV
                                </button>
                            </div>
                        </div>

                        {/* List of Vouchers Result */}
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="max-h-72 overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 text-slate-600 sticky top-0 font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2.5">#</th>
                                            <th className="px-4 py-2.5">Pelanggan / Nama</th>
                                            <th className="px-4 py-2.5">Kode Voucher</th>
                                            <th className="px-4 py-2.5">Password</th>
                                            <th className="px-4 py-2.5">Sub Area</th>
                                            <th className="px-4 py-2.5 text-center">Kirim WhatsApp</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {generatedVouchers.map((v, i) => {
                                            const phone = (v.customerPhone || '').replace(/\D/g, '');
                                            const cleanPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
                                            const waMsg = `Halo ${v.customerName || 'Pelanggan'},\nBerikut Voucher Hotspot Kuota *${quotaLabel}* Anda:\n\n🔑 Kode Voucher: *${v.name || v.voucher_code}*${v.password ? `\n🔒 Password: *${v.password}*` : ''}\n⏳ Masa Aktif: ${v.validity || '30 Hari'}\n\nSilakan hubungkan perangkat Anda ke WiFi Hotspot lalu masukkan kode di atas. Terima kasih!`;

                                            return (
                                                <tr key={i} className="hover:bg-slate-50/80">
                                                    <td className="px-4 py-2 text-slate-400 font-mono">{i + 1}</td>
                                                    <td className="px-4 py-2">
                                                        <div className="font-semibold text-slate-800">{v.customerName || v.name}</div>
                                                        {v.customerUsername && v.customerUsername !== v.name && (
                                                            <div className="text-[10px] text-slate-500 font-mono">User: {v.customerUsername}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                            {v.name || v.voucher_code}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2 font-mono text-slate-600">
                                                        {v.password || v.voucher_password || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-600">
                                                        {v.subAreaName || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        {cleanPhone ? (
                                                            <a
                                                                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-semibold text-[11px] transition-colors"
                                                            >
                                                                <MessageCircle className="w-3.5 h-3.5" /> Kirim WA
                                                            </a>
                                                        ) : (
                                                            <span className="text-slate-400 text-[10px] italic">Tanpa No. WA</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end pt-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
                            >
                                Selesai & Tutup
                            </button>
                        </div>
                    </div>
                ) : (
                    /* --- FORM VIEW --- */
                    <form onSubmit={handleGenerate} className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Mode Switcher */}
                            <div className="flex p-1 bg-slate-100 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setMode('customer')}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                        mode === 'customer'
                                            ? "bg-white text-orange-600 shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    Filter & Pilih Pelanggan (Customer)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('batch')}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                        mode === 'batch'
                                            ? "bg-white text-orange-600 shadow-sm"
                                            : "text-slate-600 hover:text-slate-900"
                                    )}
                                >
                                    <Ticket className="w-3.5 h-3.5" />
                                    Batch Voucher Anonim (Umum)
                                </button>
                                {targetUsername && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('active_user')}
                                        className={cn(
                                            "flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                            mode === 'active_user'
                                                ? "bg-white text-orange-600 shadow-sm"
                                                : "text-slate-600 hover:text-slate-900"
                                        )}
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        User Aktif: {targetUsername}
                                    </button>
                                )}
                            </div>

                            {/* Server Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                                        Server MikroTik Target
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                        value={currentServerId}
                                        onChange={e => setCurrentServerId(e.target.value)}
                                    >
                                        {servers.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.ip})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                                            Profile Hotspot
                                        </label>
                                        <select
                                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                            value={selectedProfile}
                                            onChange={e => setSelectedProfile(e.target.value)}
                                        >
                                            <option value="default">default</option>
                                            {hotspotProfiles.map(p => (
                                                <option key={p['.id'] || p.name} value={p.name}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                                            Server Hotspot
                                        </label>
                                        <select
                                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                            value={selectedHotspotServer}
                                            onChange={e => setSelectedHotspotServer(e.target.value)}
                                        >
                                            <option value="">Semua (all)</option>
                                            {hotspotServers.map(s => (
                                                <option key={s['.id'] || s.name} value={s.name}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Quota Settings Panel (Common across modes) */}
                            <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-600" />
                                        <span className="text-xs font-bold text-slate-800">
                                            Pilihan Kuota Bulanan & Masa Berlaku
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                                        {quotaLabel} (Bulanan)
                                    </span>
                                </div>

                                {/* Preset Kuota Buttons: 1G, 5G, 10G & Stepper */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {[1, 5, 10].map(gb => (
                                        <button
                                            key={gb}
                                            type="button"
                                            onClick={() => setQuotaGb(gb)}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                                                quotaGb === gb
                                                    ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            {gb} GB
                                        </button>
                                    ))}

                                    {/* Stepper buttons per 1GB and direct input */}
                                    <div className="flex items-center gap-2 ml-auto">
                                        <div className="flex items-center border border-slate-200 bg-white rounded-xl overflow-hidden shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setQuotaGb(Math.max(1, quotaGb - 1))}
                                                className="px-2.5 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
                                                title="Kurangi 1 GB"
                                            >
                                                - 1 GB
                                            </button>
                                            <input
                                                type="number"
                                                min={1}
                                                max={1000}
                                                value={quotaGb}
                                                onChange={e => setQuotaGb(Math.max(1, Number(e.target.value) || 1))}
                                                className="w-16 py-2 bg-slate-50 text-xs font-mono font-bold text-slate-800 text-center border-x border-slate-200 focus:outline-none"
                                                title="Maksimal Batas Kuota (GB)"
                                            />
                                            <span className="text-[11px] font-bold text-slate-600 px-1.5 bg-slate-50 border-r border-slate-200">GB</span>
                                            <button
                                                type="button"
                                                onClick={() => setQuotaGb(quotaGb + 1)}
                                                className="px-2.5 py-2 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors"
                                                title="Tambah 1 GB"
                                            >
                                                + 1 GB
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Validity Presets & Custom Input */}
                                <div className="flex flex-wrap items-center justify-between pt-2 border-t border-amber-200/50 gap-2">
                                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-500" /> Masa Aktif Voucher:
                                    </label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {[
                                            { label: '30 Hari (Bulanan)', val: '30d' },
                                            { label: '7 Hari', val: '7d' },
                                            { label: '3 Hari', val: '3d' },
                                            { label: '1 Hari', val: '1d' },
                                            { label: '12 Jam', val: '12h' }
                                        ].map(item => (
                                            <button
                                                key={item.val}
                                                type="button"
                                                onClick={() => setValidity(item.val)}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border",
                                                    validity === item.val
                                                        ? "bg-slate-800 text-white border-slate-900 shadow-xs"
                                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                )}
                                            >
                                                {item.label}
                                            </button>
                                        ))}

                                        {/* Custom validity input */}
                                        <div className="flex items-center gap-1 pl-1">
                                            <input
                                                type="text"
                                                value={validity}
                                                onChange={e => setValidity(e.target.value.trim())}
                                                placeholder="Custom: 15d / 2h"
                                                className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center focus:ring-1 focus:ring-amber-500"
                                                title="Format MikroTik: 30d (30 hari), 7d (7 hari), 12h (12 jam)"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* --- MODE: CUSTOMER (Filter Pelanggan) --- */}
                            {mode === 'customer' && (
                                <div className="space-y-4">
                                    {/* Filters Bar like Customers.tsx */}
                                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                                <Filter className="w-3.5 h-3.5 text-slate-500" />
                                                Filter Data Pelanggan di Server Ini
                                            </div>
                                            <span className="text-[11px] text-slate-500">
                                                Total di server: <strong>{customers.filter(c => c.serverId === currentServerId).length}</strong> pelanggan
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            {/* Status Filter */}
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                                                    Status Pelanggan
                                                </label>
                                                <select
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                                    value={statusFilter}
                                                    onChange={e => setStatusFilter(e.target.value as any)}
                                                >
                                                    <option value="all">Semua Status</option>
                                                    <option value="active">Active (Aktif)</option>
                                                    <option value="disabled">Disabled / Blocked</option>
                                                </select>
                                            </div>

                                            {/* Profile Filter */}
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                                                    Profile Paket
                                                </label>
                                                <select
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                                    value={profileFilter}
                                                    onChange={e => setProfileFilter(e.target.value)}
                                                >
                                                    <option value="all">Semua Profile</option>
                                                    {uniqueCustomerProfiles.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Sub Area Filter */}
                                            <div>
                                                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                                                    Sub Area
                                                </label>
                                                <select
                                                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                                    value={subAreaFilter}
                                                    onChange={e => setSubAreaFilter(e.target.value)}
                                                >
                                                    <option value="all">Semua Sub Area</option>
                                                    {subAreas.map(sa => (
                                                        <option key={sa.id} value={sa.id}>{sa.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Search Input */}
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Cari nama pelanggan, username, atau no. telepon WhatsApp..."
                                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500/20"
                                                value={searchFilter}
                                                onChange={e => setSearchFilter(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Table of Customers with Checkboxes */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        {/* Selection Toolbar Header */}
                                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                                            <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700">
                                                <input
                                                    type="checkbox"
                                                    className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                    checked={isAllFilteredSelected}
                                                    onChange={e => handleSelectAllFiltered(e.target.checked)}
                                                />
                                                <span>Pilih Semua Hasil Filter ({filteredCustomers.length})</span>
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500 font-medium">
                                                    <strong className="text-orange-600">{selectedCustomerIds.size}</strong> terpilih
                                                </span>
                                                {selectedCustomerIds.size > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedCustomerIds(new Set())}
                                                        className="text-[11px] text-slate-500 hover:text-red-600 transition-colors"
                                                    >
                                                        Batal Pilih
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Table Content */}
                                        <div className="max-h-60 overflow-y-auto">
                                            {filteredCustomers.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 text-xs">
                                                    Tidak ditemukan data pelanggan dengan kriteria filter di atas.
                                                </div>
                                            ) : (
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-100/60 text-slate-500 font-semibold sticky top-0">
                                                        <tr>
                                                            <th className="w-10 px-4 py-2"></th>
                                                            <th className="px-3 py-2">Pelanggan & Username</th>
                                                            <th className="px-3 py-2">WhatsApp</th>
                                                            <th className="px-3 py-2">Profile</th>
                                                            <th className="px-3 py-2">Sub Area</th>
                                                            <th className="px-3 py-2 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {paginatedFilteredCustomers.map(cust => {
                                                            const custId = cust.id || cust.name;
                                                            const isChecked = selectedCustomerIds.has(custId);
                                                            const subAreaName = subAreas.find(s => s.id === cust.sub_area_id)?.name || '-';

                                                            return (
                                                                <tr
                                                                    key={custId}
                                                                    onClick={() => handleToggleSelectOne(custId)}
                                                                    className={cn(
                                                                        "cursor-pointer transition-colors",
                                                                        isChecked ? "bg-amber-50/70" : "hover:bg-slate-50/80"
                                                                    )}
                                                                >
                                                                    <td className="px-4 py-2 text-center" onClick={e => e.stopPropagation()}>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                                                                            checked={isChecked}
                                                                            onChange={() => handleToggleSelectOne(custId)}
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <div className="font-semibold text-slate-800">
                                                                            {cust.realName || cust.comment || cust.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                                            user: {cust.name}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">
                                                                        {cust.whatsapp || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                                                                            {cust.profile || 'default'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-2 text-slate-600">
                                                                        {subAreaName}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <span className={cn(
                                                                            "px-2 py-0.5 rounded-full text-[10px] font-bold inline-block",
                                                                            cust.disabled
                                                                                ? "bg-red-100 text-red-700"
                                                                                : "bg-emerald-100 text-emerald-700"
                                                                        )}>
                                                                            {cust.disabled ? 'Disabled' : 'Active'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Table Pagination Bar */}
                                        {filteredCustomers.length > 0 && (
                                            <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                                                <div className="flex items-center gap-2">
                                                    <span>Tampil:</span>
                                                    <select
                                                        value={custPerPage}
                                                        onChange={e => {
                                                            setCustPerPage(Number(e.target.value));
                                                            setCustPage(1);
                                                        }}
                                                        className="px-1.5 py-0.5 border border-slate-200 rounded bg-white text-xs"
                                                    >
                                                        <option value={5}>5</option>
                                                        <option value={10}>10</option>
                                                        <option value={20}>20</option>
                                                        <option value={50}>50</option>
                                                    </select>
                                                    <span className="text-slate-400">|</span>
                                                    <span>
                                                        {(custPage - 1) * custPerPage + 1} - {Math.min(custPage * custPerPage, filteredCustomers.length)} dari {filteredCustomers.length} pelanggan
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustPage(p => Math.max(1, p - 1))}
                                                        disabled={custPage === 1}
                                                        className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold text-slate-700"
                                                    >
                                                        ← Prev
                                                    </button>
                                                    <span className="px-2 font-mono font-medium text-slate-700">
                                                        {custPage} / {totalCustPages}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCustPage(p => Math.min(totalCustPages, p + 1))}
                                                        disabled={custPage === totalCustPages}
                                                        className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40 text-xs font-semibold text-slate-700"
                                                    >
                                                        Next →
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Voucher Code Option for Customers */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Penamaan Akun / Kode Voucher
                                            </label>
                                            <select
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                                value={codeOption}
                                                onChange={e => setCodeOption(e.target.value as any)}
                                            >
                                                <option value="random">Kode Voucher Unik Acak (e.g. VC-8K2P9Q)</option>
                                                <option value="username">Gunakan Username Pelanggan Langsung</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-700">
                                                Tipe Login Voucher
                                            </label>
                                            <select
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                                value={voucherType}
                                                onChange={e => setVoucherType(e.target.value as any)}
                                            >
                                                <option value="single">Kode Tunggal (Username = Password)</option>
                                                <option value="dual">Kode Ganda (Username & Password Beda)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- MODE: BATCH ANONYMOUS --- */}
                            {mode === 'batch' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-700">Jumlah Voucher</label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={200}
                                                value={batchQuantity}
                                                onChange={e => setBatchQuantity(Number(e.target.value))}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-700">Prefix Kode</label>
                                            <input
                                                type="text"
                                                value={prefix}
                                                onChange={e => setPrefix(e.target.value.toUpperCase())}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium font-mono focus:ring-2 focus:ring-orange-500/20"
                                                placeholder="e.g. VC-"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-700">Panjang Karakter</label>
                                            <select
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-orange-500/20"
                                                value={codeLength}
                                                onChange={e => setCodeLength(Number(e.target.value))}
                                            >
                                                <option value={4}>4 Karakter (e.g. VC-8K2P)</option>
                                                <option value={6}>6 Karakter (e.g. VC-8K2P9Q)</option>
                                                <option value={8}>8 Karakter (e.g. VC-8K2P9Q3M)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- MODE: ACTIVE USER SINGLE --- */}
                            {mode === 'active_user' && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                    <label className="text-xs font-semibold text-slate-700 block">
                                        Username User Aktif Target
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedActiveUser}
                                        onChange={e => setSelectedActiveUser(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800"
                                        placeholder="Masukkan username user hotspot"
                                    />
                                    <p className="text-[11px] text-slate-500">
                                        Router akan menerapkan limit byte sebesar <strong>{quotaLabel}</strong> dan mereset counter traffic user ini sehingga kuota bulanan dimulai dari nol.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-xs text-slate-500 font-medium">
                                {mode === 'customer' && (
                                    <span>
                                        Target: <strong className="text-slate-800">{selectedCustomerIds.size}</strong> pelanggan terpilih
                                    </span>
                                )}
                                {mode === 'batch' && (
                                    <span>
                                        Target: <strong className="text-slate-800">{batchQuantity}</strong> voucher baru
                                    </span>
                                )}
                                {mode === 'active_user' && (
                                    <span>
                                        Target: <strong className="text-slate-800">{selectedActiveUser || '-'}</strong>
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2.5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || (mode === 'customer' && selectedCustomerIds.size === 0)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
                                >
                                    <Ticket className="w-4 h-4" />
                                    {submitting ? 'Menghubungi MikroTik & Database...' : (
                                        mode === 'customer'
                                            ? `Generate Voucher (${selectedCustomerIds.size} Pelanggan)`
                                            : mode === 'batch'
                                                ? `Generate ${batchQuantity} Voucher ${quotaLabel}`
                                                : `Terapkan Kuota ${quotaLabel}`
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
