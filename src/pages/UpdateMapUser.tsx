import { useState, useEffect } from 'react';
import { MapPin, Server, Search, CheckCircle2, RefreshCcw } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useServers } from '@/context/ServerContext';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import axios from 'axios';
export function UpdateMapUser() {
    const { servers } = useServers();
    const { customers, refreshCustomers } = useData();

    const [selectedServer, setSelectedServer] = useState<string>('');
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [mapsUrl, setMapsUrl] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filter customers by selected server
    const serverCustomers = customers.filter(c => c.serverId === selectedServer && !c.disabled);

    useEffect(() => {
        setSelectedCustomer('');
        setMapsUrl('');
        setSuccess(false);
        setError(null);
    }, [selectedServer]);

    const handleUpdate = async () => {
        if (!selectedCustomer) {
            setError('Please select a user first');
            return;
        }
        if (!mapsUrl) {
            setError('Please enter a Google Maps link');
            return;
        }

        const customer = customers.find(c => c.id === selectedCustomer || c.name === selectedCustomer);
        if (!customer) {
            setError('Customer not found');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            // Extract lat long just in case we need it, though saving mapsUrl directly might be fine.
            // But we will pass the mapsUrl so the API handles it. If the API expects `coordinates`, we'll try to extract it.
            let lat = '', long = '';
            const match = mapsUrl.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || mapsUrl.match(/q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
            if (match) {
                lat = match[1];
                long = match[2];
            }

            const customerId = customer.crmId || customer.id || customer.name;
            await axios.put(`/api/customers/${customerId}`, {
                ...customer, // Keep existing data
                mapsUrl: mapsUrl, // API might use this
                coordinates: lat && long ? `${lat},${long}` : customer.coordinates,
                serverId: selectedServer
            });

            // Also try to update registration if possible
            if (customer.registrationId) {
                 await axios.put(`/api/registrations/${customer.registrationId}`, {
                    mapsUrl: mapsUrl
                 });
            }

            setSuccess(true);
            setMapsUrl('');
            setSelectedCustomer('');
            refreshCustomers();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || err.message || 'Failed to update map');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-6 h-6 text-primary" />
                    Update User Map
                </h1>
                <p className="text-slate-500 mt-1">Update location coordinate of a user using a Google Maps link.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                
                {/* 1. Select Server */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Server className="w-4 h-4 text-slate-400" />
                        Select Server
                    </label>
                    <SearchableSelect
                        value={selectedServer}
                        onChange={setSelectedServer}
                        options={[
                            { label: 'Select a server...', value: '' },
                            ...servers.map((s: any) => ({ label: s.name, value: s.id }))
                        ]}
                        placeholder="Select a server..."
                    />
                </div>

                {/* 2. Select User */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        Select User
                    </label>
                    <SearchableSelect
                        value={selectedCustomer}
                        onChange={setSelectedCustomer}
                        options={[
                            { label: selectedServer ? 'Select a user...' : 'Select a server first', value: '' },
                            ...serverCustomers.map(c => ({ 
                                label: `${c.name} ${c.realName ? `(${c.realName})` : ''}`, 
                                value: c.id || c.name 
                            }))
                        ]}
                        placeholder="Select a user..."
                        disabled={!selectedServer}
                    />
                    {selectedCustomer && (
                        <p className="text-xs text-slate-500 mt-2">
                            Current Location:{' '}
                            {serverCustomers.find(c => (c.id || c.name) === selectedCustomer)?.coordinates || serverCustomers.find(c => (c.id || c.name) === selectedCustomer)?.mapsUrl || 'Not set'}
                        </p>
                    )}
                </div>

                {/* 3. Input Maps URL */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        Google Maps Link
                    </label>
                    <input
                        type="url"
                        value={mapsUrl}
                        onChange={(e) => setMapsUrl(e.target.value)}
                        placeholder="https://maps.google.com/..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        disabled={!selectedCustomer}
                    />
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Location updated successfully!
                    </div>
                )}

                {/* Submit */}
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleUpdate}
                        disabled={!selectedCustomer || !mapsUrl || loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        {loading ? 'Updating...' : 'Update Location'}
                    </button>
                </div>
            </div>
        </div>
    );
}
