"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Link,
  CheckCircle,
  MessageSquare,
  CreditCard,
  BarChart3,
  DollarSign,
  Home,
} from "lucide-react"

const slides = [
  {
    id: 0,
    title: "Bienvenido a NetmarketHN",
    description:
      "Tu plataforma digital para emprendedores. Plataforma P2P y herramientas de pago para hacer crecer tu negocio.",
    icon: Home,
    cta: null, // Sin botón CTA
    isWelcome: true,
  },
  {
    id: 1,
    title: "P2P con escrow",
    description: "Compra y vende con protección de fondos automática.",
    icon: Shield,
    cta: "Ver más",
  },
  {
    id: 2,
    title: "Enlaces de pago",
    description: "Cobra en línea sin integraciones complejas.",
    icon: Link,
    cta: "Ver más",
  },
  {
    id: 3,
    title: "Verificación de comerciantes",
    description: "Mayor confianza y reputación en tus transacciones.",
    icon: CheckCircle,
    cta: "Ver más",
  },
  {
    id: 4,
    title: "Disputas asistidas",
    description: "Soporte especializado para resolver incidentes.",
    icon: MessageSquare,
    cta: "Ver más",
  },
  {
    id: 5,
    title: "Múltiples métodos",
    description: "Banca tradicional y wallets digitales compatibles.",
    icon: CreditCard,
    cta: "Ver más",
  },
  {
    id: 6,
    title: "Panel y analíticas",
    description: "Control completo de tus operaciones y métricas.",
    icon: BarChart3,
    cta: "Ver más",
  },
]

export function Carousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [isAutoPlaying])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
    setIsAutoPlaying(false)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
    setIsAutoPlaying(false)
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
  }

  const IconComponent = slides[currentSlide].icon
  const currentSlideData = slides[currentSlide]

  return (
    <div className="relative max-w-4xl mx-auto bg-gray-100 dark:bg-gray-900 rounded-xl p-8">
      <div className="overflow-hidden rounded-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <Card className="border-0 shadow-lg dark:bg-gray-800">
              <CardContent className="p-12 text-center">
                <motion.div
                  className="mb-6 flex justify-center"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                >
                  <motion.div
                    className={`relative p-4 rounded-full ${
                      currentSlideData.isWelcome
                        ? "bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-500/25"
                        : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 shadow-lg"
                    }`}
                    initial={{
                      scale: 0,
                      rotate: -180,
                      opacity: 0,
                    }}
                    animate={{
                      scale: 1,
                      rotate: 0,
                      opacity: 1,
                    }}
                    transition={{
                      duration: 1.2,
                      ease: "easeOut",
                      delay: 0.3,
                    }}
                    whileHover={{
                      scale: 1.1,
                      rotate: [0, -5, 5, 0],
                      boxShadow: currentSlideData.isWelcome
                        ? "0 20px 40px rgba(20, 184, 166, 0.4)"
                        : "0 20px 40px rgba(0, 0, 0, 0.15)",
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <motion.div
                      initial={{
                        pathLength: 0,
                        opacity: 0,
                        scale: 0.5,
                      }}
                      animate={{
                        pathLength: 1,
                        opacity: 1,
                        scale: 1,
                      }}
                      transition={{
                        pathLength: { duration: 1.5, delay: 0.5 },
                        opacity: { duration: 0.3, delay: 0.5 },
                        scale: { duration: 0.8, delay: 0.7, ease: "backOut" },
                      }}
                    >
                      <IconComponent
                        className={`w-12 h-12 relative z-10 ${
                          currentSlideData.isWelcome ? "text-white drop-shadow-sm" : "text-teal-600 dark:text-teal-400"
                        }`}
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.6 }}
                  className="mb-6"
                >
                  <motion.h3
                    className="text-2xl font-bold text-gray-900 dark:text-white mb-3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  >
                    {currentSlideData.isWelcome ? (
                      <>
                        Bienvenido a <span className="text-teal-600 dark:text-teal-400">Netmarket</span>
                        <span className="text-gray-800 dark:text-gray-300">HN</span>
                      </>
                    ) : (
                      currentSlideData.title
                    )}
                  </motion.h3>
                  <motion.p
                    className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                  >
                    {currentSlideData.description}
                  </motion.p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                >
                  {currentSlideData.isWelcome ? (
                    <div className="flex flex-wrap justify-center gap-4">
                      <motion.div
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4, duration: 0.4 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
                        >
                          <motion.div
                            animate={{ rotate: [0, 10, -10, 0] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, repeatDelay: 3 }}
                          >
                            <Shield className="w-4 h-4 mr-2" />
                          </motion.div>
                          Escrow seguro
                        </Badge>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.6, duration: 0.4 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
                        >
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, repeatDelay: 2 }}
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                          </motion.div>
                          Bajas comisiones
                        </Badge>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.8, duration: 0.4 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 hover:bg-teal-100 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-300 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
                        >
                          <motion.div
                            animate={{ rotateY: [0, 180, 360] }}
                            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                          </motion.div>
                          Multi-wallet
                        </Badge>
                      </motion.div>
                    </div>
                  ) : currentSlideData.cta ? (
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1.4, duration: 0.4 }}
                    >
                      <Button
                        variant="outline"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-teal-500 hover:text-teal-600 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:border-teal-400 dark:hover:text-teal-400 bg-transparent transition-all duration-300 shadow-md hover:shadow-lg"
                      >
                        {currentSlideData.cta}
                      </Button>
                    </motion.div>
                  ) : null}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <Button
        variant="outline"
        size="icon"
        onClick={prevSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:border-teal-500 dark:bg-gray-800/80 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-teal-400"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={nextSlide}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 backdrop-blur-sm border-gray-200 hover:bg-white hover:border-teal-500 dark:bg-gray-800/80 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-teal-400"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      {/* Indicators */}
      <div className="flex justify-center mt-6 space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-colors ${
              index === currentSlide
                ? "bg-teal-500"
                : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
