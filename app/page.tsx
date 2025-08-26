"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { FeatureCard } from "@/components/feature-card"
import { FAQ } from "@/components/faq"
import { Carousel } from "@/components/carousel"
import {
  Shield,
  CreditCard,
  DollarSign,
  CheckCircle,
  MessageSquare,
  BarChart3,
  Twitter,
  Linkedin,
  Facebook,
  ArrowRight,
  ChevronUp,
} from "lucide-react"
import { useState, useEffect } from "react"

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

export default function HomePage() {
  const [showScrollTop, setShowScrollTop] = useState(false)

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
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      <Header />

      {/* Carousel Section */}
      <section className="py-20 bg-white dark:bg-gray-900 pt-32">
        <div className="container mx-auto px-4">
          <Carousel />
        </div>
      </section>

      {/* Features Grid */}
      <section id="caracteristicas" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-4">
              ¿Por qué elegir NetmarketHN?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Todo lo que necesitas para transacciones P2P seguras y pagos eficientes
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={Shield}
              title="Bajas comisiones transparentes"
              description="Precios claros sin costos ocultos para tu tranquilidad"
              index={0}
            />
            <FeatureCard
              icon={CreditCard}
              title="Multi-wallet"
              description="Transferencias bancarias, billeteras digitales y más opciones"
              index={1}
            />
            <FeatureCard
              icon={MessageSquare}
              title="Disputas asistidas"
              description="Sistema de resolución 24/7 para cualquier inconveniente"
              index={2}
            />
            <FeatureCard
              icon={CheckCircle}
              title="Verificación de comerciantes"
              description="Vendedores verificados para mayor seguridad en tus transacciones"
              index={3}
            />
            <FeatureCard
              icon={DollarSign}
              title="Enlaces de pago"
              description="Cobra en línea sin integraciones complejas"
              index={4}
            />
            <FeatureCard
              icon={BarChart3}
              title="Panel con métricas"
              description="Control completo de tus operaciones con métricas detalladas"
              index={5}
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-4">Cómo funciona</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">Pasos simples para comenzar</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "1",
                title: "Crea tu cuenta",
                description: "Regístrate y verifica tu identidad para transacciones seguras",
              },
              {
                step: "2",
                title: "Publica o acepta una oferta",
                description: "Elige tu método de pago preferido y condiciones",
              },
              {
                step: "3",
                title: "Escrow y liberación",
                description: "Los fondos se liberan cuando se confirma el pago",
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
                <div className="w-16 h-16 bg-teal-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{item.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              * La disponibilidad de métodos puede variar según región
            </p>
          </div>
        </div>
      </section>

      <FAQ />

      <section className="py-20 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white mb-4">¿Listo para comenzar?</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Únete a miles de emprendedores que ya confían en NetmarketHN
            </p>
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Comenzar ahora <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Compliance Note */}
      <section className="py-12 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>Importante:</strong> La disponibilidad de métodos puede variar según región.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 dark:bg-black text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold mb-4">
                <span className="text-teal-400">Netmarket</span>
                <span className="text-gray-200">HN</span>
              </div>
              <p className="text-gray-400 mb-4">Plataforma P2P y herramientas de pago para emprendedores.</p>
              <div className="flex space-x-4">
                <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-teal-600 dark:hover:bg-teal-500 transition-colors cursor-pointer">
                  <Twitter className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-teal-600 dark:hover:bg-teal-500 transition-colors cursor-pointer">
                  <Linkedin className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-teal-600 dark:hover:bg-teal-500 transition-colors cursor-pointer">
                  <Facebook className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Características
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    API
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Documentación
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Acerca de
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Carreras
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Contacto
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Soporte</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Centro de Ayuda
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Política de Privacidad
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white hover:text-teal-400 transition-colors">
                    Términos de Servicio
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 dark:border-gray-600 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2024 NetmarketHN. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: showScrollTop ? 1 : 0,
          scale: showScrollTop ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-50 bg-teal-600 hover:bg-teal-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        aria-label="Volver arriba"
      >
        <ChevronUp className="w-6 h-6" />
      </motion.button>
    </div>
  )
}
