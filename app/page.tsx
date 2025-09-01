"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/header"
import { FeatureCard } from "@/components/feature-card"
import { FAQ } from "@/components/faq"
import { Carousel } from "@/components/carousel"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Link from "next/link" // Importar Link
import {
  Shield,
  CreditCard,
  DollarSign,
  CheckCircle,
  MessageSquare,
  BarChart3,
  Facebook,
  Mail,
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
            <h2 className="text-3xl md:text-4xl font-bold text-[#424242]/90 dark:text-white mb-4">
              ¿Por qué elegir NetmarketHN?
            </h2>
            <p className="text-xl text-[#9E9E9E] dark:text-gray-300 max-w-2xl mx-auto">
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
      <section id="como-funciona" className="py-20 bg-[#FAFAFA] dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-[#424242]/90 dark:text-white mb-4">¿Cómo funciona?</h2>
            <p className="text-xl text-[#9E9E9E] dark:text-gray-300">
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
                  className="w-16 h-16 bg-gradient-to-br from-[#26A69A] to-[#26A69A] text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg hover:shadow-xl transition-shadow duration-300 relative overflow-hidden"
                >
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.3 + 0.5 }}
                    viewport={{ once: true }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-[#80CBC4]/20 to-transparent -skew-x-12 transform translate-x-[-100%]"
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
                <h3 className="text-xl font-semibold text-[#424242]/90 dark:text-white mb-2">{item.title}</h3>
                <p className="text-[#9E9E9E] dark:text-gray-300">{item.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-[#9E9E9E] dark:text-gray-400">
              * Intercambios P2P, herramientas de pago en línea y múltiples métodos disponibles para usuarios
              verificados
            </p>
          </div>
        </div>
      </section>

      <section id="faq">
        <FAQ />
      </section>

      <section className="py-20 bg-gradient-to-r from-[#FAFAFA] to-[#FAFAFA] dark:from-gray-800 dark:to-gray-700">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-[#424242]/90 dark:text-white mb-4">
              ¿Listo para ser parte de la revolución digital hondureña?
            </h2>
            <p className="text-xl text-[#9E9E9E] dark:text-gray-300 mb-8">
              Unite a miles de emprendedores que ya confían en NetmarketHN para hacer crecer sus negocios.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/login" passHref>
                <Button
                  size="lg"
                  className="bg-[#26A69A] hover:bg-[#26A69A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/register" passHref>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-[#26A69A] text-[#26A69A] hover:bg-[#26A69A]/10 shadow-lg hover:shadow-xl transition-all duration-300 dark:text-[#26A69A] dark:hover:bg-[#26A69A]/20"
                >
                  Crear cuenta <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Compliance Note */}
      <section className="py-12 bg-[#80CBC4]/10 dark:bg-yellow-900/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm text-[#9E9E9E] dark:text-gray-300 mb-4">
              <strong>Importante:</strong> NetmarketHN no es una entidad o plataforma financiera. No existe retención de
              fondos en términos de ahorro o inversión. Todos los servicios están disponibles para usuarios debidamente
              verificados.
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
                <span className="text-[#26A69A]">Netmarket</span>
                <span className="text-gray-200">HN</span>
              </div>
              <p className="text-gray-400 mb-4">
                La primera plataforma P2P de Honduras con herramientas de pago para emprendedores catrachos.
              </p>
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-[#26A69A] dark:hover:bg-[#26A69A] transition-colors cursor-pointer">
                  <Facebook className="w-4 h-4" />
                </div>
                <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-[#26A69A] dark:hover:bg-[#26A69A] transition-colors cursor-pointer">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-2.08v5.73a3.87 3.87 0 0 1-3.14 3.78 3.87 3.87 0 0 1-4.08-2.87A3.87 3.87 0 0 1 9.75 4.5c.43 0 .85.08 1.25.23l1.38-2.5A6.37 6.37 0 0 0 9.75 1.5a6.37 6.37 0 0 0-6.14 4.87A6.37 6.37 0 0 0 9.75 12.5a6.37 6.37 0 0 0 4.08-1.5v9.5h2.08v-9.5a6.83 6.83 0 0 0 3.68-5.31z" />
                  </svg>
                </div>
                <Dialog open={isInfoEmailOpen} onOpenChange={setIsInfoEmailOpen}>
                  <DialogTrigger asChild>
                    <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded flex items-center justify-center hover:bg-[#26A69A] dark:hover:bg-[#26A69A] transition-colors cursor-pointer">
                      <Mail className="w-4 h-4" />
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                    <DialogHeader className="text-center p-6">
                      <DialogTitle className="text-xl font-semibold" style={{ color: "#424242", opacity: 0.9 }}>
                        Información General
                      </DialogTitle>
                    </DialogHeader>
                    <div className="px-6 pb-6 text-center">
                      <p className="text-gray-600 dark:text-gray-300 mb-4">Para consultas generales, contáctanos en:</p>
                      <a
                        href="mailto:info@netmarkethn.com"
                        className="inline-block px-6 py-3 rounded-lg text-white font-medium transition-all duration-200 hover:scale-105"
                        style={{
                          background: "linear-gradient(135deg, #26A69A 0%, #80CBC4 100%)",
                          boxShadow: "0 4px 15px rgba(38, 166, 154, 0.3)",
                        }}
                      >
                        info@netmarkethn.com
                      </a>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Dialog open={isWhoWeAreOpen} onOpenChange={setIsWhoWeAreOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-white hover:text-[#26A69A] transition-colors text-left">
                        ¿Quiénes somos?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-[90vw] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <DialogHeader className="text-center pb-6">
                        <DialogTitle className="text-2xl font-bold text-[#424242]/90 dark:text-white text-center">
                          ¿Quiénes somos?
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 text-[#424242]/90 dark:text-gray-200 text-sm leading-relaxed px-2">
                        <div className="bg-[#FAFAFA] dark:bg-gray-700 p-6 rounded-lg border-l-4 border-[#26A69A]">
                          <p className="text-[#424242]/90 dark:text-gray-200 text-base leading-relaxed">
                            NetMarketHN nace como la primera plataforma P2P creada para catrachos, pensada para
                            responder a las necesidades reales del mercado hondureño. Nuestro propósito es claro: dar a
                            emprendedores, negocios y profesionales las herramientas digitales necesarias para
                            intercambiar, cobrar y crecer sin fronteras, en su propia moneda (HNL).
                          </p>
                        </div>

                        <div>
                          <p className="text-[#424242]/90 dark:text-gray-200 mb-4">
                            En un país donde muchas veces los medios de pago digitales son inaccesibles, costosos o poco
                            adaptados al contexto local, NetMarketHN ofrece una alternativa segura, moderna y 100% hecha
                            en Honduras. Con nosotros, cada transacción se realiza en Lempiras, con soporte en español y
                            reglas claras que generan confianza en compradores y vendedores por igual.
                          </p>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            Más que una plataforma de pagos, somos un ecosistema digital diseñado para impulsar el
                            comercio catracho, desde el pequeño emprendedor hasta el profesional independiente que busca
                            llegar más lejos. Con depósito en garantía tecnológico, links de pago y subastas en línea,
                            NetMarketHN brinda transparencia y respaldo en cada operación, demostrando que desde
                            Honduras también podemos innovar y liderar en el mercado digital.
                          </p>
                        </div>

                        <div className="bg-gradient-to-r from-[#26A69A]/10 to-[#80CBC4]/10 dark:from-[#26A69A]/20 dark:to-[#80CBC4]/20 p-6 rounded-lg">
                          <div className="flex items-center mb-3">
                            <span className="text-2xl mr-3">🇭🇳</span>
                            <h4 className="font-semibold text-[#424242]/90 dark:text-white text-base">
                              Hecho en Honduras, para Honduras
                            </h4>
                          </div>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            Desde Honduras innovamos y lideramos en el mercado digital, impulsando el comercio catracho
                            con herramientas modernas y seguras.
                          </p>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            onClick={() => setIsWhoWeAreOpen(false)}
                            className="w-full bg-gradient-to-r from-[#26A69A] to-[#26A69A] hover:from-[#26A69A]/90 hover:to-[#26A69A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Entendido
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-white hover:text-[#26A69A] transition-colors text-left">
                        Acerca de
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-[90vw] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <DialogHeader className="text-center pb-6">
                        <DialogTitle className="text-2xl font-bold text-[#424242]/90 dark:text-white text-center">
                          Acerca de NetMarketHN
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 text-[#424242]/90 dark:text-gray-200 text-sm leading-relaxed px-2">
                        <div className="bg-[#FAFAFA] dark:bg-gray-700 p-6 rounded-lg border-l-4 border-[#26A69A]">
                          <p className="text-[#424242]/90 dark:text-gray-200 text-base leading-relaxed">
                            NetMarketHN es una plataforma digital desarrollada para impulsar a emprendedores, negocios y
                            profesionales en Honduras y la región. Nuestro objetivo es brindar herramientas modernas y
                            seguras que permitan cobrar, vender y participar en subastas en línea, utilizando métodos de
                            pago digitales confiables.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            Nuestra misión
                          </h4>
                          <p className="text-[#424242]/90 dark:text-gray-200 mb-4">
                            En NetMarketHN creemos en el poder de la tecnología para democratizar el acceso a medios de
                            pago, reducir costos de intermediación y ofrecer nuevas oportunidades a quienes no cuentan
                            con infraestructura financiera propia.
                          </p>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            A diferencia de una entidad financiera, NetMarketHN no administra cuentas de ahorro ni
                            fondos de inversión. Somos un intermediario tecnológico que asegura que cada transacción P2P
                            se realice de forma transparente, con un sistema de retención y liberación de fondos que
                            protege a ambas partes.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            Nuestra plataforma está pensada para:
                          </h4>
                          <ul className="space-y-4 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong className="text-[#26A69A]">Emprendedores y proveedores de servicios:</strong>
                                <span className="text-[#424242]/90 dark:text-gray-200">
                                  {" "}
                                  que pueden generar links de pago para sus clientes.
                                </span>
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong className="text-[#26A69A]">Usuarios compradores:</strong>
                                <span className="text-[#424242]/90 dark:text-gray-200">
                                  {" "}
                                  que acceden a un espacio seguro para adquirir productos o servicios y participar en
                                  subastas.
                                </span>
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong className="text-[#26A69A]">Un ecosistema P2P confiable:</strong>
                                <span className="text-[#424242]/90 dark:text-gray-200">
                                  {" "}
                                  donde el dinero cargado solo se utiliza dentro de la plataforma, con verificación de
                                  identidad y control de procedencia de fondos.
                                </span>
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div className="bg-gradient-to-r from-[#26A69A]/10 to-[#80CBC4]/10 dark:from-[#26A69A]/20 dark:to-[#80CBC4]/20 p-6 rounded-lg">
                          <div className="flex items-center mb-3">
                            <span className="text-2xl mr-3">🌐</span>
                            <h4 className="font-semibold text-[#424242]/90 dark:text-white text-base">
                              Nuestro compromiso
                            </h4>
                          </div>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            Con NetMarketHN promovemos la confianza digital, la innovación en medios de pago y la
                            inclusión tecnológica para todos.
                          </p>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            onClick={() => setIsAboutOpen(false)}
                            className="w-full bg-gradient-to-r from-[#26A69A] to-[#26A69A] hover:from-[#26A69A]/90 hover:to-[#26A69A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Entendido
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </li>
                <li>
                  <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-white hover:text-[#26A69A] transition-colors text-left">
                        Contacto
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md w-[90vw] overflow-x-hidden">
                      <DialogHeader>
                        <DialogTitle
                          className="text-2xl font-bold text-center"
                          style={{ color: "#424242", opacity: 0.9 }}
                        >
                          Contacto
                        </DialogTitle>
                      </DialogHeader>
                      <div className="px-4 py-6 text-center">
                        <div className="space-y-4">
                          <div className="p-4 rounded-lg" style={{ backgroundColor: "#FAFAFA" }}>
                            <h3 className="font-semibold mb-2" style={{ color: "#424242", opacity: 0.9 }}>
                              Correo electrónico
                            </h3>
                            <a
                              href="mailto:contacto@netmarkethn.com"
                              className="text-lg font-medium hover:underline transition-colors"
                              style={{ color: "#26A69A" }}
                            >
                              contacto@netmarkethn.com
                            </a>
                          </div>
                          <p className="text-sm" style={{ color: "#9E9E9E" }}>
                            Estamos aquí para ayudarte. Contáctanos para cualquier consulta sobre nuestros servicios.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Términos y Políticas</h3>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Dialog open={isTermsOpen} onOpenChange={setIsTermsOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-white hover:text-[#26A69A] transition-colors text-left">
                        Términos de Servicio
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <DialogHeader className="text-center pb-6">
                        <DialogTitle className="text-2xl font-bold text-[#424242]/90 dark:text-white text-center">
                          Términos de servicio
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 text-[#424242]/90 dark:text-gray-200 text-sm leading-relaxed px-2">
                        <div className="bg-[#FAFAFA] dark:bg-gray-700 p-6 rounded-lg border-l-4 border-[#26A69A]">
                          <h3 className="font-semibold text-[#26A69A] mb-3 text-base">
                            Aviso importante sobre el uso de la plataforma NetMarketHN (NMHN):
                          </h3>
                          <p className="mb-4">
                            NetMarketHN es una plataforma digital de intermediación P2P que facilita la creación de
                            enlaces de pago, subastas y transacciones seguras entre usuarios registrados. NMHN no es una
                            institución financiera, bancaria ni una entidad que administre ahorros, inversiones o fondos
                            de terceros.
                          </p>
                          <p>
                            El saldo cargado o retenido dentro de la plataforma tiene un único propósito: ser utilizado
                            como medio para completar las transacciones entre usuarios (compradores y vendedores) que
                            participan en los servicios de NMHN. Este saldo no constituye una cuenta de ahorro, depósito
                            bancario, inversión, ni genera intereses de ningún tipo.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3">
                            Los usuarios aceptan expresamente que:
                          </h4>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              El saldo dentro de NMHN es exclusivamente para operaciones P2P en la plataforma.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              No podrá transferirse, retirarse en efectivo ni utilizarse con fines distintos a los
                              autorizados dentro de NMHN.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NetMarketHN se reserva el derecho de verificar en cualquier momento la procedencia de los
                              fondos utilizados dentro de la plataforma, pudiendo solicitar información o documentos
                              adicionales al usuario.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Queda terminantemente prohibido el uso de dinero en efectivo como medio de recarga o
                              transacción dentro de NMHN. Todos los movimientos deben realizarse mediante los métodos de
                              pago electrónicos y digitales autorizados por la plataforma.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NetMarketHN actúa únicamente como intermediario tecnológico, garantizando la retención y
                              liberación de fondos conforme a las condiciones pactadas entre las partes.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Los usuarios son los únicos responsables de la veracidad de sus transacciones y del
                              cumplimiento de las obligaciones derivadas de ellas.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NMHN se reserva el derecho de bloquear, cancelar o suspender cuentas que hagan un uso
                              indebido de los fondos, de los links de pago o del sistema de subastas, o que incumplan
                              las disposiciones aquí establecidas.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              En ningún caso la plataforma será responsable por interpretaciones erróneas que equiparen
                              el uso de saldo en NMHN a un servicio bancario, de ahorro o de inversión.
                            </li>
                          </ul>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            onClick={() => setIsTermsOpen(false)}
                            className="w-full bg-gradient-to-r from-[#26A69A] to-[#26A69A] hover:from-[#26A69A]/90 hover:to-[#26A69A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Entendido
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </li>
                <li>
                  <Dialog open={isRegistrationTermsOpen} onOpenChange={setIsRegistrationTermsOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-white hover:text-[#26A69A] transition-colors text-left">
                        Términos y condiciones de registro
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <DialogHeader className="text-center pb-6">
                        <DialogTitle className="text-2xl font-bold text-[#424242]/90 dark:text-white text-center">
                          Términos y condiciones de registro
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 text-[#424242]/90 dark:text-gray-200 text-sm leading-relaxed px-2">
                        <div className="bg-[#FAFAFA] dark:bg-gray-700 p-6 rounded-lg border-l-4 border-[#26A69A]">
                          <p className="text-[#424242]/90 dark:text-gray-200 text-base leading-relaxed">
                            Al registrarse en la plataforma NetMarketHN (NMHN), toda persona acepta íntegramente los
                            presentes Términos y Condiciones, así como las políticas internas de uso de la plataforma.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            1. Requisitos de Registro
                          </h4>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Podrán registrarse únicamente personas mayores de 18 años, con capacidad legal para
                              contratar.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Cada usuario deberá completar el formulario de registro, proporcionando datos personales
                              verídicos, actualizados y completos.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NMHN podrá solicitar documentación adicional (documento de identidad, comprobante de
                              domicilio, número de identificación tributaria, entre otros) para validar la información
                              aportada por el usuario.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              El registro se considerará completo únicamente cuando la plataforma haya validado
                              satisfactoriamente los datos y documentos proporcionados.
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            2. Validación y Verificación
                          </h4>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NMHN se reserva el derecho de verificar la autenticidad de la información y documentación
                              aportada por el usuario.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              La plataforma podrá solicitar información adicional en cualquier momento como medida de
                              seguridad o para cumplir con normativas nacionales e internacionales.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              La falta de entrega de información requerida o la detección de datos falsos, incompletos o
                              fraudulentos será causa suficiente para rechazar, suspender o cancelar el registro del
                              usuario.
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            3. Responsabilidad del Usuario
                          </h4>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              El usuario se compromete a mantener actualizada su información de registro, notificando de
                              inmediato cualquier cambio.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              El usuario será el único responsable de la veracidad y legalidad de la información y
                              documentos proporcionados.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              El uso indebido de datos, la suplantación de identidad o cualquier acción que vulnere la
                              seguridad de la plataforma dará lugar a la suspensión definitiva de la cuenta y, en su
                              caso, a acciones legales correspondientes.
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            4. Facultades de la Plataforma
                          </h4>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NMHN podrá denegar o cancelar un registro si considera que la información proporcionada no
                              cumple con los requisitos establecidos.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              NMHN se reserva el derecho de realizar verificaciones periódicas de identidad, procedencia
                              de fondos y uso de la cuenta para garantizar la transparencia y seguridad de las
                              operaciones.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              La plataforma podrá bloquear o restringir el acceso de un usuario cuando se detecten
                              inconsistencias, incumplimientos o actividades sospechosas.
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            5. Consentimiento Expreso
                          </h4>
                          <p className="mb-3 text-[#424242]/90 dark:text-gray-200">
                            Al registrarse, el usuario declara de forma expresa que:
                          </p>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Autoriza a NMHN a almacenar, tratar y verificar su información personal y de otra índole
                              conforme a la normativa aplicable en materia de protección de datos.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Reconoce que el registro y la verificación de identidad son condiciones obligatorias para
                              poder acceder y utilizar los servicios de la plataforma.
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              Acepta que el incumplimiento de estos términos puede derivar en la suspensión o
                              cancelación de su cuenta sin responsabilidad para NMHN.
                            </li>
                          </ul>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            onClick={() => setIsRegistrationTermsOpen(false)}
                            className="w-full bg-gradient-to-r from-[#26A69A] to-[#26A69A] hover:from-[#26A69A]/90 hover:to-[#26A69A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Entendido
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </li>
                <li>
                  <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
                    <DialogTrigger asChild>
                      <button className="hover:text-white hover:text-[#26A69A] transition-colors text-left">
                        Políticas de privacidad
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-6xl w-[90vw] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <DialogHeader className="text-center pb-6">
                        <DialogTitle className="text-2xl font-bold text-[#424242]/90 dark:text-white text-center">
                          Política de privacidad
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 text-[#424242]/90 dark:text-gray-200 text-sm leading-relaxed px-2">
                        <div className="bg-[#FAFAFA] dark:bg-gray-700 p-6 rounded-lg border-l-4 border-[#26A69A]">
                          <p className="text-[#424242]/90 dark:text-gray-200 text-base leading-relaxed">
                            En NetMarketHN (NMHN) valoramos y respetamos la privacidad de nuestros usuarios. Esta
                            Política de Privacidad explica cómo recopilamos, utilizamos, almacenamos y protegemos la
                            información personal de las personas que acceden y utilizan nuestra plataforma digital.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            1. Información que recopilamos
                          </h4>
                          <p className="mb-3 text-[#424242]/90 dark:text-gray-200">
                            Al registrarse y utilizar nuestros servicios, podemos recopilar las siguientes categorías de
                            datos:
                          </p>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong>Datos personales de identificación:</strong> nombre completo, documento de
                                identidad, fecha de nacimiento, dirección, correo electrónico y número de teléfono.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong>Datos financieros y de transacciones:</strong> información relacionada con los
                                medios de pago digitales autorizados, historial de operaciones y registros de uso de
                                saldo dentro de la plataforma.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong>Datos técnicos y de navegación:</strong> dirección IP, tipo de dispositivo,
                                navegador utilizado, sistema operativo y datos de cookies para mejorar la experiencia de
                                usuario.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong>Documentación adicional:</strong> comprobante de domicilio, número de
                                identificación tributaria u otros documentos necesarios para validar identidad y
                                procedencia de fondos.
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            2. Uso de la información
                          </h4>
                          <p className="mb-3 text-[#424242]/90 dark:text-gray-200">
                            La información recopilada se utiliza exclusivamente para:
                          </p>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Verificar la identidad de los usuarios y garantizar la seguridad de la plataforma.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>Procesar transacciones P2P entre compradores y vendedores registrados.</div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Cumplir con normativas legales y regulatorias, incluyendo prevención de fraude y lavado
                                de activos.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Mejorar la experiencia de usuario, personalizar el servicio y optimizar nuestras
                                herramientas digitales.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Enviar notificaciones relacionadas con transacciones, cambios en las políticas o
                                información relevante para la seguridad de la cuenta.
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            3. Almacenamiento y seguridad
                          </h4>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Los datos personales son almacenados en servidores seguros y se aplican medidas técnicas
                                y administrativas para protegerlos contra accesos no autorizados, pérdida o alteración.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                La información sensible (como métodos de pago) se transmite mediante protocolos cifrados
                                (SSL/TLS).
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Solo personal autorizado de NMHN tendrá acceso a la información estrictamente necesaria
                                para la operación.
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            4. Compartición de datos
                          </h4>
                          <p className="mb-3 text-[#424242]/90 dark:text-gray-200">
                            NetMarketHN no vende, alquila ni comparte información personal con terceros salvo en los
                            siguientes casos:
                          </p>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong>Cumplimiento legal:</strong> cuando sea requerido por una autoridad competente,
                                orden judicial o normativa vigente.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                <strong>Aliados de servicio:</strong> proveedores tecnológicos o de pago que participen
                                en el procesamiento seguro de las transacciones, bajo estrictos acuerdos de
                                confidencialidad.
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            5. Derechos de los usuarios
                          </h4>
                          <p className="mb-3 text-[#424242]/90 dark:text-gray-200">
                            Los usuarios podrán, en cualquier momento:
                          </p>
                          <ul className="space-y-3 pl-4">
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>Acceder, corregir o actualizar sus datos personales.</div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Solicitar la eliminación de su cuenta y datos, salvo cuando existan obligaciones legales
                                de conservación.
                              </div>
                            </li>
                            <li className="flex items-start">
                              <span className="w-2 h-2 bg-[#26A69A] rounded-full mt-2 mr-3 flex-shrink-0"></span>
                              <div>
                                Restringir el uso de su información con fines no esenciales para el funcionamiento de la
                                plataforma.
                              </div>
                            </li>
                          </ul>
                          <p className="mt-3 text-[#424242]/90 dark:text-gray-200">
                            Las solicitudes deberán realizarse a través de los canales oficiales de atención de NMHN.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            6. Retención de la información
                          </h4>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            Los datos serán conservados únicamente durante el tiempo necesario para cumplir con los
                            fines descritos en esta política, o por períodos más largos si lo exige la normativa legal
                            aplicable.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            7. Uso de cookies y tecnologías similares
                          </h4>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            La plataforma utiliza cookies para mejorar la navegación, analizar tendencias de uso y
                            optimizar la experiencia. El usuario puede configurar su navegador para rechazarlas, aunque
                            esto podría limitar algunas funcionalidades.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            8. Consentimiento
                          </h4>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            Al registrarse y utilizar los servicios de NMHN, el usuario declara aceptar esta Política de
                            Privacidad y autoriza el tratamiento de sus datos conforme a lo aquí establecido.
                          </p>
                        </div>

                        <div>
                          <h4 className="font-semibold text-[#424242]/90 dark:text-white mb-3 text-base">
                            9. Modificaciones
                          </h4>
                          <p className="text-[#424242]/90 dark:text-gray-200">
                            NMHN se reserva el derecho de modificar esta Política de Privacidad en cualquier momento.
                            Los cambios serán notificados a los usuarios mediante la plataforma y entrarán en vigor
                            desde su publicación.
                          </p>
                        </div>

                        <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
                          <Button
                            onClick={() => setIsPrivacyOpen(false)}
                            className="w-full bg-gradient-to-r from-[#26A69A] to-[#26A69A] hover:from-[#26A69A]/90 hover:to-[#26A69A]/90 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            Entendido
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 dark:border-gray-600 mt-12 pt-8 text-center text-gray-400">
            <p>&copy; 2025 NetmarketHN LLC. Todos los derechos reservados.</p>
            <div className="mt-2">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-[#26A69A] hover:text-[#80CBC4] transition-colors duration-200 underline">
                    soporte@netmarkethn.com
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                  <DialogHeader className="text-center p-6">
                    <DialogTitle className="text-xl font-semibold text-[#424242]/90 dark:text-gray-200 mb-4">
                      Soporte técnico
                    </DialogTitle>
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-[#26A69A] to-[#80CBC4] p-4 rounded-lg">
                        <p className="text-white font-medium">Para soporte técnico, contáctanos en:</p>
                        <a
                          href="mailto:soporte@netmarkethn.com"
                          className="text-white text-lg font-semibold hover:underline block mt-2"
                        >
                          soporte@netmarkethn.com
                        </a>
                      </div>
                      <p className="text-[#9E9E9E] text-sm">
                        Nuestro equipo te ayudará con cualquier consulta técnica.
                      </p>
                    </div>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </div>
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
        className="fixed bottom-6 right-6 z-50 bg-[#26A69A] hover:bg-[#26A69A]/90 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#26A69A] focus:ring-offset-2"
        aria-label="Volver arriba"
      >
        <ChevronUp className="w-6 h-6" />
      </motion.button>
    </div>
  )
}
