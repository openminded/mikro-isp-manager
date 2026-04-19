
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, UserPlus, X, Monitor, Clock, Search, UserMinus } from 'lucide-react';
import type { NetworkNode } from '@/pages/Monitoring';
import { useData } from '@/context/DataContext';
import axios from 'axios';

interface TopologyListViewProps {
    nodes: NetworkNode[];
    searchQuery: string;
    filterType: string;
    customers?: any[];
    networkStatus: Record<string, any>;
    onDelete?: (ids: string[]) => void;
    onUnassignOnt?: (ontNode: NetworkNode) => void;
}

export function TopologyListView({ nodes, searchQuery, filterType, networkStatus, onDelete, onUnassignOnt }: TopologyListViewProps) {
    const { customers, refreshCustomers } = useData();
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Assigning State
    const [assigningOdp, setAssigningOdp] = useState<NetworkNode | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [assignSearchQuery, setAssignSearchQuery] = useState<string>('');

    const filteredNodes = nodes.filter(node => {
        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'All Types' || node.type === filterType;
        return matchesSearch && matchesType;
    });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'SERVER': return 'bg-purple-600';
            case 'ODC': return 'bg-blue-600';
            case 'ODP': return 'bg-cyan-500';
            case 'ONT': return 'bg-green-500';
            default: return 'bg-slate-500';
        }
    };

    const getCapacity = (node: NetworkNode) => {
        if (node.type === 'SERVER') return null; // Server doesn't have strict ports typically
        
        let used = 0;
        let online = 0;
        let offline = 0;
        let total = node.capacity || (node.type === 'ODC' ? 4 : 8);

        if (node.type === 'OLT') {
            const childODCs = nodes.filter(n => n.parentId === node.id && n.type === 'ODC');
            used = childODCs.length;
        } else if (node.type === 'ODC') {
            const childODPs = nodes.filter(n => n.parentId === node.id && n.type === 'ODP');
            used = childODPs.length;
        } else if (node.type === 'ODP') {
            const linkedCusts = customers.filter(c => c.odpId === node.id);
            used = linkedCusts.length;
            online = linkedCusts.filter(c => !c.disabled).length;
            offline = linkedCusts.filter(c => c.disabled).length;
        }

        const available = Math.max(0, total - used);
        const percent = total > 0 ? (used / total) * 100 : 0;

        return { used, total, available, percent, online, offline };
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(filteredNodes.map(n => n.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = () => {
        if (!onDelete || selectedIds.length === 0) return;
        if (confirm(`Are you sure you want to delete ${selectedIds.length} node(s)?`)) {
            onDelete(selectedIds);
            setSelectedIds([]);
        }
    };

    const getRootServer = (odpNode: NetworkNode) => {
        let current = odpNode;
        while (current && current.type !== 'SERVER') {
            const parent = nodes.find(n => n.id === current.parentId);
            if (!parent) break;
            current = parent;
        }
        return current;
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
            return (offlineODPs.length === childODPs.length || offlineODPs.length > 1) ? 'offline' : 'online';
        }

        return 'online';
    };

    const handleAssignSubmit = async () => {
        if (!selectedCustomerId || !assigningOdp) return;
        try {
            const rootServer = getRootServer(assigningOdp);
            await axios.post('/api/network/link-customer', {
                serverId: rootServer.refId,
                customerId: selectedCustomerId,
                odpId: assigningOdp.id
            });
            await refreshCustomers(true);
            setAssigningOdp(null);
            setSelectedCustomerId('');
            setAssignSearchQuery('');
        } catch(e) {
            alert("Failed to assign customer");
        }
    };

    const handleUnassignFromList = async (ontNode: NetworkNode) => {
        if (!confirm(`Unassign "${ontNode.name}" and remove from map?`)) return;
        try {
            // Walk up to find server
            let current = nodes.find(n => n.id === ontNode.parentId);
            let serverNode: NetworkNode | undefined;
            while (current) {
                if (current.type === 'SERVER') { serverNode = current; break; }
                current = nodes.find(n => n.id === current?.parentId);
            }
            if (serverNode?.refId && ontNode.refId) {
                await axios.post('/api/network/link-customer', {
                    serverId: serverNode.refId,
                    customerId: ontNode.refId,
                    odpId: null
                });
            }
            await axios.delete(`/api/network/nodes/${ontNode.id}`);
            await refreshCustomers(true);
            if (onUnassignOnt) onUnassignOnt(ontNode);
        } catch(e) {
            alert('Failed to unassign');
        }
    };

    return (
        <div className="flex-1 bg-white p-6 overflow-y-auto w-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm text-slate-500 font-medium">Showing {filteredNodes.length} of {nodes.length} nodes</h2>
                
                {selectedIds.length > 0 && onDelete && (
                    <button 
                        onClick={handleDeleteSelected}
                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedIds.length})
                    </button>
                )}
            </div>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden text-sm w-full">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="px-4 py-4 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                    checked={selectedIds.length > 0 && selectedIds.length === filteredNodes.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4">TYPE</th>
                            <th className="px-6 py-4">NAME</th>
                            <th className="px-6 py-4">LOCATION</th>
                            <th className="px-6 py-4 w-64">AVAILABLE SLOTS</th>
                            <th className="px-6 py-4">STATUS</th>
                            <th className="px-6 py-4">NOTES</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredNodes.map(node => {
                            const cap = getCapacity(node);
                            
                            return (
                                <tr key={node.id} className={cn("hover:bg-slate-50 transition-colors", selectedIds.includes(node.id) && "bg-blue-50/50")}>
                                    <td className="px-4 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                            checked={selectedIds.includes(node.id)}
                                            onChange={() => handleSelectOne(node.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn("px-2.5 py-1 text-white text-[10px] uppercase font-medium rounded-full", getTypeColor(node.type))}>
                                            {node.type === 'SERVER' ? 'Server/OLT' : node.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        {node.name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs">
                                        {node.lat}, {node.lng}
                                    </td>
                                    <td className="px-6 py-4">
                                        {cap ? (
                                            <div>
                                                <div className="flex justify-between text-xs mb-1.5">
                                                    <span className="font-medium text-slate-700">{cap.available} available</span>
                                                    <span className="text-slate-400">{cap.used}/{cap.total}</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                                                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${cap.percent}%` }} />
                                                </div>
                                                {node.type === 'ODP' && cap.used > 0 && (
                                                    <div className="flex items-center gap-2 text-[10px] font-medium mt-2">
                                                        <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded leading-none border border-green-200">{cap.online} Online</span>
                                                        <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded leading-none border border-red-200">{cap.offline} Offline</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {node.type === 'ONT' ? (() => {
                                                const cust = node.refId ? customers.find(c => c.name === node.refId) : null;
                                                const health = getNodeHealth(node);
                                                return (
                                                    <>
                                                        <div className="flex flex-col">
                                                            <span className={cn(
                                                                "font-medium px-2 py-1 text-[11px] rounded border",
                                                                health === 'offline' 
                                                                    ? "text-red-600 bg-red-50 border-red-200" 
                                                                    : "text-green-600 bg-green-50 border-green-200"
                                                            )}>
                                                                {cust?.comment || cust?.name || node.refId || 'Unlinked'}
                                                            </span>
                                                            {cust && <span className="text-[10px] text-slate-400 mt-0.5 ml-1 font-mono">{cust.name}</span>}
                                                        </div>
                                                        <button 
                                                            onClick={() => handleUnassignFromList(node)} 
                                                            className="bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-colors"
                                                            title="Unassign customer"
                                                        >
                                                            <UserMinus className="w-3 h-3" /> Unassign
                                                        </button>
                                                    </>
                                                );
                                            })() : (() => {
                                                const health = getNodeHealth(node);
                                                return (
                                                    <>
                                                        {health === 'offline' ? (
                                                            <span className="text-red-600 bg-red-50 font-medium px-2 py-1 text-[11px] rounded border border-red-200 uppercase tracking-tighter">Offline</span>
                                                        ) : (
                                                            <span className="text-green-600 bg-green-50 font-medium px-2 py-1 text-[11px] rounded">Active</span>
                                                        )}
                                                        {node.type === 'ODP' && (
                                                            <button 
                                                                onClick={() => { setAssigningOdp(node); setSelectedCustomerId(''); setAssignSearchQuery(''); }} 
                                                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-colors"
                                                            >
                                                                <UserPlus className="w-3 h-3" /> Assign
                                                            </button>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs italic">
                                        No notes
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredNodes.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                    No nodes found matching your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ASSIGN ODP MODAL */}
            {assigningOdp && (() => {
                const rootServer = getRootServer(assigningOdp);
                const serverName = rootServer ? rootServer.name : 'Unknown Server';
                
                const validCustomers = customers.filter(c => c.serverId === rootServer?.refId);
                const filteredValid = validCustomers.filter(c => {
                    if (!assignSearchQuery) return true;
                    const q = assignSearchQuery.toLowerCase();
                    return c.name.toLowerCase().includes(q) || 
                           (c.comment && c.comment.toLowerCase().includes(q)) ||
                           (c["remote-address"] && c["remote-address"].toLowerCase().includes(q));
                });

                return (
                    <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" style={{ animation: 'easeOut 0.2s' }}>
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="font-bold text-slate-800">Assign Customer to ODP</h3>
                                    <p className="text-xs text-slate-500 mt-1">Target: <span className="font-bold text-blue-600">{assigningOdp.name}</span></p>
                                </div>
                                <button onClick={() => setAssigningOdp(null)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                            
                            <div className="p-6 flex-1 overflow-hidden flex flex-col">
                                <div className="mb-3 shrink-0">
                                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">Select PPPoE Client from {serverName}</label>
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                        <input 
                                            type="text" 
                                            placeholder="Search by username, comment, or IP..." 
                                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
                                            value={assignSearchQuery}
                                            onChange={e => setAssignSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 min-h-[300px]">
                                    {filteredValid.length === 0 ? (
                                        <div className="p-8 text-center text-sm text-slate-400 flex flex-col items-center justify-center h-full">
                                            <Search className="w-8 h-8 text-slate-300 mb-3" />
                                            No matching clients found in {serverName}
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredValid.map(c => (
                                                <button 
                                                    key={c.id} 
                                                    onClick={() => setSelectedCustomerId(c.name)}
                                                    className={cn(
                                                        "w-full text-left p-4 hover:bg-blue-50/50 transition-colors flex items-start gap-3",
                                                        selectedCustomerId === c.name ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'bg-white border-l-4 border-l-transparent'
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn("font-bold text-sm truncate", selectedCustomerId === c.name ? "text-blue-700" : "text-slate-800")}>{c.name}</span>
                                                                {c.disabled ? (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="Disabled"></span>
                                                                ) : (
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Active"></span>
                                                                )}
                                                            </div>
                                                            {c.odpId === assigningOdp.id && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Current</span>}
                                                            {c.odpId && c.odpId !== assigningOdp.id && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Used in other ODP</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-600 mb-2 font-medium">{c.comment || <span className="italic text-slate-400 font-normal">No comment</span>}</div>
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 font-medium tracking-wide border-t border-slate-50 pt-2">
                                                            <span className="flex items-center gap-1.5"><Monitor className="w-3 h-3 text-slate-400"/> {c["remote-address"] || 'No IP'}</span>
                                                            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-400"/> {c["last-logged-out"] || 'Never'}</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
                                <button onClick={() => setAssigningOdp(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAssignSubmit} 
                                    disabled={!selectedCustomerId || validCustomers.find(c=>c.name===selectedCustomerId)?.odpId === assigningOdp.id}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                                >
                                    <UserPlus className="w-4 h-4"/> Confirm Assign
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

        </div>
    );
}
