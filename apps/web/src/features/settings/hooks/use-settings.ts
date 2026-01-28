import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '../api/config-api';
import type { SettingsConfig } from '@repo/schemas';

export function useSettings() {
    const [settings, setSettings] = useState<SettingsConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const data = await getSettings();
                setSettings(data);
            } catch (e) {
                setError(e instanceof Error ? e : new Error(String(e)));
            } finally {
                setIsLoading(false);
            }
        }
        load();
    }, []);

    const update = useCallback(async (updates: Partial<SettingsConfig>) => {
        try {
            await saveSettings(updates);
            setSettings((prev) => (prev ? { ...prev, ...updates } : null));
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            setError(err);
            throw err;
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getSettings();
            setSettings(data);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { settings, isLoading, error, update, refresh };
}
