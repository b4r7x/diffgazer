import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { HotkeyProvider, Hotkey } from '@/components/hotkeys';
import { ContextSidebar, HomeMenu, type ContextInfo } from '@/features/home/components';

const MENU_ROUTES: Record<string, string> = {
  'review-unstaged': '/review',
  'review-staged': '/review?staged=true',
  'review-files': '/review?files=true',
  resume: '/review',
  history: '/history',
  settings: '/settings',
};

const footerShortcuts = [
  { key: '↑/↓', label: 'Select' },
  { key: 'Enter', label: 'Open' },
  { key: 's', label: 'Settings' },
  { key: 'h', label: 'Help' },
  { key: 'q', label: 'Quit' },
];

const DEMO_CONTEXT: ContextInfo = {
  trustedDir: '~/dev/stargazer-core',
  providerName: 'Gemini',
  providerMode: 'Balanced',
  lastRunId: '8821',
  lastRunIssueCount: 20,
};

interface HomePageProps {
  context?: ContextInfo;
}

export function HomePage({ context = DEMO_CONTEXT }: HomePageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const handleActivate = (id: string) => {
    if (id === 'quit') {
      handleQuit();
      return;
    }
    const route = MENU_ROUTES[id];
    if (route) {
      navigate({ to: route });
    }
  };

  const handleQuit = () => {
    try {
      window.close();
    } catch {
    }
  };

  return (
    <HotkeyProvider>
      <Hotkey keys="q" onPress={handleQuit} />
      <Hotkey keys="s" onPress={() => navigate({ to: '/settings' })} />
      <Hotkey keys="h" onPress={() => handleActivate('help')} />
      <div className="bg-tui-bg text-tui-fg h-screen flex flex-col overflow-hidden selection:bg-tui-blue selection:text-black">
        <Header providerName={context?.providerName} providerStatus="idle" />
        <div className="flex flex-1 flex-col lg:flex-row items-center lg:items-start justify-start lg:justify-center p-4 md:p-6 lg:p-8 gap-4 md:gap-6 lg:gap-8 overflow-auto">
          <ContextSidebar context={context} />
          <HomeMenu
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onActivate={handleActivate}
          />
        </div>
        <Footer shortcuts={footerShortcuts} />
      </div>
    </HotkeyProvider>
  );
}
