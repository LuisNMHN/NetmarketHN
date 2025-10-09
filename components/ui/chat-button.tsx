"use client"

import { Button } from "@/components/ui/button"
import { SimpleChatModal } from "./simple-chat-modal"
import { MessageSquare, Circle } from "lucide-react"
import { useState } from "react"

interface ChatButtonProps {
  requestId: string
  otherUserId: string
  otherUserName: string
  otherUserEmail: string
  requestAmount: number
  isOnline?: boolean
  unreadCount?: number
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "sm" | "default" | "lg"
}

export function ChatButton({
  requestId,
  otherUserId,
  otherUserName,
  otherUserEmail,
  requestAmount,
  isOnline = false,
  unreadCount = 0,
  className,
  variant = "outline",
  size = "sm"
}: ChatButtonProps) {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setChatOpen(true)}
        className={`relative ${className}`}
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Chat
        {isOnline && (
          <Circle className="ml-1 h-2 w-2 fill-green-500 text-green-500" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      <SimpleChatModal
        requestId={requestId}
        otherUserId={otherUserId}
        otherUserName={otherUserName}
        requestAmount={requestAmount}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  )
}
