import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, XCircle, Wrench, Smartphone, Calendar, Eye, User, RotateCcw, CheckCircle, MapPin, Trash2, List, Map as MapIcon } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { Registration } from '@/types';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const extractCoordinates = (url: string | undefined): [number, number] | null => {
    if (!url) return null;
    const match = url.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || url.match(/q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return [lat, lng];
        }
    }
    return null;
};

const SERVER_COLORS = [
    '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

const getServerColor = (locationId: string) => {
    if (!locationId) return '#94a3b8';
    let hash = 0;
    for (let i = 0; i < locationId.length; i++) {
        hash = locationId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SERVER_COLORS[Math.abs(hash) % SERVER_COLORS.length];
};

const createCustomIcon = (locationId: string, status: string) => {
    const serverColor = getServerColor(locationId);
    let statusColor = '#94a3b8';
    if (status === 'queue') statusColor = '#f59e0b';
    else if (status === 'installation_process') statusColor = '#3b82f6';
    else if (status === 'done') statusColor = '#10b981';
    else if (status.startsWith('cancel')) statusColor = '#ef4444';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40"><path d="M16 0c-8.837 0-16 7.163-16 16 0 11.046 16 24 16 24s16-12.954 16-24c0-8.837-7.163-16-16-16z" fill="${serverColor}" /><circle cx="16" cy="16" r="10" fill="#ffffff" /><circle cx="16" cy="16" r="7" fill="${statusColor}" /></svg>`;

    return L.divIcon({
        className: 'custom-map-marker bg-transparent border-none',
        html: svg,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
    });
};

interface RegistrationProps {
    view?: 'active' | 'completed' | 'cancelled';
}

export function Registration({ view = 'active' }: RegistrationProps) {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [activeTab, setActiveTab] = useState<'data' | 'map'>('data');
    const [servers, setServers] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [jobTitles, setJobTitles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [mapType, setMapType] = useState<'m' | 'y'>('m');
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useAuth();

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Registration | 'date', direction: 'asc' | 'desc' } | null>(null);

    // Filters
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterServer, setFilterServer] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterData, setFilterData] = useState('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Modal States
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingReg, setEditingReg] = useState<Registration | null>(null);
    const [isInstallOpen, setIsInstallOpen] = useState(false);
    const [selectedReg, setSelectedReg] = useState<Registration | null>(null);

    // Detail Modal State
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [detailReg, setDetailReg] = useState<Registration | null>(null);

    // Cancel Modal
    const [isCancelOpen, setIsCancelOpen] = useState(false);
    const [cancelTargetId, setCancelTargetId] = useState('');
    const [cancelReason, setCancelReason] = useState('cancel');

    // Bulk Actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Form Data
    const [formData, setFormData] = useState({
        phoneNumber: '',
        fullName: '',
        ktpNumber: '',
        address: '',
        locationId: '',
        sub_area_id: '',
        mapsUrl: '', // Add mapsUrl state
    });
    const [installData, setInstallData] = useState({
        technician: '',
        companion: '',
        date: '',
        costName: '',
        costPrice: 0
    });

    const [subAreas, setSubAreas] = useState<any[]>([]);

    useEffect(() => {
        fetchRegistrations();
        fetchServers();
        fetchSubAreas();
        fetchEmployeesAndTitles();
        setSelectedIds([]); // Reset selection on view change
    }, [view]); // Refetch/Re-filter when view changes

    const fetchEmployeesAndTitles = async () => {
        try {
            const [empRes, titleRes] = await Promise.all([
                axios.get('/api/employees'),
                axios.get('/api/job-titles')
            ]);
            setEmployees(empRes.data);
            setJobTitles(titleRes.data);
        } catch (error) {
            console.error("Failed to fetch employees/titles", error);
        }
    };

    const fetchServers = async () => {
        try {
            const res = await axios.get('/api/servers');
            setServers(res.data);
        } catch (error) {
            console.error("Failed to fetch servers", error);
        }
    };

    const fetchSubAreas = async () => {
        try {
            const res = await axios.get('/api/sub-areas');
            setSubAreas(res.data);
        } catch (error) {
            console.error("Failed to fetch sub-areas", error);
        }
    };

    const fetchRegistrations = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/registrations');
            setRegistrations(res.data);
        } catch (error) {
            console.error("Failed to fetch registrations", error);
        } finally {
            setLoading(false);
        }
    };

    const getTechnicians = () => {
        return employees.filter(e => {
            const title = jobTitles.find(t => t.id === e.jobTitleId);
            if (!title) return false;
            const titleName = title.name.toLowerCase();
            return titleName.includes('technician') || titleName.includes('teknisi') || titleName.includes('technical');
        });
    };

    const handleSaveSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1); // Reset page on search
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingReg) {
                await axios.put(`/api/registrations/${editingReg.id}`, formData);
            } else {
                await axios.post('/api/registrations', formData);
            }
            fetchRegistrations();
            setIsFormOpen(false);
            setEditingReg(null);
            setFormData({ phoneNumber: '', fullName: '', ktpNumber: '', address: '', locationId: '', sub_area_id: '', mapsUrl: '' });
        } catch (error) {
            alert('Failed to save registration');
        }
    };

    const openEdit = (reg: Registration) => {
        setEditingReg(reg);
        setFormData({
            phoneNumber: reg.phoneNumber,
            fullName: reg.fullName,
            ktpNumber: reg.ktpNumber,
            address: reg.address,
            locationId: reg.locationId,
            sub_area_id: reg.sub_area_id || '',
            mapsUrl: reg.mapsUrl || '', // Load mapsUrl
        });
        setIsFormOpen(true);
    };

    const openDetail = (reg: Registration) => {
        setDetailReg(reg);
        setIsDetailOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to DELETE this registration PERMANENTLY? This cannot be undone.')) return;
        try {
            await axios.delete(`/api/registrations/${id}`);
            fetchRegistrations();
            setSelectedIds(prev => prev.filter(selId => selId !== id));
        } catch (error) {
            alert('Failed to delete registration');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Are you sure you want to DELETE ${selectedIds.length} registration(s) PERMANENTLY? This cannot be undone.`)) return;
        
        setLoading(true);
        try {
            await Promise.all(selectedIds.map(id => axios.delete(`/api/registrations/${id}`)));
            setSelectedIds([]);
            fetchRegistrations();
        } catch (error) {
            console.error('Bulk delete error:', error);
            alert('Failed to delete some or all registrations');
            fetchRegistrations(); // Refresh to get current state
        }
    };

    const openCancelModal = (id: string) => {
        setCancelTargetId(id);
        setCancelReason('cancel');
        setIsCancelOpen(true);
    };

    const handleConfirmCancel = async () => {
        try {
            await axios.put(`/api/registrations/${cancelTargetId}`, { status: cancelReason });
            fetchRegistrations();
            setIsCancelOpen(false);
        } catch (error) {
            alert('Failed to cancel');
        }
    };

    const handleReinstall = async (id: string) => {
        if (!confirm('Are you sure you want to reinstall this customer? Current status will be reset to Pending.')) return;
        try {
            await axios.put(`/api/registrations/${id}`, {
                status: 'queue',
                // Reset working order status so it's treated as new when installed again
                workingOrderStatus: null,
                workingOrderNote: null
            });
            fetchRegistrations();
        } catch (error) {
            alert('Failed to reinstall');
        }
    };

    const openInstall = (reg: Registration) => {
        setSelectedReg(reg);
        setInstallData({
            technician: reg.installation?.technician || '',
            companion: reg.installation?.companion || '',
            date: reg.installation?.date ? reg.installation.date.slice(0, 16) : '',
            costName: reg.installation?.cost?.name || '',
            costPrice: reg.installation?.cost?.price || 0
        });
        setIsInstallOpen(true);
    };

    const handleInstallSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReg) return;
        try {
            await axios.put(`/api/registrations/${selectedReg.id}`, {
                status: 'installation_process',
                installation: {
                    ...installData,
                    cost: installData.costName ? { name: installData.costName, price: Number(installData.costPrice) } : null
                },
                workingOrderStatus: 'pending' // Ensure it starts as pending
            });
            fetchRegistrations();
            setIsInstallOpen(false);
            setSelectedReg(null);
        } catch (error) {
            alert('Failed to process installation');
        }
    };

    // Filter Logic
    const filteredRegs = registrations.filter(r => {
        // VIEW FILTER
        if (view === 'completed') {
            if (r.status !== 'done') return false;
        } else if (view === 'cancelled') {
            if (!r.status.startsWith('cancel')) return false;
        } else {
            // Active view: Show everything EXCEPT 'done' and 'cancel'
            if (r.status === 'done' || r.status.startsWith('cancel')) return false;
        }

        const matchesSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.phoneNumber.includes(searchTerm);

        const matchesServer = filterServer ? r.locationId === filterServer : true;
        const matchesStatus = filterStatus !== 'all' ? r.status === filterStatus : true;

        let matchesData = true;
        if (filterData !== 'all') {
            const hasPhone = !!r.phoneNumber;
            const hasMaps = !!r.mapsUrl;
            const hasAddress = !!r.address;
            const coords = extractCoordinates(r.mapsUrl);
            const isValidMap = r.mapsUrl ? !!coords : false;
            const isComplete = hasPhone && hasMaps && hasAddress && (!r.mapsUrl || isValidMap);
            
            if (filterData === 'complete') matchesData = isComplete;
            else if (filterData === 'incomplete') matchesData = !isComplete;
        }

        let matchesDate = true;
        if (filterDateStart || filterDateEnd) {
            if (!r.createdAt) {
                matchesDate = false;
            } else {
                const regDate = new Date(r.createdAt.split('T')[0]);
                if (filterDateStart) {
                    matchesDate = matchesDate && regDate >= new Date(filterDateStart);
                }
                if (filterDateEnd) {
                    matchesDate = matchesDate && regDate <= new Date(filterDateEnd);
                }
            }
        }

        return matchesSearch && matchesServer && matchesStatus && matchesDate && matchesData;
    }).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aValue: any = a[key as keyof Registration];
        let bValue: any = b[key as keyof Registration];

        if (key === 'date') { // Special case for Installation Date
            aValue = a.installation?.date || '';
            bValue = b.installation?.date || '';
        } else if (key === 'createdAt') {
            aValue = a.createdAt || '';
            bValue = b.createdAt || '';
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: keyof Registration | 'date') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Pagination Logic
    const totalPages = itemsPerPage === -1
        ? 1
        : Math.ceil(filteredRegs.length / itemsPerPage);

    const startIndex = (currentPage - 1) * (itemsPerPage === -1 ? filteredRegs.length : itemsPerPage);
    const paginatedRegs = itemsPerPage === -1
        ? filteredRegs
        : filteredRegs.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterServer, filterDateStart, filterDateEnd, filterData, itemsPerPage]);

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {view === 'completed' ? 'Completed Registrations' : view === 'cancelled' ? 'Cancelled Registrations' : 'Active Registrations'}
                    </h1>
                    <p className="text-slate-500">
                        {view === 'completed' ? 'History of completed registrations' : view === 'cancelled' ? 'History of cancelled registrations' : 'Manage new WiFi registrations'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {user?.role === 'superadmin' && selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={() => { setEditingReg(null); setFormData({ phoneNumber: '', fullName: '', ktpNumber: '', address: '', locationId: '', sub_area_id: '', mapsUrl: '' }); setIsFormOpen(true); }}
                        className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Registration
                    </button>
                </div>
            </div>

            {(view === 'active' || view === 'cancelled') && (
                <div className="flex gap-4 mb-6 border-b border-slate-200 px-2">
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'data' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <List className="w-4 h-4" />
                        Data ({view === 'cancelled' ? 'Cancelled Registrations' : 'Active Registrations'})
                    </button>
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'map' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                    >
                        <MapIcon className="w-4 h-4" />
                        Registration Map
                    </button>
                </div>
            )}

            {activeTab === 'data' || view === 'completed' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={searchTerm}
                                onChange={handleSaveSearch}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            />
                        </div>

                        <div className="w-[180px]">
                            <SearchableSelect
                                value={filterStatus}
                                onChange={setFilterStatus}
                                options={[
                                    { label: 'All Status', value: 'all' },
                                    { label: 'Pending', value: 'queue' },
                                    { label: 'Installing', value: 'installation_process' },
                                    { label: 'Done', value: 'done' },
                                    { label: 'Cancelled - User (Undefined)', value: 'cancel' },
                                    { label: 'Cancelled - User (Price)', value: 'cancel_user_price' },
                                    { label: 'Cancelled - Admin (OOC)', value: 'cancel_admin_ooc' },
                                    { label: 'Cancelled - Teknisi (ODP Full)', value: 'cancel_teknisi_odp' }
                                ]}
                                placeholder="Status"
                            />
                        </div>

                        <div className="w-[180px]">
                            <SearchableSelect
                                value={filterData}
                                onChange={setFilterData}
                                options={[
                                    { label: 'Semua Kelengkapan', value: 'all' },
                                    { label: 'Data Lengkap', value: 'complete' },
                                    { label: 'Data Kosong', value: 'incomplete' }
                                ]}
                                placeholder="Kelengkapan Data"
                            />
                        </div>

                        <div className="w-[200px]">
                            <SearchableSelect
                                value={filterServer}
                                onChange={setFilterServer}
                                options={[
                                    { label: 'All Servers', value: '' },
                                    ...servers.map(s => ({ label: s.name, value: s.name }))
                                ]}
                                placeholder="Select Server"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <span className="text-sm text-slate-500 font-medium">Registration Date:</span>
                        <input
                            type="date"
                            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-600"
                            value={filterDateStart}
                            onChange={e => setFilterDateStart(e.target.value)}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                            type="date"
                            className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-600"
                            value={filterDateEnd}
                            onChange={e => setFilterDateEnd(e.target.value)}
                        />
                        {(filterDateStart || filterDateEnd) && (
                            <button
                                onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); }}
                                className="text-sm text-red-500 hover:text-red-700 font-medium"
                            >
                                Clear Date
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                            <tr>
                                {user?.role === 'superadmin' && (
                                    <th className="px-6 py-4 w-12 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                            checked={paginatedRegs.length > 0 && selectedIds.length === paginatedRegs.length}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(paginatedRegs.map(r => r.id));
                                                } else {
                                                    setSelectedIds([]);
                                                }
                                            }}
                                        />
                                    </th>
                                )}
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>Status</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('createdAt')}>Reg. Date</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('fullName')}>Customer</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('locationId')}>Location</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>Installation Info</th>
                                <th className="px-6 py-4">Kelengkapan Data</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan={user?.role === 'superadmin' ? 8 : 7} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : paginatedRegs.length === 0 ? (
                                <tr><td colSpan={user?.role === 'superadmin' ? 8 : 7} className="px-6 py-8 text-center text-slate-400">No registrations found</td></tr>
                            ) : paginatedRegs.map(reg => {
                                const missing = [];
                                if (!reg.phoneNumber) missing.push('No. HP');
                                if (!reg.mapsUrl) missing.push('Maps');
                                if (!reg.address) missing.push('Alamat');
                                
                                const coords = extractCoordinates(reg.mapsUrl);
                                if (reg.mapsUrl && !coords) {
                                    missing.push('URL Map Invalid');
                                }

                                const isDataComplete = missing.length === 0;

                                return (
                                <tr key={reg.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(reg.id) ? 'bg-blue-50/50' : (!isDataComplete ? 'bg-yellow-50' : '')}`}>
                                    {user?.role === 'superadmin' && (
                                        <td className="px-6 py-4 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                                checked={selectedIds.includes(reg.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedIds(prev => [...prev, reg.id]);
                                                    } else {
                                                        setSelectedIds(prev => prev.filter(id => id !== reg.id));
                                                    }
                                                }}
                                            />
                                        </td>
                                    )}
                                    <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${reg.status === 'queue' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            reg.status === 'installation_process' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                reg.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    reg.status.startsWith('cancel') ? 'bg-red-50 text-red-700 border-red-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {reg.status === 'queue' && 'Pending'}
                                            {reg.status === 'installation_process' && 'Installing'}
                                            {reg.status === 'done' && 'Done'}
                                            {reg.status === 'cancel' && 'Cancelled - User (Undefined)'}
                                            {reg.status === 'cancel_user_price' && 'Cancelled - User (Price)'}
                                            {reg.status === 'cancel_admin_ooc' && 'Cancelled - Admin (OOC)'}
                                            {reg.status === 'cancel_teknisi_odp' && 'Cancelled - Teknisi (ODP Full)'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {reg.createdAt ? new Date(reg.createdAt).toLocaleDateString() : '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{reg.fullName}</div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Smartphone className="w-3 h-3" /> {reg.phoneNumber}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-[200px] truncate" title={reg.address}>{reg.address}</div>
                                        <div className="text-xs text-slate-500">{reg.locationId}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {reg.installation ? (
                                            <div className="text-xs space-y-1">
                                                <div className="flex items-center gap-1"><Wrench className="w-3 h-3" /> {reg.installation.technician}</div>
                                                <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(reg.installation.date).toLocaleDateString()}</div>
                                                {reg.status === 'done' && reg.installation.finishDate && (
                                                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                                                        <CheckCircle className="w-3 h-3" /> Finished: {new Date(reg.installation.finishDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic">Not scheduled</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isDataComplete ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                                                Lengkap
                                            </span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Data Kosong:</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {missing.map(m => (
                                                        <span key={m} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                                            {m}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openDetail(reg)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="View Details">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {reg.status === 'queue' && (
                                                <>
                                                    <button onClick={() => openEdit(reg)} className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-md transition-colors" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    {isDataComplete ? (
                                                        <button onClick={() => openInstall(reg)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Process Installation">
                                                            <Wrench className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button disabled className="p-1.5 text-slate-300 cursor-not-allowed rounded-md" title="Lengkapi data terlebih dahulu untuk proses instalasi">
                                                            <Wrench className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button onClick={() => openCancelModal(reg.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Cancel">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {reg.status.startsWith('cancel') && (
                                                <button onClick={() => handleReinstall(reg.id)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Reinstall">
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                            )}
                                            {reg.status === 'done' && user?.role === 'superadmin' && (
                                                <button onClick={() => handleDelete(reg.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Show</span>
                        <div className="w-[70px]">
                            <select
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-sm cursor-pointer"
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
                            Showing {filteredRegs.length === 0 ? 0 : startIndex + 1} to{' '}
                            {itemsPerPage === -1 ? filteredRegs.length : Math.min(startIndex + itemsPerPage, filteredRegs.length)} of {filteredRegs.length} entries
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 text-sm font-medium text-slate-700">
                            Page {currentPage} of {totalPages === 0 ? 1 : totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1 bg-white border border-slate-200 rounded-md text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600"
                        >
                            Next
                        </button>
                    </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] h-[calc(100vh-220px)] relative z-0">
                    <div className="absolute top-4 right-4 z-[1000]">
                        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex gap-1">
                            <button 
                                onClick={() => setMapType('m')}
                                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", mapType === 'm' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
                            >
                                Street
                            </button>
                            <button 
                                onClick={() => setMapType('y')}
                                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", mapType === 'y' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
                            >
                                Satellite
                            </button>
                        </div>
                    </div>
                    <MapContainer center={[-0.366535, 101.556898]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url={`https://mt1.google.com/vt/lyrs=${mapType}&x={x}&y={y}&z={z}`} attribution='&copy; Google Maps' maxZoom={22} />
                        {registrations.filter(r => {
                            if (view === 'cancelled') return r.status.startsWith('cancel');
                            return r.status !== 'done' && !r.status.startsWith('cancel');
                        }).map(reg => {
                            const missing = [];
                            if (!reg.phoneNumber) missing.push('No. HP');
                            if (!reg.mapsUrl) missing.push('Maps');
                            if (!reg.address) missing.push('Alamat');
                            const coords = extractCoordinates(reg.mapsUrl);
                            if (reg.mapsUrl && !coords) missing.push('URL Map Invalid');
                            
                            if (missing.length > 0 || !coords) return null;

                            return (
                                <Marker key={reg.id} position={coords} icon={createCustomIcon(reg.locationId, reg.status)}>
                                    <Tooltip permanent direction="bottom" offset={[0, 10]} className="bg-white/90 shadow-sm border-slate-200 text-xs font-semibold text-slate-700 rounded-md">
                                        {reg.fullName}
                                    </Tooltip>
                                    <Popup className="rounded-xl overflow-hidden min-w-[200px]">
                                        <div className="p-1 font-sans">
                                            <h3 className="font-bold text-sm text-slate-800 mb-1">{reg.fullName}</h3>
                                            <div className="text-xs text-slate-500 mb-2">{reg.phoneNumber}</div>
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                reg.status === 'queue' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                reg.status === 'installation_process' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                reg.status.startsWith('cancel') ? 'bg-red-50 text-red-700 border-red-200' :
                                                'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                {reg.status === 'queue' ? 'Pending' : reg.status === 'installation_process' ? 'Installing' : 
                                                 reg.status === 'cancel' ? 'Cancelled - User (Undefined)' :
                                                 reg.status === 'cancel_user_price' ? 'Cancelled - User (Price)' :
                                                 reg.status === 'cancel_admin_ooc' ? 'Cancelled - Admin (OOC)' :
                                                 reg.status === 'cancel_teknisi_odp' ? 'Cancelled - Teknisi (ODP)' : reg.status}
                                            </span>
                                            <div className="mt-2 text-xs text-slate-600 truncate max-w-[200px]" title={reg.address}>{reg.address}</div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                    
                    {/* Map Legend */}
                    <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200/60 max-w-[300px] text-sm">
                        <div className="font-semibold text-slate-800 mb-3">Map Legend</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Pin Color (Server)</div>
                                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-2">
                                    {servers.map(s => (
                                        <div key={s.name} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: getServerColor(s.name) }}></div>
                                            <span className="text-xs text-slate-600 truncate" title={s.name}>{s.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Dot Color (Status)</div>
                                <div className="space-y-2 mt-1">
                                    {view === 'active' && (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-[#f59e0b]"></div>
                                                <span className="text-xs text-slate-600">Pending</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-[#3b82f6]"></div>
                                                <span className="text-xs text-slate-600">Installing</span>
                                            </div>
                                        </>
                                    )}
                                    {view === 'cancelled' && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-[#ef4444]"></div>
                                            <span className="text-xs text-slate-600">Cancelled</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="font-semibold text-lg">{editingReg ? 'Edit Registration' : 'New Registration'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={formData.phoneNumber}
                                        onChange={e => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.startsWith('0')) val = '62' + val.slice(1);
                                            // Handle case where user starts typing without 62 or 0 (e.g. 812...)
                                            if (val.length > 0 && !val.startsWith('62')) val = '62' + val;
                                            setFormData({ ...formData, phoneNumber: val });
                                        }}
                                        placeholder="628..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">KTP Number</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                    value={formData.ktpNumber}
                                    onChange={e => setFormData({ ...formData, ktpNumber: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                <textarea className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none" rows={3}
                                    value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })}></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Link Lokasi (Maps URL)</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="url"
                                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={formData.mapsUrl}
                                        onChange={e => setFormData({ ...formData, mapsUrl: e.target.value })}
                                        placeholder="https://maps.google.com/..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location (Server) <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    required
                                    value={formData.locationId}
                                    onChange={(val) => setFormData({ ...formData, locationId: val, sub_area_id: '' })}
                                    options={[
                                        { label: 'Select Server...', value: '' },
                                        ...servers.map(server => ({ label: server.name, value: server.name }))
                                    ]}
                                    placeholder="Select Server..."
                                />
                            </div>
                            {formData.locationId && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Sub Area</label>
                                    <SearchableSelect
                                        value={formData.sub_area_id}
                                        onChange={(val) => setFormData({ ...formData, sub_area_id: val })}
                                        options={[
                                            { label: 'Select Sub Area...', value: '' },
                                            ...subAreas.filter(sa => {
                                                const server = servers.find(s => s.name === formData.locationId);
                                                return server && sa.serverId === server.id;
                                            }).map(sa => ({ label: sa.name, value: sa.id }))
                                        ]}
                                        placeholder="Select Sub Area..."
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Save Registration</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail View Modal */}
            {isDetailOpen && detailReg && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg text-slate-900">Registration Details</h3>
                            <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Status Banner */}
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="text-sm font-medium text-slate-500">Current Status</span>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${detailReg.status === 'queue' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    detailReg.status === 'installation_process' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        detailReg.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            'bg-slate-100 text-slate-600 border-slate-200'
                                    }`}>
                                    {detailReg.status === 'queue' && 'Pending'}
                                    {detailReg.status === 'installation_process' && 'Installing'}
                                    {detailReg.status === 'done' && 'Done'}
                                    {detailReg.status === 'cancel' && 'Cancelled'}
                                </span>
                            </div>

                            {/* Customer Info */}
                            <div>
                                <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                                    <User className="w-4 h-4 text-primary" /> Customer Information
                                </h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="text-slate-500 mb-1">Full Name</div>
                                        <div className="font-medium text-slate-900">{detailReg.fullName}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 mb-1">Phone Number</div>
                                        <div className="font-medium text-slate-900">{detailReg.phoneNumber}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 mb-1">KTP Number</div>
                                        <div className="font-medium text-slate-900">{detailReg.ktpNumber || '-'}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 mb-1">Server Location</div>
                                        <div className="font-medium text-slate-900">{detailReg.locationId}</div>
                                    </div>
                                    <div className="col-span-2">
                                        <div className="text-slate-500 mb-1">Address</div>
                                        <div className="font-medium text-slate-900">{detailReg.address}</div>
                                        {detailReg.mapsUrl && (
                                            <a href={detailReg.mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline mt-1 text-xs">
                                                <MapPin className="w-3 h-3" /> View Location
                                            </a>
                                        )}
                                    </div>
                                    {detailReg.createdAt && (
                                        <div className="col-span-2 mt-1">
                                            <div className="text-slate-500 mb-1 text-xs">Registration Date</div>
                                            <div className="font-medium text-slate-900 text-sm">
                                                {new Date(detailReg.createdAt).toLocaleString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Installation Info */}
                            {detailReg.installation && (
                                <div className="pt-4 border-t border-slate-100">
                                    <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                                        <Wrench className="w-4 h-4 text-blue-500" /> Installation Details
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-slate-500 mb-1">Technician</div>
                                            <div className="font-medium text-slate-900">{detailReg.installation.technician}</div>
                                        </div>
                                        <div>
                                            <div className="text-slate-500 mb-1">Companion</div>
                                            <div className="font-medium text-slate-900">{detailReg.installation.companion || '-'}</div>
                                        </div>
                                        {/* Cost Display */}
                                        {(detailReg.installation as any).cost && (
                                            <div className="col-span-2 bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                                                <div className="text-slate-500 text-xs mb-1">Installation Cost</div>
                                                <div className="font-medium text-slate-900 flex justify-between">
                                                    <span>{(detailReg.installation as any).cost.name}</span>
                                                    <span>Rp {Number((detailReg.installation as any).cost.price).toLocaleString('id-ID')}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="col-span-2">
                                            <div className="text-slate-500 mb-1">Scheduled Date</div>
                                            <div className="font-medium text-slate-900">
                                                {new Date(detailReg.installation.date).toLocaleString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className="col-span-2 mt-2 pt-2 border-t border-slate-100">
                                            <div className="text-slate-500 mb-1 text-xs uppercase tracking-wide font-semibold">Finish Date</div>
                                            <div className="font-medium text-emerald-700 bg-emerald-50 inline-block px-2 py-1 rounded">
                                                {detailReg.installation.finishDate ? new Date(detailReg.installation.finishDate).toLocaleString() : '-'}
                                            </div>
                                        </div>
                                        {detailReg.installation.coordinates && (
                                            <div className="col-span-2 mt-2">
                                                <div className="text-slate-500 mb-1 text-xs">Captured Location</div>
                                                <div className="font-medium text-slate-900 flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-red-500" />
                                                    {detailReg.installation.coordinates}
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${detailReg.installation.coordinates}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue-600 hover:underline text-xs"
                                                    >
                                                        (Open Map)
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Technician Notes */}
                            {detailReg.workingOrderNote && (
                                <div className="pt-4 border-t border-slate-100">
                                    <h4 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                                        <Edit2 className="w-4 h-4 text-amber-500" /> Technician Notes
                                    </h4>
                                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-slate-700 italic">
                                        "{detailReg.workingOrderNote}"
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setIsDetailOpen(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Installation Modal */}
            {isInstallOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50 rounded-t-xl">
                            <h3 className="font-semibold text-lg text-blue-900">Process Installation</h3>
                            <button onClick={() => setIsInstallOpen(false)} className="text-blue-400 hover:text-blue-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleInstallSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Technician</label>
                                <SearchableSelect
                                    required
                                    value={installData.technician}
                                    onChange={(val) => setInstallData({ ...installData, technician: val })}
                                    options={[
                                        { label: 'Select Technician...', value: '' },
                                        ...getTechnicians().map(tech => ({ label: tech.name, value: tech.name }))
                                    ]}
                                    placeholder="Select Technician..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Companion (Pendamping)</label>
                                <SearchableSelect
                                    value={installData.companion}
                                    onChange={(val) => setInstallData({ ...installData, companion: val })}
                                    options={[
                                        { label: 'Select Companion...', value: '' },
                                        ...getTechnicians().map(tech => ({ label: tech.name, value: tech.name }))
                                    ]}
                                    placeholder="Select Companion..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time</label>
                                <input required type="datetime-local" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={installData.date} onChange={e => setInstallData({ ...installData, date: e.target.value })} />
                            </div>

                            {/* Installation Cost Section */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Installation Cost</label>
                                <select
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    value={installData.costName}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        if (!name) {
                                            setInstallData({ ...installData, costName: '', costPrice: 0 });
                                            return;
                                        }
                                        // Find cost
                                        const server = servers.find(s => s.name === selectedReg?.locationId);
                                        const cost = server?.installation_costs?.find((c: any) => c.name === name);
                                        if (cost) {
                                            setInstallData({ ...installData, costName: cost.name, costPrice: cost.price });
                                        }
                                    }}
                                >
                                    <option value="">Select Cost...</option>
                                    {selectedReg && servers.find(s => s.name === selectedReg.locationId)?.installation_costs?.map((c: any, idx: number) => (
                                        <option key={idx} value={c.name}>
                                            {c.name} - Rp {c.price.toLocaleString('id-ID')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsInstallOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start Installation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Cancel Modal */}
            {isCancelOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg text-slate-900">Cancel Registration</h3>
                            <button onClick={() => setIsCancelOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6">
                            <p className="text-slate-500 mb-4 text-sm">Please select a reason for cancelling this registration:</p>
                            <select
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-slate-50 mb-6"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                            >
                                <option value="cancel">Cancel - User - Undefined</option>
                                <option value="cancel_user_price">Cancel - User - (Price)</option>
                                <option value="cancel_admin_ooc">Cancel - Admin (Out of Coverage)</option>
                                <option value="cancel_teknisi_odp">Cancel - Teknisi (ODP Full)</option>
                            </select>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setIsCancelOpen(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                                    Cancel
                                </button>
                                <button onClick={handleConfirmCancel} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                                    Confirm Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
