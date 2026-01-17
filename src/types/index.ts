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
    realName?: string; // From Registration (Full Name) based on phone match
    registrationId?: string; // To allow updating the registration
    sub_area_id?: string;
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

export interface DamageType {
    id: string;
    name: string;
    description?: string;
    createdAt: string;
}

export interface Ticket {
    id: string;
    ticketNumber: string; // Auto-generated ID or simple distinct string? We will stick to UUID for ID, and use simple index or timestamp for display if needed. Or just use short ID.
    customerId: string; // Foreign key to customer (or registration)
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    locationId: string; // Server
    damageTypeId: string;
    damageTypeName: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    createdAt: string;

    technician?: string;
    technicianId?: string;
    solution?: string;
    resolvedAt?: string;
    photos?: string[];
}

export interface User {
    id: string;
    username: string;
    name: string;
    role: 'superadmin' | 'admin' | 'technician';
    employeeId?: string;
}

export interface Registration {
    id: string;
    phoneNumber: string;
    fullName: string;
    ktpNumber: string;
    address: string;
    locationId: string;
    status: 'queue' | 'installation_process' | 'done' | 'cancel';
    installation?: {
        technician: string;
        companion: string;
        date: string;
        finishDate?: string;
    };
    workingOrderStatus?: 'pending' | 'done';
    workingOrderNote?: string;
    createdAt?: string;
}
