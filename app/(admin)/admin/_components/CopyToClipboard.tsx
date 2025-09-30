"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface CopyToClipboardProps {
  text: string
  label?: string
}

export function CopyToClipboard({ text, label = "Copiar" }: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: "Copiado",
        description: "El texto ha sido copiado al portapapeles",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo copiar el texto",
        variant: "destructive",
      })
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2 bg-transparent">
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copiado" : label}
    </Button>
  )
}
