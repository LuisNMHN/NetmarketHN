"use client"

import { useEffect, useState } from "react"

interface AuthSpinnerProps {
  message?: string
}

export function AuthSpinner({ message = "Iniciando sesión..." }: AuthSpinnerProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="flex flex-col items-center space-y-6 p-8 bg-card rounded-2xl shadow-2xl border border-border/50 animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Spinner principal */}
        <div className="relative">
          {/* Círculo exterior giratorio */}
          <div className="w-20 h-20 border-4 border-muted rounded-full animate-spin" />
          
          {/* Círculo interior con gradiente */}
          <div 
            className="absolute inset-2 w-16 h-16 border-4 border-transparent rounded-full animate-spin"
            style={{
              background: "conic-gradient(from 0deg, #14b8a6, #0d9488, #14b8a6)",
              mask: "radial-gradient(circle at center, transparent 60%, black 60%)",
              WebkitMask: "radial-gradient(circle at center, transparent 60%, black 60%)",
              animationDuration: "1.5s"
            }}
          />
          
          {/* Letra N en el centro */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 animate-pulse">
              N
            </div>
          </div>
          
          {/* Puntos decorativos */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-teal-500 rounded-full animate-ping"
              style={{
                top: "50%",
                left: "50%",
                transformOrigin: `${30 + i * 10}px 0px`,
                transform: `translate(-50%, -50%) rotate(${i * 120}deg) translateY(-30px)`,
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1.5s"
              }}
            />
          ))}
        </div>
        
        {/* Texto de carga */}
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground animate-pulse">
            {message}
          </p>
          
          {/* Puntos animados */}
          <div className="flex justify-center space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-teal-500 rounded-full animate-bounce"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1s"
                }}
              />
            ))}
          </div>
        </div>
        
        {/* Barra de progreso sutil */}
        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}
