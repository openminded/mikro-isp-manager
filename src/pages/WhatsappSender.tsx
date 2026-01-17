
import { useState } from 'react';
import axios from 'axios';
import { Send, Phone, MessageSquare, RefreshCw } from 'lucide-react';

export function WhatsappSender() {
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone || !message) return;

        setSending(true);
        try {
            await axios.post('/api/whatsapp/send', { phone, message });
            alert('Message sent successfully!');
            setMessage('');
            setPhone('');
        } catch (error: any) {
            alert('Failed to send message: ' + (error.response?.data?.error || error.message));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Send Message</h1>
                <p className="text-slate-500">Send WhatsApp messages directly</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <form onSubmit={handleSend} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Phone className="w-4 h-4" /> Phone Number
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 628123456789"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        />
                        <p className="text-xs text-slate-500">Include country code (e.g. 62 for Indonesia)</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" /> Message
                        </label>
                        <textarea
                            placeholder="Type your message here..."
                            rows={4}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            required
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={sending}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {sending ? 'Sending...' : 'Send Message'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
