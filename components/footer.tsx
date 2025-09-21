"use client"

import { useState } from "react"
import Link from "next/link"
import { Facebook, Instagram, Twitter, Mail, Shield, Info } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function Footer() {
  const [isWhoWeAreOpen, setIsWhoWeAreOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isSupportOpen, setIsSupportOpen] = useState(false)

  return (
    <footer className="bg-secondary text-secondary-foreground py-16 mt-20">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Marca */}
          <div>
            <div className="text-2xl font-bold mb-4">
              <span className="text-primary">NetMarket</span>
              <span className="text-secondary-foreground/80">HN</span>
            </div>
            <p className="text-muted-foreground mb-4">
              La primera plataforma P2P de Honduras con herramientas de pago para emprendedores hondureños.
            </p>
            <div className="flex gap-3">
              <a
                className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary transition-colors"
                aria-label="Facebook"
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary transition-colors"
                aria-label="Instagram"
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                className="w-9 h-9 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary transition-colors"
                aria-label="Twitter/X"
                href="#"
                target="_blank"
                rel="noreferrer"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="font-semibold mb-4 text-secondary-foreground">Producto</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Dialog open={isWhoWeAreOpen} onOpenChange={setIsWhoWeAreOpen}>
                  <DialogTrigger asChild>
                    <button className="hover:text-primary transition-colors inline-flex items-center gap-2">
                      <Info className="w-4 h-4" /> ¿Quiénes somos?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl w-[92vw]">
                    <DialogHeader>
                      <DialogTitle>Acerca de NetMarketHN</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        NetMarketHN es una plataforma digital para impulsar a emprendedores, negocios y profesionales en
                        Honduras. Ofrecemos herramientas modernas para cobrar, vender y participar en subastas en línea
                        con métodos de pago confiables.
                      </p>
                      <p>
                        No somos una entidad financiera; actuamos como intermediario tecnológico con un sistema de
                        retención y liberación de fondos que protege a ambas partes.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </li>

              <li>
                <Link
                  href="/legal/terminos"
                  className="hover:text-primary transition-colors inline-flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" /> Términos y condiciones
                </Link>
              </li>

              <li>
                <Link
                  href="/legal/privacidad"
                  className="hover:text-primary transition-colors inline-flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" /> Política de privacidad
                </Link>
              </li>
            </ul>
          </div>

          {/* Soporte */}
          <div>
            <h3 className="font-semibold mb-4 text-secondary-foreground">Soporte</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
                  <DialogTrigger asChild>
                    <button className="hover:text-primary transition-colors inline-flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Soporte técnico
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md w-[92vw]">
                    <DialogHeader>
                      <DialogTitle>Soporte técnico</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="rounded-lg p-4 bg-primary text-primary-foreground">
                        <p className="font-medium">Para soporte técnico, contáctanos:</p>
                        <a href="mailto:soporte@netmarkethn.com" className="underline font-semibold block mt-1">
                          soporte@netmarkethn.com
                        </a>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Horario de atención: Lunes a Viernes, 9:00 a.m. – 5:00 p.m. (UTC-6).
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </li>
              <li>
                <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
                  <DialogTrigger asChild>
                    <button className="hover:text-primary transition-colors inline-flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Información general
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md w-[92vw]">
                    <DialogHeader>
                      <DialogTitle>Información General</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-muted-foreground">
                      <p>Para consultas generales, escríbenos a:</p>
                      <a
                        href="mailto:info@netmarkethn.com"
                        className="inline-flex items-center gap-2 rounded-md px-4 py-2 bg-primary text-primary-foreground"
                      >
                        <Mail className="w-4 h-4" /> info@netmarkethn.com
                      </a>
                    </div>
                  </DialogContent>
                </Dialog>
              </li>
            </ul>
          </div>

          {/* Compañía / Navegación rápida */}
          <div>
            <h3 className="font-semibold mb-4 text-secondary-foreground">Compañía</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link href="/#caracteristicas" className="hover:text-primary transition-colors">
                  Características
                </Link>
              </li>
              <li>
                <Link href="/#como-funciona" className="hover:text-primary transition-colors">
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-primary transition-colors">
                  Ingresar
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary transition-colors">
                  Crear cuenta
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-primary-foreground/80">
          <p>© {new Date().getFullYear()} NetMarketHN LLC — Todos los derechos reservados.</p>
          <div className="flex items-center gap-6">
            <Link href="/legal/terminos" className="hover:text-primary transition-colors">
              Términos
            </Link>
            <Link href="/legal/privacidad" className="hover:text-primary transition-colors">
              Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
