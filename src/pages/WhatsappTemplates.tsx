
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Check, X, MessageSquare, Save } from 'lucide-react';
import { cn } from "@/lib/utils";

export function WhatsappTemplates() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: '', content: '' });
    const [isCreating, setIsCreating] = useState(false);

    const fetchTemplates = async () => {
        try {
            const res = await axios.get('/api/whatsapp/templates');
            setTemplates(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleCreate = async () => {
        if (!formData.name || !formData.content) return;
        try {
            await axios.post('/api/whatsapp/templates', formData);
            setFormData({ name: '', content: '' });
            setIsCreating(false);
            fetchTemplates();
        } catch (error) {
            alert('Failed to create template');
        }
    };

    const handleUpdate = async (id: string) => {
        try {
            await axios.put(`/api/whatsapp/templates/${id}`, formData);
            setEditingId(null);
            setFormData({ name: '', content: '' });
            fetchTemplates();
        } catch (error) {
            alert('Failed to update template');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try {
            await axios.delete(`/api/whatsapp/templates/${id}`);
            fetchTemplates();
        } catch (error) {
            alert('Failed to delete template');
        }
    };

    const startEdit = (t: any) => {
        setEditingId(t.id);
        setFormData({ name: t.name, content: t.content });
        setIsCreating(false);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Message Templates</h1>
                    <p className="text-slate-500">Manage standard replies and broadcast templates</p>
                </div>
                <button
                    onClick={() => { setIsCreating(true); setFormData({ name: '', content: '' }); setEditingId(null); }}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" /> New Template
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create New Card (Full Width) */}
                {isCreating && (
                    <div className="col-span-1 md:col-span-2 bg-white p-6 rounded-xl border-2 border-primary/20 shadow-lg space-y-6 relative">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                                <Plus className="w-5 h-5" /> New Template
                            </h3>
                            <button onClick={() => setIsCreating(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Template Name</label>
                                <input
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g. Monthly Bill Notification"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Message Content</label>
                                <textarea
                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[300px] font-mono text-sm leading-relaxed"
                                    placeholder="Type your message here..."
                                    value={formData.content}
                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                />
                                <div className="flex gap-2 flex-wrap pt-2">
                                    <span className="text-xs text-slate-500 flex items-center mr-2">Insert variable:</span>
                                    {['{name}', '{server}', '{profile}', '{price}'].map(v => (
                                        <button key={v} onClick={() => setFormData(prev => ({ ...prev, content: prev.content + ' ' + v }))}
                                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg border border-blue-100 transition-colors">
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium">Cancel</button>
                            <button onClick={handleCreate} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-primary/20 transition-all">
                                <Save className="w-4 h-4" /> Save Template
                            </button>
                        </div>
                    </div>
                )}

                {/* Template List */}
                {loading ? (
                    <div className="col-span-full text-center py-12 text-slate-400">Loading templates...</div>
                ) : templates.length === 0 && !isCreating ? (
                    <div className="col-span-full text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                        No templates found. Create one to get started.
                    </div>
                ) : (
                    templates.map(t => (
                        <div key={t.id} className={cn(
                            "bg-white p-4 rounded-xl border shadow-sm transition-all",
                            editingId === t.id ? "border-primary ring-1 ring-primary" : "border-slate-200 hover:border-slate-300"
                        )}>
                            {editingId === t.id ? (
                                <div className="space-y-4 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}>
                                    <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="text-lg font-bold text-slate-900">Editing Template</h3>
                                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">Template Name</label>
                                                <input
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-700">Message Content</label>
                                                <textarea
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[300px] font-mono text-sm leading-relaxed"
                                                    value={formData.content}
                                                    onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                />
                                                <div className="flex gap-2 flex-wrap pt-2">
                                                    <span className="text-xs text-slate-500 flex items-center mr-2">Insert variable:</span>
                                                    {['{name}', '{server}', '{profile}', '{price}'].map(v => (
                                                        <button key={v} onClick={() => setFormData(prev => ({ ...prev, content: prev.content + ' ' + v }))}
                                                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg border border-blue-100 transition-colors">
                                                            {v}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                                            <button onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium border border-slate-200 bg-white">Cancel</button>
                                            <button onClick={() => handleUpdate(t.id)} className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary/90 shadow-lg shadow-primary/20">
                                                <Check className="w-4 h-4" /> Save Changes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                <MessageSquare className="w-4 h-4" />
                                            </div>
                                            <h3 className="font-semibold text-slate-900">{t.name}</h3>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(t)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap font-mono">
                                        {t.content}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
