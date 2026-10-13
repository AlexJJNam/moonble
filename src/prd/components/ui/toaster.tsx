

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, onDismiss, onAutoClose, variant, ...props }) {
        const Icon = variant === 'success' ? CheckCircle2 : variant === 'destructive' ? XCircle : null;
        
        return (
          <Toast key={id} variant={variant} {...props} className={cn(
              {"group destructive": variant === 'destructive'},
              {"group success": variant === 'success'},
          )}>
             <div className="flex items-start gap-3">
              {Icon && <Icon className={cn(
                  "h-6 w-6 mt-0.5 shrink-0",
                  variant === 'success' && 'text-emerald-500',
                  variant === 'destructive' && 'text-destructive'
              )} />}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
