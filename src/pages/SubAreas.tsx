import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react';
import { useServers } from '@/context/ServerContext';


interface SubArea {
    id: string;
    name: string;
    serverId: string;
    description?: string;
}

export function SubAreas() {
    const { servers } = useServers();
    const [subAreas, setSubAreas] = useState<SubArea[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAppearing, setIsAppearing] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingArea, setEditingArea] = useState<SubArea | null>(null);
    const [formData, setFormData] = useState({ name: '', serverId: '', description: '' });

    useEffect(() => {
        setIsAppearing(true);
        fetchSubAreas();
    }, []);

    const fetchSubAreas = async () => {
        try {
            const res = await axios.get('/api/sub-areas');
            setSubAreas(res.data);
        } catch (error) {
            console.error("Failed to fetch sub areas", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (area?: SubArea) => {
        if (area) {
            setEditingArea(area);
            setFormData({ name: area.name, serverId: area.serverId, description: area.description || '' });
        } else {
            setEditingArea(null);
            setFormData({ name: '', serverId: servers[0]?.id || '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingArea) {
                await axios.put(`/api/sub-areas/${editingArea.id}`, formData);
            } else {
                await axios.post('/api/sub-areas', formData);
            }
            fetchSubAreas();
            setIsModalOpen(false);
        } catch (error: any) {
            alert('Failed to save sub area: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this sub area?')) return;
        try {
            await axios.delete(`/api/sub-areas/${id}`);
            fetchSubAreas();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    const getServerName = (id: string) => {
        const server = servers.find(s => s.id === id);
        return server ? server.name : 'Unknown Server';
    };

    return (
        <div className={`p-6 max-w-5xl mx-auto transition-opacity duration-500 ${isAppearing ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sub Areas</h1>
                    <p className="text-slate-500">Manage sub-areas for customer grouping</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Add Sub Area
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Server</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                        ) : subAreas.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-8 h-8 text-slate-300" />
                                        <p>No sub areas found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            subAreas.map(area => (
                                <tr key={area.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{area.name}</td>
                                    <td className="px-6 py-4 text-slate-700">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs border border-slate-200 font-medium">
                                            {getServerName(area.serverId)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{area.description || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenModal(area)}
                                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(area.id)}
                                                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm transition-all">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-semibold text-lg text-slate-900">{editingArea ? 'Edit Sub Area' : 'New Sub Area'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Cibinong Area"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Server <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={formData.serverId}
                                    onChange={e => setFormData({ ...formData, serverId: e.target.value })}
                                >
                                    <option value="" disabled>Select Server</option>
                                    {servers.map(server => (
                                        <option key={server.id} value={server.id}>{server.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional description..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 shadow-sm transition-all active:scale-95"
                                >
                                    <Save className="w-4 h-4" />
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
