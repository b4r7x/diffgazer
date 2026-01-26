import { MainMenu } from '@/features/menu/components/main-menu';
import { useNavigate } from '@tanstack/react-router';

export default function Index() {
    const navigate = useNavigate();

    return (
        <MainMenu
            onAction={(action) => {
                if (action === 'review-unstaged') {
                    navigate({ to: '/review', search: { scope: 'unstaged' } });
                } else if (action === 'review-staged') {
                    navigate({ to: '/review', search: { scope: 'staged' } });
                } else if (action === 'history') {
                    navigate({ to: '/history' });
                } else if (action === 'sessions') {
                    navigate({ to: '/sessions' });
                } else if (action === 'settings') {
                    navigate({ to: '/settings' });
                }
            }}
        />
    );
}
