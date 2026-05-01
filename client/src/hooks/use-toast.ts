import { toast } from "sonner";

export function useToast() {
  return {
    toast: (props: {
      title?: string;
      description?: string;
      variant?: "default" | "destructive";
    }) => {
      const message = props.title ? `${props.title}\n${props.description || ""}` : props.description || "";
      
      if (props.variant === "destructive") {
        toast.error(message);
      } else {
        toast.success(message);
      }
    },
  };
}
