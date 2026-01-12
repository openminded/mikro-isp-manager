import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, XCircle, Trash2, Users, Briefcase, Smartphone, MapPin } from 'lucide-react';
import axios from 'axios';

interface JobTitle {
    id: string;
    name: string;
}

interface Employee {
    id: string;
    name: string;
    ttl: string;
    nik: string;
    phoneNumber: string;
    jobTitleId: string;
}

export function Employees() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Employee | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        ttl: '',
        nik: '',
        phoneNumber: '',
        jobTitleId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [empRes, jobRes] = await Promise.all([
                axios.get('http://localhost:3001/api/employees'),
                axios.get('http://localhost:3001/api/job-titles')
            ]);
            setEmployees(empRes.data);
            setJobTitles(jobRes.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await axios.put(`http://localhost:3001/api/employees/${editingItem.id}`, formData);
            } else {
                await axios.post('http://localhost:3001/api/employees', formData);
            }
            fetchData();
            closeModal();
        } catch (error) {
            alert('Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this employee?')) return;
        try {
            await axios.delete(`http://localhost:3001/api/employees/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    const openModal = (item?: Employee) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                ttl: item.ttl,
                nik: item.nik,
                phoneNumber: item.phoneNumber,
                jobTitleId: item.jobTitleId
            });
        } else {
            setEditingItem(null);
            setFormData({ name: '', ttl: '', nik: '', phoneNumber: '', jobTitleId: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '', ttl: '', nik: '', phoneNumber: '', jobTitleId: '' });
    };

    const filtered = employees.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.phoneNumber.includes(searchTerm) ||
        e.nik.includes(searchTerm)
    );

    const getJobTitleName = (id: string) => {
        return jobTitles.find(j => j.id === id)?.name || 'Unknown';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-primary" />
                        Employees
                    </h1>
                    <p className="text-slate-500">Manage employee records</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Employee
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
                                <th className="px-6 py-4 w-32 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No employees found</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{item.name}</div>
                                        <div className="text-xs text-slate-500">{item.nik}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                            <Briefcase className="w-3 h-3" />
                                            {getJobTitleName(item.jobTitleId)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                            <MapPin className="w-3 h-3" /> {item.ttl || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <Smartphone className="w-3 h-3" /> {item.phoneNumber}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 flex justify-center gap-2">
                                        <button onClick={() => openModal(item)} className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-md transition-colors" title="Edit">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg">{editingItem ? 'Edit Employee' : 'New Employee'}</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                                    <input required type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
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
                                            if (val.length > 0 && !val.startsWith('62')) val = '62' + val;
                                            setFormData({ ...formData, phoneNumber: val });
                                        }}
                                        placeholder="628..."
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">NIK <span className="text-red-500">*</span></label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={formData.nik}
                                        onChange={e => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, '') })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">TTL (Place, Date)</label>
                                    <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                        value={formData.ttl} onChange={e => setFormData({ ...formData, ttl: e.target.value })} placeholder="Jakarta, 17-08-1990" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title / Jabatan <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none bg-white"
                                    value={formData.jobTitleId}
                                    onChange={e => setFormData({ ...formData, jobTitleId: e.target.value })}
                                >
                                    <option value="">Select Job Title...</option>
                                    {jobTitles.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
