import { cn } from '@/lib/utils';

type TileSize = 'small' | 'medium' | 'wide';
/** Comportamento no celular (abaixo de sm), independente do tamanho de desktop. */
type TileMobile = 'half' | 'full' | 'tall';

const SIZE_CLASSES: Record<TileSize, string> = {
  // Quadrado pequeno: 1 coluna no grid de 4 (2 por linha no celular)
  small: 'col-span-1 min-h-[200px] sm:min-h-[220px]',
  // Quadrado grande: 2 colunas
  medium: 'col-span-2 min-h-[300px] sm:min-h-[350px]',
  // Retângulo largo: 4 colunas no desktop
  wide: 'col-span-2 xl:col-span-4 min-h-[320px] sm:min-h-[380px]',
};

/** Só afeta o celular; a partir de sm os valores de SIZE_CLASSES voltam a valer. */
const MOBILE_CLASSES: Record<TileMobile, string> = {
  // 2 por linha, altura compacta (cartões de leitura rápida)
  half: 'col-span-1 min-h-[160px]',
  // largura total no celular, altura enxuta
  full: 'col-span-2 min-h-[200px]',
  // largura total com mais altura útil para o gráfico
  tall: 'col-span-2 min-h-[400px]',
};

/** Reafirma, a partir de sm, o número de colunas do tamanho de desktop. */
const SM_SPAN: Record<TileSize, string> = {
  small: 'sm:col-span-1',
  medium: 'sm:col-span-2',
  wide: 'sm:col-span-2 xl:col-span-4',
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
  mobile,
  children,
  className,
}: {
  size?: TileSize;
  mobile?: TileMobile;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col min-w-0',
        SIZE_CLASSES[size],
        mobile && [MOBILE_CLASSES[mobile], SM_SPAN[size]],
        className,
      )}
    >
      {children}
    </div>
  );
}


