import { useState, useEffect } from 'react';

interface MapSettings {
    defaultLat: number;
    defaultLng: number;
    maxZoomIn: number;
    maxZoomOut: number;
    defaultZoom: number;
    mapStyle: 'm' | 's' | 'y' | 'p';
    routingMode: 'none' | 'osrm';
}

interface TopologySettingsViewProps {
    settings: MapSettings;
    onSave: (newSettings: MapSettings) => void;
}

export function TopologySettingsView({ settings: initialSettings, onSave }: TopologySettingsViewProps) {
    const [settings, setSettings] = useState<MapSettings>(initialSettings);

    useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings]);

    const handleSave = () => {
        onSave(settings);
    };

    return (
        <div className="bg-white border text-left border-slate-200 rounded-xl p-8 shadow-sm">
            
            <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Center Coordinates</h3>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Latitude</label>
                        <input 
                            type="number" 
                            step="any"
                            value={settings.defaultLat} 
                            onChange={e => setSettings({...settings, defaultLat: parseFloat(e.target.value)})}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Longitude</label>
                        <input 
                            type="number" 
                            step="any"
                            value={settings.defaultLng} 
                            onChange={e => setSettings({...settings, defaultLng: parseFloat(e.target.value)})}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="mb-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Zoom Levels</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Max Zoom In</label>
                        <input 
                            type="number" 
                            value={settings.maxZoomIn} 
                            onChange={e => setSettings({...settings, maxZoomIn: parseInt(e.target.value)})}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Max Zoom Out</label>
                        <input 
                            type="number" 
                            value={settings.maxZoomOut} 
                            onChange={e => setSettings({...settings, maxZoomOut: parseInt(e.target.value)})}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-2">Default Zoom</label>
                        <input 
                            type="number" 
                            value={settings.defaultZoom} 
                            onChange={e => setSettings({...settings, defaultZoom: parseInt(e.target.value)})}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="mb-8 border-t border-slate-100 pt-8">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Map Appearance</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { id: 'm', name: 'Street Map', desc: 'Standard map' },
                        { id: 's', name: 'Satellite', desc: 'Pure imagery' },
                        { id: 'y', name: 'Hybrid', desc: 'Imagery + streets' },
                        { id: 'p', name: 'Terrain', desc: 'Topographic map' }
                    ].map(style => (
                        <div 
                            key={style.id}
                            onClick={() => setSettings({...settings, mapStyle: style.id as any})}
                            className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${settings.mapStyle === style.id || (!settings.mapStyle && style.id === 'm') ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`font-bold text-sm ${settings.mapStyle === style.id || (!settings.mapStyle && style.id === 'm') ? 'text-blue-700' : 'text-slate-700'}`}>{style.name}</span>
                                {(settings.mapStyle === style.id || (!settings.mapStyle && style.id === 'm')) && (
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500">{style.desc}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-8 border-t border-slate-100 pt-8">
                <h3 className="text-sm font-bold text-slate-800 mb-1">Fiber Line Routing</h3>
                <p className="text-xs text-slate-500 mb-4">Pilih bagaimana garis fiber digambarkan di peta. Mode OSRM akan membuat garis mengikuti jalur jalan.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        {
                            id: 'none',
                            name: 'Garis Lurus',
                            desc: 'Garis fiber ditarik lurus dari titik ke titik.',
                            icon: '📏',
                            badge: null
                        },
                        {
                            id: 'osrm',
                            name: 'Ikut Jalan (OSRM)',
                            desc: 'Garis fiber mengikuti jalur jalan berdasarkan data OpenStreetMap. Membutuhkan koneksi internet.',
                            icon: '🛣️',
                            badge: 'Gratis'
                        }
                    ].map(mode => (
                        <div
                            key={mode.id}
                            onClick={() => setSettings({...settings, routingMode: mode.id as any})}
                            className={`cursor-pointer border-2 rounded-xl p-4 transition-all ${
                                (settings.routingMode || 'none') === mode.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{mode.icon}</span>
                                    <span className={`font-bold text-sm ${
                                        (settings.routingMode || 'none') === mode.id ? 'text-blue-700' : 'text-slate-700'
                                    }`}>{mode.name}</span>
                                    {mode.badge && (
                                        <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">{mode.badge}</span>
                                    )}
                                </div>
                                {(settings.routingMode || 'none') === mode.id && (
                                    <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500 ml-7">{mode.desc}</p>
                        </div>
                    ))}
                </div>
                {(settings.routingMode === 'osrm') && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                            Mode OSRM bergantung pada API publik <code className="bg-amber-100 px-1 rounded font-mono">router.project-osrm.org</code>. 
                            Akurasi terbaik di area yang sudah terpetakan di OpenStreetMap. 
                            Gunakan tombol <strong>Snap to Roads</strong> di toolbar peta untuk merekalkulate garis yang sudah ada.
                        </p>
                    </div>
                )}
            </div>

            <button 
                onClick={handleSave}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
                {/* Save Icon SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Save Settings
            </button>
        </div>
    );
}
