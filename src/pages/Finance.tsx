import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Download, CheckCircle, Upload, X, Filter, Layers, Ban, History, Pencil, ArrowUpDown, Trash2, Printer, AlertTriangle, Eye, EyeOff, Zap, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data for dev (replace with API calls later)
// actually let's try to fetch if we can, but likely need to build API helpers in frontend first.
// For now, I will write the component to fetch from the new /api/billing endpoints.

export function Finance() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'unpaid' | 'history' | 'invalid' | 'recap' | 'analytics'>('analytics');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [showNominal, setShowNominal] = useState(true);
    const [monthlyStatusFilters, setMonthlyStatusFilters] = useState({ PAID: true, UNPAID: true, CANCELLED: false, INVALID: false });
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [editFormData, setEditFormData] = useState({ amount: '', due_date: '', status: '' });
    const [selectedAnalyticsGroup, setSelectedAnalyticsGroup] = useState<{ title: string, invoices: any[] } | null>(null);

    // Grouping & Selection
    const [groupByServer, setGroupByServer] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Payment Form State
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState('');
    const [paymentMethodsList, setPaymentMethodsList] = useState<any[]>([]);

    // Search, Filter, Pagination
    const [search, setSearch] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // Default current month
    const [filterServerId, setFilterServerId] = useState('');
    const [filterPaymentDate, setFilterPaymentDate] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [servers, setServers] = useState<any[]>([]);
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [filterSubAreaId, setFilterSubAreaId] = useState('');

    // Clear selection when changing tabs
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab]);

    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            setPage(1); // Reset to page 1 on search/filter change
            fetchInvoices(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, period, filterServerId, filterSubAreaId, filterPaymentDate, activeTab, limit, sortConfig]);

    useEffect(() => {
        // Fetch when page changes (skip initial redundant fetch)
        fetchInvoices(page);
    }, [page]);

    // Initial load
    useEffect(() => {
        fetchPaymentMethods();
        fetchServers();
        fetchSubAreas();
    }, []);

    const fetchSubAreas = async () => {
        try {
            const res = await fetch('/api/sub-areas');
            const data = await res.json();
            if (Array.isArray(data)) setSubAreas(data);
        } catch (e) { console.error('Failed to fetch sub areas', e); }
    };

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/servers');
            const data = await res.json();
            if (Array.isArray(data)) setServers(data);
        } catch (e) { console.error('Failed to fetch servers', e); }
    };

    const fetchPaymentMethods = async () => {
        try {
            const res = await fetch('/api/payment-methods');
            const data = await res.json();
            if (Array.isArray(data)) {
                setPaymentMethodsList(data);
                if (data.length > 0) setPaymentMethod(data[0].id);
            }
        } catch (e) { console.error(e); }
    };

    const fetchInvoices = async (currentPage = page) => {
        setIsLoading(true);
        try {
            if (activeTab === 'analytics') {
                const params = new URLSearchParams();
                if (period) params.append('period', period);
                if (filterServerId) params.append('serverId', filterServerId);

                const res = await fetch(`/api/billing/analytics?${params.toString()}`);
                const data = await res.json();

                if (res.ok && !data.error && data.summary) {
                    setAnalyticsData(data);
                } else {
                    console.error("Backend Error:", data.error);
                    setAnalyticsData({ error: data.error || 'Failed to load analytics' });
                }
                setIsLoading(false);
                return;
            }

            if (activeTab === 'recap') {
                const params = new URLSearchParams();
                params.append('page', currentPage.toString());
                params.append('limit', limit.toString());
                if (search) params.append('search', search);
                if (period) params.append('period', period);
                if (filterServerId) params.append('serverId', filterServerId);
                if (filterSubAreaId) params.append('subAreaId', filterSubAreaId);
                if (filterPaymentDate) params.append('paymentDate', filterPaymentDate);
                if (sortConfig) {
                    params.append('sortBy', sortConfig.key);
                    params.append('order', sortConfig.direction.toUpperCase());
                }
                const res = await fetch(`/api/billing/payments?${params.toString()}`);
                const result = await res.json();
                if (result.data) {
                    setInvoices(result.data);
                    setTotalPages(result.meta.totalPages);
                } else {
                    setInvoices([]);
                }
                return;
            }

            // Map table tabs to API status
            let status = 'UNPAID';
            if (activeTab === 'history') status = 'PAID';
            if (activeTab === 'invalid') status = 'INVALID';

            const params = new URLSearchParams();
            params.append('status', status);
            params.append('page', currentPage.toString());
            params.append('limit', limit.toString());
            if (search) params.append('search', search);
            if (period) params.append('period', period);
            if (filterServerId) params.append('serverId', filterServerId);
            if (filterSubAreaId) params.append('subAreaId', filterSubAreaId);
            if (filterPaymentDate) params.append('paymentDate', filterPaymentDate);
            if (sortConfig) {
                params.append('sortBy', sortConfig.key);
                params.append('order', sortConfig.direction.toUpperCase());
            }

            const res = await fetch(`/api/billing/invoices?${params.toString()}`);
            const result = await res.json();

            if (result.data) {
                setInvoices(result.data);
                setTotalPages(result.meta.totalPages);
            } else {
                setInvoices(Array.isArray(result) ? result : []); // Fallback
            }
            // Selection is now persisted across searches/pages
            // setSelectedIds(new Set());
        } catch (error) {
            console.error("Failed to fetch invoices", error);
        } finally {
            setIsLoading(false);
        }
    };

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handlePayClick = (invoice: any) => {
        setSelectedInvoice(invoice);
        setAmount(invoice.amount); // Pre-fill amount
        setPaymentDate(new Date().toISOString().slice(0, 16)); // Pre-fill current date and time
        setIsPayModalOpen(true);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        const formData = new FormData();
        formData.append('invoiceId', selectedInvoice.id);
        formData.append('amount', amount);
        formData.append('method', paymentMethod);
        formData.append('paymentDate', paymentDate);
        // Send user info for audit trail
        formData.append('user', user?.username || 'Unknown');
        if (proofFile) {
            formData.append('proof', proofFile);
        }

        try {
            const res = await fetch('/api/billing/pay', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            if (result.success) {
                alert('Payment Successful!');
                setIsPayModalOpen(false);
                fetchInvoices(); // Refresh list
            } else {
                alert('Payment Failed: ' + result.error);
            }
        } catch (error) {
            alert('Error submitting payment');
        }
    };

    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateServerId, setGenerateServerId] = useState('');
    const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
    const [generateYear, setGenerateYear] = useState(new Date().getFullYear());

    const monthNames = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const formatPeriod = (periodStr: string) => {
        if (!periodStr) return 'N/A';
        const [year, month] = periodStr.split('-');
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    };

    const handleGenerateClick = () => {
        setIsGenerateModalOpen(true);
    };

    const handleGenerateConfirm = async () => {
        setIsGenerateModalOpen(false); // Close first
        try {
            const res = await fetch('/api/billing/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId: generateServerId || undefined,
                    month: generateMonth,
                    year: generateYear
                })
            });
            const result = await res.json();
            alert(result.message);
            fetchInvoices();
        } catch (error) {
            alert('Failed to generate invoices');
        }
    };

    const handleEditClick = (invoice: any) => {
        setSelectedInvoice(invoice);
        setEditFormData({
            amount: invoice.amount,
            due_date: invoice.due_date,
            status: invoice.status
        });
        setIsEditModalOpen(true);
    };

    const handleViewHistory = async (invoice: any) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/billing/invoices/${invoice.id}/history`);
            const data = await res.json();
            setHistoryLogs(Array.isArray(data) ? data : []);
            setSelectedInvoice(invoice);
            setIsHistoryModalOpen(true);
        } catch (e) {
            console.error(e);
            alert('Failed to fetch history');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        try {
            const res = await fetch(`/api/billing/invoices/${selectedInvoice.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...editFormData, user: user || { username: 'Unknown' } })
            });
            const result = await res.json();
            if (result.success) {
                alert('Invoice updated successfully');
                setIsEditModalOpen(false);
                fetchInvoices();
            } else {
                alert('Update failed: ' + result.error);
            }
        } catch (e) {
            alert('Failed to update invoice');
        }
    };

    // Bulk Actions
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(invoices.map(inv => inv.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSet = new Set(selectedIds);
        if (checked) newSet.add(id);
        else newSet.delete(id);
        setSelectedIds(newSet);
    };

    const handleBulkAction = async (status: string) => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to mark ${selectedIds.size} invoices as ${status}?`)) return;

        try {
            const res = await fetch('/api/billing/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceIds: Array.from(selectedIds),
                    status,
                    user: user || { username: 'Unknown' }
                })
            });
            const result = await res.json();
            if (result.success) {
                // alert(result.message);
                fetchInvoices();
            } else {
                alert('Update failed: ' + result.error);
            }
        } catch (e) {
            alert('Failed to update invoices');
        }
    };

    const handleBulkBlock = async (actionType?: 'disable' | 'kick') => {
        if (selectedIds.size === 0) return;
        const actionLabel = actionType === 'disable' ? 'DISABLE PPP' : actionType === 'kick' ? 'KICK ACTIVE' : 'BLOCK';
        if (!confirm(`Are you sure you want to ${actionLabel} ${selectedIds.size} customers?`)) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/billing/bulk-block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceIds: Array.from(selectedIds),
                    user: user || { username: 'Unknown' },
                    actionType
                })
            });
            const result = await res.json();
            if (result.success) {
                alert(result.message + (result.errors ? `\n\nSome errors occurred:\n${result.errors.join('\n')}` : ''));
                fetchInvoices();
            } else {
                alert('Bulk block failed: ' + result.error);
            }
        } catch (e) {
            alert('Failed to execute bulk block');
        } finally {
            setIsLoading(false);
        }
    };

    const SkeletonRow = () => (
        <tr className="animate-pulse">
            {(user?.role === 'superadmin' || user?.role === 'admin') && <td className="px-4 py-4 w-[40px]"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto"></div></td>}
            <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
            <td className="px-6 py-4"><div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
            <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
            <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
            <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
            <td className="px-6 py-4"><div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded"></div></td>
            <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-full"></div></td>
            <td className="px-6 py-4"><div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded ml-auto"></div></td>
        </tr>
    );

    // Grouping Logic
    const groupedInvoices = useMemo(() => {
        if (!groupByServer) return null;
        const groups: Record<string, any[]> = {};
        invoices.forEach(inv => {
            let serverName = 'Unknown Server';
            if (activeTab === 'recap') {
                serverName = inv.Invoice?.Customer?.Server?.name || 'Unknown Server';
            } else {
                serverName = inv.Customer?.Server?.name || 'Unknown Server';
            }
            if (!groups[serverName]) groups[serverName] = [];
            groups[serverName].push(inv);
        });
        return groups;
    }, [invoices, groupByServer, activeTab]);


    const handleBulkDelete = async () => {
        if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) return;
        const itemName = activeTab === 'recap' ? 'payments' : 'invoices';
        if (!confirm(`Are you sure you want to delete ${selectedIds.size} ${itemName}? This cannot be undone.`)) return;

        try {
            const isRecap = activeTab === 'recap';
            const endpoint = isRecap ? '/api/billing/payments/bulk-delete' : '/api/billing/bulk-delete';
            const payload = isRecap
                ? { paymentIds: Array.from(selectedIds), user }
                : { invoiceIds: Array.from(selectedIds), user };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const result = await res.json();
                if (result.success) {
                    alert(result.message);
                    setSelectedIds(new Set());
                    fetchInvoices();
                } else {
                    alert('Bulk delete failed: ' + result.error);
                }
            } else {
                const text = await res.text();
                alert(`Server Error (${res.status}): API endpoint not found or server crash. Response: ${text.substring(0, 100)}`);
            }
        } catch (e: any) {
            alert('Failed to execute bulk delete: ' + e.message);
        }
    };

    const handleDeleteInvoice = async (invoice: any) => {
        if (!confirm(`Are you sure you want to delete invoice for ${invoice.Customer?.name}? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/billing/invoices/${invoice.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user })
            });
            const result = await res.json();
            if (result.success) {
                alert('Invoice deleted successfully');
                fetchInvoices();
            } else {
                alert('Delete failed: ' + result.error);
            }
        } catch (e) {
            alert('Failed to delete invoice');
        }
    };

    return (
        <div className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance & Billing</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage invoices and recurring payments</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setGroupByServer(!groupByServer)}
                        className={cn(
                            "px-4 py-2 border rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                            groupByServer
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        <Layers className="w-4 h-4" />
                        {groupByServer ? "Ungroup" : "Group by Server"}
                    </button>
                    <button
                        onClick={() => setShowNominal(!showNominal)}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                        title={showNominal ? "Hide Nominals" : "Show Nominals"}
                    >
                        {showNominal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showNominal ? "Hide" : "Show"}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchInvoices()} // quick refresh
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Refresh
                    </button>
                    <button
                        onClick={handleGenerateClick}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Generate Invoices
                    </button>
                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:max-w-xs">
                        <select
                            className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm appearance-none min-w-[150px] w-full"
                            value={filterServerId}
                            onChange={(e) => setFilterServerId(e.target.value)}
                        >
                            <option value="">All Servers</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>

                    <div className="relative flex-1 md:max-w-xs">
                        <select
                            className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm appearance-none min-w-[150px] w-full"
                            value={filterSubAreaId}
                            onChange={(e) => setFilterSubAreaId(e.target.value)}
                        >
                            <option value="">All Sub Areas</option>
                            {subAreas
                                .filter(sa => !filterServerId || sa.serverId === filterServerId)
                                .map(sa => (
                                    <option key={sa.id} value={sa.id}>{sa.name}</option>
                                ))
                            }
                        </select>
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>

                    <div className="relative flex-1 md:max-w-xs">
                        <input
                            type="text"
                            placeholder="Search customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>

                    {(activeTab === 'history' || activeTab === 'recap') && (
                        <div className="relative flex-1 md:max-w-xs">
                            <input
                                type="date"
                                value={filterPaymentDate}
                                onChange={(e) => setFilterPaymentDate(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm text-slate-600 dark:text-slate-400"
                                title="Filter by Payment Date"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <input
                        type="month"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                    />

                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                    >
                        <option value={10}>10 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {
                selectedIds.size > 0 && (user?.role === 'superadmin' || user?.role === 'admin') && (
                    <div className="mb-6 p-4 bg-slate-900 text-white rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 px-3 py-1 rounded-md text-sm font-medium">
                                {selectedIds.size} Selected
                            </div>
                            <span className="text-sm text-slate-300 border-l border-white/20 pl-3">
                                Bulk Actions:
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {activeTab !== 'recap' && (
                                <>
                                    <button onClick={() => handleBulkAction('PAID')} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" /> Paid
                                    </button>
                                    <button onClick={() => handleBulkAction('UNPAID')} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                        <X className="w-4 h-4" /> Unpaid
                                    </button>
                                    <button onClick={() => handleBulkAction('INVALID')} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                                        <Ban className="w-4 h-4" /> Invalid
                                    </button>
                                    {activeTab === 'unpaid' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleBulkBlock('disable')}
                                                disabled={isLoading}
                                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-slate-600 disabled:opacity-50"
                                            >
                                                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Ban className="w-4 h-4" />}
                                                Disable PPP
                                            </button>
                                            <button
                                                onClick={() => handleBulkBlock('kick')}
                                                disabled={isLoading}
                                                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-red-600 disabled:opacity-50"
                                            >
                                                {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Zap className="w-4 h-4" />}
                                                Kick Active
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-red-900 hover:bg-red-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-red-700">
                                <Trash2 className="w-4 h-4" /> Delete Selected
                            </button>
                        </div>
                    </div>
                )
            }

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 mb-6 overflow-x-auto pb-1">
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                        activeTab === 'analytics'
                            ? "border-primary text-primary"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                >
                    Overview & Analytics
                </button>
                <button
                    onClick={() => setActiveTab('unpaid')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                        activeTab === 'unpaid'
                            ? "border-primary text-primary"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                >
                    Unpaid Invoices
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'history'
                            ? "border-primary text-primary"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                >
                    Payment History
                </button>
                <button
                    onClick={() => setActiveTab('invalid')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'invalid'
                            ? "border-red-500 text-red-600"
                            : "border-transparent text-slate-500 hover:text-red-500"
                    )}
                >
                    Invalid / Cancelled
                </button>
                <button
                    onClick={() => setActiveTab('recap')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors ml-auto",
                        activeTab === 'recap'
                            ? "border-primary text-primary"
                            : "border-transparent text-slate-500 hover:text-slate-700"
                    )}
                >
                    Payment Recap
                </button>
            </div>

            {/* Content */}
            {activeTab === 'analytics' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {!analyticsData ? (
                        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            Loading analytics...
                        </div>
                    ) : analyticsData.error ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
                            <div className="text-red-500 bg-red-100 p-4 rounded-full">
                                <Ban className="w-8 h-8" />
                            </div>
                            <h3 className="font-semibold text-slate-900">Backend Not Updated</h3>
                            <p className="text-slate-500 text-sm max-w-md">
                                {analyticsData.error === 'API route not found'
                                    ? "Please restart the Node.js service on your server to apply the latest API routes."
                                    : analyticsData.error}
                            </p>
                        </div>
                    ) : !analyticsData.summary ? (
                        <div className="p-12 text-center text-red-500">Invalid analytics data received.</div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Total Revenue</div>
                                    <div className="text-3xl font-bold text-slate-900 dark:text-white">Rp {showNominal ? (analyticsData.summary.totalPaid || 0).toLocaleString('id-ID') : 'xxx'}</div>
                                    <div className="text-xs text-green-600 font-medium mt-2">Received from {analyticsData.summary.paidCount || 0} payments</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Unpaid Amount</div>
                                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">Rp {showNominal ? (analyticsData.summary.totalUnpaid || 0).toLocaleString('id-ID') : 'xxx'}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2">From {analyticsData.summary.unpaidCount || 0} customer invoices</div>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between col-span-1 lg:col-span-2">
                                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Collection Rate</div>
                                    <div className="flex items-end gap-3 mb-2">
                                        <div className="text-3xl font-bold text-primary">
                                            {analyticsData.summary.totalPaid + analyticsData.summary.totalUnpaid > 0
                                                ? Math.round((analyticsData.summary.totalPaid / (analyticsData.summary.totalPaid + analyticsData.summary.totalUnpaid)) * 100)
                                                : 0}%
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
                                        <div className="bg-primary h-full transition-all" style={{ width: `${analyticsData.summary.totalPaid + analyticsData.summary.totalUnpaid > 0 ? (analyticsData.summary.totalPaid / (analyticsData.summary.totalPaid + analyticsData.summary.totalUnpaid)) * 100 : 0}%` }}></div>
                                        <div className="bg-red-500 h-full transition-all" style={{ width: `${analyticsData.summary.totalPaid + analyticsData.summary.totalUnpaid > 0 ? (analyticsData.summary.totalUnpaid / (analyticsData.summary.totalPaid + analyticsData.summary.totalUnpaid)) * 100 : 0}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs mt-2 font-medium">
                                        <span className="text-primary">Paid: {analyticsData.summary.paidCount}</span>
                                        <span className="text-red-500">Unpaid: {analyticsData.summary.unpaidCount}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Revenue By Server */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Revenue by Server</h3>
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                        {analyticsData.revenueByServer.length === 0 ? (
                                            <div className="text-center text-slate-500 py-4 text-sm">No server data</div>
                                        ) : (
                                            analyticsData.revenueByServer.sort((a: any, b: any) => b.amount - a.amount).map((item: any, i: number) => {
                                                const maxAmount = Math.max(...analyticsData.revenueByServer.map((x: any) => x.amount));
                                                const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="space-y-1 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                                        onClick={() => setSelectedAnalyticsGroup({ title: `Server: ${item.name}`, invoices: item.invoices || [] })}
                                                    >
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                                                            <span className="font-semibold text-slate-900 dark:text-white">Rp {showNominal ? item.amount.toLocaleString('id-ID') : 'xxx'}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.count} Payments</div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Revenue By Payment Method */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Revenue by Payment Method</h3>
                                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                        {analyticsData.revenueByMethod.length === 0 ? (
                                            <div className="text-center text-slate-500 py-4 text-sm">No payment data</div>
                                        ) : (
                                            analyticsData.revenueByMethod.sort((a: any, b: any) => b.amount - a.amount).map((item: any, i: number) => {
                                                const maxAmount = Math.max(...analyticsData.revenueByMethod.map((x: any) => x.amount));
                                                const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                                                const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500'];
                                                const color = colors[i % colors.length];

                                                return (
                                                    <div
                                                        key={i}
                                                        className="space-y-1 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                                                        onClick={() => setSelectedAnalyticsGroup({ title: `Method: ${item.name ? (paymentMethodsList.find((m: any) => m.id.toLowerCase() === item.name.toLowerCase())?.name || item.name.replace('_', ' ')) : 'Unknown'}`, invoices: item.invoices || [] })}
                                                    >
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{item.name ? (paymentMethodsList.find((m: any) => m.id.toLowerCase() === item.name.toLowerCase())?.name || item.name.replace('_', ' ')) : '-'}</span>
                                                            <span className="font-semibold text-slate-900 dark:text-white">Rp {showNominal ? item.amount.toLocaleString('id-ID') : 'xxx'}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                                            <div className={`${color} h-full rounded-full`} style={{ width: `${percentage}%` }}></div>
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.count} Transactions</div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Anomaly Data */}
                                {analyticsData.anomalies && analyticsData.anomalies.length > 0 && (
                                    <div className="col-span-1 lg:col-span-2 mb-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-sm">
                                        <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5" /> Data Anomalies Detected ({analyticsData.anomalies.length})
                                        </h3>
                                        <div className="space-y-3">
                                            {analyticsData.anomalies.map((anom: any, idx: number) => (
                                                <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded border border-red-100 dark:border-red-900 flex justify-between items-center">
                                                    <div>
                                                        <div className="font-semibold text-slate-900 dark:text-white text-sm">
                                                            {anom.invoice.Customer?.name || anom.invoice.Customer?.mikrotik_name || 'Unknown'}
                                                            <span className="ml-2 font-normal text-slate-500 text-xs">({anom.invoice.Customer?.mikrotik_name})</span>
                                                            <span className="ml-2 text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded uppercase">{anom.type}</span>
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                                            {anom.invoice.Customer?.Server?.name || 'N/A'} • {anom.invoice.period} • By: <span className="text-blue-600 dark:text-blue-400">{anom.invoice.updatedBy || '-'}</span>
                                                        </div>
                                                        <div className="text-xs text-red-600 mt-1 font-medium">{anom.description}</div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleEditClick(anom.invoice)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors">Edit</button>
                                                        {(user?.role === 'superadmin' || user?.role === 'admin') && (
                                                            <button onClick={() => handleDeleteInvoice(anom.invoice)} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors">Delete</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Daily Revenue Trend */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1 lg:col-span-2">
                                    <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Daily Revenue Trend</h3>
                                    <div className="h-[200px] flex items-end gap-2 w-full pt-4">
                                        {analyticsData.dailyRevenue.length === 0 ? (
                                            <div className="w-full text-center text-slate-500 self-center text-sm">No transactions in this period</div>
                                        ) : (
                                            (() => {
                                                const maxDaily = Math.max(...analyticsData.dailyRevenue.map((d: any) => d.amount));
                                                return analyticsData.dailyRevenue.map((day: any, i: number) => {
                                                    const height = maxDaily > 0 ? (day.amount / maxDaily) * 100 : 0;
                                                    const dateShort = new Date(day.date).getDate();
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col justify-end items-center group relative min-w-[10px]">
                                                            {/* Tooltip on hover */}
                                                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                                                                {day.date}: Rp {showNominal ? day.amount.toLocaleString('id-ID') : 'xxx'}
                                                            </div>
                                                            <div
                                                                className="w-full bg-primary/80 hover:bg-primary transition-all rounded-t-sm"
                                                                style={{ height: `${height}%`, minHeight: '4px' }}
                                                            ></div>
                                                            <div className="text-[10px] text-slate-400 mt-1 truncate max-w-full">{dateShort}</div>
                                                        </div>
                                                    );
                                                });
                                            })()
                                        )}
                                    </div>
                                </div>

                                {/* Monthly Revenue Trend */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1 lg:col-span-2">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                        <h3 className="font-semibold text-slate-900 dark:text-white">Monthly Revenue Trend</h3>
                                        <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" className="rounded border-slate-300 text-blue-500 focus:ring-blue-500 w-4 h-4" checked={monthlyStatusFilters.PAID} onChange={(e) => setMonthlyStatusFilters(p => ({ ...p, PAID: e.target.checked }))} />
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">Paid</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" className="rounded border-slate-300 text-red-500 focus:ring-red-500 w-4 h-4" checked={monthlyStatusFilters.UNPAID} onChange={(e) => setMonthlyStatusFilters(p => ({ ...p, UNPAID: e.target.checked }))} />
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">Unpaid</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" className="rounded border-slate-300 text-slate-500 focus:ring-slate-500 w-4 h-4" checked={monthlyStatusFilters.CANCELLED} onChange={(e) => setMonthlyStatusFilters(p => ({ ...p, CANCELLED: e.target.checked }))} />
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">Cancel</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="checkbox" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4" checked={monthlyStatusFilters.INVALID} onChange={(e) => setMonthlyStatusFilters(p => ({ ...p, INVALID: e.target.checked }))} />
                                                <span className="text-slate-600 dark:text-slate-300 font-medium">Invalid</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="h-[250px] flex items-end gap-4 w-full pt-4 pb-2">
                                        {!analyticsData.monthlyTrend || analyticsData.monthlyTrend.length === 0 ? (
                                            <div className="w-full text-center text-slate-500 self-center text-sm">No monthly data available</div>
                                        ) : (
                                            (() => {
                                                const maxTotal = Math.max(...analyticsData.monthlyTrend.map((m: any) => {
                                                    let total = 0;
                                                    if (monthlyStatusFilters.PAID) total += m.PAID;
                                                    if (monthlyStatusFilters.UNPAID) total += m.UNPAID;
                                                    if (monthlyStatusFilters.CANCELLED) total += m.CANCELLED;
                                                    if (monthlyStatusFilters.INVALID) total += m.INVALID;
                                                    return total;
                                                }));

                                                return analyticsData.monthlyTrend.map((month: any, i: number) => {
                                                    const paidH = maxTotal > 0 ? (month.PAID / maxTotal) * 100 : 0;
                                                    const unpaidH = maxTotal > 0 ? (month.UNPAID / maxTotal) * 100 : 0;
                                                    const cancelledH = maxTotal > 0 ? (month.CANCELLED / maxTotal) * 100 : 0;
                                                    const invalidH = maxTotal > 0 ? (month.INVALID / maxTotal) * 100 : 0;

                                                    const totalH = paidH + unpaidH + cancelledH + invalidH;
                                                    // Only render bar if totalH > 0 to prevent 0-height bars from rendering if no filters match

                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col justify-end items-center group relative min-w-[20px] h-full">
                                                            {/* Tooltip on hover */}
                                                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs py-2 px-3 rounded whitespace-nowrap z-10 pointer-events-none flex flex-col gap-1 shadow-lg">
                                                                <div className="font-bold border-b border-slate-600 pb-1 mb-1">{formatPeriod(month.period)}</div>
                                                                {monthlyStatusFilters.PAID && month.PAID > 0 && <div className="flex justify-between gap-4"><span className="text-blue-300">Paid:</span> <span>Rp {showNominal ? month.PAID.toLocaleString('id-ID') : 'xxx'}</span></div>}
                                                                {monthlyStatusFilters.UNPAID && month.UNPAID > 0 && <div className="flex justify-between gap-4"><span className="text-red-300">Unpaid:</span> <span>Rp {showNominal ? month.UNPAID.toLocaleString('id-ID') : 'xxx'}</span></div>}
                                                                {monthlyStatusFilters.CANCELLED && month.CANCELLED > 0 && <div className="flex justify-between gap-4"><span className="text-slate-300">Cancel:</span> <span>Rp {showNominal ? month.CANCELLED.toLocaleString('id-ID') : 'xxx'}</span></div>}
                                                                {monthlyStatusFilters.INVALID && month.INVALID > 0 && <div className="flex justify-between gap-4"><span className="text-orange-300">Invalid:</span> <span>Rp {showNominal ? month.INVALID.toLocaleString('id-ID') : 'xxx'}</span></div>}
                                                            </div>
                                                            <div className="w-full flex flex-col justify-end h-full">
                                                                {totalH > 0 && (
                                                                    <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden relative" style={{ height: `${totalH}%`, minHeight: '4px' }}>
                                                                        {monthlyStatusFilters.INVALID && invalidH > 0 && <div className="w-full bg-orange-400 transition-all border-b border-white/20" style={{ height: `${(invalidH / totalH) * 100}%` }}></div>}
                                                                        {monthlyStatusFilters.CANCELLED && cancelledH > 0 && <div className="w-full bg-slate-400 transition-all border-b border-white/20" style={{ height: `${(cancelledH / totalH) * 100}%` }}></div>}
                                                                        {monthlyStatusFilters.UNPAID && unpaidH > 0 && <div className="w-full bg-red-500 transition-all border-b border-white/20" style={{ height: `${(unpaidH / totalH) * 100}%` }}></div>}
                                                                        {monthlyStatusFilters.PAID && paidH > 0 && <div className="w-full bg-blue-500 transition-all" style={{ height: `${(paidH / totalH) * 100}%` }}></div>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="text-xs font-medium text-slate-500 mt-3 truncate max-w-full">
                                                                {month.period.slice(5, 7)}/{month.period.slice(2, 4)}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        {activeTab === 'recap' ? (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        {(user?.role === 'superadmin' || user?.role === 'admin') && (
                                            <th className="px-4 py-4 w-[40px]">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300"
                                                    checked={invoices.length > 0 && selectedIds.size === invoices.length}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('transaction_date')}>
                                            <div className="flex items-center gap-2">
                                                Payment Date
                                                {sortConfig?.key === 'transaction_date' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('username')}>
                                            <div className="flex items-center gap-2">
                                                Username
                                                {sortConfig?.key === 'username' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('customer_name')}>
                                            <div className="flex items-center gap-2">
                                                Customer
                                                {sortConfig?.key === 'customer_name' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('profile')}>
                                            <div className="flex items-center gap-2">
                                                Daya
                                                {sortConfig?.key === 'profile' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('period')}>
                                            <div className="flex items-center gap-2">
                                                Invoice Period
                                                {sortConfig?.key === 'period' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                Sub Area
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('method')}>
                                            <div className="flex items-center gap-2">
                                                Method
                                                {sortConfig?.key === 'method' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right" onClick={() => requestSort('amount')}>
                                            <div className="flex items-center justify-end gap-2">
                                                Amount
                                                {sortConfig?.key === 'amount' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                No payments found for this criteria.
                                            </td>
                                        </tr>
                                    ) : groupByServer && groupedInvoices ? (
                                        Object.entries(groupedInvoices).map(([serverName, groupInvoices]) => (
                                            <React.Fragment key={`group-${serverName}`}>
                                                <tr className="bg-slate-50/80 dark:bg-slate-900/30">
                                                    <td colSpan={10} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-y border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <Layers className="w-3.5 h-3.5" />
                                                            {serverName} <span className="text-slate-400 font-normal">({groupInvoices.length} payments)</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {groupInvoices.map(payment => (
                                                    <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        {(user?.role === 'superadmin' || user?.role === 'admin') && (
                                                            <td className="px-4 py-4 w-[40px]">
                                                                <input
                                                                    type="checkbox"
                                                                    className="rounded border-slate-300"
                                                                    checked={selectedIds.has(payment.id)}
                                                                    onChange={(e) => handleSelectOne(payment.id, e.target.checked)}
                                                                />
                                                            </td>
                                                        )}
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                            {new Date(payment.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                            {payment.Invoice?.Customer?.mikrotik_name || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                            {payment.Invoice?.Customer?.name || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                            {payment.Invoice?.Customer?.profile || '-'}
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                            {formatPeriod(payment.Invoice?.period)}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase">
                                                                {subAreas?.find(sa => sa.id === payment.Invoice?.Customer?.sub_area_id)?.name || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 uppercase">
                                                                {payment.method ? (paymentMethodsList.find((m: any) => m.id.toLowerCase() === payment.method.toLowerCase())?.name || payment.method) : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white text-right">
                                                            Rp {showNominal ? Number(payment.amount).toLocaleString('id-ID') : 'xxx'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        invoices.map(payment => (
                                            <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                {(user?.role === 'superadmin' || user?.role === 'admin') && (
                                                    <td className="px-4 py-4 w-[40px]">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-slate-300"
                                                            checked={selectedIds.has(payment.id)}
                                                            onChange={(e) => handleSelectOne(payment.id, e.target.checked)}
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {new Date(payment.transaction_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                    {payment.Invoice?.Customer?.mikrotik_name || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {payment.Invoice?.Customer?.name || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {payment.Invoice?.Customer?.profile || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                                    {formatPeriod(payment.Invoice?.period)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase">
                                                        {subAreas?.find(sa => sa.id === payment.Invoice?.Customer?.sub_area_id)?.name || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 uppercase">
                                                        {payment.method ? (paymentMethodsList.find((m: any) => m.id.toLowerCase() === payment.method.toLowerCase())?.name || payment.method) : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white text-right">
                                                    Rp {showNominal ? Number(payment.amount).toLocaleString('id-ID') : 'xxx'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        {(user?.role === 'superadmin' || user?.role === 'admin') && (
                                            <th className="px-4 py-4 w-[40px]">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300"
                                                    checked={invoices.length > 0 && selectedIds.size === invoices.length}
                                                    onChange={handleSelectAll}
                                                />
                                            </th>
                                        )}
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('username')}>
                                            <div className="flex items-center gap-2">
                                                Username
                                                {sortConfig?.key === 'username' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('customer_name')}>
                                            <div className="flex items-center gap-2">
                                                Customer
                                                {sortConfig?.key === 'customer_name' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                Real Name
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('profile')}>
                                            <div className="flex items-center gap-2">
                                                Daya
                                                {sortConfig?.key === 'profile' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('period')}>
                                            <div className="flex items-center gap-2">
                                                Period
                                                {sortConfig?.key === 'period' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                Sub Area
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                Server
                                            </div>
                                        </th>
                                        {activeTab === 'history' && (
                                            <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                                <div className="flex items-center gap-2">
                                                    Payment Date
                                                </div>
                                            </th>
                                        )}
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('amount')}>
                                            <div className="flex items-center gap-2">
                                                Amount
                                                {sortConfig?.key === 'amount' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => requestSort('status')}>
                                            <div className="flex items-center gap-2">
                                                Status
                                                {sortConfig?.key === 'status' && (
                                                    <ArrowUpDown className={cn("w-3 h-3 text-slate-400", sortConfig.direction === 'asc' ? "rotate-0" : "rotate-180")} />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {isLoading ? (
                                        <>
                                            {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
                                        </>
                                    ) : invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={12} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                No invoices found for this category.
                                            </td>
                                        </tr>
                                    ) : groupByServer && groupedInvoices ? (
                                        Object.entries(groupedInvoices).map(([serverName, groupInvoices]) => (
                                            <React.Fragment key={`group-${serverName}`}>
                                                <tr className="bg-slate-50/80 dark:bg-slate-900/30">
                                                    <td colSpan={12} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-y border-slate-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-2">
                                                            <Layers className="w-3.5 h-3.5" />
                                                            {serverName} <span className="text-slate-400 font-normal">({groupInvoices.length} invoices)</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {groupInvoices.map(inv => (
                                                    <InvoiceRow
                                                        key={inv.id}
                                                        invoice={inv}
                                                        petugasName={user?.name || ''}
                                                        formattedPeriod={formatPeriod(inv.period)}
                                                        selected={selectedIds.has(inv.id)}
                                                        onSelect={(c) => handleSelectOne(inv.id, c)}
                                                        onPay={() => handlePayClick(inv)}
                                                        onEdit={() => handleEditClick(inv)}
                                                        onViewHistory={() => handleViewHistory(inv)}
                                                        onDelete={user?.role === 'superadmin' ? () => handleDeleteInvoice(inv) : undefined}
                                                        isSuperAdmin={user?.role === 'superadmin' || user?.role === 'admin'}
                                                        subAreas={subAreas}
                                                        showNominal={showNominal}
                                                        showPaymentDate={activeTab === 'history'}
                                                    />
                                                ))}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        invoices.map((inv) => (
                                            <InvoiceRow
                                                key={inv.id}
                                                invoice={inv}
                                                petugasName={user?.name || ''}
                                                formattedPeriod={formatPeriod(inv.period)}
                                                selected={selectedIds.has(inv.id)}
                                                onSelect={(c) => handleSelectOne(inv.id, c)}
                                                onPay={() => handlePayClick(inv)}
                                                onEdit={() => handleEditClick(inv)}
                                                onViewHistory={() => handleViewHistory(inv)}
                                                onDelete={user?.role === 'superadmin' ? () => handleDeleteInvoice(inv) : undefined}
                                                isSuperAdmin={user?.role === 'superadmin' || user?.role === 'admin'}
                                                subAreas={subAreas}
                                                showNominal={showNominal}
                                                showPaymentDate={activeTab === 'history'}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}v

            {/* Pagination (Hide for Analytics) */}
            {activeTab !== 'analytics' && (
                <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-500">
                            Page <span className="font-medium text-slate-900 dark:text-white">{page}</span> of <span className="font-medium text-slate-900 dark:text-white">{totalPages}</span>
                        </div>
                        <select
                            value={limit}
                            onChange={(e) => setLimit(Number(e.target.value))}
                            className="px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                            <option value={10000}>All</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || isLoading}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || isLoading}
                            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {
                isPayModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Process Payment</h3>
                                <button onClick={() => setIsPayModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Customer
                                    </label>
                                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 text-sm">
                                        {selectedInvoice?.Customer?.name || selectedInvoice?.Customer?.mikrotik_name}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Amount to Pay
                                    </label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Payment Date
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={paymentDate}
                                        onChange={(e) => setPaymentDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        {paymentMethodsList.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.type.replace('_', ' ')})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Proof of Payment (Optional)
                                    </label>
                                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex flex-col items-center gap-1">
                                            <Upload className="w-5 h-5 text-slate-400" />
                                            <span className="text-xs text-slate-500">
                                                {proofFile ? proofFile.name : "Click to upload photo"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Confirm Payment
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit Invoice Modal */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Edit Invoice</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amount (Rp)</label>
                                    <input
                                        type="number"
                                        value={editFormData.amount}
                                        onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={editFormData.due_date}
                                        onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        value={editFormData.status}
                                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="UNPAID">UNPAID</option>
                                        <option value="PAID">PAID</option>
                                        <option value="INVALID">INVALID</option>
                                        <option value="CANCELLED">CANCELLED</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* History Modal */}
            {
                isHistoryModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                    <History className="w-5 h-5" /> Invoice History
                                </h3>
                                <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-0 overflow-y-auto flex-1">
                                {historyLogs.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">No history available for this invoice.</div>
                                ) : (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 font-medium text-slate-500">Timestamp</th>
                                                <th className="px-4 py-2 font-medium text-slate-500">User</th>
                                                <th className="px-4 py-2 font-medium text-slate-500">Action</th>
                                                <th className="px-4 py-2 font-medium text-slate-500">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {historyLogs.map((log) => (
                                                <tr key={log.id}>
                                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                                        {new Date(log.timestamp).toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                        {log.user_name}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                        {log.details}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Generate Invoices Modal */}
            {
                isGenerateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Generate Invoices</h3>
                                <button onClick={() => setIsGenerateModalOpen(false)} className="text-slate-500 hover:text-slate-700">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Select which server and period you want to generate invoices for. This will generate UNPAID invoices for active customers.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Target Server
                                    </label>
                                    <select
                                        value={generateServerId}
                                        onChange={(e) => setGenerateServerId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    >
                                        <option value="">All Servers</option>
                                        {servers.map(srv => (
                                            <option key={srv.id} value={srv.id}>{srv.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Bulan
                                        </label>
                                        <select
                                            value={generateMonth}
                                            onChange={(e) => setGenerateMonth(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        >
                                            {monthNames.map((name, i) => (
                                                <option key={i} value={i + 1}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Tahun
                                        </label>
                                        <select
                                            value={generateYear}
                                            onChange={(e) => setGenerateYear(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        >
                                            {[...Array(3)].map((_, i) => {
                                                const y = new Date().getFullYear() - 1 + i;
                                                return <option key={y} value={y}>{y}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerateConfirm}
                                    className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Start Generation
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Analytics List Modal */}
            {selectedAnalyticsGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {selectedAnalyticsGroup.title} ({selectedAnalyticsGroup.invoices.length})
                            </h3>
                            <button onClick={() => setSelectedAnalyticsGroup(null)} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {selectedAnalyticsGroup.invoices.length === 0 ? (
                                <p className="text-center text-slate-500">No invoices found.</p>
                            ) : (
                                <div className="space-y-3">
                                    {selectedAnalyticsGroup.invoices.map((inv: any) => (
                                        <div key={inv.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white dark:bg-slate-800">
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    {inv.Customer?.name || inv.Customer?.mikrotik_name || 'Unknown'}
                                                    <span className="ml-2 font-normal text-slate-500 text-xs">({inv.Customer?.mikrotik_name})</span>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {inv.Customer?.comment || '-'}
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                                                    <span className="font-medium text-slate-700 dark:text-slate-300">Rp {showNominal ? Number(inv.amount).toLocaleString('id-ID') : 'xxx'}</span>
                                                    <span>Period: {inv.period}</span>
                                                    <span>Due: {inv.due_date}</span>
                                                    <span>By: <span className="text-blue-600 dark:text-blue-400 font-medium">{inv.updatedBy || '-'}</span></span>
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                                        inv.status === 'PAID' ? "bg-green-100 text-green-700" : inv.status === 'INVALID' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                                    )}>{inv.status}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => { setSelectedAnalyticsGroup(null); handleEditClick(inv); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors">Edit</button>
                                                {user?.role === 'superadmin' && (
                                                    <button onClick={() => {
                                                        handleDeleteInvoice(inv);
                                                        setSelectedAnalyticsGroup(prev => prev ? { ...prev, invoices: prev.invoices.filter(i => i.id !== inv.id) } : null);
                                                    }} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-medium transition-colors flex items-center gap-1">
                                                        <Trash2 className="w-4 h-4" /> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

function InvoiceRow({ invoice, petugasName, formattedPeriod, selected, onSelect, onPay, onEdit, onViewHistory, onDelete, isSuperAdmin, subAreas, showNominal, showPaymentDate }: { invoice: any, petugasName: string, formattedPeriod: string, selected: boolean, onSelect: (c: boolean) => void, onPay: () => void, onEdit: () => void, onViewHistory: () => void, onDelete?: () => void, isSuperAdmin?: boolean, subAreas?: any[], showNominal: boolean, showPaymentDate?: boolean }) {

    return (
        <tr className={cn("hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors", selected && "bg-blue-50/50 dark:bg-blue-900/10")}>
            {isSuperAdmin && (
                <td className="px-4 py-4 w-[40px]">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={selected}
                        onChange={(e) => onSelect(e.target.checked)}
                    />
                </td>
            )}
            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                {/* Username = PPP Secret: name */}
                {invoice.Customer?.mikrotik_name || 'N/A'}
                {invoice.status === 'INVALID' && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">INVALID</span>}
            </td>
            <td className="px-6 py-4">
                <div className="font-medium text-slate-700 dark:text-slate-200">
                    {/* Customer = PPP Secret: comment */}
                    {invoice.Customer?.comment || '-'}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="text-slate-600 dark:text-slate-400">
                    {/* Real Name = data dari database Customer di aplikasi */}
                    {invoice.Customer?.real_name || '-'}
                </div>
            </td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                {invoice.Customer?.profile || '-'}
            </td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                {formattedPeriod}
            </td>
            <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 uppercase">
                    {subAreas?.find(sa => sa.id === invoice.Customer?.sub_area_id)?.name || '-'}
                </span>
            </td>
            <td className="px-6 py-4">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {invoice.Customer?.Server?.name || '-'}
                </span>
            </td>
            {showPaymentDate && (
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 text-sm">
                    {invoice.Payments?.[0]?.transaction_date
                        ? new Date(invoice.Payments[0].transaction_date).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '-'}
                </td>
            )}
            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                Rp {showNominal ? Number(invoice.amount).toLocaleString('id-ID') : 'xxx'}
            </td>
            <td className="px-6 py-4">
                <span className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border",
                    invoice.status === 'PAID'
                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20"
                        : invoice.status === 'INVALID'
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                )}>
                    {invoice.status}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => window.open(`/api/billing/invoices/${invoice.id}/pdf`, '_blank')}
                        title="Download PDF"
                        className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => window.open(`/api/billing/invoices/${invoice.id}/thermal?petugas=${encodeURIComponent(petugasName)}`, '_blank', 'width=400,height=600')}
                        title="Print Thermal"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onViewHistory}
                        title="View History"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                        <History className="w-4 h-4" />
                    </button>

                    <button
                        onClick={onEdit}
                        title="Edit Invoice"
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                    </button>

                    {invoice.status === 'UNPAID' && (
                        <button
                            onClick={onPay}
                            className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                        >
                            Pay Now
                        </button>
                    )}
                </div>
                {onDelete && (
                    <div className="mt-1 flex justify-end">
                        <button
                            onClick={onDelete}
                            title="Delete Invoice"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                            <span className="text-xs font-medium">Delete</span>
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
}
