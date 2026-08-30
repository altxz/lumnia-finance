import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Classes extras mescladas com o padrão (ex.: largura maior para conteúdo com tabela). */
  className?: string;
  /**
   * Quando false, impede fechar tocando fora, arrastando (mobile) ou com Esc.
   * Usar apenas para fluxos que não podem ser interrompidos sem confirmação
   * (ex.: importação de dados em andamento).
   */
  dismissible?: boolean;
}

export function ResponsiveModal({ open, onOpenChange, children, className, dismissible = true }: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={dismissible}>
        <DrawerContent
          className={cn('max-h-[92dvh] overflow-hidden flex flex-col', className)}
          onInteractOutside={dismissible ? undefined : (event) => event.preventDefault()}
        >
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('max-w-lg max-h-[90dvh] overflow-hidden p-0 gap-0 rounded-2xl flex flex-col', className)}
        onInteractOutside={dismissible ? undefined : (event) => event.preventDefault()}
        onEscapeKeyDown={dismissible ? undefined : (event) => event.preventDefault()}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

interface ResponsiveModalHeaderProps {
  className?: string;
  children: React.ReactNode;
}

export function ResponsiveModalHeader({ className, children }: ResponsiveModalHeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerHeader className={cn('p-0', className)}>{children}</DrawerHeader>;
  }
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveModalTitle({ className, children }: ResponsiveModalHeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function ResponsiveModalDescription({ className, children }: ResponsiveModalHeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>;
  }
  return <DialogDescription className={className}>{children}</DialogDescription>;
}

export function ResponsiveModalFooter({ className, children }: ResponsiveModalHeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>;
  }
  return <DialogFooter className={className}>{children}</DialogFooter>;
}
