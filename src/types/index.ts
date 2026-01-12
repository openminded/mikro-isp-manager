export interface Customer {
    id: string; // Mikrotik ID (*1)
    name: string; // Username
    password?: string;
    service: string;
    profile: string;
    "remote-address"?: string;
    "last-logged-out"?: string;
    disabled: boolean;
    comment?: string; // Customer Name
    serverName: string; // To know which router it came from
    serverId: string;
    // CRM Fields (from simple DB)
    whatsapp?: string;
    lat?: string;
    long?: string;
    photos?: string[]; // URLs
    ktp?: string;
    activationDate?: string;
}

export interface Profile {
    id: string;
    name: string;
    "local-address"?: string;
    "remote-address"?: string;
    "rate-limit"?: string;
    "dns-server"?: string;
    serverName: string;
    serverId: string;
    price?: number;
}

export interface IpPool {
    id: string;
    name: string;
    ranges: string;
    "next-pool"?: string;
    serverName: string;
    serverId: string;
}
