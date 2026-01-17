
import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { RefreshCw, LogOut, CheckCircle, Smartphone } from 'lucide-react';

export function WhatsappManager() {
    const [status, setStatus] = useState('disconnected');
    const [qr, setQr] = useState('');
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/whatsapp/status');
            setStatus(res.data.status);
            setQr(res.data.qr || '');
            setUser(res.data.user || null);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        if (!confirm('Are you sure you want to logout?')) return;
        try {
            setLoading(true);
            await axios.post('/api/whatsapp/logout');
            // Status will update via polling
        } catch (error) {
            alert('Failed to logout');
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">WhatsApp Manager</h1>
                <p className="text-slate-500">Manage your WhatsApp connection</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[400px]">
                {loading && status === 'disconnected' ? (
                    <div className="text-slate-400 flex flex-col items-center gap-2">
                        <RefreshCw className="w-8 h-8 animate-spin" />
                        <p>Checking status...</p>
                    </div>
                ) : (
                    <>
                        {status === 'connected' ? (
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                                    <CheckCircle className="w-10 h-10" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Connected</h2>
                                    <p className="text-slate-500">
                                        {user?.id ? `Linked to ${user.name || user.id}` : 'WhatsApp is ready to use'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-200"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="text-center space-y-6">
                                {qr ? (
                                    <div className="space-y-4">
                                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 inline-block">
                                            <QRCodeSVG value={qr} size={250} level="M" />
                                        </div>
                                        <p className="text-slate-600 max-w-sm mx-auto">
                                            Open WhatsApp on your phone &rarr; Menu &rarr; Linked Devices &rarr; Link a Device and scan this QR code.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                            <Smartphone className="w-8 h-8" />
                                        </div>
                                        <p className="text-slate-500">Waiting for QR Code...</p>
                                        <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
