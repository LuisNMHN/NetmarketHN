"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { FeatureCard } from "@/components/feature-card"
import { FAQ } from "@/components/faq"
import { Carousel } from "@/components/carousel"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Footer } from "@/components/footer"
import { Shield, CreditCard, DollarSign, CheckCircle, MessageSquare, BarChart3, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"

function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)

      setCount(Math.floor(progress * end))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration])

  return (
    <span>
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

export const dynamic = "force-dynamic"

export default function HomePage() {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isTermsOpen, setIsTermsOpen] = useState(false)
  const [isRegistrationTermsOpen, setIsRegistrationTermsOpen] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
  const [isAboutOpen, setIsAboutOpen] = useState(false)
  const [isWhoWeAreOpen, setIsWhoWeAreOpen] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isInfoEmailOpen, setIsInfoEmailOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  return (
    <div className="min-h-screen bg-background transition-colors">
      <Header />

      {/* Carousel Section */}
      <section className="py-20 bg-background pt-32">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <Carousel />
        </div>
      </section>

      {/* Features Grid */}
      <section id="caracteristicas" className="py-20">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">¿Por qué elegir NetmarketHN?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              La primera plataforma de intercambio P2P diseñada especialmente para hondureños, con herramientas de pago
              en línea para proveedores de servicios
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="Comisiones bajas y transparentes"
              description="Precios justos sin sorpresas, pensados para el bolsillo catracho"
              index={0}
            />
            <FeatureCard
              icon={CreditCard}
              title="Múltiples opciones de pago"
              description="Transferencias bancarias locales, billeteras digitales y métodos de pago populares"
              index={1}
            />
            <FeatureCard
              icon={MessageSquare}
              title="Soporte en español"
              description="Atención personalizada cuando la necesites, hablamos tu idioma"
              index={2}
            />
            <FeatureCard
              icon={CheckCircle}
              title="Usuarios verificados"
              description="Usuarios hondureños verificados para tu tranquilidad y seguridad"
              index={3}
            />
            <FeatureCard
              icon={DollarSign}
              title="Enlaces de pago para tu negocio"
              description="Cobrá en línea fácilmente, ideal para emprendedores y pequeños negocios"
              index={4}
            />
            <FeatureCard
              icon={BarChart3}
              title="Panel de control completo"
              description="Seguimiento de todas tus transacciones con métricas claras y detalladas"
              index={5}
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-20 bg-muted">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">¿Cómo funciona?</h2>
            <p className="text-xl text-muted-foreground">
              Tres pasos sencillos para empezar a intercambiar P2P y generar medios de pago en línea
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: 1,
                title: "Registrate gratis",
                description:
                  "Creá tu cuenta, verificá tu identidad y accedé a intercambios P2P y herramientas de pago en línea para tu negocio",
              },
              {
                step: 2,
                title: "Elegí tu método de pago",
                description:
                  "Configurá enlaces de pago, intercambios P2P directos, transferencias bancarias, billeteras digitales o efectivo según tu negocio",
              },
              {
                step: 3,
                title: "Cobrá y vendé seguro",
                description:
                  "Generá enlaces de pago para cobrar en línea o realizá intercambios P2P directos con otros usuarios - ¡todo protegido!",
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: index * 0.3,
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                  }}
                  viewport={{ once: true }}
                  className="w-16 h-16 bg-gradient-to-br from-primary to-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300 relative overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.3 + 0.5 }}
                    viewport={{ once: true }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -skew-x-12 transform translate-x-[-100%]"
                    animate={{
                      translateX: ["100%", "-100%"],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: index * 0.3 + 0.8,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.3 + 0.4,
                      type: "spring",
                      stiffness: 300,
                    }}
                    viewport={{ once: true }}
                  >
                    <AnimatedCounter end={item.step} duration={1000} />
                  </motion.span>
                </motion.div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-muted-foreground">
              * Intercambios P2P, herramientas de pago en línea y múltiples métodos disponibles para usuarios
              verificados
            </p>
          </div>
        </div>
      </section>

      <section id="faq">
        <FAQ />
      </section>

      <section className="py-20 bg-gradient-to-r from-muted to-muted">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              ¿Listo para ser parte de la revolución digital hondureña?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Unite a miles de emprendedores que ya confían en NetmarketHN para hacer crecer sus negocios.
            </p>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              asChild
            >
              <Link href="/register">
                Empezar ahora <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Compliance Note */}
      <section className="py-12 bg-primary/10">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Importante:</strong> NetmarketHN no es una entidad o plataforma financiera. No existe retención de
              fondos en términos de ahorro o inversión. Todos los servicios están disponibles para usuarios debidamente
              verificados.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {/* Modals for footer links */}
      <Dialog open={isTermsOpen} onOpenChange={setIsTermsOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Términos de Uso</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Contenido de términos de uso pendiente...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Política de Privacidad</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Contenido de política de privacidad pendiente...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRegistrationTermsOpen} onOpenChange={setIsRegistrationTermsOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Términos de Registro</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Contenido de términos de registro pendiente...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Acerca de NetmarketHN</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Información sobre la empresa pendiente...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWhoWeAreOpen} onOpenChange={setIsWhoWeAreOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">¿Quiénes Somos?</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Información del equipo pendiente...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="sm:max-w-2xl bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Contactanos</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Información de contacto pendiente...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInfoEmailOpen} onOpenChange={setIsInfoEmailOpen}>
        <DialogContent className="sm:max-w-lg bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Contacto por Email</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-4">
            <p>Para consultas generales, escribinos a:</p>
            <p className="font-semibold text-foreground">info@netmarkethn.com</p>
          </div>
        </DialogContent>
      </Dialog>

      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-50 w-12 h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
          aria-label="Volver arriba"
        >
          <ArrowRight className="w-5 h-5 rotate-[-90deg]" />
        </motion.button>
      )}
    </div>
  )
}
