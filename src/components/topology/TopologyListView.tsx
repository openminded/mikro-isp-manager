import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, UserPlus, X, Search, UserMinus, ChevronLeft, ChevronRight, Filter, Eye, Edit, Users, MapPin, Hash, User } from 'lucide-react';
import type { NetworkNode } from '@/pages/Monitoring';
import { useData } from '@/context/DataContext';
import { useServers } from '@/context/ServerContext';
import axios from 'axios';

interface TopologyListViewProps {
    nodes: NetworkNode[];
    searchQuery: string;
    filterType?: string;
    customers?: any[];
    networkStatus: Record<string, any>;
    onEdit?: (node: NetworkNode) => void;
    onDelete?: (ids: string[]) => void;
    onUnassignOnt?: (ontNode: NetworkNode) => void;
    onViewOnMap?: (lat: number, lng: number) => void;
}

const TABS = [
    { id: 'SERVER', label: 'Server' },
    { id: 'OLT', label: 'OLT' },
    { id: 'ODC', label: 'ODC' },
    { id: 'ODP', label: 'ODP' },
    { id: 'ONT', label: 'ONT' },
];

export function TopologyListView({ nodes, searchQuery: externalSearch, networkStatus, onEdit, onDelete, onUnassignOnt, onViewOnMap }: TopologyListViewProps) {
    const { customers, refreshCustomers } = useData();
    const { servers } = useServers();
    const [subAreas, setSubAreas] = useState<any[]>([]);
    
    const [activeTab, setActiveTab] = useState('SERVER');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    
    // Filters
    const [localSearch, setLocalSearch] = useState('');
    const [selectedServerId, setSelectedServerId] = useState('all');
    const [selectedSubAreaId, setSelectedSubAreaId] = useState('all');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Members Viewing
    const [viewingMembersNode, setViewingMembersNode] = useState<NetworkNode | null>(null);

    // Assigning State
    const [assigningOdp, setAssigningOdp] = useState<NetworkNode | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [assignSearchQuery, setAssignSearchQuery] = useState<string>('');

    useEffect(() => {
        axios.get('/api/sub-areas').then((res: any) => setSubAreas(res.data)).catch(console.error);
    }, []);

    // Helper to find root server for any node
    const getRootServer = (node: NetworkNode) => {
        let current: NetworkNode | undefined = node;
        while (current && current.type !== 'SERVER') {
            current = nodes.find(n => n.id === current?.parentId);
        }
        return current;
    };

    const filteredNodes = useMemo(() => {
        return nodes.filter(node => {
            // Tab Filter
            if (node.type !== activeTab) return false;

            // Search Filter
            const search = (localSearch || externalSearch).toLowerCase();
            const matchesSearch = node.name.toLowerCase().includes(search) || 
                                 (node.notes || '').toLowerCase().includes(search);
            if (!matchesSearch) return false;

            // Server Filter
            if (selectedServerId !== 'all') {
                const root = getRootServer(node);
                if (!root || root.refId !== selectedServerId) return false;
            }

            // Sub Area Filter
            if (selectedSubAreaId !== 'all') {
                if (node.subAreaId !== selectedSubAreaId) return false;
            }

            return true;
        });
    }, [nodes, activeTab, localSearch, externalSearch, selectedServerId, selectedSubAreaId]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredNodes.length / itemsPerPage);
    const paginatedNodes = filteredNodes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds([]);
    }, [activeTab, localSearch, externalSearch, selectedServerId, selectedSubAreaId]);

    // Removed unused getTypeColor

    const getCapacity = (node: NetworkNode) => {
        if (node.type === 'SERVER') return null;
        
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
            setSelectedIds(paginatedNodes.map(n => n.id));
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
            if (!rootServer) return;
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

    const handleDisconnectNode = async (node: NetworkNode) => {
        if (!confirm(`Disconnect "${node.name}" from its parent?`)) return;
        try {
            await axios.put(`/api/network/nodes/${node.id}`, { ...node, parentId: '' });
            if (onUnassignOnt) onUnassignOnt(node); // Reuse refresh logic
        } catch (e) {
            alert('Failed to disconnect node');
        }
    };

    const handleDisconnectCustomer = async (custName: string) => {
        if (!confirm(`Unassign customer "${custName}" from this ODP?`)) return;
        try {
            if (!viewingMembersNode) return;
            const rootServer = getRootServer(viewingMembersNode);
            if (!rootServer) return;

            await axios.post('/api/network/link-customer', {
                serverId: rootServer.refId,
                customerId: custName,
                odpId: null
            });
            await refreshCustomers(true);
            if (onUnassignOnt) onUnassignOnt(viewingMembersNode); // Refresh parent view if needed
        } catch (e) {
            alert('Failed to disconnect customer');
        }
    };

    return (
        <div className="flex-1 bg-white flex flex-col overflow-hidden w-full">
            {/* Tab Bar */}
            <div className="px-6 border-b border-slate-100 flex items-center bg-white shrink-0 overflow-x-auto no-scrollbar">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "py-4 px-6 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
                            activeTab === tab.id 
                                ? "border-blue-600 text-blue-600 bg-blue-50/30" 
                                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-4 shrink-0">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder={`Search ${activeTab.toLowerCase()}...`}
                        value={localSearch}
                        onChange={e => setLocalSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select 
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={selectedServerId}
                        onChange={e => setSelectedServerId(e.target.value)}
                    >
                        <option value="all">All Servers</option>
                        {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <select 
                        className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={selectedSubAreaId}
                        onChange={e => setSelectedSubAreaId(e.target.value)}
                    >
                        <option value="all">All Areas</option>
                        {subAreas.map(sa => <option key={sa.id} value={sa.id}>{sa.name}</option>)}
                    </select>
                </div>

                {selectedIds.length > 0 && (
                    <button 
                        onClick={handleDeleteSelected}
                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
                    </button>
                )}
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-y-auto w-full">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                    checked={selectedIds.length > 0 && selectedIds.length === paginatedNodes.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="px-6 py-4">Node Name</th>
                            {activeTab === 'ONT' && <th className="px-6 py-4">Customer Name</th>}
                            <th className="px-6 py-4">Location</th>
                            <th className="px-6 py-4">Capacity / Usage</th>
                            <th className="px-6 py-4">Health Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedNodes.map(node => {
                            const cap = getCapacity(node);
                            const health = getNodeHealth(node);
                            
                            return (
                                <tr key={node.id} className={cn("hover:bg-slate-50 transition-colors group", selectedIds.includes(node.id) && "bg-blue-50/50")}>
                                    <td className="px-6 py-3 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                            checked={selectedIds.includes(node.id)}
                                            onChange={() => handleSelectOne(node.id)}
                                        />
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-800 text-sm">{node.name}</span>
                                            <span className="text-[10px] text-slate-400 mt-0.5">{node.notes || 'No description'}</span>
                                        </div>
                                    </td>
                                    {activeTab === 'ONT' && (
                                        <td className="px-6 py-3">
                                            <span className="text-sm font-medium text-slate-700">
                                                {customers.find(c => c.name === node.refId)?.comment || '-'}
                                            </span>
                                        </td>
                                    )}
                                    <td className="px-6 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] text-slate-600 font-medium">{node.lat.toFixed(6)}, {node.lng.toFixed(6)}</span>
                                            {node.subAreaId && (
                                                <span className="text-[10px] text-blue-600 mt-0.5 font-bold uppercase tracking-tighter">
                                                    {subAreas.find(sa => sa.id === node.subAreaId)?.name || 'Unknown Area'}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3">
                                        {cap ? (
                                            <div className="w-40">
                                                <div className="flex justify-between text-[10px] mb-1 font-bold">
                                                    <span className="text-slate-500">{cap.used} / {cap.total} used</span>
                                                    <span className={cn(cap.available === 0 ? "text-red-500" : "text-green-600")}>{cap.available} free</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={cn("h-full rounded-full transition-all", cap.percent > 90 ? "bg-red-500" : "bg-blue-500")} 
                                                        style={{ width: `${cap.percent}%` }} 
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", health === 'online' ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                                            <span className={cn("text-xs font-bold uppercase tracking-wider", health === 'online' ? "text-green-600" : "text-red-600")}>
                                                {health}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button 
                                                onClick={() => onViewOnMap && onViewOnMap(node.lat, node.lng)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                                title="View on Map"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> View
                                            </button>

                                            {node.type !== 'ONT' && (
                                                <button 
                                                    onClick={() => setViewingMembersNode(node)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                                    title="View Members / Children"
                                                >
                                                    <Users className="w-3.5 h-3.5" /> Members
                                                </button>
                                            )}

                                            {node.type === 'ODP' && (
                                                <button 
                                                    onClick={() => { setAssigningOdp(node); setSelectedCustomerId(''); setAssignSearchQuery(''); }} 
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Assign Customer"
                                                >
                                                    <UserPlus className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => onEdit && onEdit(node)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                            >
                                                <Edit className="w-3.5 h-3.5" /> Edit
                                            </button>

                                            {node.type === 'ONT' && (
                                                <button 
                                                    onClick={() => handleUnassignFromList(node)} 
                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Unassign"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => onDelete && onDelete([node.id])}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredNodes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <Search className="w-10 h-10 mb-4 opacity-20" />
                                        <p className="text-sm font-medium">No results found for current filters</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="text-xs text-slate-500 font-medium">
                        Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredNodes.length)}</span> of <span className="text-slate-900">{filteredNodes.length}</span> entries
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }).map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={cn(
                                        "w-8 h-8 text-xs font-bold rounded-lg transition-all",
                                        currentPage === i + 1 ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "text-slate-500 hover:bg-slate-50"
                                    )}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* ASSIGN ODP MODAL (Repurposed from previous) */}
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
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-800">Assign Customer to ODP</h3>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Target Node: <span className="text-blue-600">{assigningOdp.name}</span></p>
                                </div>
                                <button onClick={() => setAssigningOdp(null)} className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-lg">
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>
                            
                            <div className="p-6 flex-1 overflow-hidden flex flex-col space-y-4">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input 
                                        type="text" 
                                        placeholder={`Search clients in ${serverName}...`} 
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                                        value={assignSearchQuery}
                                        onChange={e => setAssignSearchQuery(e.target.value)}
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-slate-50/50">
                                    {filteredValid.length === 0 ? (
                                        <div className="p-12 text-center text-slate-400">
                                            <p className="text-xs font-medium">No available clients found</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredValid.map(c => (
                                                <button 
                                                    key={c.id} 
                                                    onClick={() => setSelectedCustomerId(c.name)}
                                                    className={cn(
                                                        "w-full text-left p-4 hover:bg-white transition-all flex items-start gap-3",
                                                        selectedCustomerId === c.name ? 'bg-white ring-2 ring-blue-500/20 z-10' : 'bg-transparent'
                                                    )}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className={cn("font-bold text-sm", selectedCustomerId === c.name ? "text-blue-600" : "text-slate-800")}>{c.name}</span>
                                                            <div className={cn("w-1.5 h-1.5 rounded-full", c.disabled ? "bg-red-400" : "bg-green-400")} />
                                                        </div>
                                                        <div className="text-xs text-slate-500 line-clamp-1">{c.comment || 'No comment'}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-2">
                                <button onClick={() => setAssigningOdp(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAssignSubmit} 
                                    disabled={!selectedCustomerId}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-200 transition-all"
                                >
                                    Confirm Assign
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* VIEW MEMBERS MODAL */}
            {viewingMembersNode && (() => {
                const members = nodes.filter(n => n.parentId === viewingMembersNode.id);
                const assignedCustomers = viewingMembersNode.type === 'ODP' 
                    ? customers.filter(c => c.odpId === viewingMembersNode.id)
                    : [];

                return (
                    <div className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                                <div>
                                    <h3 className="font-bold text-lg">{viewingMembersNode.name} - Members</h3>
                                    <p className="text-[10px] text-white/70 uppercase font-bold tracking-widest mt-0.5">
                                        Type: {viewingMembersNode.type} • {viewingMembersNode.type === 'ODP' ? 'Assigned Customers' : 'Connected Devices'}
                                    </p>
                                </div>
                                <button onClick={() => setViewingMembersNode(null)} className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                                    <X className="w-6 h-6"/>
                                </button>
                            </div>

                            <div className="p-0 overflow-y-auto flex-1 bg-slate-50/50">
                                {viewingMembersNode.type === 'ODP' ? (
                                    assignedCustomers.length === 0 ? (
                                        <div className="py-20 text-center text-slate-400">
                                            <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No customers assigned to this ODP</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100 bg-white">
                                            {assignedCustomers.map(c => (
                                                <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 border border-green-100">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm">{c.comment || c.name}</p>
                                                            <p className="text-[11px] text-slate-400 font-medium">PPPoE: {c.name} • {c['remote-address'] || 'No IP'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn(
                                                            "text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                                                            c.disabled ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                                                        )}>
                                                            {c.disabled ? 'Inactive' : 'Active'}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleDisconnectCustomer(c.name)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                            title="Disconnect from ODP"
                                                        >
                                                            <UserMinus className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    members.length === 0 ? (
                                        <div className="py-20 text-center text-slate-400">
                                            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No connected child devices found</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100 bg-white">
                                            {members.map(m => (
                                                <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm",
                                                            m.type === 'OLT' ? 'bg-purple-600' :
                                                            m.type === 'ODC' ? 'bg-blue-600' :
                                                            m.type === 'ODP' ? 'bg-cyan-500' : 'bg-green-500'
                                                        )}>
                                                            <Hash className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm">{m.name}</p>
                                                            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-tighter">{m.type} • {m.lat.toFixed(6)}, {m.lng.toFixed(6)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => { setViewingMembersNode(null); onViewOnMap && onViewOnMap(m.lat, m.lng); }}
                                                            className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-[10px] font-bold uppercase transition-colors border border-blue-100"
                                                        >
                                                            Track on Map
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDisconnectNode(m)}
                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shadow-sm"
                                                            title="Disconnect Connection"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                            
                            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                                <button onClick={() => setViewingMembersNode(null)} className="px-6 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition-all">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
