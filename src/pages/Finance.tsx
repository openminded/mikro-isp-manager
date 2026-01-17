import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Download, CheckCircle, Upload, X, Filter, Layers, Ban, History, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data for dev (replace with API calls later)
// actually let's try to fetch if we can, but likely need to build API helpers in frontend first.
// For now, I will write the component to fetch from the new /api/billing endpoints.

export function Finance() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'unpaid' | 'history' | 'invalid'>('unpaid');
    const [invoices, setInvoices] = useState<any[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [editFormData, setEditFormData] = useState({ amount: '', due_date: '', status: '' });

    // Grouping & Selection
    const [groupByServer, setGroupByServer] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Payment Form State
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [amount, setAmount] = useState('');
    const [paymentMethodsList, setPaymentMethodsList] = useState<any[]>([]);

    // Search, Filter, Pagination
    const [search, setSearch] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // Default current month
    const [filterServerId, setFilterServerId] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [servers, setServers] = useState<any[]>([]);

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
    }, [search, period, filterServerId, activeTab, limit]);

    useEffect(() => {
        // Fetch when page changes (skip initial redundant fetch)
        fetchInvoices(page);
    }, [page]);

    // Initial load
    useEffect(() => {
        fetchPaymentMethods();
        fetchServers();
    }, []);

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

    const handlePayClick = (invoice: any) => {
        setSelectedInvoice(invoice);
        setAmount(invoice.amount); // Pre-fill amount
        setIsPayModalOpen(true);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInvoice) return;

        const formData = new FormData();
        formData.append('invoiceId', selectedInvoice.id);
        formData.append('amount', amount);
        formData.append('method', paymentMethod);
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

    const handleGenerate = async () => {
        if (!confirm('Generate invoices for all active customers for this month?')) return;
        try {
            const res = await fetch('/api/billing/generate', { method: 'POST' });
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

    // Grouping Logic
    const groupedInvoices = useMemo(() => {
        if (!groupByServer) return null;
        const groups: Record<string, any[]> = {};
        invoices.forEach(inv => {
            // Customer might be null if deleted, handle gracefully
            const serverName = inv.Customer?.Server?.name || 'Unknown Server';
            if (!groups[serverName]) groups[serverName] = [];
            groups[serverName].push(inv);
        });
        return groups;
    }, [invoices, groupByServer]);


    return (
        <div className="p-8 max-w-7xl mx-auto">
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
                        onClick={() => fetchInvoices()} // quick refresh
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        Refresh
                    </button>
                    <button
                        onClick={handleGenerate}
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

            {/* Filter Bar */}


            {/* Filter Bar */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:max-w-xs">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        />
                    </div>
                    <input
                        type="month"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                    />
                    <select
                        value={filterServerId}
                        onChange={(e) => setFilterServerId(e.target.value)}
                        className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                    >
                        <option value="">All Servers</option>
                        {servers.map(srv => (
                            <option key={srv.id} value={srv.id}>{srv.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
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
                        <button onClick={() => handleBulkAction('PAID')} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Paid
                        </button>
                        <button onClick={() => handleBulkAction('UNPAID')} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <X className="w-4 h-4" /> Unpaid
                        </button>
                        <button onClick={() => handleBulkAction('INVALID')} className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <Ban className="w-4 h-4" /> Invalid
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 mb-6">
                <button
                    onClick={() => setActiveTab('unpaid')}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
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
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-4 w-[40px]">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300"
                                        checked={invoices.length > 0 && selectedIds.size === invoices.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Customer</th>
                                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Period</th>
                                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Due Date</th>
                                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Amount</th>
                                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white">Status</th>
                                <th className="px-6 py-4 font-semibold text-slate-900 dark:text-white text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                        No invoices found for this category.
                                    </td>
                                </tr>
                            ) : groupByServer && groupedInvoices ? (
                                Object.entries(groupedInvoices).map(([serverName, groupInvoices]) => (
                                    <>
                                        <tr key={`group-${serverName}`} className="bg-slate-50/80 dark:bg-slate-900/30">
                                            <td colSpan={7} className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider border-y border-slate-100 dark:border-slate-800">
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
                                                selected={selectedIds.has(inv.id)}
                                                onSelect={(c) => handleSelectOne(inv.id, c)}
                                                onPay={() => handlePayClick(inv)}
                                                onEdit={() => handleEditClick(inv)}
                                                onViewHistory={() => handleViewHistory(inv)}
                                            />
                                        ))}
                                    </>
                                ))
                            ) : (
                                invoices.map((inv) => (
                                    <InvoiceRow
                                        key={inv.id}
                                        invoice={inv}
                                        selected={selectedIds.has(inv.id)}
                                        onSelect={(c) => handleSelectOne(inv.id, c)}
                                        onPay={() => handlePayClick(inv)}
                                        onEdit={() => handleEditClick(inv)}
                                        onViewHistory={() => handleViewHistory(inv)}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>



            {/* Pagination */}
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
            {isEditModalOpen && (
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
            )}
            {/* History Modal */}
            {isHistoryModalOpen && (
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
            )}
        </div >
    );
}

function InvoiceRow({ invoice, selected, onSelect, onPay, onEdit, onViewHistory }: { invoice: any, selected: boolean, onSelect: (c: boolean) => void, onPay: () => void, onEdit: () => void, onViewHistory: () => void }) {
    return (
        <tr className={cn("hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors", selected && "bg-blue-50/50 dark:bg-blue-900/10")}>
            <td className="px-4 py-4">
                <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={selected}
                    onChange={(e) => onSelect(e.target.checked)}
                />
            </td>
            <td className="px-6 py-4">
                <div className="font-medium text-slate-900 dark:text-white">
                    {invoice.Customer?.name || invoice.Customer?.mikrotik_name || 'Unknown'}
                    {invoice.status === 'INVALID' && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">INVALID</span>}
                </div>
                <div className="text-xs text-slate-500">{invoice.Customer?.mikrotik_name}</div>
            </td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                {invoice.period}
            </td>
            <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                {invoice.due_date}
            </td>
            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                Rp {Number(invoice.amount).toLocaleString('id-ID')}
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
            </td>
        </tr>
    );
}
