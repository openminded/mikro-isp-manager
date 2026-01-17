import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, XCircle, Wrench, Smartphone, Calendar, Eye, User, RotateCcw, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { Registration } from '@/types';

interface RegistrationProps {
    view?: 'active' | 'completed';
}

export function Registration({ view = 'active' }: RegistrationProps) {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [servers, setServers] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [jobTitles, setJobTitles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Registration | 'date', direction: 'asc' | 'desc' } | null>(null);

    // Filters
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterServer, setFilterServer] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

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

    // Form Data
    const [formData, setFormData] = useState({
        phoneNumber: '',
        fullName: '',
        ktpNumber: '',
        address: '',
        locationId: '',
    });
    const [installData, setInstallData] = useState({
        technician: '',
        companion: '',
        date: '',
    });

    useEffect(() => {
        fetchRegistrations();
        fetchServers();
        fetchEmployeesAndTitles();
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
            setFormData({ phoneNumber: '', fullName: '', ktpNumber: '', address: '', locationId: '' });
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
        });
        setIsFormOpen(true);
    };

    const openDetail = (reg: Registration) => {
        setDetailReg(reg);
        setIsDetailOpen(true);
    };

    const handleCancelReg = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this registration?')) return;
        try {
            await axios.put(`/api/registrations/${id}`, { status: 'cancel' });
            fetchRegistrations();
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
        });
        setIsInstallOpen(true);
    };

    const handleInstallSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReg) return;
        try {
            await axios.put(`/api/registrations/${selectedReg.id}`, {
                status: 'installation_process',
                installation: installData,
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
        } else {
            // Active view: Show everything EXCEPT 'done'
            if (r.status === 'done') return false;
        }

        const matchesSearch = r.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.phoneNumber.includes(searchTerm);

        const matchesServer = filterServer ? r.locationId === filterServer : true;
        const matchesStatus = filterStatus !== 'all' ? r.status === filterStatus : true;

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

        return matchesSearch && matchesServer && matchesStatus && matchesDate;
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

    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, filterServer, filterDateStart, filterDateEnd, itemsPerPage]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        {view === 'completed' ? 'Completed Registrations' : 'Active Registrations'}
                    </h1>
                    <p className="text-slate-500">
                        {view === 'completed' ? 'History of completed registrations' : 'Manage new WiFi registrations'}
                    </p>
                </div>
                <button
                    onClick={() => { setEditingReg(null); setFormData({ phoneNumber: '', fullName: '', ktpNumber: '', address: '', locationId: '' }); setIsFormOpen(true); }}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Registration
                </button>
            </div>

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
                                    { label: 'Cancelled', value: 'cancel' }
                                ]}
                                placeholder="Status"
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
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>Status</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('createdAt')}>Reg. Date</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('fullName')}>Customer</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('locationId')}>Location</th>
                                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>Installation Info</th>
                                <th className="px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : paginatedRegs.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No registrations found</td></tr>
                            ) : paginatedRegs.map(reg => (
                                <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${reg.status === 'queue' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            reg.status === 'installation_process' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                reg.status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {reg.status === 'queue' && 'Pending'}
                                            {reg.status === 'installation_process' && 'Installing'}
                                            {reg.status === 'done' && 'Done'}
                                            {reg.status === 'cancel' && 'Cancelled'}
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
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openDetail(reg)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="View Details">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {reg.status === 'queue' && (
                                                <>
                                                    <button onClick={() => openEdit(reg)} className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-md transition-colors" title="Edit">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => openInstall(reg)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Process Installation">
                                                        <Wrench className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleCancelReg(reg.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Cancel">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {reg.status === 'cancel' && (
                                                <button onClick={() => handleReinstall(reg.id)} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Reinstall">
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Show</span>
                        <div className="w-[80px]">
                            <SearchableSelect
                                value={itemsPerPage}
                                onChange={(val) => {
                                    setItemsPerPage(Number(val));
                                    setCurrentPage(1);
                                }}
                                options={[
                                    { label: '10', value: 10 },
                                    { label: '50', value: 50 },
                                    { label: '100', value: 100 },
                                    { label: 'All', value: -1 }
                                ]}
                            />
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Location (Server) <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    required
                                    value={formData.locationId}
                                    onChange={(val) => setFormData({ ...formData, locationId: val })}
                                    options={[
                                        { label: 'Select Server...', value: '' },
                                        ...servers.map(server => ({ label: server.name, value: server.name }))
                                    ]}
                                    placeholder="Select Server..."
                                />
                            </div>
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
                                        <div className="col-span-2">
                                            <div className="text-slate-500 mb-1">Scheduled Date</div>
                                            <div className="font-medium text-slate-900">
                                                {new Date(detailReg.installation.date).toLocaleString([], { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        {detailReg.installation.finishDate && (
                                            <div className="col-span-2 mt-2 pt-2 border-t border-slate-100">
                                                <div className="text-slate-500 mb-1 text-xs uppercase tracking-wide font-semibold">Finish Date</div>
                                                <div className="font-medium text-emerald-700 bg-emerald-50 inline-block px-2 py-1 rounded">
                                                    {new Date(detailReg.installation.finishDate).toLocaleString()}
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
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsInstallOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Start Installation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

}
