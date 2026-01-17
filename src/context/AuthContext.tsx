import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import type { User } from '@/types';

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                try {
                    const res = await axios.get('/api/auth/me', {
                        headers: { Authorization: `Bearer ${storedToken}` }
                    });
                    setUser(res.data.user);
                    setToken(storedToken);
                } catch (error) {
                    console.error("Auth check failed", error);
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(newUser);
    };

    const logout = async () => {
        if (token) {
            try {
                await axios.post('/api/auth/logout', { token });
            } catch (e) {
                console.error("Logout error", e);
            }
        }
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        // Optional: window.location.href = '/login'; 
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
