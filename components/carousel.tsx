"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
      "NMHN es la primera plataforma P2P creada en Honduras para hondureños, diseñada para que emprendedores, negocios y profesionales puedan intercambiar, vender y cobrar en Lempiras (HNL) de forma segura, moderna y confiable.",
    icon: Home,
    cta: null, // Sin botón CTA
    isWelcome: true,
  },
  {
    id: 1,
    title: "P2P con depósito en garantía seguro",
    description: "Comprá y vendé con total confianza. Tus lempiras protegidos hasta completar la transacción.",
    icon: Shield,
    cta: "Conocé más",
  },
  {
    id: 2,
    title: "Enlaces de pago digitales",
    description: "Cobrá en línea fácil y rápido. Perfecto para tu negocio hondureño sin complicaciones técnicas.",
    icon: Link,
    cta: "Conocé más",
  },
  {
    id: 3,
    title: "Verificación de usuarios",
    description: "Construí tu reputación como vendedor confiable. Los hondureños prefieren usuarios verificados.",
    icon: CheckCircle,
    cta: "Conocé más",
  },
  {
    id: 4,
    title: "Soporte especializado",
    description: "¿Problemas con una transacción? Nuestro equipo hondureño te ayuda a resolver cualquier disputa.",
    icon: MessageSquare,
    cta: "Conocé más",
  },
  {
    id: 5,
    title: "Métodos de pago locales",
    description: "Billeteras digitales, transferencias bancarias y efectivo. Todos los métodos que ya conocés y usás.",
    icon: CreditCard,
    cta: "Conocé más",
  },
  {
    id: 6,
    title: "Panel de control completo",
    description:
      "Controlá todas tus ventas y ganancias desde un solo lugar. Perfecto para tu emprendimiento hondureño.",
    icon: BarChart3,
    cta: "Conocé más",
  },
]

