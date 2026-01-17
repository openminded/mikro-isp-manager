import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import L from 'leaflet';
import { useServers } from '@/context/ServerContext';
import { useData } from '@/context/DataContext';
import { Router, Save, Trash2, Link as LinkIcon } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';

// Icons fix for Leaflet in React
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetinaUrl,
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
});

// Custom Icons
// Custom Icons (lineIcon removed as LINE is now a group)

const odcIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const odpIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Helper component to handle map clicks
function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

interface NetworkNode {
    id: string;
    type: 'ODC' | 'ODP' | 'LINE';
    name: string;
    lat: number;
    lng: number;
    capacity: number;
    parentId: string; // Server ID or Node ID
}

interface NetworkStatus {
    [key: string]: {
        isOnline: boolean;
        lastCheck: string;
        latency: string;
    }
}

export function Monitoring() {
    const { servers } = useServers();
    const { customers, refreshCustomers } = useData();
    const [nodes, setNodes] = useState<NetworkNode[]>([]);
    const [status, setStatus] = useState<NetworkStatus>({});

    // UI State
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
    const [newNodePos, setNewNodePos] = useState<{ lat: number, lng: number } | null>(null);
    const [formNode, setFormNode] = useState<Partial<NetworkNode>>({
        type: 'LINE',
        name: '',
        capacity: 8,
        parentId: ''
    });

    const [selectedCustomerToLink, setSelectedCustomerToLink] = useState('');

    useEffect(() => {
        fetchNodes();
        const statInterval = setInterval(fetchStatus, 30000); // Poll status every 30s
        fetchStatus();
        return () => clearInterval(statInterval);
    }, []);

    const fetchNodes = async () => {
        try {
            const res = await axios.get('/api/network/nodes');
            if (Array.isArray(res.data)) setNodes(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await axios.get('/api/network/status');
            setStatus(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    const handleMapClick = (lat: number, lng: number) => {
        if (mode === 'edit') {
            setNewNodePos({ lat, lng });
            setSelectedNode(null); // Clear selection if clicking empty space to add
            setFormNode(prev => ({ ...prev, name: `New Node`, lat, lng, type: 'LINE' }));
        }
    };

    const handleSaveNode = async () => {
        if (!newNodePos && !selectedNode) return;

        try {
            if (selectedNode) {
                // Update
                await axios.put(`/api/network/nodes/${selectedNode.id}`, { ...selectedNode, ...formNode }); // formNode contains edits
            } else {
                // Create
                if (!newNodePos) return;
                await axios.post('/api/network/nodes', {
                    ...formNode,
                    lat: newNodePos.lat,
                    lng: newNodePos.lng
                });
            }
            fetchNodes();
            setNewNodePos(null);
            setSelectedNode(null);
        } catch (e) {
            alert('Failed to save node');
        }
    };

    const handleDeleteNode = async () => {
        if (!selectedNode) return;
        if (!confirm('Delete this node? All child links will be broken.')) return;
        try {
            await axios.delete(`/api/network/nodes/${selectedNode.id}`);
            fetchNodes();
            setSelectedNode(null);
        } catch (e) {
            alert('Failed to delete node');
        }
    };

    const handleLinkCustomer = async () => {
        if (!selectedNode || selectedNode.type !== 'ODP' || !selectedCustomerToLink) return;

        const customer = customers.find(c => c.id === selectedCustomerToLink);
        if (!customer) return;

        try {
            await axios.post('/api/network/link-customer', {
                serverId: customer.serverId,
                customerId: customer.id, // using ID for link
                odpId: selectedNode.id
            });
            alert('Customer linked!');
            refreshCustomers(true); // refresh extended meta
            setSelectedCustomerToLink('');
        } catch (e) {
            alert('Failed to link customer');
        }
    };

    // Derived Data for Visualization
    // Get Line connections (Only draw ODC -> ODP for now, unless we want to visualize Line via logic)
    // Update: If ODC has a parentId which is a LINE, we don't draw from LINE to ODC because LINE has no lat/lng
    // We only draw ODC -> ODP or ODC -> ODC (if supported)
    const connections = nodes.map(node => {
        if (!node.parentId) return null;
        const parentNode = nodes.find(n => n.id === node.parentId);

        // If parent is a LINE (virtual group), we don't draw a line unless we derived a virtual position (not doing that now)
        if (parentNode && parentNode.type === 'LINE') return null;

        if (parentNode) {
            return { from: [parentNode.lat, parentNode.lng] as [number, number], to: [node.lat, node.lng] as [number, number], color: 'orange' };
        }
        return null;
    }).filter(Boolean);

    // Filter customers linked to selected ODP
    const linkedCustomers = selectedNode ? customers.filter(c => (c as any).odpId === selectedNode.id) : [];

    // Node Status Logic
    const getNodeStatusColor = (nodeId: string) => {
        const nodeCustomers = customers.filter(c => (c as any).odpId === nodeId);
        if (nodeCustomers.length === 0) return 'gray';
        const customerStatuses = nodeCustomers.map(c => {
            const key = `${c.serverId}_${c.name}`;
            return status[key]?.isOnline;
        });
        const anyOnline = customerStatuses.some(s => s === true);
        const allOffline = customerStatuses.every(s => !s);
        if (allOffline) return 'red';
        if (anyOnline) return 'green';
        return 'gray';
    };

    // Health Diagnostics Logic
    // Group nodes by Line


    // Tree View Data Construction
    const getTreeData = () => {
        const lines = nodes.filter(n => n.type === 'LINE');
        return lines.map(line => {
            const odcs = nodes.filter(n => n.parentId === line.id && n.type === 'ODC');
            const lineCapacity = line.capacity || 8;
            const usedOdc = odcs.length;
            const availableOdc = Math.max(0, lineCapacity - usedOdc);

            const odcData = odcs.map(odc => {
                const odps = nodes.filter(n => n.parentId === odc.id && n.type === 'ODP');
                const odcCapacity = 4; // Fixed 4 Max
                const odpFull = odps.length >= odcCapacity;

                const odpData = odps.map(odp => {
                    const custs = customers.filter(c => (c as any).odpId === odp.id);
                    const odpCapacity = odp.capacity || 8;
                    const online = custs.filter(c => status[`${c.serverId}_${c.name}`]?.isOnline).length;
                    const offline = custs.filter(c => status[`${c.serverId}_${c.name}`]?.isOnline === false).length;
                    const empty = Math.max(0, odpCapacity - custs.length);

                    return { ...odp, custs, online, offline, empty };
                });

                return { ...odc, odps: odpData, odpFull };
            });

            return { ...line, odcs: odcData, usedOdc, availableOdc };
        });
    };

    const treeData = getTreeData();

    // Helper to get allowed parents based on selected type
    const getParentOptions = () => {
        const type = formNode.type;
        if (type === 'LINE') return servers.map(s => ({ id: s.id, name: s.name, group: 'Servers' }));
        if (type === 'ODC') return nodes.filter(n => n.type === 'LINE').map(n => ({ id: n.id, name: n.name, group: 'Lines' }));
        if (type === 'ODP') return nodes.filter(n => n.type === 'ODC').map(n => ({ id: n.id, name: n.name, group: 'ODCs' }));
        return [];
    };

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col">
            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Router className="w-5 h-5 text-primary" />
                        Network Topology
                    </h1>
                    <p className="text-sm text-slate-500">Monitor ODC/ODP status and Backbone health</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => { setMode('view'); setNewNodePos(null); }}
                            className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-all", mode === 'view' ? "bg-white shadow text-primary" : "text-slate-500 hover:text-slate-700")}
                        >
                            Monitoring
                        </button>
                        <button
                            onClick={() => { setMode('edit'); setNewNodePos(null); }}
                            className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-all", mode === 'edit' ? "bg-white shadow text-primary" : "text-slate-500 hover:text-slate-700")}
                        >
                            Edit Topology
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex relative">
                {/* Sidebar Health Summary (Left) */}
                {/* Sidebar Health Summary (Left) - REPLACED WITH TREE VIEW */}
                <div className="w-80 bg-slate-50 border-r border-slate-200 overflow-y-auto p-4 hidden md:block text-sm">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Hierarchy Status</h3>
                    <div className="space-y-4">
                        {treeData.length === 0 && (
                            <div className="p-4 border border-dashed border-slate-300 rounded text-center text-slate-500">
                                <p className="mb-2">No network topology found.</p>
                                <button
                                    onClick={() => { setMode('edit'); setNewNodePos(null); }}
                                    className="text-primary hover:underline text-xs"
                                >
                                    Click here to Edit & Add a Line
                                </button>
                            </div>
                        )}
                        {treeData.map(line => (
                            <div key={line.id} className="border border-slate-200 rounded-md bg-white overflow-hidden">
                                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-medium flex justify-between">
                                    <span>{line.name}</span>
                                    <span className="text-xs text-slate-500">
                                        {line.usedOdc} Used / {line.availableOdc} Avail
                                    </span>
                                </div>
                                <div className="p-2 space-y-2">
                                    {line.odcs.length === 0 && <p className="text-xs text-slate-400 italic px-2">No ODCs connected.</p>}
                                    {line.odcs.map(odc => (
                                        <div key={odc.id} className="pl-2 border-l-2 border-orange-200 ml-1">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-slate-700">{odc.name}</span>
                                                <span className={cn("text-[10px] px-1.5 rounded-full", odc.odpFull ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")}>
                                                    {odc.odpFull ? 'ODC Penuh' : 'Available'}
                                                </span>
                                            </div>

                                            {/* ODPs */}
                                            <div className="space-y-1 mt-1">
                                                {odc.odps.length === 0 && <p className="text-[10px] text-slate-400 italic">No ODPs.</p>}
                                                {odc.odps.map(odp => (
                                                    <div key={odp.id} className="pl-2 border-l-2 border-violet-200 ml-1 bg-slate-50 p-1 rounded">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-medium text-slate-600 font-mono text-xs">{odp.name}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex gap-1 mt-0.5">
                                                            <span className="text-green-600">{odp.online} Online</span> •
                                                            <span className="text-red-600">{odp.offline} Mati</span> •
                                                            <span className="text-slate-400">{odp.empty} Kosong</span>
                                                        </div>
                                                        {/* Show Customers? Maybe too cluttered. Let's start with stats as requested. */}
                                                        {mode === 'view' && odp.custs.length > 0 && (
                                                            <div className="pl-1 mt-1 border-t border-slate-200 pt-1">
                                                                {odp.custs.map(c => {
                                                                    const statKey = `${c.serverId}_${c.name}`;
                                                                    const isOnline = status[statKey]?.isOnline;
                                                                    return (
                                                                        <div key={c.id} className="flex items-center gap-1 text-[10px] text-slate-500">
                                                                            <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")} />
                                                                            <span className="truncate">{c.name}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 relative z-0">
                    <MapContainer center={[-0.5319385, 101.5726013]} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            attribution='Tiles &copy; Esri'
                        />
                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
                            attribution='&copy; Google Maps'
                        />
                        <MapEvents onMapClick={handleMapClick} />

                        {/* Lines */}
                        {connections.map((conn, i) => (
                            conn && <Polyline key={i} positions={[conn.from, conn.to]} color={conn.color} />
                        ))}

                        {/* Nodes (Filter out LINE type from map) */}
                        {nodes.filter(n => n.type !== 'LINE').map(node => {
                            const statusColor = getNodeStatusColor(node.id);
                            // Dynamic marker color via filter/icon swap is hard with default icons
                            // For simplicity, we keep type icons (Blue/Orange/Violet) but maybe add a status dot popup
                            // Or use CircleMarker for status color ring.

                            return (
                                <Marker
                                    key={node.id}
                                    position={[node.lat, node.lng]}
                                    icon={node.type === 'ODC' ? odcIcon : odpIcon}
                                    eventHandlers={{
                                        click: () => {
                                            setSelectedNode(node);
                                            setNewNodePos(null);
                                            setFormNode(node);
                                        }
                                    }}
                                >
                                    <Popup>
                                        <div className="p-2">
                                            <h3 className="font-bold">{node.name}</h3>
                                            <p className="text-xs text-slate-500">{node.type}</p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className={cn("w-2 h-2 rounded-full", statusColor === 'green' ? 'bg-green-500' : 'bg-red-500')} />
                                                <span className="text-xs font-medium capitalize">{statusColor === 'green' ? 'Online' : 'Offline'}</span>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}

                        {/* Only render Ghost if it's NOT a LINE we are adding */}
                        {newNodePos && formNode.type !== 'LINE' && (
                            <Marker position={[newNodePos.lat, newNodePos.lng]} opacity={0.6} />
                        )}
                    </MapContainer>
                </div>

                {/* Sidebar Panel for Edit/Details */}
                {(mode === 'edit' || selectedNode || newNodePos) && (
                    <div className="w-80 bg-white border-l border-slate-200 p-4 overflow-y-auto absolute right-0 top-0 bottom-0 z-[400] shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-bold text-lg">
                                {newNodePos ? 'Add Node/Line' : selectedNode ? 'Edit Details' : 'Topology Editor'}
                            </h2>
                            <button onClick={() => { setSelectedNode(null); setNewNodePos(null); if (mode === 'edit') setMode('view'); }} className="text-slate-400 hover:text-slate-600">×</button>
                        </div>

                        {!selectedNode && !newNodePos && mode === 'edit' && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-center">
                                <p className="text-sm text-slate-600 font-medium mb-2">Instructions</p>
                                <p className="text-xs text-slate-500 mb-2">Click anywhere on the map to add a new Node or Line.</p>
                                <p className="text-xs text-slate-500">Click an existing node marker to edit its properties.</p>
                            </div>
                        )}

                        {(selectedNode || newNodePos) && (
                            <div className="space-y-4">
                                {/* Form */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Name</label>
                                    <input
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={formNode.name}
                                        onChange={e => setFormNode({ ...formNode, name: e.target.value })}
                                        disabled={mode === 'view'}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Type</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={formNode.type}
                                        onChange={e => setFormNode({ ...formNode, type: e.target.value as any, parentId: '' })} // Reset parent on type change
                                        disabled={mode === 'view'}
                                    >
                                        <option value="LINE">Line (Backbone Group)</option>
                                        <option value="ODC">ODC (Distribution)</option>
                                        <option value="ODP">ODP (Access)</option>
                                    </select>
                                </div>

                                {formNode.type === 'LINE' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Capacity (Max ODCs)</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-md"
                                            value={formNode.capacity}
                                            onChange={e => setFormNode({ ...formNode, capacity: Number(e.target.value) })}
                                            disabled={mode === 'view'}
                                        >
                                            <option value={4}>4 ODCs</option>
                                            <option value={8}>8 ODCs</option>
                                            <option value={16}>16 ODCs</option>
                                        </select>
                                    </div>
                                )}

                                {/* ODC Capacity is fixed to 4 ODPs, no input needed */}

                                {formNode.type === 'ODP' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Capacity (Max Clients)</label>
                                        <select
                                            className="w-full px-3 py-2 border rounded-md"
                                            value={formNode.capacity}
                                            onChange={e => setFormNode({ ...formNode, capacity: Number(e.target.value) })}
                                            disabled={mode === 'view'}
                                        >
                                            <option value={2}>2 Ports</option>
                                            <option value={4}>4 Ports</option>
                                            <option value={8}>8 Ports</option>
                                            <option value={16}>16 Ports</option>
                                        </select>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Parent</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md"
                                        value={formNode.parentId}
                                        onChange={e => setFormNode({ ...formNode, parentId: e.target.value })}
                                        disabled={mode === 'view'}
                                    >
                                        <option value="">Select Parent...</option>
                                        {getParentOptions().map(opt => (
                                            <option key={opt.id} value={opt.id} disabled={(opt as any).disabled}>
                                                {opt.name} {(opt as any).disabled ? '(Full)' : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {formNode.type === 'ODC' && <p className="text-xs text-slate-500 mt-1">Select the Line (Backbone).</p>}
                                    {formNode.type === 'ODP' && <p className="text-xs text-slate-500 mt-1">Select the ODC (Max 4 ODPs per ODC).</p>}
                                </div>

                                {/* Actions (Edit Mode) */}
                                {mode === 'edit' && (
                                    <div className="pt-4 flex gap-2">
                                        <button onClick={handleSaveNode} className="flex-1 bg-primary text-white py-2 rounded-md flex justify-center items-center gap-2">
                                            <Save className="w-4 h-4" /> Save
                                        </button>
                                        {selectedNode && (
                                            <button onClick={handleDeleteNode} className="px-3 bg-red-100 text-red-600 rounded-md">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Customer Linking (ODP Only) */}
                                {selectedNode && selectedNode.type === 'ODP' && (
                                    <div className="pt-6 border-t border-slate-100">
                                        <h3 className="font-semibold text-sm mb-3">Connected Customers ({linkedCustomers.length}/{selectedNode.capacity})</h3>

                                        <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
                                            {linkedCustomers.map(c => {
                                                const statKey = `${c.serverId}_${c.name}`;
                                                const isOnline = status[statKey]?.isOnline;
                                                return (
                                                    <div key={c.id} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-500" : "bg-red-500")} />
                                                            <span className="truncate max-w-[120px]">{c.name}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-400">{c.serverName}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {mode === 'edit' && (
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-slate-500">Link Customer</label>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <SearchableSelect
                                                            value={selectedCustomerToLink}
                                                            onChange={setSelectedCustomerToLink}
                                                            options={customers.filter(c => !(c as any).odpId).map(c => ({ label: c.name, value: c.id }))} // Filter unassigned
                                                            placeholder="Select customer..."
                                                        />
                                                    </div>
                                                    <button onClick={handleLinkCustomer} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md">
                                                        <LinkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
