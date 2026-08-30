import { WifiOff } from 'lucide-react';
import { StatePanel } from '@/components/ui/state-panel';

interface OfflineBannerProps {
  className?: string;
}

export function OfflineBanner({ className = 'min-h-0 rounded-3xl py-6' }: OfflineBannerProps) {
  return (
    <StatePanel
      tone="offline"
      icon={<WifiOff className="h-5 w-5" />}
      title="Você está offline"
      description="Os dados já carregados continuam visíveis, mas alterações e atualizações exigem conexão."
      className={className}
    />
  );
}
