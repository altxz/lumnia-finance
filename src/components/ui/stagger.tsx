import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StaggerItemProps {
  /** Posição do bloco na sequência de revelação (0 = primeiro, sem atraso). */
  index: number;
  children: ReactNode;
  className?: string;
  /** Intervalo entre cada bloco, em ms. */
  stepMs?: number;
}

/**
 * Revela um bloco de conteúdo com um pequeno atraso proporcional à sua posição,
 * para que seções de uma página carreguem em sequência em vez de surgirem juntas.
 * Respeita `prefers-reduced-motion` via `motion-reduce:animate-none` do Tailwind.
 */
function StaggerItem({ index, children, className, stepMs = 70 }: StaggerItemProps) {
  return (
    <div
      className={cn('animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 motion-reduce:animate-none', className)}
      style={{ animationDelay: `${index * stepMs}ms` }}
    >
      {children}
    </div>
  );
}

export { StaggerItem };
