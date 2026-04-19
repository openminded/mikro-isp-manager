import { useState, useEffect } from 'react';
import axios from 'axios';
import type { NetworkNode } from '@/pages/Monitoring';
import { useServers } from '@/context/ServerContext';

interface TopologyNodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (nodeData: Partial<NetworkNode>) => void;
    nodeType: 'SERVER' | 'OLT' | 'ODC' | 'ODP' | 'ONT';
    initialLat?: number;
    initialLng?: number;
    initialData?: Partial<NetworkNode>;
    customers?: any[];
    nodes?: NetworkNode[];
}

export function TopologyNodeModal({ isOpen, onClose, onSave, nodeType, initialLat, initialLng, initialData, nodes = [] }: TopologyNodeModalProps) {
    const [name, setName] = useState('');
    const [lat, setLat] = useState<number | ''>('');
    const [lng, setLng] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [splitterType, setSplitterType] = useState('1:8');
    const [ponPorts, setPonPorts] = useState(4);
    const [ponColors, setPonColors] = useState<string[]>(Array(32).fill('#ffffff'));
    
    // ONT specifics
    const [identifierType, setIdentifierType] = useState<'PPPoE' | 'SerialNumber'>('PPPoE');
    const [refId, setRefId] = useState(''); // Customer ID if PPPoE
    const [parentId, setParentId] = useState(''); // Uplink node ID

    const { servers, editServer } = useServers();
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [subAreaId, setSubAreaId] = useState('');

    const [manualCoords, setManualCoords] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setManualCoords(false);
            axios.get('/api/sub-areas').then((res: any) => setSubAreas(res.data)).catch(console.error);
            
            if (initialData) {
                setName(initialData.name || '');
                setLat(initialData.lat ?? '');
                setLng(initialData.lng ?? '');
                setNotes(initialData.notes || '');
                if (nodeType === 'ODC' || nodeType === 'ODP') {
                    setSplitterType(initialData.splitterType || '1:8');
                }
                if (nodeType === 'OLT') {
                    setPonPorts(initialData.capacity || 4);
                    setPonColors(initialData.ponColors || Array(32).fill('#ffffff'));
                }
                setRefId(initialData.refId || '');
                setParentId(initialData.parentId || '');
                setSubAreaId(initialData.subAreaId || '');
                if (initialData.type === 'ONT') {
                    // Usually we set identifierType based on info, hardcoding for now
                    setIdentifierType('PPPoE');
                }
            } else {
                setName('');
                setLat(initialLat ?? '');
                setLng(initialLng ?? '');
                setNotes('');
                setSplitterType(nodeType === 'ODC' ? '1:4' : '1:8'); // Defaults based on typical usage
                setRefId('');
                setParentId('');
                setSubAreaId('');
                setIdentifierType('PPPoE');
            }
        }
    }, [isOpen, initialLat, initialLng, initialData, nodeType]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (nodeType !== 'SERVER' && !name.trim()) {
            alert('Name field is required');
            return;
        }
        if (nodeType === 'SERVER' && !refId) {
            alert('Please select a Server from the dropdown');
            return;
        }
        // For SERVER type, name comes from the selected server record
        if (nodeType === 'SERVER' && refId) {
            const selectedServer = servers.find(s => s.id === refId);
            if (!selectedServer) {
                alert('Selected server not found');
                return;
            }
        }

        let serverName = name;
        if (nodeType === 'SERVER' && refId) {
            const selectedServer = servers.find(s => s.id === refId);
            if (selectedServer) {
                serverName = selectedServer.name;
                // Save the latest map position back to Mikrotik Server DB if there's an actual change
                // or just overwriting to be safe so it stays synchronized.
                editServer(selectedServer.id, { lat: Number(lat), lng: Number(lng) });
            }
        }

        // Calculate capacity based on splitter if applicable
        let capacity = 8;
        if (nodeType === 'SERVER') capacity = 10000;
        else if (nodeType === 'OLT') capacity = ponPorts; // PON Ports
        else if (nodeType === 'ONT') capacity = 1;
        else {
            if (splitterType === '1:2') capacity = 2;
            if (splitterType === '1:4') capacity = 4;
            if (splitterType === '1:8') capacity = 8;
            if (splitterType === '1:16') capacity = 16;
            if (splitterType === '1:32') capacity = 32;
        }
        
        const payload: Partial<NetworkNode> = {
            name: serverName,
            lat: Number(lat),
            lng: Number(lng),
            capacity,
            notes,
            splitterType: (nodeType === 'ODC' || nodeType === 'ODP') ? splitterType : undefined,
            refId: (nodeType === 'ONT' || nodeType === 'SERVER') ? refId : undefined,
            parentId: parentId,
            type: nodeType,
            ponColors: nodeType === 'OLT' ? ponColors : undefined,
            subAreaId: subAreaId || undefined
        };

        onSave(payload);
    };

    const modalTitle = initialData ? `Edit ${nodeType}` : `Add New ${nodeType}`;

    return (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-0 w-full max-w-[480px] overflow-hidden flex flex-col max-h-[90vh]">
                
                <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-white z-10 shrink-0">
                    <h2 className="font-bold text-lg text-slate-800">{modalTitle}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-1 rounded-md transition-colors leading-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50 flex-1 space-y-5">
                    
                    {/* TYPE: ONT Toggle */}
                    {nodeType === 'ONT' && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-2">Identifier Type</label>
                            <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-slate-100 p-1">
                                <button 
                                    onClick={() => setIdentifierType('PPPoE')} 
                                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${identifierType === 'PPPoE' ? 'bg-[#ff5722] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                >
                                    PPPoE
                                </button>
                                <button 
                                    onClick={() => setIdentifierType('SerialNumber')} 
                                    className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${identifierType === 'SerialNumber' ? 'bg-[#ff5722] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                                >
                                    Serial Number
                                </button>
                            </div>
                        </div>
                    )}

                    {/* NAME OR SERVER SELECT */}
                    {nodeType === 'SERVER' ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Select Mikrotik Server</label>
                            <select 
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                                value={refId}
                                onChange={e => {
                                    setRefId(e.target.value);
                                    const sv = servers.find(s => s.id === e.target.value);
                                    if (sv) {
                                        // Auto-fill map coordinates if the server already has them saved previously
                                        if (sv.lat && sv.lng && !initialData?.id) { 
                                            setLat(sv.lat);
                                            setLng(sv.lng);
                                        }
                                    }
                                }}
                            >
                                <option value="">-- Choose Registered Server --</option>
                                {servers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.ip})</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">{nodeType} Name</label>
                            <input 
                                type="text" 
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                                placeholder={`E.g. ${nodeType}-JKT-01`}
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* PON PORTS (OLT) */}
                    {nodeType === 'OLT' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Number of PON Ports <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                                value={ponPorts}
                                onChange={e => setPonPorts(Number(e.target.value))}
                            >
                                <option value={1}>1 PON</option>
                                <option value={2}>2 PON</option>
                                <option value={4}>4 PON</option>
                                <option value={8}>8 PON</option>
                                <option value={16}>16 PON</option>
                                <option value={32}>32 PON</option>
                            </select>

                            <div className="mt-5 p-4 border border-slate-200 bg-white rounded-lg">
                                <label className="block text-xs font-bold text-slate-600 mb-3">Custom Fiber Line Colors</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {Array.from({length: ponPorts}).map((_, i) => (
                                        <div key={i} className="flex flex-col items-center justify-center p-2 rounded-md bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                                            <span className="text-[10px] font-bold text-slate-500 mb-1.5">PON {i + 1}</span>
                                            <div className="relative rounded overflow-hidden shadow-sm" style={{ width: 28, height: 28 }}>
                                                <input 
                                                    type="color" 
                                                    value={ponColors[i] || '#ffffff'}
                                                    onChange={e => {
                                                        const newColors = [...ponColors];
                                                        newColors[i] = e.target.value;
                                                        setPonColors(newColors);
                                                    }}
                                                    className="absolute w-[150%] h-[150%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 p-0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SPLITTER TYPE (ODC/ODP) */}
                    {(nodeType === 'ODC' || nodeType === 'ODP') && (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1.5">Splitter Type <span className="text-red-500">*</span></label>
                            <select 
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                                value={splitterType}
                                onChange={e => setSplitterType(e.target.value)}
                            >
                                <option value="1:2">1:2</option>
                                <option value="1:4">1:4</option>
                                <option value="1:8">1:8</option>
                                <option value="1:16">1:16</option>
                                <option value="1:32">1:32</option>
                            </select>
                        </div>
                    )}

                    {/* UPLINK (PARENT) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Uplink Source (Parent) <span className="text-slate-400 font-normal ml-1">(Optional)</span></label>
                        <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                            value={parentId}
                            onChange={e => setParentId(e.target.value)}
                        >
                            <option value="">-- No Source / Root --</option>
                            {nodes?.filter(n => !initialData || n.id !== initialData.id).map(n => (
                                <option key={n.id} value={n.id}>{n.type} - {n.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* SUB AREA */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Sub Area <span className="text-slate-400 font-normal ml-1">(Optional)</span></label>
                        <select 
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-medium"
                            value={subAreaId}
                            onChange={e => setSubAreaId(e.target.value)}
                        >
                            <option value="">-- No Sub Area --</option>
                            {subAreas.map(sa => (
                                <option key={sa.id} value={sa.id}>{sa.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* COORDINATES */}
                    <div className="pt-2">
                        <label className="flex items-center gap-2 text-xs text-slate-600 font-medium mb-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="rounded text-blue-600 focus:ring-blue-500" 
                                checked={manualCoords} 
                                onChange={e => setManualCoords(e.target.checked)} 
                            />
                            Set coordinates manually
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-1">Latitude</label>
                                <input 
                                    type="number" step="any"
                                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm ${!manualCoords && 'bg-slate-100 text-slate-500'}`}
                                    value={lat}
                                    onChange={e => setLat(parseFloat(e.target.value))}
                                    disabled={!manualCoords}
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-500 mb-1">Longitude</label>
                                <input 
                                    type="number" step="any"
                                    className={`w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm ${!manualCoords && 'bg-slate-100 text-slate-500'}`}
                                    value={lng}
                                    onChange={e => setLng(parseFloat(e.target.value))}
                                    disabled={!manualCoords}
                                />
                            </div>
                        </div>
                    </div>

                    {/* NOTES */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">Notes</label>
                        <textarea 
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none min-h-[80px]"
                            placeholder="Additional notes (optional)"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>

                    {/* INFO BOX */}
                    <div className="bg-blue-50/50 border border-blue-100 text-blue-700/80 p-3 rounded-lg flex items-start gap-2 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        <p>Coordinates are set from the marker position on the map. Check 'Set coordinates manually' to edit them.</p>
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1">
                        {initialData ? 'Save Changes' : '+ Add Node'}
                    </button>
                </div>

            </div>
        </div>
    );
}