export function Carousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentLinksModalOpen, setIsPaymentLinksModalOpen] = useState(false)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false)
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)
  const [isLocalPaymentModalOpen, setIsLocalPaymentModalOpen] = useState(false)
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false)

  useEffect(() => {
    if (!isAutoPlaying) return

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 7000)

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

  const handleCTAClick = (slideId: number) => {
    if (slideId === 1) {
      // P2P con depósito en garantía seguro
      setIsModalOpen(true)
    }
    if (slideId === 2) {
      // Enlaces de pago digitales
      setIsPaymentLinksModalOpen(true)
    }
    if (slideId === 3) {
      // Verificación de usuarios
      setIsVerificationModalOpen(true)
    }
    if (slideId === 4) {
      // Soporte especializado
      setIsSupportModalOpen(true)
    }
    if (slideId === 5) {
      // Métodos de pago locales
      setIsLocalPaymentModalOpen(true)
    }
    if (slideId === 6) {
      // Panel de control completo
      setIsDashboardModalOpen(true)
    }
  }

  const IconComponent = slides[currentSlide].icon
  const currentSlideData = slides[currentSlide]

  return (
    <>
      <div className="relative max-w-4xl mx-auto bg-muted rounded-xl p-8">
        <div className="overflow-hidden rounded-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <Card className="border-0 shadow-lg bg-card">
                <CardContent className={`text-center ${currentSlideData.isWelcome ? "p-8" : "p-12"}`}>
                  <motion.div
                    className="mb-6 flex justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                  >
                    <motion.div
                      className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-lg shadow-primary/25"
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
                        boxShadow: "0 20px 40px hsl(var(--primary) / 0.4)",
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
                        <IconComponent className="w-12 h-12 relative z-10 text-primary-foreground drop-shadow-sm" />
                      </motion.div>
                    </motion.div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className={currentSlideData.isWelcome ? "mb-4" : "mb-6"}
                  >
                    <motion.h3
                      className="text-2xl font-bold text-card-foreground mb-3"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8, duration: 0.5 }}
                    >
                      {currentSlideData.isWelcome ? (
                        <>
                          Bienvenido a <span className="text-primary">Netmarket</span>
                          <span className="text-muted-foreground">HN</span>
                        </>
                      ) : (
                        currentSlideData.title
                      )}
                    </motion.h3>
                    <motion.p
                      className={`text-muted-foreground leading-relaxed ${
                        currentSlideData.isWelcome ? "text-base" : "text-lg"
                      }`}
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
                            className="bg-primary/20 text-foreground px-4 py-2 hover:bg-primary/30 hover:text-primary transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
                          >
                            <motion.div
                              animate={{ rotateY: [0, 180, 360] }}
                              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                            </motion.div>
                            Depósito en garantía seguro
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
                            className="bg-primary/20 text-foreground px-4 py-2 hover:bg-primary/30 hover:text-primary transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
                          >
                            <motion.div
                              animate={{ rotateY: [0, 180, 360] }}
                              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
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
                            className="bg-primary/20 text-foreground px-4 py-2 hover:bg-primary/30 hover:text-primary transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
                          >
                            <motion.div
                              animate={{ rotateY: [0, 180, 360] }}
                              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, repeatDelay: 4 }}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                            </motion.div>
                            Múltiples billeteras
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
                          className="border-border text-foreground hover:bg-muted hover:border-primary hover:text-primary bg-transparent transition-all duration-300 shadow-md hover:shadow-lg"
                          onClick={() => handleCTAClick(currentSlideData.id)}
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
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/80 backdrop-blur-sm border-border hover:bg-background hover:border-primary"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={nextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/80 backdrop-blur-sm border-border hover:bg-background hover:border-primary"
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
                index === currentSlide ? "bg-primary" : "bg-muted-foreground hover:bg-foreground"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Modal existente de seguridad */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
          <DialogHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-xl shadow-primary/30"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 25px 50px hsl(var(--primary) / 0.4)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <Shield className="w-10 h-10 text-primary-foreground relative z-10 drop-shadow-sm" />
              </motion.div>
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground mb-4 text-center">
              Seguridad garantizada
            </DialogTitle>
          </DialogHeader>

          <div className="text-left space-y-4">
            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <div className="text-foreground text-base leading-relaxed">
                <span className="text-primary font-bold text-lg">NMHN</span> garantiza la seguridad de tu transacción.
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  El depósito acordado entre comprador y vendedor se mantiene{" "}
                  <span className="text-foreground font-semibold">retenido de forma segura</span>.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary/80 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Se libera únicamente cuando{" "}
                  <span className="text-foreground font-semibold">ambas partes cumplen</span> con lo pactado.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 border-t border-border">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setIsModalOpen(false)}
                className="bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border-0"
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentLinksModalOpen} onOpenChange={setIsPaymentLinksModalOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
          <DialogHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-xl shadow-primary/30"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 25px 50px hsl(var(--primary) / 0.4)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <Link className="w-10 h-10 text-primary-foreground relative z-10 drop-shadow-sm" />
              </motion.div>
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground mb-4 text-center">
              Enlaces de pago seguros
            </DialogTitle>
          </DialogHeader>

          <div className="text-left space-y-4">
            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <div className="text-foreground text-base leading-relaxed">
                <span className="text-primary font-bold text-lg">Genera y comparte</span> links de pago con confianza.
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Los proveedores de productos y servicios registrados en{" "}
                  <span className="text-foreground font-semibold">NMHN</span> pueden crear enlaces de cobro seguros.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary/80 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Garantizando que sus clientes realicen{" "}
                  <span className="text-foreground font-semibold">pagos de forma rápida y confiable</span>.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 border-t border-border">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setIsPaymentLinksModalOpen(false)}
                className="bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border-0"
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de verificación de usuarios */}
      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
          <DialogHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-xl shadow-primary/30"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 25px 50px hsl(var(--primary) / 0.4)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <CheckCircle className="w-10 h-10 text-primary-foreground relative z-10 drop-shadow-sm" />
              </motion.div>
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground mb-4 text-center">
              Verificación de identidad obligatoria
            </DialogTitle>
          </DialogHeader>

          <div className="text-left space-y-4">
            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <div className="text-foreground text-base leading-relaxed">
                <span className="text-primary font-bold text-lg">Verificación de identidad</span> obligatoria.
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Todos los usuarios registrados en <span className="text-foreground font-semibold">NMHN</span> deben
                  completar un proceso de verificación de identidad.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary/80 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Para garantizar la{" "}
                  <span className="text-foreground font-semibold">seguridad y confianza en cada transacción</span>.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 border-t border-border">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setIsVerificationModalOpen(false)}
                className="bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border-0"
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de soporte especializado */}
      <Dialog open={isSupportModalOpen} onOpenChange={setIsSupportModalOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
          <DialogHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-xl shadow-primary/30"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 25px 50px hsl(var(--primary) / 0.4)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <MessageSquare className="w-10 h-10 text-primary-foreground relative z-10 drop-shadow-sm" />
              </motion.div>
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground mb-4 text-center">
              Soporte especializado para proveedores
            </DialogTitle>
          </DialogHeader>

          <div className="text-left space-y-4">
            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <div className="text-foreground text-base leading-relaxed">
                <span className="text-primary font-bold text-lg">NMHN</span> ofrece atención personalizada y
                completamente en español.
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Para todos los{" "}
                  <span className="text-foreground font-semibold">proveedores de servicios registrados</span> en la
                  plataforma.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary/80 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Nuestro equipo de soporte <span className="text-foreground font-semibold">acompaña cada paso</span> de
                  tus transacciones, garantizando un servicio confiable y profesional.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 border-t border-border">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setIsSupportModalOpen(false)}
                className="bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border-0"
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de métodos de pago locales */}
      <Dialog open={isLocalPaymentModalOpen} onOpenChange={setIsLocalPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
          <DialogHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-xl shadow-primary/30"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 25px 50px hsl(var(--primary) / 0.4)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <CreditCard className="w-10 h-10 text-primary-foreground relative z-10 drop-shadow-sm" />
              </motion.div>
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground mb-4 text-center">
              Pagos en lempiras (HNL)
            </DialogTitle>
          </DialogHeader>

          <div className="text-left space-y-4">
            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <div className="text-foreground text-base leading-relaxed">
                Todas las transacciones en <span className="text-primary font-bold text-lg">NMHN</span> se realizan en
                HNL.
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Para garantizar{" "}
                  <span className="text-foreground font-semibold">claridad de precios y comisiones</span> en el mercado
                  hondureño.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary/80 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Nuestros métodos de pago están orientados a ofrecer una{" "}
                  <span className="text-foreground font-semibold">experiencia local, transparente y confiable</span>.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 border-t border-border">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setIsLocalPaymentModalOpen(false)}
                className="bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border-0"
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDashboardModalOpen} onOpenChange={setIsDashboardModalOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
          <DialogHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <motion.div
                className="relative p-4 rounded-full bg-gradient-to-br from-primary to-primary shadow-xl shadow-primary/30"
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: "backOut" }}
                whileHover={{
                  scale: 1.05,
                  boxShadow: "0 25px 50px hsl(var(--primary) / 0.4)",
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/50"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                />
                <BarChart3 className="w-10 h-10 text-primary-foreground relative z-10 drop-shadow-sm" />
              </motion.div>
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground mb-4 text-center">
              Panel de control de transacciones
            </DialogTitle>
          </DialogHeader>

          <div className="text-left space-y-4">
            <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
              <div className="text-foreground text-base leading-relaxed">
                <span className="text-primary font-bold text-lg">Visualiza tus operaciones</span> en tiempo real.
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  Con <span className="text-foreground font-semibold">estados, filtros y detalles</span> de cada pago.
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary/80 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-muted-foreground text-base leading-relaxed">
                  <span className="text-foreground font-semibold">Descarga reportes</span> y realiza conciliaciones con
                  seguridad.
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6 border-t border-border">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => setIsDashboardModalOpen(false)}
                className="bg-gradient-to-r from-primary to-primary hover:from-primary/90 hover:to-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-xl border-0"
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
