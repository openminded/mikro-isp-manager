import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { useServers } from '@/context/ServerContext';
import { useData } from '@/context/DataContext';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Map as MapIcon, Users, UserCog, Filter } from 'lucide-react';
import type { Registration } from '@/types';
import { cn } from '@/lib/utils';

// Fix leaflet icon paths
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const SERVER_COLORS = [
    '#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

const getServerColor = (serverId: string | number) => {
    if (!serverId) return '#94a3b8';
    const idStr = String(serverId);
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
        hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SERVER_COLORS[Math.abs(hash) % SERVER_COLORS.length];
};

const createCustomIcon = (color: string, dotColor: string = '#ffffff') => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40"><path d="M16 0c-8.837 0-16 7.163-16 16 0 11.046 16 24 16 24s16-12.954 16-24c0-8.837-7.163-16-16-16z" fill="${color}" /><circle cx="16" cy="16" r="10" fill="#ffffff" /><circle cx="16" cy="16" r="7" fill="${dotColor}" /></svg>`;
    return L.divIcon({
        className: 'custom-map-marker bg-transparent border-none',
        html: svg,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
    });
};

const extractCoordinates = (urlOrCoords: string | undefined): [number, number] | null => {
    if (!urlOrCoords) return null;
    const match = urlOrCoords.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || urlOrCoords.match(/@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || urlOrCoords.match(/q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return [lat, lng];
        }
    }
    return null;
};

