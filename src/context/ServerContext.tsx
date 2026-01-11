import React, { createContext, useContext, useEffect, useState } from 'react';

export interface MikrotikServer {
    id: string;
    name: string;
    ip: string;
    port: number;
    username: string;
    password?: string; // stored locally, obviously not secure for production but fine for this demo
    isOnline: boolean;
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
    const [servers, setServers] = useState<MikrotikServer[]>(() => {
        const saved = localStorage.getItem('mikrotik_servers');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('mikrotik_servers', JSON.stringify(servers));
    }, [servers]);

    const addServer = (data: Omit<MikrotikServer, 'id' | 'isOnline'>) => {
        const newServer: MikrotikServer = {
            ...data,
            id: crypto.randomUUID(),
            isOnline: false, // default offline until checked
        };
        setServers(prev => [...prev, newServer]);
    };

    const editServer = (id: string, updatedData: Partial<MikrotikServer>) => {
        setServers(prev => prev.map(server =>
            server.id === id ? { ...server, ...updatedData } : server
        ));
    };

    const removeServer = (id: string) => {
        setServers(prev => prev.filter(s => s.id !== id));
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
