import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { TrustConfig } from '@repo/schemas';
import type { SaveTrustRequest } from '../types';

export function useTrust(projectId: string | null) {
    const [trust, setTrust] = useState<TrustConfig | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!projectId) {
            setTrust(null);
            return;
        }
        setIsLoading(true);
        try {
            const data = await api.get<TrustConfig>(`/settings/trust?projectId=${encodeURIComponent(projectId)}`);
            setTrust(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
            setTrust(null);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (projectId) {
            refresh();
        }
    }, [projectId, refresh]);

    const save = useCallback(async (request: SaveTrustRequest) => {
        try {
            await api.post('/settings/trust', request);
            await refresh();
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            throw err;
        }
    }, [refresh]);

    const revoke = useCallback(async () => {
        if (!projectId) return;
        try {
            await api.delete(`/settings/trust?projectId=${encodeURIComponent(projectId)}`);
            setTrust(null);
            setError(null);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            throw err;
        }
    }, [projectId]);

    return { trust, isLoading, error, refresh, save, revoke };
}
