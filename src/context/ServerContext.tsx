import React, { createContext, useContext, useEffect, useState } from 'react';

export interface MikrotikServer {
    id: string;
    name: string;
    ip: string;
    port: number;
    username: string;
    password?: string; // stored locally, obviously not secure for production but fine for this demo
    isOnline: boolean;
    installation_costs?: { name: string; price: number }[];
    lat?: number;
    lng?: number;
}

interface ServerContextType {
    servers: MikrotikServer[];
    addServer: (server: Omit<MikrotikServer, 'id' | 'isOnline'>) => void;
    editServer: (id: string, data: Partial<MikrotikServer>) => void;
    removeServer: (id: string) => void;
    updateServerStatus: (id: string, isOnline: boolean) => void;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export function ServerProvider({ children }: { children: React.ReactNode }) {
    const [servers, setServers] = useState<MikrotikServer[]>([]);

    // Fetch servers from backend on mount
    useEffect(() => {
        const fetchServers = async () => {
            try {
                const response = await fetch('/api/servers');
                if (response.ok) {
                    const data = await response.json();
                    // Add isOnline: false to each server as it's not stored in DB
                    setServers(data.map((s: any) => ({ ...s, isOnline: false })));
                } else {
                    console.error('Failed to fetch servers');
                }
            } catch (error) {
                console.error('Error fetching servers:', error);
            }
        };
        fetchServers();
    }, []);

    const addServer = async (data: Omit<MikrotikServer, 'id' | 'isOnline'>) => {
        try {
            const response = await fetch('/api/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const newServerData = await response.json();
                const newServer: MikrotikServer = {
                    ...newServerData,
                    isOnline: false,
                };
                setServers(prev => [...prev, newServer]);
            } else {
                console.error('Failed to add server');
            }
        } catch (error) {
            console.error('Error adding server', error);
        }
    };

    const editServer = async (id: string, updatedData: Partial<MikrotikServer>) => {
        // Optimistic update for UI responsiveness, especially for isOnline which isn't saved
        setServers(prev => prev.map(server =>
            server.id === id ? { ...server, ...updatedData } : server
        ));

        // If we are just updating status (isOnline), do NOT save to DB
        // The check is if updatedData ONLY contains isOnline, or if we want to filter it out
        // However, editServer is usually used for config edits. updateServerStatus is for isOnline.
        // Let's separate cleanly.

        // Filter out isOnline from the payload to backend
        const { isOnline, ...dataToSave } = updatedData;

        if (Object.keys(dataToSave).length > 0) {
            try {
                await fetch(`/api/servers/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSave)
                });
            } catch (error) {
                console.error('Error updating server', error);
                // Revert? For now, assume success or user will retry
            }
        }
    };

    const removeServer = async (id: string) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus server ini? Semua data pelanggan dan invoice terkait akan ikut terhapus secara permanen.')) {
            return;
        }
        try {
            const response = await fetch(`/api/servers/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setServers(prev => prev.filter(s => s.id !== id));
            } else {
                const err = await response.json();
                alert('Gagal menghapus server: ' + (err.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting server', error);
            alert('Terjadi kesalahan saat menghapus server.');
        }
    };

    const updateServerStatus = (id: string, isOnline: boolean) => {
        setServers(prev => prev.map(s => s.id === id ? { ...s, isOnline } : s));
    };

    return (
        <ServerContext.Provider value={{ servers, addServer, editServer, removeServer, updateServerStatus }}>
            {children}
        </ServerContext.Provider>
    );
}

export function useServers() {
    const context = useContext(ServerContext);
    if (context === undefined) {
        throw new Error('useServers must be used within a ServerProvider');
    }
    return context;
}
