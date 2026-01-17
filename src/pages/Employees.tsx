import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Edit2, Trash2, Key, X, Lock, ShieldCheck, User as UserIcon, MapPin, Smartphone, Briefcase, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import type { User } from '@/types';

interface Employee {
    id: string;
    name: string;
    phoneNumber: string;
    jobTitleId: string;
    ttl: string;
    nik: string;
    photoUrl?: string;
}

interface JobTitle {
    id: string;
    name: string;
}

export function Employees() {
    const { user: currentUser } = useAuth();
    const isSuperAdmin = currentUser?.role === 'superadmin';

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
    const [users, setUsers] = useState<User[]>([]); // To track existing accounts

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Employee Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [employeeFormData, setEmployeeFormData] = useState({
        name: '',
        phoneNumber: '',
        jobTitleId: '',
        ttl: '',
        nik: '',
        photoUrl: ''
    });

    // Access Modal State
    const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
    const [selectedEmployeeForAccess, setSelectedEmployeeForAccess] = useState<Employee | null>(null);
    const [accessFormData, setAccessFormData] = useState({
        username: '',
        password: '',
        role: 'technician'
    });
    const [existingAccount, setExistingAccount] = useState<User | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [empRes, jobRes] = await Promise.all([
                axios.get('/api/employees'),
                axios.get('/api/job-titles')
            ]);
            setEmployees(empRes.data);
            setJobTitles(jobRes.data);

            if (isSuperAdmin) {
                fetchUsers();
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        if (!isSuperAdmin) return;
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data);
        } catch (error) { console.error("Failed to fetch users", error); }
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        setEmployeeFormData({
            name: employee.name,
            phoneNumber: employee.phoneNumber,
            jobTitleId: employee.jobTitleId,
            ttl: employee.ttl,
            nik: employee.nik,
            photoUrl: employee.photoUrl || ''
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this employee?')) return;
        try {
            await axios.delete(`/api/employees/${id}`);
            setEmployees(employees.filter(e => e.id !== id));
        } catch (error) {
            alert('Failed to delete employee');
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingEmployee) {
                await axios.put(`/api/employees/${editingEmployee.id}`, employeeFormData);
            } else {
                await axios.post('/api/employees', employeeFormData);
            }
            fetchInitialData(); // Refetch to be safe
            setIsFormOpen(false);
            setEditingEmployee(null);
            setEmployeeFormData({ name: '', phoneNumber: '', jobTitleId: '', ttl: '', nik: '', photoUrl: '' });
        } catch (error) {
            alert('Failed to save employee');
        }
    };

    // User Access Management
    const openAccessModal = (employee: Employee) => {
        setSelectedEmployeeForAccess(employee);
        const account = users.find(u => u.employeeId === employee.id);
        setExistingAccount(account || null);

        if (account) {
            setAccessFormData({
                username: account.username,
                password: '', // Don't show password
                role: account.role || 'technician'
            });
        } else {
            // New Account Defaults
            setAccessFormData({
                username: employee.name.toLowerCase().replace(/\s+/g, ''),
                password: '',
                role: 'technician'
            });
        }
        setIsAccessModalOpen(true);
    };

    const handleAccessSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEmployeeForAccess) return;

        try {
            await axios.post('/api/users/manage', {
                employeeId: selectedEmployeeForAccess.id,
                name: selectedEmployeeForAccess.name,
                ...accessFormData
            });
            alert('User access updated successfully');
            setIsAccessModalOpen(false);
            fetchUsers();
        } catch (error: any) {
            alert(`Failed to update user: ${error.response?.data?.error || error.message}`);
        }
    };

    const filteredEmployees = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getJobTitleName = (id: string) => {
        return jobTitles.find(j => j.id === id)?.name || 'Unknown';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
                    <p className="text-slate-500">Manage your workforce</p>
                </div>
                <button
                    onClick={() => { setEditingEmployee(null); setEmployeeFormData({ name: '', phoneNumber: '', jobTitleId: '', ttl: '', nik: '', photoUrl: '' }); setIsFormOpen(true); }}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Employee
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Employee Name</th>
                                <th className="px-6 py-4">Job Title</th>
                                <th className="px-6 py-4">Details</th>
                                <th className="px-6 py-4">Contact</th>
                                {isSuperAdmin && <th className="px-6 py-4">User Account</th>}
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : filteredEmployees.map((employee) => {
                                const jobTitle = getJobTitleName(employee.jobTitleId);
                                const account = users.find(u => u.employeeId === employee.id);

                                return (
                                    <tr key={employee.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {employee.photoUrl ? (
                                                    <img src={employee.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                                        <UserIcon className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium text-slate-900">{employee.name}</div>
                                                    <div className="text-xs text-slate-500">{employee.nik}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                                <Briefcase className="w-3 h-3" />
                                                {jobTitle}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                <MapPin className="w-3 h-3" /> {employee.ttl || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Smartphone className="w-3 h-3" /> {employee.phoneNumber}
                                            </div>
                                        </td>
                                        {isSuperAdmin && (
                                            <td className="px-6 py-4">
                                                {account ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                                        <ShieldCheck className="w-4 h-4" />
                                                        {account.username} ({account.role})
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No account</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center gap-2">
                                                {isSuperAdmin && (
                                                    <button
                                                        onClick={() => openAccessModal(employee)}
                                                        className={`p-1.5 rounded-md transition-colors ${account ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                                        title="Manage Login Access"
                                                    >
                                                        <Key className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEdit(employee)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(employee.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                    title="Delete"
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
            </div>

            {/* Employee Modal (Create/Edit) */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg text-slate-900">{editingEmployee ? 'Edit Employee' : 'New Employee'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">

                            {/* Photo Upload */}
                            <div className="flex justify-center mb-4">
                                <div className="relative group cursor-pointer">
                                    <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                        {employeeFormData.photoUrl ? (
                                            <img src={employeeFormData.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-10 h-10 text-slate-400" />
                                        )}
                                    </div>
                                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <label className="cursor-pointer text-white text-xs font-medium flex flex-col items-center">
                                            <Edit2 className="w-4 h-4 mb-1" />
                                            Change
                                            <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                if (e.target.files?.[0]) {
                                                    const formData = new FormData();
                                                    formData.append('photos', e.target.files[0]);
                                                    try {
                                                        const res = await axios.post('/api/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                                                        setEmployeeFormData({ ...employeeFormData, photoUrl: res.data.urls[0] });
                                                    } catch (err) { alert('Upload failed'); }
                                                }
                                            }} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                    <input required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={employeeFormData.name} onChange={e => setEmployeeFormData({ ...employeeFormData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={employeeFormData.phoneNumber}
                                        onChange={e => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.startsWith('0')) val = '62' + val.slice(1);
                                            // Simple check, let user type mostly
                                            setEmployeeFormData({ ...employeeFormData, phoneNumber: val });
                                        }}
                                        placeholder="628..."
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">NIK</label>
                                    <input
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={employeeFormData.nik}
                                        onChange={e => setEmployeeFormData({ ...employeeFormData, nik: e.target.value })}
                                        placeholder="NIK"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">TTL</label>
                                    <input
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={employeeFormData.ttl}
                                        onChange={e => setEmployeeFormData({ ...employeeFormData, ttl: e.target.value })}
                                        placeholder="Place, Date"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title / Jabatan <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                    required
                                    value={employeeFormData.jobTitleId}
                                    onChange={(val) => setEmployeeFormData({ ...employeeFormData, jobTitleId: val })}
                                    options={[
                                        { label: 'Select Job Title...', value: '' },
                                        ...jobTitles.map(t => ({ label: t.name, value: t.id }))
                                    ]}
                                    placeholder="Select Job Title..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Access Management Modal (Superadmin Only) */}
            {isAccessModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-2">
                                <Lock className="w-5 h-5 text-primary" />
                                <h3 className="font-semibold text-lg text-slate-900">Manage Access</h3>
                            </div>
                            <button onClick={() => setIsAccessModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-sm text-blue-800">
                            Configuring access for <strong>{selectedEmployeeForAccess?.name}</strong>
                        </div>

                        <form onSubmit={handleAccessSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        required
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={accessFormData.username}
                                        onChange={e => setAccessFormData({ ...accessFormData, username: e.target.value })}
                                        placeholder="username"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {existingAccount ? 'New Password (Optional)' : 'Password'}
                                </label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text" // Visible for admin creation
                                        required={!existingAccount}
                                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        value={accessFormData.password}
                                        onChange={e => setAccessFormData({ ...accessFormData, password: e.target.value })}
                                        placeholder={existingAccount ? "Leave blank to keep current" : "Enter password"}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                <SearchableSelect
                                    required
                                    value={accessFormData.role}
                                    onChange={(val) => setAccessFormData({ ...accessFormData, role: val })}
                                    options={[
                                        { label: 'Technician', value: 'technician' },
                                        { label: 'Admin', value: 'admin' },
                                        { label: 'Superadmin', value: 'superadmin' }
                                    ]}
                                    placeholder="Select Role"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsAccessModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">
                                    {existingAccount ? 'Update Access' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
