import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';

import { useData } from '@/context/DataContext';
import { Search, Map as MapIcon, List, Settings, Trash2, Edit, MapPin, Server, Box, Wifi, HardDrive, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TopologyListView } from '@/components/topology/TopologyListView';
import { TopologySettingsView } from '@/components/topology/TopologySettingsView';
import { TopologyNodeModal } from '@/components/topology/TopologyNodeModal';

// Leaflet Icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const getCustomIcon = (type: string, name: string, label?: string, isOffline?: boolean) => {
    let color = '';
    const offlineRed = '#ef4444'; // Red-500

    let svg = '';
    switch (type) {
        case 'SERVER':
            color = '#dc2626';
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>`;
            break;
        case 'OLT':
            color = '#8b5cf6';
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2" ry="2"/><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`;
            break;
        case 'ODC':
            color = isOffline ? offlineRed : '#2563eb';
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/></svg>`;
            break;
        case 'ODP':
            color = isOffline ? offlineRed : '#eab308';
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
            break;
        case 'ONT':
            color = isOffline ? offlineRed : '#22c55e';
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
            break;
        default:
            color = '#64748b';
            svg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
    }

    const displayLabel = label || name;
    return new L.DivIcon({
        html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 32px; height: 32px;">
                <div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border: 2.5px solid white; position: relative; z-index: 2;">
                    ${svg}
                </div>
                <div style="position: absolute; top: 34px; left: 50%; transform: translateX(-50%); background: rgba(255,255,255,0.9); padding: 2px 5px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #1e293b; border: 1.5px solid ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap; z-index: 3;">
                    ${displayLabel}
                </div>
            </div>
        `,
        className: 'custom-leaflet-icon-container',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
};


export interface NetworkNode {
    id: string;
    type: 'SERVER' | 'OLT' | 'ODC' | 'ODP' | 'ONT';
    name: string;
    lat: number;
    lng: number;
    capacity: number;
    parentId: string;
    pathCoords?: [number, number][]; // Line to parent
    notes?: string;
    splitterType?: string;
    refId?: string; // Link to Customers DB if ONT
    ponColors?: string[]; // Custom colors for OLT PON ports
    subAreaId?: string; // Link to sub_areas.json
}

type Tool = 'SELECT' | 'SERVER' | 'OLT' | 'ODC' | 'ODP' | 'ONT' | 'FIBER_LINE';

function MapEvents({ onClick, onMouseMove }: { onClick: (lat: number, lng: number) => void, onMouseMove?: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) { onClick(e.latlng.lat, e.latlng.lng); },
        mousemove(e) { onMouseMove && onMouseMove(e.latlng.lat, e.latlng.lng); }
    });
    return null;
}

function MapFocus({ pos }: { pos: [number, number] }) {
    const map = useMapEvents({});
    useEffect(() => {
        if (pos) map.setView(pos, 19);
    }, [pos, map]);
    return null;
}

