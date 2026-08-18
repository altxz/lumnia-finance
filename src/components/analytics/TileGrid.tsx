import { cn } from '@/lib/utils';

type TileSize = 'small' | 'medium' | 'wide';

const SIZE_CLASSES: Record<TileSize, string> = {
  // Quadrado pequeno: 1 coluna no grid de 4 (2 por linha no celular)
  small: 'col-span-1 h-[200px] sm:h-[210px]',
  // Quadrado grande: 2 colunas
  medium: 'col-span-2 h-[300px] sm:h-[350px]',
  // Retângulo largo: 4 colunas no desktop
  wide: 'col-span-2 xl:col-span-4 h-[320px] sm:h-[380px]',
};

export function TileGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5', className)}>
      {children}
    </div>
  );
}

export function Tile({
  size = 'medium',
  children,
  className,
}: {
  size?: TileSize;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col min-w-0', SIZE_CLASSES[size], className)}>
      {children}
    </div>
  );
}
