import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, XCircle, Trash2, BadgeCheck } from 'lucide-react';
import axios from 'axios';

interface JobTitle {
    id: string;
    name: string;
    createdAt: string;
}

export function JobTitles() {
    const [titles, setTitles] = useState<JobTitle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<JobTitle | null>(null);
    const [formData, setFormData] = useState({ name: '' });

    useEffect(() => {
        fetchTitles();
    }, []);

    const fetchTitles = async () => {
        try {
            const res = await axios.get('http://localhost:3001/api/job-titles');
            setTitles(res.data);
        } catch (error) {
            console.error("Failed to fetch job titles", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingItem) {
                await axios.put(`http://localhost:3001/api/job-titles/${editingItem.id}`, formData);
            } else {
                await axios.post('http://localhost:3001/api/job-titles', formData);
            }
            fetchTitles();
            closeModal();
        } catch (error) {
            alert('Failed to save');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this job title?')) return;
        try {
            await axios.delete(`http://localhost:3001/api/job-titles/${id}`);
            fetchTitles();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    const openModal = (item?: JobTitle) => {
        if (item) {
            setEditingItem(item);
            setFormData({ name: item.name });
        } else {
            setEditingItem(null);
            setFormData({ name: '' });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({ name: '' });
    };

    const filtered = titles.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <BadgeCheck className="w-6 h-6 text-primary" />
                        Job Titles
                    </h1>
                    <p className="text-slate-500">Manage employee job titles and positions</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Job Title
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden max-w-3xl">
                <div className="p-4 border-b border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search job titles..."
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
                                <th className="px-6 py-4">Title Name</th>
                                <th className="px-6 py-4 w-32 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {loading ? (
                                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400">No job titles found</td></tr>
                            ) : filtered.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
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
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg">{editingItem ? 'Edit Job Title' : 'New Job Title'}</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title Name <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-primary focus:border-primary outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
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