export function MonitoringUser() {
    const { servers } = useServers();
    const { customers, refreshCustomers } = useData();
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    
    const [activeTab, setActiveTab] = useState<'registration' | 'technician'>('registration');

    // Filters for Registration Tab
    const [regServerFilter, setRegServerFilter] = useState('all');
    const [regStatusFilter, setRegStatusFilter] = useState('all');
    const [regProfileFilter, setRegProfileFilter] = useState('all');

    // Filters for Technician Tab
    const [techServerFilter, setTechServerFilter] = useState('all');
    const [techStatusFilter, setTechStatusFilter] = useState('all');
    const [techFilter, setTechFilter] = useState('all');

    const [mapType, setMapType] = useState<'m' | 'y'>('m');

    useEffect(() => {
        refreshCustomers();
        fetchRegistrations();
    }, []);

    const fetchRegistrations = async () => {
        try {
            const res = await axios.get('/api/registrations');
            if (Array.isArray(res.data)) {
                setRegistrations(res.data);
            } else {
                setRegistrations([]);
            }
        } catch (error) {
            console.error("Failed to fetch registrations", error);
        }
    };

    // Derived Data
    const uniqueProfiles = useMemo(() => {
        let filtered = customers || [];
        if (regServerFilter !== 'all') {
            filtered = filtered.filter(c => c.serverId === regServerFilter);
        }
        return Array.from(new Set(filtered.map(c => c.profile))).sort();
    }, [customers, regServerFilter]);

    useEffect(() => {
        setRegProfileFilter('all');
    }, [regServerFilter]);

    const uniqueTechnicians = useMemo(() => {
        const techs = (registrations || [])
            .map(r => r.installation?.technician)
            .filter((t): t is string => !!t);
        return Array.from(new Set(techs)).sort();
    }, [registrations]);

    // Processed Data for Map Registration
    const mapRegistrationData = useMemo(() => {
        return (customers || []).map(customer => {
            let coords: [number, number] | null = null;
            if (customer.coordinates) coords = extractCoordinates(customer.coordinates);
            else if (customer.lat && customer.long) {
                const lat = parseFloat(customer.lat);
                const lng = parseFloat(customer.long);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    coords = [lat, lng];
                }
            }
            
            // Try to find matching registration for coordinates if none
            if (!coords) {
                const reg = (registrations || []).find(r => r.fullName === customer.realName || r.phoneNumber === customer.whatsapp);
                if (reg?.installation?.coordinates) coords = extractCoordinates(reg.installation.coordinates);
                else if (reg?.mapsUrl) coords = extractCoordinates(reg.mapsUrl);
            }

            return {
                ...customer,
                mappedCoords: coords,
                serverColor: getServerColor(customer.serverId),
                statusColor: customer.disabled ? '#ef4444' : '#10b981' // Red if disabled, Green if active
            };
        }).filter(item => {
            if (!item.mappedCoords) return false;
            if (regServerFilter !== 'all' && item.serverId !== regServerFilter) return false;
            if (regProfileFilter !== 'all' && item.profile !== regProfileFilter) return false;
            if (regStatusFilter !== 'all') {
                if (regStatusFilter === 'active' && item.disabled) return false;
                if (regStatusFilter === 'blocked' && !item.disabled) return false;
            }
            return true;
        });
    }, [customers, registrations, regServerFilter, regProfileFilter, regStatusFilter]);

    // Processed Data for Map Technician
    const mapTechnicianData = useMemo(() => {
        return (registrations || []).filter(r => r.installation && (r.installation.coordinates || r.mapsUrl)).map(reg => {
            let coords: [number, number] | null = null;
            if (reg.installation?.coordinates) coords = extractCoordinates(reg.installation.coordinates);
            else if (reg.mapsUrl) coords = extractCoordinates(reg.mapsUrl);

            return {
                ...reg,
                mappedCoords: coords,
                serverColor: getServerColor(reg.locationId),
                techName: reg.installation?.technician || 'Unknown'
            };
        }).filter(item => {
            if (!item.mappedCoords) return false;
            if (techServerFilter !== 'all' && item.locationId !== techServerFilter) return false;
            if (techStatusFilter !== 'all' && item.status !== techStatusFilter) return false;
            if (techFilter !== 'all' && item.techName !== techFilter) return false;
            return true;
        });
    }, [registrations, techServerFilter, techFilter]);


    const renderFilters = () => {
        if (activeTab === 'registration') {
            return (
                <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-500 px-2 font-medium text-sm border-r border-slate-200">
                        <Filter className="w-4 h-4" /> Filters
                    </div>
                    <div className="w-full sm:w-[200px]">
                        <SearchableSelect
                            value={regServerFilter}
                            onChange={setRegServerFilter}
                            options={[
                                { label: 'All Servers', value: 'all' },
                                ...(servers || []).map(s => ({ label: s.name, value: s.id }))
                            ]}
                            placeholder="Server"
                        />
                    </div>
                    <div className="w-full sm:w-[180px]">
                        <SearchableSelect
                            value={regStatusFilter}
                            onChange={setRegStatusFilter}
                            options={[
                                { label: 'All Status', value: 'all' },
                                { label: 'Active', value: 'active' },
                                { label: 'Blocked', value: 'blocked' }
                            ]}
                            placeholder="Status"
                        />
                    </div>
                    <div className="w-full sm:w-[200px]">
                        <SearchableSelect
                            value={regProfileFilter}
                            onChange={setRegProfileFilter}
                            options={[
                                { label: 'All Profiles', value: 'all' },
                                ...uniqueProfiles.map(p => ({ label: p, value: p }))
                            ]}
                            placeholder="Profile"
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 px-2 font-medium text-sm border-r border-slate-200">
                    <Filter className="w-4 h-4" /> Filters
                </div>
                <div className="w-full sm:w-[200px]">
                    <SearchableSelect
                        value={techServerFilter}
                        onChange={setTechServerFilter}
                        options={[
                            { label: 'All Servers', value: 'all' },
                            ...(servers || []).map(s => ({ label: s.name, value: s.id }))
                        ]}
                        placeholder="Server"
                    />
                </div>
                <div className="w-full sm:w-[180px]">
                    <SearchableSelect
                        value={techStatusFilter}
                        onChange={setTechStatusFilter}
                        options={[
                            { label: 'All Status', value: 'all' },
                            { label: 'Pending', value: 'queue' },
                            { label: 'Installing', value: 'installation_process' },
                            { label: 'Done', value: 'done' },
                            { label: 'Cancelled', value: 'cancel' } // can be extended for other cancels
                        ]}
                        placeholder="Status"
                    />
                </div>
                <div className="w-full sm:w-[200px]">
                    <SearchableSelect
                        value={techFilter}
                        onChange={setTechFilter}
                        options={[
                            { label: 'All Technicians', value: 'all' },
                            ...uniqueTechnicians.map(t => ({ label: t, value: t }))
                        ]}
                        placeholder="Technician"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 h-[calc(100vh-4rem)] flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <MapIcon className="w-6 h-6 text-primary" />
                        Monitoring User
                    </h1>
                    <p className="text-slate-500">Monitor customer and installation locations</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 shrink-0">
                <button
                    onClick={() => setActiveTab('registration')}
                    className={cn(
                        "px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
                        activeTab === 'registration' 
                            ? "border-primary text-primary" 
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    <Users className="w-4 h-4" />
                    Map by Registration
                </button>
                <button
                    onClick={() => setActiveTab('technician')}
                    className={cn(
                        "px-4 py-2 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors",
                        activeTab === 'technician' 
                            ? "border-primary text-primary" 
                            : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                >
                    <UserCog className="w-4 h-4" />
                    Map by Technician
                </button>
            </div>

            {/* Filters */}
            <div className="shrink-0 z-[1001]">
                {renderFilters()}
            </div>

            {/* Map Area */}
            <div className="relative flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden z-0 min-h-[400px]">
                <div className="absolute top-4 right-4 z-[1000]">
                    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex gap-1">
                        <button 
                            onClick={() => setMapType('m')}
                            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", mapType === 'm' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                            Street
                        </button>
                        <button 
                            onClick={() => setMapType('y')}
                            className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", mapType === 'y' ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                            Satellite
                        </button>
                    </div>
                </div>
                <div className="absolute inset-0">
                    <MapContainer 
                        center={[-6.2088, 106.8456]} 
                        zoom={5} 
                        className="w-full h-full"
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            url={`https://mt1.google.com/vt/lyrs=${mapType}&x={x}&y={y}&z={z}`}
                            attribution='&copy; Google Maps'
                            maxZoom={22}
                        />
                    
                    {activeTab === 'registration' && mapRegistrationData.map((customer, idx) => (
                        <Marker 
                            key={`reg-${customer.id}-${idx}`}
                            position={customer.mappedCoords!}
                            icon={createCustomIcon(customer.serverColor, customer.statusColor)}
                        >
                            <Tooltip permanent direction="bottom" offset={[0, 10]} className="bg-white/90 shadow-sm border-slate-200 text-xs font-semibold text-slate-700 rounded-md">
                                {customer.realName || customer.name}
                            </Tooltip>
                            <Popup className="rounded-lg shadow-lg">
                                <div className="p-1 min-w-[200px]">
                                    <div className="font-bold text-sm mb-1">{customer.name}</div>
                                    <div className="text-xs text-slate-500 mb-2">{customer.realName || '-'}</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                        <div><span className="font-semibold">Server:</span> {customer.serverName}</div>
                                        <div><span className="font-semibold">Profile:</span> {customer.profile}</div>
                                    </div>
                                    <div className="mb-2">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase",
                                            customer.disabled ? "bg-red-500" : "bg-emerald-500"
                                        )}>
                                            {customer.disabled ? 'Blocked' : 'Active'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-600 truncate max-w-[200px]" title={customer.address}>{customer.address || '-'}</div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {activeTab === 'technician' && mapTechnicianData.map((reg, idx) => (
                        <Marker 
                            key={`tech-${reg.id}-${idx}`}
                            position={reg.mappedCoords!}
                            icon={createCustomIcon(reg.serverColor, '#3b82f6')} // Blue dot for installation
                        >
                            <Tooltip permanent direction="bottom" offset={[0, 10]} className="bg-white/90 shadow-sm border-slate-200 text-xs font-semibold text-slate-700 rounded-md">
                                {reg.fullName}
                            </Tooltip>
                            <Popup className="rounded-lg shadow-lg">
                                <div className="p-1 min-w-[200px]">
                                    <div className="font-bold text-sm mb-1">{reg.fullName}</div>
                                    <div className="text-xs text-slate-500 mb-2">Technician: <span className="font-semibold text-slate-800">{reg.techName}</span></div>
                                    <div className="text-xs mb-2">
                                        <span className="font-semibold">Date:</span> {reg.installation?.date ? new Date(reg.installation.date).toLocaleDateString() : '-'}
                                    </div>
                                    <div className="text-xs text-slate-600 truncate max-w-[200px]" title={reg.address}>{reg.address}</div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* Legend */}
                <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-slate-200/60 max-w-[300px] text-sm">
                    <div className="font-semibold text-slate-800 mb-3">Map Legend</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                            <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Server (Pin Color)</div>
                            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-2">
                                {(servers || []).map(s => (
                                    <div key={s.id} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: getServerColor(s.id) }}></div>
                                        <span className="text-xs text-slate-600 truncate" title={s.name}>{s.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Status (Dot Color)</div>
                            <div className="space-y-2 mt-1">
                                {activeTab === 'registration' && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-[#10b981]"></div>
                                            <span className="text-xs text-slate-600">Active</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-[#ef4444]"></div>
                                            <span className="text-xs text-slate-600">Blocked</span>
                                        </div>
                                    </>
                                )}
                                {activeTab === 'technician' && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm bg-[#3b82f6]"></div>
                                        <span className="text-xs text-slate-600">Installed</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
}
