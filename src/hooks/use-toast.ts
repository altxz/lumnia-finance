import type * as React from "react";
import { toast as sonnerToast } from "sonner";

type LegacyToast = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
  action?: React.ReactNode;
};

function toast({ title, description, variant = "default", duration, action }: LegacyToast) {
  const method = variant === "destructive" ? sonnerToast.error : sonnerToast.success;
  const id = method(title ?? description ?? "Lumnia", { description: title ? description : undefined, duration, action });
  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: LegacyToast) => toast(next),
  };
}

function useToast() {
  return {
    toasts: [],
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  };
}

export { useToast, toast };
