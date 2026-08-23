import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      closeButton
      richColors={false}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-success" />,
        error: <CircleAlert className="h-5 w-5 text-destructive" />,
        warning: <TriangleAlert className="h-5 w-5 text-accent" />,
        info: <Info className="h-5 w-5 text-primary" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border-border/60 !bg-card/85 !text-foreground !shadow-float !backdrop-blur-xl",
          title: "!font-semibold !font-sans",
          description: "!text-muted-foreground !font-sans",
          actionButton: "!rounded-full !bg-primary !px-4 !text-primary-foreground",
          cancelButton: "!rounded-full !bg-secondary !text-secondary-foreground",
          closeButton: "!border-border/60 !bg-card !text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
