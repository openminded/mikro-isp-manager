import type { MikrotikServer } from "@/context/ServerContext";

export interface SystemResource {
    uptime: string;
    version: string;
    "cpu-load": string;
    "free-memory": string;
    "total-memory": string;
}

export interface InterfaceStats {
    name: string;
    "rx-byte": number;
    "tx-byte": number;
    "rx-bits-per-second": number;
    "tx-bits-per-second": number;
}

const API_URL = '/api/proxy';
const META_API_URL = '/api';

// Helper to use the Backend Proxy
const runCommand = async (server: MikrotikServer, command: string[]) => {
    // Ensure command is array of strings for proper API formatting if library supports it,
    // but typically node-routeros .write() takes a single path or array. 
    // We'll standardise on passing the primary command path here, or array if args needed.
    // However, simplest usage is often just the command path string if no complex queries.

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            host: server.ip,
            port: server.port,
            user: server.username,
            password: server.password,
            command: command
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mikrotik API Error (${response.status}): ${errorText}`);
    }

    return await response.json();
};

export const MikrotikApi = {
    async getSystemResource(server: MikrotikServer): Promise<SystemResource> {
        try {
            const data = await runCommand(server, ['/system/resource/print']);
            const resource = Array.isArray(data) ? data[0] : data;

            // API returns mixed types (numbers/strings). Ensure conversion.
            return {
                uptime: resource.uptime || "0s",
                version: resource.version || "Unknown",
                "cpu-load": String(resource['cpu-load'] || "0"),
                "free-memory": String(resource['free-memory'] || "0"),
                "total-memory": String(resource['total-memory'] || "0"),
            };
        } catch (error) {
            console.error("Mikrotik API Error (System):", error);
            throw error;
        }
    },

    async getInterfaceMonitor(server: MikrotikServer, interfaceName: string = 'ether1'): Promise<InterfaceStats> {
        try {
            // monitor-traffic requires arguments: interface=<name>, once
            const data = await runCommand(server, [
                '/interface/monitor-traffic',
                `=interface=${interfaceName}`,
                '=once'
            ]);
            const stats = Array.isArray(data) ? data[0] : data;

            return {
                name: interfaceName,
                "rx-byte": Number(stats['rx-bits-per-second'] || 0) / 8,
                "tx-byte": Number(stats['tx-bits-per-second'] || 0) / 8,
                "rx-bits-per-second": Number(stats['rx-bits-per-second'] || 0),
                "tx-bits-per-second": Number(stats['tx-bits-per-second'] || 0),
            };
        } catch (error) {
            console.error("Mikrotik API Error (Interface):", error);
            throw error;
        }
    },

    async getAllInterfaces(_server: MikrotikServer): Promise<any[]> {
        return [];
    },

    async getActivePPP(server: MikrotikServer): Promise<number> {
        try {
            // Using 'count-only' is efficient if supported, else fetch list and length
            // /ppp/active/print with count-only might not return pure number in all lib wrappers
            // Safer to just get list for now.
            const data = await runCommand(server, ['/ppp/active/print']);
            return Array.isArray(data) ? data.length : 0;
        } catch (error) {
            // console.error("Mikrotik API Error (PPP):", error);
            throw error;
        }
    },

    // --- Sync & Cache Methods ---

    async syncSecrets(server: MikrotikServer): Promise<any> {
        return await fetch(`${META_API_URL}/mikrotik/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server, resource: 'secrets' })
        }).then(r => r.json());
    },

    async getPPPSecrets(server: MikrotikServer): Promise<any[]> {
        // Read from cache
        try {
            const res = await fetch(`${META_API_URL}/mikrotik/data?serverId=${server.id}&resource=secrets`);
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
        } catch (e) {
            console.error("Failed to read secrets cache", e);
            return [];
        }
    },

    async syncProfiles(server: MikrotikServer): Promise<any> {
        return await fetch(`${META_API_URL}/mikrotik/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server, resource: 'profiles' })
        }).then(r => r.json());
    },

    async getPPPProfiles(server: MikrotikServer): Promise<any[]> {
        try {
            const res = await fetch(`${META_API_URL}/mikrotik/data?serverId=${server.id}&resource=profiles`);
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
        } catch (e) {
            console.error("Failed to read profiles cache", e);
            return [];
        }
    },

    async syncPools(server: MikrotikServer): Promise<any> {
        return await fetch(`${META_API_URL}/mikrotik/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ server, resource: 'pools' })
        }).then(r => r.json());
    },

    async getIPPools(server: MikrotikServer): Promise<any[]> {
        try {
            const res = await fetch(`${META_API_URL}/mikrotik/data?serverId=${server.id}&resource=pools`);
            const json = await res.json();
            return Array.isArray(json.data) ? json.data : [];
        } catch (e) {
            console.error("Failed to read pools cache", e);
            return [];
        }
    },

    async addPPPSecret(server: MikrotikServer, data: any): Promise<any> {
        // ... (Keep existing write logic as writes should be live. 
        // Ideally we should auto-sync after write, but for now kept simple)
        const command = ['/ppp/secret/add'];
        Object.keys(data).forEach(key => command.push(`=${key}=${data[key]}`));
        return await runCommand(server, command);
    },

    async updatePPPSecret(server: MikrotikServer, id: string, data: any): Promise<any> {
        const command = ['/ppp/secret/set', `=.id=${id}`];
        Object.keys(data).forEach(key => command.push(`=${key}=${data[key]}`));
        return await runCommand(server, command);
    },

    async togglePPPSecret(server: MikrotikServer, id: string, disabled: boolean): Promise<any> {
        const command = ['/ppp/secret/set', `=.id=${id}`, `=disabled=${disabled ? 'yes' : 'no'}`];
        return await runCommand(server, command);
    },

    async removePPPSecret(server: MikrotikServer, id: string): Promise<any> {
        const command = ['/ppp/secret/remove', `=.id=${id}`];
        return await runCommand(server, command);
    },

    async removeActivePppSession(server: MikrotikServer, username: string): Promise<void> {
        try {
            // Find active session ID
            const activeSessions = await runCommand(server, ['/ppp/active/print', `?name=${username}`]);
            if (Array.isArray(activeSessions) && activeSessions.length > 0) {
                const id = activeSessions[0]['.id'];
                // Remove session
                await runCommand(server, ['/ppp/active/remove', `=.id=${id}`]);
            }
        } catch (error) {
            console.error(`Failed to remove active session for ${username}:`, error);
        }
    },


    // --- CRM / Extended Data Methods ---
    async getExtendedData(): Promise<Record<string, any>> {
        try {
            const res = await fetch(`${META_API_URL}/customers/meta`);
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch extended data", e);
            return {};
        }
    },

    async updateExtendedData(serverId: string, customerId: string, data: any): Promise<any> {
        try {
            const res = await fetch(`${META_API_URL}/customers/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, customerId, ...data })
            });
            return await res.json();
        } catch (e) {
            console.error("Failed to update extended data", e);
            return null;
        }
    },

    async uploadPhotos(files: File[]): Promise<string[]> {
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));

        try {
            const res = await fetch(`${META_API_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            return data.urls || [];
        } catch (e) {
            console.error("Failed to upload photos", e);
            return [];
        }
    },

    async addPPPProfile(server: MikrotikServer, data: any): Promise<any> {
        const command = ['/ppp/profile/add'];
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                command.push(`=${key}=${data[key]}`);
            }
        });
        return await runCommand(server, command);
    },

    async updatePPPProfile(server: MikrotikServer, id: string, data: any): Promise<any> {
        const command = ['/ppp/profile/set', `=.id=${id}`];
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                command.push(`=${key}=${data[key]}`);
            }
        });
        return await runCommand(server, command);
    },

    // --- Profile Extended Data (CRM) ---
    async getProfileExtendedData() {
        try {
            const response = await fetch(`${META_API_URL}/profiles/meta`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to fetch profile extended data", error);
            return {};
        }
    },

    async updateProfileExtendedData(serverId: string, profileName: string, data: any) {
        try {
            const response = await fetch(`${META_API_URL}/profiles/meta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serverId, profileName, ...data })
            });
            return await response.json();
        } catch (error) {
            console.error("Failed to update profile extended data", error);
            throw error;
        }
    },

    async removePPPProfile(server: MikrotikServer, id: string): Promise<any> {
        return await runCommand(server, ['/ppp/profile/remove', `=.id=${id}`]);
    }
};
