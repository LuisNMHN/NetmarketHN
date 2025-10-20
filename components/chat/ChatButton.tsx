"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { UseTransactionalChatParams } from "@/hooks/useTransactionalChat"

interface ChatButtonProps {
  chatParams: UseTransactionalChatParams
  buttonText?: string
  buttonVariant?: "default" | "outline" | "ghost" | "destructive"
  buttonSize?: "sm" | "default" | "lg"
  className?: string
  showIcon?: boolean
}

export function ChatButton({ 
  chatParams, 
  buttonText = "💬 Abrir chat",
  buttonVariant = "outline",
  buttonSize = "sm",
  className,
  showIcon = true
}: ChatButtonProps) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  const handleOpenChat = () => {
    setIsChatOpen(true)
  }

  const handleCloseChat = () => {
    setIsChatOpen(false)
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        onClick={handleOpenChat}
        className={className}
      >
        {showIcon && <MessageSquare className="h-4 w-4 mr-2" />}
        {buttonText}
      </Button>

      <ChatPanel
        isOpen={isChatOpen}
        onClose={handleCloseChat}
        chatParams={chatParams}
      />
    </>
  )
}

// Componente específico para órdenes
interface OrderChatButtonProps {
  orderId: string
  buyerId: string
  sellerId: string
  orderTitle?: string
  orderData?: Record<string, any>
  className?: string
}

export function OrderChatButton({ 
  orderId, 
  buyerId, 
  sellerId, 
  orderTitle,
  orderData,
  className 
}: OrderChatButtonProps) {
  return (
    <ChatButton
      chatParams={{
        contextType: 'order',
        contextId: orderId,
        partyA: buyerId,
        partyB: sellerId,
        contextTitle: orderTitle || `Orden #${orderId}`,
        contextData: orderData || {}
      }}
      buttonText="💬 Negociar"
      buttonVariant="outline"
      className={className}
    />
  )
}

// Componente específico para subastas
interface AuctionChatButtonProps {
  auctionId: string
  bidderId: string
  sellerId: string
  auctionTitle?: string
  auctionData?: Record<string, any>
  className?: string
}

export function AuctionChatButton({ 
  auctionId, 
  bidderId, 
  sellerId, 
  auctionTitle,
  auctionData,
  className 
}: AuctionChatButtonProps) {
  return (
    <ChatButton
      chatParams={{
        contextType: 'auction',
        contextId: auctionId,
        partyA: bidderId,
        partyB: sellerId,
        contextTitle: auctionTitle || `Subasta #${auctionId}`,
        contextData: auctionData || {}
      }}
      buttonText="💬 Chatear"
      buttonVariant="outline"
      className={className}
    />
  )
}

// Componente específico para tickets de soporte
interface SupportChatButtonProps {
  ticketId: string
  userId: string
  supportUserId?: string
  ticketTitle?: string
  ticketData?: Record<string, any>
  className?: string
}

export function SupportChatButton({ 
  ticketId, 
  userId, 
  supportUserId,
  ticketTitle,
  ticketData,
  className 
}: SupportChatButtonProps) {
  return (
    <ChatButton
      chatParams={{
        contextType: 'ticket',
        contextId: ticketId,
        partyA: userId,
        partyB: supportUserId || userId, // Si no hay soporte, usar el mismo usuario
        contextTitle: ticketTitle || `Ticket #${ticketId}`,
        contextData: ticketData || {},
        supportUserId
      }}
      buttonText="💬 Soporte"
      buttonVariant="outline"
      className={className}
    />
  )
}

// Componente específico para disputas
interface DisputeChatButtonProps {
  disputeId: string
  partyAId: string
  partyBId: string
  supportUserId?: string
  disputeTitle?: string
  disputeData?: Record<string, any>
  className?: string
}

export function DisputeChatButton({ 
  disputeId, 
  partyAId, 
  partyBId,
  supportUserId,
  disputeTitle,
  disputeData,
  className 
}: DisputeChatButtonProps) {
  return (
    <ChatButton
      chatParams={{
        contextType: 'dispute',
        contextId: disputeId,
        partyA: partyAId,
        partyB: partyBId,
        contextTitle: disputeTitle || `Disputa #${disputeId}`,
        contextData: disputeData || {},
        supportUserId
      }}
      buttonText="💬 Resolver"
      buttonVariant="destructive"
      className={className}
    />
  )
}


