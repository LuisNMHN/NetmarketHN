"use client"

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

interface ChatNotificationsSimpleProps {
  children: React.ReactNode
}

export default function ChatNotificationsSimple({ children }: ChatNotificationsSimpleProps) {
  return <>{children}</>
}
