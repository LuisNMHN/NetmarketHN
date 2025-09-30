import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface QrPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  title?: string
}

export function QrPreview({ open, onOpenChange, url, title = "Código QR" }: QrPreviewProps) {
  // TODO: Integrate QR code library (qrcode.react or similar)
  // For now, showing placeholder
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Escanea este código QR para acceder al link de pago</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {/* TODO: Replace with actual QR code component */}
          <div className="size-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">QR Code</p>
              <p className="text-xs text-muted-foreground px-4 break-all">{url}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-sm">{url}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
