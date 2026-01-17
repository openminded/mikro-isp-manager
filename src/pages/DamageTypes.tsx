import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react';
import { type DamageType } from '@/types';

export function DamageTypes() {
    const [types, setTypes] = useState<DamageType[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAppearing, setIsAppearing] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<DamageType | null>(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    useEffect(() => {
        setIsAppearing(true);
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        try {
            const res = await axios.get('/api/damage-types');
            setTypes(res.data);
        } catch (error) {
            console.error("Failed to fetch damage types", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (type?: DamageType) => {
        if (type) {
            setEditingType(type);
            setFormData({ name: type.name, description: type.description || '' });
        } else {
            setEditingType(null);
            setFormData({ name: '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingType) {
                await axios.put(`/api/damage-types/${editingType.id}`, formData);
            } else {
                await axios.post('/api/damage-types', formData);
            }
            fetchTypes();
            setIsModalOpen(false);
        } catch (error) {
            alert('Failed to save damage type');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this damage type?')) return;
        try {
            await axios.delete(`/api/damage-types/${id}`);
            fetchTypes();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    return (
        <div className={`p-6 max-w-5xl mx-auto transition-opacity duration-500 ${isAppearing ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Damage Types</h1>
                    <p className="text-slate-500">Manage categories for support tickets</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Add Type
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-400">Loading...</td></tr>
                        ) : types.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-8 h-8 text-slate-300" />
                                        <p>No damage types found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            types.map(type => (
                                <tr key={type.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900">{type.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{type.description || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenModal(type)}
                                                className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/5 rounded-md transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(type.id)}
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
                            <h3 className="font-semibold text-lg text-slate-900">{editingType ? 'Edit Damage Type' : 'New Damage Type'}</h3>
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
                                    placeholder="e.g. Fiber Cut"
                                />
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
