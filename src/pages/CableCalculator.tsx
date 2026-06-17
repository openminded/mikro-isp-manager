import { useState } from 'react';
import { Calculator as CalculatorIcon, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CableCalculator() {
    const [start, setStart] = useState<string>('');
    const [end, setEnd] = useState<string>('');

    const startNum = parseFloat(start);
    const endNum = parseFloat(end);

    let totalLength = 0;
    let cost = 0;
    let details = '';
    let isValid = false;

    if (!isNaN(startNum) && !isNaN(endNum)) {
        if (startNum >= endNum) {
            isValid = true;
            totalLength = startNum - endNum;
            if (totalLength <= 200) {
                cost = 0;
                details = "Total kabel <= 200 meter (Gratis)";
            } else if (totalLength <= 600) {
                cost = (totalLength - 200) * 3000;
                details = `${totalLength}m - 200m (gratis) = ${totalLength - 200}m x Rp 3.000`;
            } else {
                cost = (totalLength - 200) * 2500;
                details = `${totalLength}m - 200m (gratis) = ${totalLength - 200}m x Rp 2.500`;
            }
        } else {
            details = "Kabel Start harus lebih besar atau sama dengan Kabel End";
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-200">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <CalculatorIcon className="w-6 h-6 text-primary" /> Kalkulator Kabel
                </h1>
                <p className="text-slate-500 mt-1">Hitung estimasi biaya tarikan kabel ke rumah pelanggan berdasarkan selisih meteran kabel.</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 block">Angka Meteran Start (Awal)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg font-mono"
                                placeholder="Contoh: 2000"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 block">Angka Meteran End (Di Pelanggan)</label>
                            <input
                                type="number"
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg font-mono"
                                placeholder="Contoh: 1700"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                            />
                        </div>
                        
                        {isValid && totalLength > 600 && totalLength < 720 && (
                            <div className="text-amber-600 bg-amber-50 p-4 rounded-lg text-sm flex items-start gap-3 border border-amber-100">
                                <span className="font-bold">Info:</span>
                                <div className="leading-relaxed">Karena panjang kabel melewati 600m (masuk tarif Rp 2.500/m), secara nominal total biayanya lebih murah dibandingkan pas di panjang 600m. Ini efek normal dari perubahan struktur tarif.</div>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-col justify-center">
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6 text-center">Hasil Perhitungan</h3>
                        
                        <div className="space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
                                <span className="text-slate-500 font-medium flex items-center gap-2"><Cable className="w-4 h-4" /> Panjang Kabel</span>
                                <span className={cn("text-xl font-bold", isValid ? "text-slate-900" : "text-slate-400")}>
                                    {isValid ? `${totalLength} Meter` : '-'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center pb-4 border-b border-slate-200 border-dashed">
                                <span className="text-slate-500 font-medium">Rincian Perhitungan</span>
                                <span className={cn("text-sm font-medium text-right max-w-[220px]", isValid ? "text-slate-600" : "text-red-500")}>
                                    {details || '-'}
                                </span>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                <span className="text-slate-700 font-bold text-lg">Total Biaya</span>
                                <span className={cn("text-3xl font-bold", isValid && cost > 0 ? "text-emerald-600" : isValid && cost === 0 ? "text-blue-600" : "text-slate-400")}>
                                    {isValid ? formatCurrency(cost) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
