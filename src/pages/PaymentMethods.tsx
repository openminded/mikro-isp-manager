
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';

interface PaymentMethod {
    id: string;
    name: string;
    type: 'cash' | 'bank_transfer' | 'manual' | 'ewallet';
    accountNumber: string;
    accountName: string;
}

export function PaymentMethods() {
    const [items, setItems] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PaymentMethod | null>(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await axios.get('/api/payment-methods');
            setItems(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payment method?')) return;
        try {
            await axios.delete(`/api/payment-methods/${id}`);
            fetchItems();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    const handleEdit = (item: PaymentMethod) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const data = {
            name: formData.get('name'),
            type: formData.get('type'),
            accountNumber: formData.get('accountNumber'),
            accountName: formData.get('accountName'),
        };

        try {
            if (editingItem) {
                await axios.put(`/api/payment-methods/${editingItem.id}`, data);
            } else {
                await axios.post('/api/payment-methods', data);
            }
            setIsModalOpen(false);
            fetchItems();
        } catch (error) {
            alert('Failed to save');
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Payment Methods</h1>
                    <p className="text-slate-500">Manage payment options for invoices</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Method
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-slate-700">Name</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Type</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Account Details</th>
                            <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={4} className="p-6 text-center">Loading...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={4} className="p-6 text-center text-slate-500">No payment methods found.</td></tr>
                        ) : (
                            items.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <CreditCard className="w-4 h-4" />
                                        </div>
                                        {item.name}
                                    </td>
                                    <td className="px-6 py-4 capitalize text-slate-600">{item.type.replace('_', ' ')}</td>
                                    <td className="px-6 py-4 text-slate-600">
                                        {item.accountNumber ? (
                                            <div>
                                                <div className="font-mono text-xs bg-slate-100 px-2 py-1 rounded w-fit">{item.accountNumber}</div>
                                                <div className="text-xs mt-1 text-slate-500">{item.accountName}</div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-xs italic">No account details</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-semibold text-lg">{editingItem ? 'Edit Payment Method' : 'Add Payment Method'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Method Name</label>
                                <input name="name" defaultValue={editingItem?.name} required placeholder="e.g. BCA Transfer" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                <select name="type" defaultValue={editingItem?.type || 'bank_transfer'} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="ewallet">E-Wallet</option>
                                    <option value="manual">Other / Manual</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                                    <input name="accountNumber" defaultValue={editingItem?.accountNumber} placeholder="Optional" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                                    <input name="accountName" defaultValue={editingItem?.accountName} placeholder="Optional" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full py-2 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium transition-colors">
                                    Save Method
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
