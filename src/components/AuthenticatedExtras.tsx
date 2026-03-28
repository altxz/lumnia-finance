import { useAuth } from '@/contexts/AuthContext';
import { FloatingActionButton } from './FloatingActionButton';
import { GeniusChatbot } from './GeniusChatbot';

export function AuthenticatedExtras() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <>
      <FloatingActionButton />
      <GeniusChatbot />
    </>
  );
}
