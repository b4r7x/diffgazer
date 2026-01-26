import * as React from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/card';
import { useConfig } from '@/features/settings/hooks/use-config';

export default function SettingsPage() {
    const { provider, model, isConfigured, isLoading, updateConfig } = useConfig();

    // We need local state for form values
    const [localProvider, setLocalProvider] = React.useState('anthropic');
    const [localModel, setLocalModel] = React.useState('claude-sonnet-4-20250514');
    const [localApiKey, setLocalApiKey] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    // Sync from config when loaded
    React.useEffect(() => {
        if (provider) setLocalProvider(provider);
        if (model) setLocalModel(model);
    }, [provider, model]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateConfig({
                provider: localProvider as any,
                model: localModel,
                apiKey: localApiKey // api key might be needed if re-authenticating or validation
            });
            // Clear API key after save
            setLocalApiKey('');
        } catch (error) {
            // Set error state (check if error state exists, use it)
            // Show error toast ideally
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Loading settings...</div>;

    return (
        <div className="max-w-2xl mx-auto py-8 w-full px-4 space-y-8 animate-fade-in">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your AI provider and configuration.</p>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>AI Provider</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Provider</label>
                            <Select
                                value={localProvider}
                                onChange={(e) => setLocalProvider(e.target.value)}
                            >
                                <option value="anthropic">Anthropic</option>
                                <option value="openai">OpenAI</option>
                                <option value="gemini">Gemini</option>
                                <option value="glm">GLM (Z.ai)</option>
                                <option value="openrouter">OpenRouter</option>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Model</label>
                            <Input
                                value={localModel}
                                onChange={(e) => setLocalModel(e.target.value)}
                                placeholder="Model ID"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">API Key</label>
                        <Input
                            type="password"
                            value={localApiKey}
                            onChange={(e) => setLocalApiKey(e.target.value)}
                            placeholder={isConfigured ? "Re-enter to update..." : "sk-..."}
                        />
                        <p className="text-xs text-muted-foreground">
                            Your key is stored locally and never sent to our servers.
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border pt-4">
                    <Button variant="ghost">Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </CardFooter>
            </Card>

            {/* Status Card */}
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-base">Current Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm font-mono">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Configured:</span>
                            <span className={isConfigured ? "text-green-400" : "text-yellow-400"}>
                                {isConfigured ? "Yes" : "No"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Provider:</span>
                            <span>{provider || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Model:</span>
                            <span>{model || '-'}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
