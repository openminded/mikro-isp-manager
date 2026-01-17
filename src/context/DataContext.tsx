import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Customer, Profile, IpPool, Registration } from '@/types';
import axios from 'axios';
import { useServers } from './ServerContext';
import { MikrotikApi } from '@/services/mikrotikApi';

interface DataContextType {
    customers: Customer[];
    profiles: Profile[];
    pools: IpPool[];
    loadingCustomers: boolean;
    loadingProfiles: boolean;
    loadingPools: boolean;
    refreshCustomers: (force?: boolean) => Promise<void>;
    refreshProfiles: (force?: boolean) => Promise<void>;
    refreshPools: (force?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const DEFAULT_PRICES: Record<string, number> = {
    "PPoE-5Mbps": 100000,
    "PPoE-10Mbps": 150000,
    "PPoE-20Mbps": 250000,
    "PPoE-50Mbps": 500000,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
    const { servers } = useServers();

    // Data State
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [pools, setPools] = useState<IpPool[]>([]);

    // Loading State
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [loadingPools, setLoadingPools] = useState(false);

    // Initial Fetch Flags to prevent double fetch on strict mode
    const [fetchedCustomers, setFetchedCustomers] = useState(false);
    const [fetchedProfiles, setFetchedProfiles] = useState(false);
    const [fetchedPools, setFetchedPools] = useState(false);

    const refreshCustomers = async (force = false) => {
        if (!force && fetchedCustomers && customers.length > 0) return;

        setLoadingCustomers(true);
        const newCustomers: Customer[] = [];
        try {
            if (servers.length === 0) return;

            const metaData = await MikrotikApi.getExtendedData();

            // Fetch registrations for linking real names
            let registrations: Registration[] = [];
            try {
                const res = await axios.get('/api/registrations');
                if (Array.isArray(res.data)) registrations = res.data;
            } catch (e) { console.error("Failed to fetch registrations for linking", e); }

            await Promise.all(servers.map(async (server) => {
                // Read from cache/live
                try {
                    const isDisabled = (raw: any) => {
                        const val = raw.disabled;
                        if (val === true || val === 'true' || val === 'yes' || val === '1') return true;
                        return false;
                    };

                    const secrets = await MikrotikApi.getPPPSecrets(server); // Reads cache
                    secrets.forEach((s: any) => {
                        const key = `${server.id}_${s.name}`;
                        const meta = metaData[key] || {};

                        // Link with Registration
                        let realName = '';
                        let registrationId = '';
                        if (meta.whatsapp) {
                            // Try to find by normalized phone number
                            const phone = meta.whatsapp.replace(/\D/g, '');
                            const reg = registrations.find(r => r.phoneNumber?.replace(/\D/g, '') === phone);
                            if (reg) {
                                realName = reg.fullName;
                                registrationId = reg.id;
                            }
                        }

                        newCustomers.push({
                            id: s['.id'],
                            name: s.name,
                            password: s.password,
                            service: s.service || 'any',
                            profile: s.profile || 'default',
                            "remote-address": s['remote-address'],
                            "last-logged-out": s['last-logged-out'],
                            disabled: isDisabled(s),
                            comment: s.comment,
                            serverName: server.name,
                            serverId: server.id,
                            whatsapp: meta.whatsapp,
                            realName: realName,
                            registrationId: registrationId,
                            lat: meta.lat,
                            long: meta.long,
                            photos: meta.photos || [],
                            ktp: meta.ktp,
                            activationDate: meta.activationDate
                        });
                    });
                } catch (e) {
                    console.error(`Failed to fetch customers from ${server.name}`, e);
                }
            }));

            setCustomers(newCustomers);
            setFetchedCustomers(true);
        } catch (e) {
            console.error("Failed to refresh customers", e);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const refreshProfiles = async (force = false) => {
        if (!force && fetchedProfiles && profiles.length > 0) return;

        setLoadingProfiles(true);
        const newProfiles: Profile[] = [];
        try {
            if (servers.length === 0) return;

            const extendedData = await MikrotikApi.getProfileExtendedData();

            await Promise.all(servers.map(async (server) => {
                try {
                    const data = await MikrotikApi.getPPPProfiles(server); // Reads cache

                    for (const p of data) {
                        const key = `${server.id}_${p.name}`;
                        let price = extendedData[key]?.price;

                        if (price === undefined && DEFAULT_PRICES[p.name]) {
                            price = DEFAULT_PRICES[p.name];
                            MikrotikApi.updateProfileExtendedData(server.id, p.name, { price }).catch(console.error);
                        }

                        newProfiles.push({
                            id: p['.id'],
                            name: p.name,
                            "local-address": p['local-address'],
                            "remote-address": p['remote-address'],
                            "rate-limit": p['rate-limit'],
                            "dns-server": p['dns-server'],
                            serverName: server.name,
                            serverId: server.id,
                            price: price ? Number(price) : undefined
                        });
                    }
                } catch (e) {
                    console.error(`Failed to fetch profiles from ${server.name}`, e);
                }
            }));

            setProfiles(newProfiles);
            setFetchedProfiles(true);
        } catch (e) {
            console.error("Failed to refresh profiles", e);
        } finally {
            setLoadingProfiles(false);
        }
    };

    const refreshPools = async (force = false) => {
        if (!force && fetchedPools && pools.length > 0) return;

        setLoadingPools(true);
        const newPools: IpPool[] = [];
        try {
            if (servers.length === 0) return;

            await Promise.all(servers.map(async (server) => {
                try {
                    const data = await MikrotikApi.getIPPools(server); // Reads cache
                    data.forEach((p: any) => {
                        newPools.push({
                            id: p['.id'],
                            name: p.name,
                            ranges: p.ranges,
                            "next-pool": p['next-pool'],
                            serverName: server.name,
                            serverId: server.id
                        });
                    });
                } catch (e) {
                    console.error(`Failed to fetch pools from ${server.name}`, e);
                }
            }));

            setPools(newPools);
            setFetchedPools(true);
        } catch (e) {
            console.error("Failed to refresh pools", e);
        } finally {
            setLoadingPools(false);
        }
    };

    // Auto-fetch data on mount if servers exist
    // Actually, good to rely on Pages calling refresh() on mount, 
    // but we can also trigger a background fetch here if we want instant data everywhere.
    // Let's stick to Pages calling it, but Context holding the state.
    // OR, better yet, trigger inside useEffect here when servers load.

    useEffect(() => {
        if (servers.length > 0) {
            // We can pre-fetch transparently
            refreshCustomers();
            refreshProfiles();
            refreshPools();
        }
    }, [servers]);

    return (
        <DataContext.Provider value={{
            customers, profiles, pools,
            loadingCustomers, loadingProfiles, loadingPools,
            refreshCustomers, refreshProfiles, refreshPools
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
