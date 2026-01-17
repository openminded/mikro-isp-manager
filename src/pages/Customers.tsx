import { useState, useEffect } from 'react';
import axios from 'axios';
import { useServers, type MikrotikServer } from '@/context/ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';
import { useData } from '@/context/DataContext';
import { type Customer } from '@/types';
import { Search, Plus, AlertCircle, RefreshCw, CheckCircle2, Pencil, Lock, Unlock, Save, ChevronLeft, ChevronRight, DownloadCloud } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';

export function Customers() {
    const { servers } = useServers();
    const { customers, refreshCustomers } = useData();
    // ...
    // const cleanPhone = data.whatsapp.replace(/\D/g, '');
    // const [customers, setCustomers] = useState<Customer[]>([]); // Removed local state
    // const [loading, setLoading] = useState(false); // Removed local state
    const [filter, setFilter] = useState('');
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
    const [serverFilter, setServerFilter] = useState<string>('all');
    const [profileFilter, setProfileFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Customer | 'serverName' | 'comment' | 'activationDate', direction: 'asc' | 'desc' } | null>(null);
    const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const [syncLoading, setSyncLoading] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

    // ... (rest of helper functions)

    const handleSync = async () => {
        if (!confirm('This will fetch live data from all routers and update the local cache. Continue?')) return;

        setSyncLoading(true);
        setSyncStatus(null);
        try {
            await Promise.all(servers.map(server => MikrotikApi.syncSecrets(server)));
            setSyncStatus({ type: 'success', message: 'Data synced successfully' });
            refreshCustomers(true); // Re-read from cache (forced)
        } catch (error) {
            console.error(error);
            setSyncStatus({ type: 'error', message: 'Failed to sync data from some routers' });
        } finally {
            setSyncLoading(false);
            setTimeout(() => setSyncStatus(null), 3000);
        }
    };

    // Calculate unique profiles based on current server filter
    const uniqueProfiles = Array.from(new Set(
        customers
            .filter(c => serverFilter === 'all' || c.serverId === serverFilter)
            .map(c => c.profile)
    )).sort();

    // Rest of useEffects...

    // Combined Filter & Sort Logic
    const filteredAndSortedCustomers = customers
        .filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(filter.toLowerCase()) ||
                (c.comment || '').toLowerCase().includes(filter.toLowerCase()) ||
                c.serverName.toLowerCase().includes(filter.toLowerCase());

            const matchesStatus = statusFilter === 'all'
                ? true
                : statusFilter === 'active' ? !c.disabled : c.disabled;

            const matchesServer = serverFilter === 'all' ? true : c.serverId === serverFilter;

            const matchesProfile = profileFilter === 'all' ? true : c.profile === profileFilter;

            return matchesSearch && matchesStatus && matchesServer && matchesProfile;
        })
        .sort((a, b) => {
            // ... existing sort logic
            if (!sortConfig) return 0;
            const { key, direction } = sortConfig;

            let aValue: any = a[key as keyof Customer];
            let bValue: any = b[key as keyof Customer];

            // Handle specific keys if needed, e.g., if undefined
            if (aValue === undefined) aValue = '';
            if (bValue === undefined) bValue = '';

            if (typeof aValue === 'string') {
                return direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            // Boolean comparison
            if (typeof aValue === 'boolean') {
                if (aValue === bValue) return 0;
                return direction === 'asc'
                    ? (aValue ? 1 : -1) // true comes after false
                    : (aValue ? -1 : 1); // true comes before false
            }

            // Fallback for other types (numbers, etc.)
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });

    // Reset pagination when filters change (including profileFilter)
    // Initial Load - handled by context mostly, but we trigger refresh checks
    useEffect(() => {
        refreshCustomers(false);
    }, []);

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingCustomer(null);
        setIsModalOpen(true);
    };

    const handleSave = async (data: any, targetServerId: string, saveMode: 'server' | 'app') => {
        setSaving(true);
        try {
            const server = servers.find(s => s.id === targetServerId);
            if (!server) throw new Error("Target server not found");

            if (saveMode === 'server') {
                // SERVER SIDE: Mikrotik Update
                const mikrotikPayload = {
                    name: data.name,
                    password: data.password,
                    profile: data.profile,
                    comment: data.comment,
                    "remote-address": data["remote-address"],
                };

                if (editingCustomer) {
                    await MikrotikApi.updatePPPSecret(server, editingCustomer.id, mikrotikPayload);
                } else {
                    await MikrotikApi.addPPPSecret(server, mikrotikPayload);
                }

                // Sync cache immediately to reflect changes
                await MikrotikApi.syncSecrets(server);
                setSyncStatus({ type: 'success', message: editingCustomer ? "Mikrotik Secret updated successfully." : "Mikrotik Secret created successfully." });

            } else {
                // APP SIDE: Local Data Update Only (No Mikrotik Connection)
                if (!editingCustomer) throw new Error("Cannot create new customer in App mode. Please create in Server mode first.");

                // Use the new endpoint to update SQL and JSON metadata directly
                await axios.put(`/api/customers/${editingCustomer.id}`, {
                    serverId: targetServerId, // Required for backend lookup
                    name: data.name, // Keep consistency if needed, but mainly realName below
                    realName: data.realName,
                    whatsapp: data.whatsapp,
                    address: data.address, // mapping needed if used
                    sub_area_id: data.sub_area_id,
                    coordinates: `${data.lat},${data.long}`,
                    ktp: data.ktp,
                    activationDate: data.activationDate,
                    photos: data.photos
                });

                // Also Handle Registration Real Name Update if needed (Legacy Support)
                if (data.realName && editingCustomer.registrationId) {
                    try {
                        await axios.put(`/api/registrations/${editingCustomer.registrationId}`, {
                            fullName: data.realName
                        });
                    } catch (e) { console.error("Failed to update registration name", e); }
                }

                setSyncStatus({ type: 'success', message: "App Data updated successfully (Saved to DB)." });
            }

            setIsModalOpen(false);
            refreshCustomers(true); // Forcing refresh
        } catch (e: any) {
            console.error(e);
            // [DEBUG] Alert the user on error so they know why it failed
            alert(`Failed to save: ${e.response?.data?.error || e.message}`);
            setSyncStatus({ type: 'error', message: `Operation failed: ${e.message}` });
        } finally {
            setSaving(false);
        }
    };

    const toggleCustomer = async (customer: Customer) => {
        const server = servers.find(s => s.id === customer.serverId);
        if (!server) return;

        try {
            const newDisabledState = !customer.disabled;
            await MikrotikApi.togglePPPSecret(server, customer.id, newDisabledState);

            // If blocking, also remove active session to kick the user
            if (newDisabledState) {
                await MikrotikApi.removeActivePppSession(server, customer.name);
                setSyncStatus({ type: 'success', message: `Blocked ${customer.name} and terminated active session.` });
            } else {
                setSyncStatus({ type: 'success', message: `Unblocked ${customer.name}.` });
            }

            // Sync cache to reflect status change
            await MikrotikApi.syncSecrets(server);

            // Optimistic Update is tricky with global context unless we expose a setter or just refresh
            refreshCustomers(true);
        } catch (e: any) {
            console.error(e);
            setSyncStatus({ type: 'error', message: `Failed to toggle status: ${e.message}` });
        }
    };

    const handlePush = async (customer: Customer) => {
        const server = servers.find(s => s.id === customer.serverId);
        if (!server) return;

        // Show loading state for this specific action if possible, or global loading
        // For now, using global sync status to notify start
        setSyncStatus({ type: 'success', message: `Pushing ${customer.name} to ${server.name}...` });

        try {
            // Construct payload from customer object
            // Note: We need to ensure we send all relevant fields that might have changed or simply enforce current state
            const payload = {
                name: customer.name,
                password: customer.password,
                service: customer.service || 'any',
                profile: customer.profile,
                "remote-address": customer["remote-address"] || "",
                comment: customer.comment || "",
                disabled: customer.disabled ? 'yes' : 'no'
            };

            await MikrotikApi.updatePPPSecret(server, customer.id, payload);
            setSyncStatus({ type: 'success', message: `Successfully pushed ${customer.name} to ${server.name}.` });
        } catch (e: any) {
            console.error(e);
            setSyncStatus({ type: 'error', message: `Failed to push ${customer.name}: ${e.message}` });
        }
    };

    // Reset pagination when filters change (including profileFilter)
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, statusFilter, serverFilter, profileFilter, itemsPerPage]);

    const handleSort = (key: keyof Customer | 'serverName' | 'comment') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Pagination Logic
    const totalPages = itemsPerPage === -1
        ? 1
        : Math.ceil(filteredAndSortedCustomers.length / itemsPerPage);

    const startIndex = (currentPage - 1) * (itemsPerPage === -1 ? filteredAndSortedCustomers.length : itemsPerPage);

    const paginatedCustomers = itemsPerPage === -1
        ? filteredAndSortedCustomers
        : filteredAndSortedCustomers.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
                    <p className="text-slate-500">Manage PPPoE secrets and users</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleAdd}
                        className="p-2 md:px-4 md:py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="hidden md:inline font-medium">Add Customer</span>
                    </button>

                    <button
                        onClick={handleSync}
                        disabled={syncLoading}
                        className="p-2 md:px-4 md:py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                        title="Sync Data from Mikrotik to Database"
                    >
                        <RefreshCw className={cn("w-5 h-5", syncLoading && "animate-spin")} />
                        <span className="hidden md:inline font-medium">Sync Data</span>
                    </button>
                </div>
            </div>

            {/* Sync Status Alert */}
            {
                syncStatus && (
                    <div className={cn(
                        "p-4 rounded-lg flex items-center gap-2 text-sm",
                        syncStatus.type === 'success' ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                    )}>
                        {syncStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {syncStatus.message}
                    </div>
                )
            }

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Search username, name..."
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>

                <div className="w-[180px]">
                    <SearchableSelect
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { label: 'All Status', value: 'all' },
                            { label: 'Active', value: 'active' },
                            { label: 'Isolated', value: 'isolated' },
                            { label: 'Disabled', value: 'disabled' },
                            { label: 'Installing', value: 'installing' }
                        ]}
                        placeholder="Status"
                    />
                </div>

                <div className="w-[200px]">
                    <SearchableSelect
                        value={serverFilter}
                        onChange={(val) => {
                            setServerFilter(val);
                            setProfileFilter('all'); // Reset profile filter when server changes
                        }}
                        options={[
                            { label: 'All Servers', value: 'all' },
                            ...servers.map(s => ({ label: s.name, value: s.id }))
                        ]}
                        placeholder="Select Server"
                    />
                </div>

                <div className="w-[200px]">
                    <SearchableSelect
                        value={profileFilter}
                        onChange={setProfileFilter}
                        options={[
                            { label: 'All Profiles', value: 'all' },
                            ...uniqueProfiles.map(p => ({ label: p, value: p }))
                        ]}
                        placeholder="Select Profile"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="overflow-x-auto overflow-y-hidden rounded-t-xl">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                {[
                                    { label: 'Username', key: 'name' },
                                    { label: 'Real Name', key: 'realName' },
                                    { label: 'Customer', key: 'comment' },
                                    { label: 'Profile', key: 'profile' },
                                    { label: 'WhatsApp', key: 'whatsapp' },
                                    { label: 'IP', key: 'remote-address' },
                                    { label: 'Server', key: 'serverName' },
                                    { label: 'Status', key: 'disabled' },
                                    { label: 'Last Logout', key: 'last-logged-out' },
                                ].map((col) => (
                                    <th
                                        key={col.key}
                                        className="px-6 py-3 font-medium text-slate-500 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                                        onClick={() => handleSort(col.key as any)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {col.label}
                                            {sortConfig?.key === col.key && (
                                                <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredAndSortedCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                                        No customers found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                paginatedCustomers.map((customer) => (
                                    <tr key={`${customer.serverId}-${customer.name}`} className="hover:bg-slate-50/50 group">
                                        <td className="px-6 py-3 font-medium text-slate-900">
                                            {customer.name}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600 font-medium">
                                            {customer.realName ? (
                                                <span className="text-emerald-600">{customer.realName}</span>
                                            ) : (
                                                <span className="text-slate-400 italic text-xs">Unlinked</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">{customer.comment || '-'}</td>
                                        <td className="px-6 py-3">
                                            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                                {customer.profile}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3">
                                            {customer.whatsapp ? (
                                                <a
                                                    href={`https://wa.me/${customer.whatsapp.replace(/^0/, '62').replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium text-xs px-2 py-1 bg-emerald-50 rounded-full transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                    {customer.whatsapp}
                                                </a>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 font-mono text-xs text-slate-600">{customer["remote-address"] || '-'}</td>
                                        <td className="px-6 py-3 text-slate-500 text-xs">{customer.serverName}</td>
                                        <td className="px-6 py-3">
                                            {customer.disabled ? (
                                                <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded-full">
                                                    <Lock className="w-3 h-3" /> Blocked
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">{customer["last-logged-out"] || '-'}</td>
                                        <td className="px-6 py-3 text-right">
                                            {/* Actions... */}
                                            <div className="flex justify-end gap-2">
                                                {customer.whatsapp ? (
                                                    <a
                                                        href={`https://wa.me/${customer.whatsapp.replace(/^0/, '62').replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                                        title="Chat on WhatsApp"
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                    </a>
                                                ) : (
                                                    <button
                                                        disabled
                                                        className="p-1.5 text-slate-200 cursor-not-allowed rounded-lg"
                                                        title="No WhatsApp Number"
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => toggleCustomer(customer)}
                                                    className={cn("p-1.5 rounded-lg transition-colors", customer.disabled ? "text-emerald-600 hover:bg-emerald-50" : "text-red-500 hover:bg-red-50")}
                                                    title={customer.disabled ? "Unblock" : "Block"}
                                                >
                                                    {customer.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => handlePush(customer)}
                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                    title="Push to Router"
                                                >
                                                    <DownloadCloud className="w-4 h-4 rotate-180" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(customer)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                                    title="Edit Customer & CRM Data"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50 rounded-b-xl">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Show</span>
                        <div className="w-[80px]">
                            <select
                                className="w-full px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm"
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={10}>10</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={-1}>All</option>
                            </select>
                        </div>
                        <span>entries</span>
                        <span className="text-slate-400 mx-2">|</span>
                        <span>
                            Showing {filteredAndSortedCustomers.length === 0 ? 0 : startIndex + 1} to{' '}
                            {itemsPerPage === -1 ? filteredAndSortedCustomers.length : Math.min(startIndex + itemsPerPage, filteredAndSortedCustomers.length)} of {filteredAndSortedCustomers.length} entries
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-1">
                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700">
                                Page {currentPage} of {totalPages === 0 ? 1 : totalPages}
                            </span>
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="p-1 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <CustomerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSave}
                initialData={editingCustomer}
                servers={servers}
                isLoading={saving}

            />
        </div >
    );
}

function CustomerModal({ isOpen, onClose, onSave, initialData, servers, isLoading }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any, serverId: string, saveMode: 'server' | 'app') => void,
    initialData?: Customer | null,
    servers: MikrotikServer[],
    isLoading: boolean
}) {
    if (!isOpen) return null;

    const [formData, setFormData] = useState({
        name: '',
        realName: '',
        password: '',
        comment: '',
        profile: 'default',
        "remote-address": '',
        serverId: servers[0]?.id || '',
        // CRM
        whatsapp: '',
        lat: '',
        long: '',
        ktp: '',
        activationDate: '',
        photos: [] as string[],
        sub_area_id: ''
    });

    const [uploading, setUploading] = useState(false);
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [availablePools, setAvailablePools] = useState<any[]>([]);
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<'server' | 'app'>('server');

    // Fetch Sub Areas on mount
    useEffect(() => {
        axios.get('/api/sub-areas').then(res => setSubAreas(res.data)).catch(console.error);
    }, []);

    // Fetch profiles and pools when serverId changes
    useEffect(() => {
        const fetchData = async () => {
            if (!formData.serverId) {
                setAvailableProfiles([]);
                setAvailablePools([]);
                return;
            }
            const server = servers.find(s => s.id === formData.serverId);
            if (!server) {
                setAvailableProfiles([]);
                setAvailablePools([]);
                return;
            }

            setLoadingProfiles(true);
            try {
                const [profiles, pools] = await Promise.all([
                    MikrotikApi.getPPPProfiles(server),
                    MikrotikApi.getIPPools(server)
                ]);
                setAvailableProfiles(profiles);
                setAvailablePools(pools);
            } catch (error) {
                console.error("Failed to fetch master data", error);
            } finally {
                setLoadingProfiles(false);
            }
        };

        fetchData();
    }, [formData.serverId, servers]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                realName: initialData.realName || '',
                password: initialData.password || '',
                comment: initialData.comment || '',
                profile: initialData.profile,
                "remote-address": initialData["remote-address"] || '',
                serverId: initialData.serverId,
                whatsapp: initialData.whatsapp || '',
                lat: initialData.lat || '',
                long: initialData.long || '',
                ktp: initialData.ktp || '',
                activationDate: initialData.activationDate || '',
                photos: initialData.photos || [],
                sub_area_id: initialData.sub_area_id || ''
            });
        } else {
            setFormData({
                name: '',
                realName: '',
                password: '',
                comment: '',
                profile: 'default',
                "remote-address": '',
                serverId: servers[0]?.id || '',
                whatsapp: '',
                lat: '',
                long: '',
                ktp: '',
                activationDate: '',
                photos: [],
                sub_area_id: ''
            });
        }
    }, [initialData, isOpen, servers]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        setUploading(true);
        try {
            const files = Array.from(e.target.files);
            const urls = await MikrotikApi.uploadPhotos(files);
            setFormData(prev => ({ ...prev, photos: [...prev.photos, ...urls] }));
        } catch (error) {
            alert("Failed to upload photos");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Save to Mikrotik & Metadata
        onSave({
            name: formData.name,
            realName: formData.realName,
            password: formData.password,
            comment: formData.comment,
            profile: formData.profile,
            "remote-address": formData["remote-address"] || undefined,
            serverId: formData.serverId, // Pass serverId for extended data update
            whatsapp: formData.whatsapp || undefined,
            lat: formData.lat || undefined,
            long: formData.long || undefined,
            ktp: formData.ktp || undefined,
            activationDate: formData.activationDate || undefined,
            photos: formData.photos,
            sub_area_id: formData.sub_area_id || undefined
        }, formData.serverId, activeTab);
    };

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-semibold">{initialData ? 'Edit Customer' : 'Add New Customer'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto min-h-[400px]">
                    <div className="flex gap-4 mb-6 border-b border-slate-100 pb-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('server')}
                            className={cn(
                                "pb-2 px-1 text-sm font-medium transition-colors relative",
                                activeTab === 'server' ? "text-primary border-b-2 border-primary" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            Server Configuration
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('app')}
                            className={cn(
                                "pb-2 px-1 text-sm font-medium transition-colors relative",
                                activeTab === 'app' ? "text-primary border-b-2 border-primary" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            App & CRM Data
                        </button>
                    </div>

                    <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">

                        {activeTab === 'server' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                                {/* Server Selection - Full Width */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Server (Router)</label>
                                    <SearchableSelect
                                        required
                                        value={formData.serverId}
                                        onChange={(val) => setFormData({ ...formData, serverId: val, sub_area_id: '' })}
                                        options={[
                                            { label: 'Select Server...', value: '' },
                                            ...servers.map(server => ({ label: server.name, value: server.id }))
                                        ]}
                                        placeholder="Select Server..."
                                        disabled={!!initialData}
                                    />
                                    <p className="text-xs text-slate-400">Target Mikrotik Router</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Username (PPPoE Secret)</label>
                                            <input required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="username" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Password</label>
                                            <input required className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="password" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Profile (Package)</label>
                                            {loadingProfiles ? (
                                                <div className="text-sm text-slate-400 py-2">Loading...</div>
                                            ) : (
                                                <SearchableSelect
                                                    value={formData.profile}
                                                    onChange={val => setFormData({ ...formData, profile: val })}
                                                    options={[
                                                        { label: 'default', value: 'default' },
                                                        ...availableProfiles.map((p: any) => ({ label: p.name, value: p.name }))
                                                    ]}
                                                />
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Remote Address</label>
                                            <input
                                                list="ip-pools"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData["remote-address"]}
                                                onChange={e => setFormData({ ...formData, "remote-address": e.target.value })}
                                                placeholder="IP or Pool Name"
                                            />
                                            <datalist id="ip-pools">
                                                {availablePools.map((pool: any) => (
                                                    <option key={pool['.id']} value={pool.name}>Pool: {pool.ranges}</option>
                                                ))}
                                            </datalist>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2 border-t border-slate-100 pt-4">
                                    <label className="text-sm font-medium text-slate-700">Mikrotik Comment / Identity</label>
                                    <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                        value={formData.comment} onChange={e => setFormData({ ...formData, comment: e.target.value })} placeholder="Customer Name in Mikrotik" />
                                    <p className="text-xs text-slate-400">Usually used for the main Customer Name in Mikrotik list</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'app' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {/* Sub Area Selection */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Sub Area</label>
                                            <SearchableSelect
                                                value={formData.sub_area_id}
                                                onChange={(val) => setFormData({ ...formData, sub_area_id: val })}
                                                options={[
                                                    { label: 'Select Sub Area...', value: '' },
                                                    ...subAreas
                                                        .filter(sa => sa.serverId === formData.serverId)
                                                        .map(sa => ({ label: sa.name, value: sa.id }))
                                                ]}
                                                placeholder={formData.serverId ? "Select Sub Area..." : "Select Server first (in Server Tab)"}
                                                disabled={!formData.serverId}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Real Name (Registration)</label>
                                            <input
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                placeholder="Full Name as per Registration"
                                                value={formData.realName} onChange={e => setFormData({ ...formData, realName: e.target.value })}
                                            />
                                            <p className="text-xs text-slate-400">Updates linked registration data</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">No. KTP</label>
                                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData.ktp} onChange={e => setFormData({ ...formData, ktp: e.target.value })} placeholder="16 Digits" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">WhatsApp</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">62</span>
                                                <input className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                    value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} placeholder="812..." />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Activation Date</label>
                                            <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData.activationDate} onChange={e => setFormData({ ...formData, activationDate: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* Location & Photos */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Location & Installation</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Latitude</label>
                                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData.lat} onChange={e => setFormData({ ...formData, lat: e.target.value })} placeholder="-6.200..." />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-700">Longitude</label>
                                            <input className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                                value={formData.long} onChange={e => setFormData({ ...formData, long: e.target.value })} placeholder="106.8..." />
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        <label className="text-sm font-medium text-slate-700">Installation Photos</label>
                                        <div className="flex flex-wrap gap-2">
                                            {formData.photos.map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 rounded overflow-hidden border border-slate-200 hover:opacity-80">
                                                    <img src={url} alt="Install" className="w-full h-full object-cover" />
                                                </a>
                                            ))}
                                            <label className="w-16 h-16 rounded border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-primary hover:text-primary transition-colors">
                                                <Plus className="w-5 h-5" />
                                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
                                            </label>
                                        </div>
                                        {uploading && <p className="text-xs text-blue-500">Uploading photos...</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0 bg-slate-50 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium disabled:opacity-50">Cancel</button>
                    <button
                        type="submit"
                        form="customer-form"
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
                    >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {initialData ? 'Save Changes' : 'Create Customer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
