import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveModal({ open, onOpenChange, children }: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] overflow-hidden flex flex-col">
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 gap-0 rounded-2xl flex flex-col">
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

export function ResponsiveModalFooter({ className, children }: ResponsiveModalHeaderProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>;
  }
  return <DialogFooter className={className}>{children}</DialogFooter>;
}