export function Monitoring() {
    const { customers } = useData();
    const [nodes, setNodes] = useState<NetworkNode[]>([]);
    
    // View State
    const [viewMode, setViewMode] = useState<'map' | 'list' | 'settings'>('map');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType] = useState('All Types');
    
    // Tools State
    const [activeTool, setActiveTool] = useState<Tool>('SELECT');
    
    // Modal & selection State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalLat, setModalLat] = useState<number | undefined>();
    const [modalLng, setModalLng] = useState<number | undefined>();
    const [editingNode, setEditingNode] = useState<Partial<NetworkNode> | undefined>();
    const [modalNodeType, setModalNodeType] = useState<'SERVER' | 'OLT' | 'ODC' | 'ODP' | 'ONT'>('SERVER');
    
    // Fiber Line Drawing State
    const [fiberSource, setFiberSource] = useState<NetworkNode | null>(null);
    const [fiberWaypoints, setFiberWaypoints] = useState<[number, number][]>([]);
    const [mousePos, setMousePos] = useState<[number, number] | null>(null);

    // Map Settings
    const [mapSettings, setMapSettings] = useState({
        defaultLat: -0.366535,
        defaultLng: 101.556898,
        maxZoomIn: 22,
        maxZoomOut: 15,
        defaultZoom: 16,
        mapStyle: 'm' as 'm' | 's' | 'y' | 'p',
        routingMode: 'none' as 'none' | 'osrm'
    });

    // Network Status (Pings)
    const [networkStatus, setNetworkStatus] = useState<Record<string, { isOnline: boolean, lastCheck: string, latency: number }>>({});

    // Map State
    const [focusedPosition, setFocusedPosition] = useState<[number, number] | null>(null);

    useEffect(() => { 
        fetchNodes(); 
        fetchNetworkStatus();
        
        // Poll status every 60 seconds
        const timer = setInterval(fetchNetworkStatus, 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchNetworkStatus = async () => {
        try {
            const res = await axios.get('/api/network/status');
            setNetworkStatus(res.data);
        } catch (e) {
            console.warn('Failed to fetch network status');
        }
    };

    const fetchNodes = async () => {
        try {
            const res = await axios.get('/api/network/nodes');
            if (Array.isArray(res.data)) {
                setNodes(res.data.filter(n => n.type !== 'LINE'));
            }
        } catch (e) {
            console.error(e);
        }
    };

    // ─── Road Routing via OSRM ───────────────────────────────────────────────
    // Only calls OSRM if routingMode is 'osrm', otherwise returns straight waypoints
    const fetchRoadRoute = async (waypoints: [number, number][]): Promise<[number, number][]> => {
        if (mapSettings.routingMode !== 'osrm') return waypoints;
        try {
            const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
            const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
            const res = await axios.get(url);
            if (res.data?.routes?.[0]?.geometry?.coordinates) {
                return res.data.routes[0].geometry.coordinates.map(
                    ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
                );
            }
        } catch (e) {
            console.warn('OSRM routing failed, fallback to straight line:', e);
        }
        return waypoints;
    };

    // Snap all straight-line connections to road routes (OSRM mode only)
    const [isSnapping, setIsSnapping] = useState(false);
    const snapAllToRoads = async () => {
        if (isSnapping || mapSettings.routingMode !== 'osrm') return;
        setIsSnapping(true);
        const toSnap = nodes.filter(n => n.parentId && (!n.pathCoords || n.pathCoords.length < 3));
        for (const node of toSnap) {
            const parent = nodes.find(p => p.id === node.parentId);
            if (!parent) continue;
            const roadPath = await fetchRoadRoute([[parent.lat, parent.lng], [node.lat, node.lng]]);
            if (roadPath.length > 2) {
                await axios.put(`/api/network/nodes/${node.id}`, { pathCoords: roadPath });
            }
        }
        setIsSnapping(false);
        fetchNodes();
    };

    const handleMapClick = (lat: number, lng: number) => {
        if (activeTool === 'FIBER_LINE') {
            if (fiberSource) {
                setFiberWaypoints(prev => [...prev, [lat, lng]]);
            }
        } else if (activeTool !== 'SELECT') {
            setModalLat(lat);
            setModalLng(lng);
            setModalNodeType(activeTool as any);
            setEditingNode(undefined);
            setIsModalOpen(true);
        }
    };

    const handleNodeClick = async (node: NetworkNode) => {
        if (activeTool === 'FIBER_LINE') {
            if (!fiberSource) {
                setFiberSource(node);
                setFiberWaypoints([[node.lat, node.lng]]);
            } else {
                if (fiberSource.id === node.id) return;
                const rawWaypoints = [...fiberWaypoints, [node.lat, node.lng]] as [number, number][];

                // Fetch road-following route from OSRM
                const roadPath = await fetchRoadRoute(rawWaypoints);
                const updatedNode = { ...node, parentId: fiberSource.id, pathCoords: roadPath };
                
                axios.put(`/api/network/nodes/${node.id}`, updatedNode).then(() => {
                    fetchNodes();
                    setFiberSource(null);
                    setFiberWaypoints([]);
                    setActiveTool('SELECT');
                });
            }
        }
    };

    const openEditModal = (node: NetworkNode) => {
        setModalNodeType(node.type);
        setEditingNode(node);
        setIsModalOpen(true);
    };

    const handleSaveNode = async (nodeData: Partial<NetworkNode>) => {
        try {
            if (editingNode && editingNode.id) {
                await axios.put(`/api/network/nodes/${editingNode.id}`, { ...editingNode, ...nodeData });
            } else {
                await axios.post('/api/network/nodes', { ...nodeData, parentId: '' });
                setActiveTool('SELECT');
            }
            fetchNodes();
            setIsModalOpen(false);
        } catch (e) {
            alert('Failed to save node');
        }
    };

    const unlinkCustomerIfOnt = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node || node.type !== 'ONT' || !node.refId) return;

        try {
            let current = nodes.find(n => n.id === node.parentId);
            let serverNode: NetworkNode | undefined;
            while (current) {
                if (current.type === 'SERVER') { serverNode = current; break; }
                current = nodes.find(n => n.id === current?.parentId);
            }
            if (serverNode?.refId) {
                await axios.post('/api/network/link-customer', {
                    serverId: serverNode.refId,
                    customerId: node.refId,
                    odpId: null
                });
            }
        } catch (e) {
            console.warn('Failed to unlink customer during node deletion:', e);
        }
    };

    const handleDeleteNode = async (id: string) => {
        if (!confirm('Are you sure you want to delete this node? Child nodes will lose connection.')) return;
        try {
            await unlinkCustomerIfOnt(id);
            await axios.delete(`/api/network/nodes/${id}`);
            fetchNodes();
        } catch (e) {
            alert('Failed to delete node');
        }
    };

    const handleDeleteMultipleNodes = async (ids: string[]) => {
        try {
            for (const id of ids) {
                await unlinkCustomerIfOnt(id);
            }
            await Promise.all(ids.map(id => axios.delete(`/api/network/nodes/${id}`)));
            fetchNodes();
        } catch (e) {
            alert('Failed to delete some nodes');
        }
    };

    // Handle ONT drag — update position in DB
    const handleOntDragEnd = async (nodeId: string, lat: number, lng: number) => {
        try {
            await axios.put(`/api/network/nodes/${nodeId}`, { lat, lng });
            setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, lat, lng } : n));
        } catch (e) {
            console.error('Failed to update ONT position', e);
        }
    };

    // Unassign ONT — remove customer link and delete the ONT node
    const handleUnassignOnt = async (node: NetworkNode) => {
        if (!confirm(`Unassign "${node.name}" from this ODP and remove ONT from map?`)) return;
        try {
            // Find which server this ODP belongs to
            let current = nodes.find(n => n.id === node.parentId);
            let serverNode: NetworkNode | undefined;
            while (current) {
                if (current.type === 'SERVER') { serverNode = current; break; }
                current = nodes.find(n => n.id === current?.parentId);
            }
            if (serverNode?.refId && node.refId) {
                // Clear odp_id in SQL
                await axios.post('/api/network/link-customer', {
                    serverId: serverNode.refId,
                    customerId: node.refId,
                    odpId: null
                });
            }
            // Delete ONT node
            await axios.delete(`/api/network/nodes/${node.id}`);
            fetchNodes();
        } catch (e) {
            alert('Failed to unassign ONT');
        }
    };

    const handleViewOnMap = (lat: number, lng: number) => {
        setFocusedPosition([lat, lng]);
        setViewMode('map');
    };

    const getCapacityInfo = (node: NetworkNode) => {
        const children = nodes.filter(n => n.parentId === node.id);
        const used = children.length;
        const total = node.capacity || 0;
        return { used, total, available: Math.max(0, total - used), percent: total ? (used/total)*100 : 0 };
    };

    // ─── Hierarchical Health Logic ──────────────────────────────────────────
    const getRootServerId = (nodeId: string): string | null => {
        let current = nodes.find(n => n.id === nodeId);
        while (current && current.type !== 'SERVER') {
            current = nodes.find(n => n.id === current?.parentId);
        }
        return current ? current.refId || null : null;
    };

    const getNodeHealth = (node: NetworkNode): 'online' | 'offline' => {
        if (node.type === 'ONT') {
            const serverId = getRootServerId(node.id);
            if (!serverId || !node.refId) return 'online';
            const status = networkStatus[`${serverId}_${node.refId}`];
            return (status && !status.isOnline) ? 'offline' : 'online';
        }

        if (node.type === 'ODP') {
            const childONTs = nodes.filter(n => n.parentId === node.id && n.type === 'ONT');
            if (childONTs.length === 0) return 'online';
            const offlineCount = childONTs.filter(ont => getNodeHealth(ont) === 'offline').length;
            return (offlineCount / childONTs.length) > 0.5 ? 'offline' : 'online';
        }

        if (node.type === 'ODC') {
            const childODPs = nodes.filter(n => n.parentId === node.id && n.type === 'ODP');
            if (childODPs.length === 0) return 'online';
            const offlineODPs = childODPs.filter(odp => getNodeHealth(odp) === 'offline');
            // Condition: All child ODPs offline OR more than 1 ODP offline
            return (offlineODPs.length === childODPs.length || offlineODPs.length > 1) ? 'offline' : 'online';
        }

        return 'online';
    };

    const getConnectedChildren = (parentId: string) => {
        return nodes.filter(n => n.parentId === parentId);
    };

    return (
        <div className="bg-slate-50 min-h-screen p-6">
            <div className="max-w-[1700px] mx-auto space-y-4">
                
                {/* Embedded Toolbar Inside Main Card */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden" style={{ minHeight: '65vh', height: '65vh' }}>
                    {/* Top Toolbar */}
                    <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 shrink-0 z-[500] relative bg-white">
                        <div className="flex items-center gap-2">
                            {/* Search */}
                            <div className="relative mr-4 hidden md:block">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Search or type /view..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>

                            {/* Placing Tools */}
                            <button onClick={() => { setActiveTool('SERVER'); setFiberSource(null); setViewMode('map'); }} className={cn("px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1 border", activeTool === 'SERVER' ? "bg-red-600 text-white border-red-600 shadow" : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100")}>
                                + Server
                            </button>
                            <button onClick={() => { setActiveTool('OLT'); setFiberSource(null); setViewMode('map'); }} className={cn("px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1", activeTool === 'OLT' ? "bg-purple-600 text-white shadow" : "bg-purple-600 text-white hover:bg-purple-700")}>
                                + OLT
                            </button>
                            <button onClick={() => { setActiveTool('ODC'); setFiberSource(null); setViewMode('map'); }} className={cn("px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1", activeTool === 'ODC' ? "bg-blue-600 text-white shadow" : "bg-blue-600 text-white hover:bg-blue-700")}>
                                + ODC
                            </button>
                            <button onClick={() => { setActiveTool('ODP'); setFiberSource(null); setViewMode('map'); }} className={cn("px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1", activeTool === 'ODP' ? "bg-cyan-500 text-white shadow" : "bg-cyan-500 text-white hover:bg-cyan-600")}>
                                + ODP
                            </button>
                            <button onClick={() => { setActiveTool('ONT'); setFiberSource(null); setViewMode('map'); }} className={cn("px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1", activeTool === 'ONT' ? "bg-green-500 text-white shadow" : "bg-green-500 text-white hover:bg-green-600")}>
                                + ONT
                            </button>

                            <button onClick={() => { setActiveTool('FIBER_LINE'); setFiberSource(null); setFiberWaypoints([]); setViewMode('map'); }} className={cn("ml-2 px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1 border", activeTool === 'FIBER_LINE' ? "bg-indigo-600 text-white border-indigo-600 shadow" : "bg-indigo-600 text-white hover:bg-indigo-700")}>
                                ✦ Fiber Line
                            </button>
                            
                            {activeTool !== 'SELECT' && viewMode === 'map' && (
                                <div className="ml-4 flex items-center gap-2">
                                    <button onClick={() => { setActiveTool('SELECT'); setFiberSource(null); setFiberWaypoints([]); }} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-md font-medium">
                                        × Cancel
                                    </button>
                                </div>
                            )}
                            {activeTool === 'SELECT' && viewMode === 'map' && (
                                <button
                                    onClick={snapAllToRoads}
                                    disabled={isSnapping}
                                    className="ml-3 px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-md transition-all flex items-center gap-1.5 border bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Re-route all fiber lines to follow roads"
                                >
                                    {isSnapping ? (
                                        <><span className="animate-spin inline-block">⟳</span> Snapping...</>
                                    ) : (
                                        <><span>🛣</span> Snap to Roads</>
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200">
                                <button onClick={() => setViewMode('map')} className={cn("px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors", viewMode === 'map' ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-700")}>
                                    <MapIcon className="w-3.5 h-3.5" /> Map
                                </button>
                                <button onClick={() => setViewMode('list')} className={cn("px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors", viewMode === 'list' ? "bg-blue-600 text-white shadow" : "text-slate-500 hover:text-slate-700")}>
                                    <List className="w-3.5 h-3.5" /> List
                                </button>
                            </div>
                            <button onClick={() => setViewMode('settings')} className={cn("px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ml-2", viewMode === 'settings' ? "bg-blue-600 text-white shadow" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm")}>
                                <Settings className="w-3.5 h-3.5" /> Settings
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 relative z-0 flex flex-col h-full overflow-hidden">
                        {viewMode === 'list' && (
                            <TopologyListView 
                                nodes={nodes} 
                                searchQuery={searchQuery} 
                                networkStatus={networkStatus}
                                onEdit={openEditModal}
                                onDelete={handleDeleteMultipleNodes}
                                onUnassignOnt={() => fetchNodes()}
                                onViewOnMap={handleViewOnMap}
                            />
                        )}

                        {viewMode === 'settings' && (
                            <div className="p-8 bg-slate-50 flex-1 overflow-y-auto">
                                <TopologySettingsView 
                                    settings={mapSettings} 
                                    onSave={(newSet) => { setMapSettings(newSet); alert('Settings saved successfully!'); }} 
                                />
                            </div>
                        )}

                        {viewMode === 'map' && (() => {
                            const getLineColor = (nodeId: string): string => {
                                let current = nodes.find(n => n.id === nodeId);
                                let rootChild = null;
                                let oltNode = null;

                                while (current) {
                                    const parent = nodes.find(n => n.id === current?.parentId);
                                    if (parent && parent.type === 'OLT') {
                                        rootChild = current;
                                        oltNode = parent;
                                        break;
                                    }
                                    if (!parent) break;
                                    current = parent;
                                }

                                if (rootChild && oltNode) {
                                    const ponSiblings = nodes
                                        .filter(n => n.parentId === oltNode.id)
                                        .sort((a, b) => a.id.localeCompare(b.id)); 
                                    
                                    const ponIndex = ponSiblings.findIndex(n => n.id === rootChild?.id);
                                    if (ponIndex !== -1) {
                                        // Use custom OLT color if set, else fallback to #ffffff (White)
                                        if (oltNode.ponColors && oltNode.ponColors[ponIndex]) {
                                            return oltNode.ponColors[ponIndex];
                                        }
                                        return '#ffffff';
                                    }
                                }

                                return '#64748b'; // default slate for Server lines
                            };

                            return (
                                <MapContainer center={[mapSettings.defaultLat, mapSettings.defaultLng]} zoom={mapSettings.defaultZoom} style={{ height: '100%', width: '100%', cursor: activeTool === 'FIBER_LINE' ? 'crosshair' : activeTool !== 'SELECT' ? 'crosshair' : 'grab' }}>
                                    {focusedPosition && <MapFocus pos={focusedPosition} />}
                                    <TileLayer url={`https://mt1.google.com/vt/lyrs=${mapSettings.mapStyle || 'm'}&x={x}&y={y}&z={z}`} attribution='&copy; Google Maps' maxZoom={mapSettings.maxZoomIn || 22} />
                                    <MapEvents onClick={handleMapClick} onMouseMove={(lat, lng) => setMousePos([lat, lng])} />

                                    {/* Rendering Committed Fiber Lines */}
                                    {nodes.map(node => {
                                        if (!node.parentId) return null;
                                        
                                        const lineColor = getLineColor(node.id);

                                        if (node.pathCoords && node.pathCoords.length > 0) {
                                            return <Polyline key={`line-${node.id}`} positions={node.pathCoords} color={lineColor} weight={4} dashArray="8, 10" opacity={0.8} />;
                                        }

                                        const parentNode = nodes.find(n => n.id === node.parentId);
                                        if (parentNode) {
                                            // Draw straight line from parent to child
                                            return <Polyline key={`line-${node.id}`} positions={[[parentNode.lat, parentNode.lng], [node.lat, node.lng]]} color={lineColor} weight={4} dashArray="8, 10" opacity={0.8} />;
                                        }
                                        return null;
                                    })}

                                    {/* Rendering Active Drawing Line */}
                                    {fiberSource && fiberWaypoints.length > 0 && mousePos && (
                                        <Polyline positions={[...fiberWaypoints, mousePos] as [number,number][]} color="#f43f5e" weight={3} dashArray="8, 8" opacity={0.8} />
                                    )}

                                    {/* Rendering Nodes */}
                                    {nodes.map(node => {
                                    if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) return null;
                                    if (filterType !== 'All Types' && node.type !== filterType) return null;

                                    const health = getNodeHealth(node);
                                    const isOffline = health === 'offline';

                                    const custForOnt = node.type === 'ONT' && node.refId
                                        ? customers.find(c => c.name === node.refId)
                                        : null;
                                    const ontLabel = custForOnt?.comment || undefined;
                                    const icon = getCustomIcon(node.type, node.name, ontLabel, isOffline);
                                    const cap = getCapacityInfo(node);
                                    const parentNode = nodes.find(n => n.id === node.parentId);
                                    const childNodes = getConnectedChildren(node.id);

                                    return (
                                        <Marker 
                                            key={node.id} 
                                            position={[node.lat, node.lng]} 
                                            icon={icon}
                                            draggable={node.type === 'ONT'}
                                            eventHandlers={{
                                                click: () => handleNodeClick(node),
                                                dragend: node.type === 'ONT' ? (e: any) => {
                                                    const { lat, lng } = e.target.getLatLng();
                                                    handleOntDragEnd(node.id, lat, lng);
                                                } : undefined
                                            }}
                                        >
                                            {activeTool === 'SELECT' && (
                                                <Popup maxWidth={300} minWidth={260} className="topology-popup rounded-2xl overflow-hidden shadow-xl border-0">
                                                    <div className="w-full font-sans -m-1">
                                                        <div className="px-4 pt-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                                                            <span className={cn(
                                                                "text-[10px] uppercase font-bold px-2 py-0.5 rounded text-white tracking-wider",
                                                                node.type === 'SERVER' ? 'bg-red-600' :
                                                                node.type === 'OLT' ? 'bg-purple-600' :
                                                                node.type === 'ODC' ? 'bg-blue-600' :
                                                                node.type === 'ODP' ? 'bg-cyan-500' : 'bg-green-500'
                                                            )}>
                                                                {node.type} {node.splitterType && `(${node.splitterType})`}
                                                            </span>
                                                        </div>
                                                        <div className="px-4 py-3">
                                                            <h3 className="font-bold text-base text-slate-800 leading-tight mb-1">{node.name}</h3>
                                                            {node.notes && <p className="text-[11px] text-slate-400 mb-2 italic">"{node.notes}"</p>}
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                                                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                                <span className="truncate">{node.lat.toFixed(6)}, {node.lng.toFixed(6)}</span>
                                                            </div>
                                                        
                                                            {node.type !== 'ONT' && (
                                                                <div className="mb-4">
                                                                    <div className="flex justify-between text-xs mb-1.5">
                                                                        <span className="text-slate-600 font-bold">Slot Usage</span>
                                                                        <span className="font-bold text-slate-700">{cap.used} / {cap.total}</span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                                                                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${cap.percent}%` }} />
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="space-y-3 mb-5 border-t border-slate-100 pt-3">
                                                                {parentNode && (
                                                                    <div>
                                                                        <p className="text-[11px] text-slate-500 mb-1">Connected from:</p>
                                                                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                                                            <div className={cn("w-1.5 h-1.5 rounded-full", parentNode.type === 'SERVER' ? 'bg-red-500' : parentNode.type === 'OLT' ? 'bg-purple-500' : 'bg-blue-500')}></div> 
                                                                            {parentNode.name}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                
                                                                {childNodes.length > 0 && (
                                                                    <div className="pt-1">
                                                                        <p className="text-[11px] text-slate-500 mb-1">Connected to ({childNodes.length}):</p>
                                                                        <div className="max-h-20 overflow-y-auto">
                                                                            {childNodes.map(c => (
                                                                                <p key={c.id} className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5 truncate">
                                                                                    <div className={cn("w-1.5 h-1.5 rounded-full", c.type === 'OLT' ? 'bg-purple-500' : c.type === 'ODC' ? 'bg-blue-500' : c.type === 'ODP' ? 'bg-cyan-500' : 'bg-green-500')}></div> {c.name}
                                                                                </p>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* ONT: show customer info + unassign button */}
                                                            {node.type === 'ONT' && (() => {
                                                                const cust = node.refId ? customers.find(c => c.name === node.refId) : null;
                                                                return (
                                                                    <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg">
                                                                        <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1.5">Assigned Customer</p>
                                                                        {cust ? (
                                                                            <>
                                                                                <p className="font-bold text-sm text-slate-800">{cust.comment || cust.name}</p>
                                                                                <p className="text-xs text-slate-500">PPPoE: <span className="font-mono">{cust.name}</span></p>
                                                                                <p className="text-xs text-slate-500 mt-0.5">{cust['remote-address'] || 'No IP'}</p>
                                                                            </>
                                                                        ) : (
                                                                            <p className="text-xs text-slate-500">PPPoE: <span className="font-mono">{node.refId}</span></p>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}

                                                            <div className="flex gap-2">
                                                                <button onClick={() => openEditModal(node)} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-2 rounded-md transition-colors flex justify-center items-center gap-1.5">
                                                                    <Edit className="w-3.5 h-3.5"/> Edit Info
                                                                </button>
                                                                {node.type === 'ONT' && (
                                                                    <button onClick={() => handleUnassignOnt(node)} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-md transition-colors shadow-sm" title="Unassign customer">
                                                                        <Wifi className="w-3.5 h-3.5"/>
                                                                    </button>
                                                                )}
                                                                <button onClick={() => handleDeleteNode(node.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md transition-colors shadow-sm">
                                                                    <Trash2 className="w-3.5 h-3.5"/>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Popup>
                                            )}
                                        </Marker>
                                    );
                                })}
                                </MapContainer>
                            );
                        })()}
                    </div>
                </div>

                {/* Bottom Stats Cards - 5 Columns */}
                <div className="grid grid-cols-5 gap-4 pb-12">
                    <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-[9px] font-bold text-red-500 tracking-wider uppercase mb-1">SERVER ROUTER</h4>
                            <p className="text-2xl font-bold text-slate-800">{nodes.filter(n=>n.type==='SERVER').length}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Main NOCs</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100">
                            <Server className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">OLT DEVICES</h4>
                            <p className="text-2xl font-bold text-slate-800">{nodes.filter(n=>n.type==='OLT').length}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Transmitters</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                            <Cpu className="w-5 h-5" />
                        </div>
                    </div>
                    
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">ODC CABINETS</h4>
                            <p className="text-2xl font-bold text-slate-800">{nodes.filter(n=>n.type==='ODC').length}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Distribution</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-800 flex items-center justify-center text-white border border-blue-900 shadow-sm">
                            <HardDrive className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">ODP BOXES</h4>
                            <p className="text-2xl font-bold text-slate-800">{nodes.filter(n=>n.type==='ODP').length}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Drop points</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-cyan-400 flex items-center justify-center text-white border border-cyan-500 shadow-sm">
                            <Box className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1">ONT DEVICES</h4>
                            <p className="text-2xl font-bold text-slate-800">{nodes.filter(n=>n.type==='ONT').length}</p>
                            <p className="text-[10px] text-slate-400 mt-1">Customers</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center text-white border border-green-600 shadow-sm">
                            <Wifi className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* MODAL ENHANCEMENT replacing the old basic slide-over forms */}
                <TopologyNodeModal 
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        if (!editingNode) setActiveTool('SELECT'); // Reset tool if cancelled placement
                    }}
                    onSave={handleSaveNode}
                    nodeType={modalNodeType}
                    initialLat={modalLat}
                    initialLng={modalLng}
                    initialData={editingNode}
                    customers={customers}
                    nodes={nodes}
                />
            </div>
        </div>
    );
}
