"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X, Sun, Moon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)

      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (window.scrollY / totalHeight) * 100
      setScrollProgress(progress)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDarkMode(true)
      document.documentElement.classList.add("dark")
    } else {
      setIsDarkMode(false)
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-teal-600 text-white px-4 py-2 rounded-md z-[60]"
      >
        Saltar al contenido
      </a>

      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200/20 dark:bg-gray-700/20 z-[51]">
        <motion.div
          className="h-full bg-gradient-to-r from-gray-600 to-teal-600"
          style={{ width: `${scrollProgress}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${scrollProgress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      <header
        className={`fixed top-1 w-full z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl shadow-lg border border-gray-200/30 dark:border-gray-700/30"
            : "bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm"
        }`}
        style={{
          background: isScrolled
            ? "linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)"
            : "linear-gradient(135deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)",
          ...(isDarkMode && {
            background: isScrolled
              ? "linear-gradient(135deg, rgba(17,24,39,0.8) 0%, rgba(17,24,39,0.6) 100%)"
              : "linear-gradient(135deg, rgba(17,24,39,0.5) 0%, rgba(17,24,39,0.3) 100%)",
          }),
        }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">
              <span className="text-teal-600 dark:text-teal-400">NM</span>
              <span className="text-gray-800 dark:text-gray-200">HN</span>
            </div>

            <nav className="hidden md:flex items-center space-x-8">
              {[
                { href: "#", label: "Inicio" },
                { href: "#caracteristicas", label: "Características" },
                { href: "#como-funciona", label: "Cómo funciona" },
                { href: "#faq", label: "FAQ" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href === "#") {
                      e.preventDefault()
                      window.scrollTo({ top: 0, behavior: "smooth" })
                    }
                  }}
                  className="relative text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors group"
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-teal-600 dark:bg-teal-400 transition-all duration-300 group-hover:w-full" />
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </Button>
              <Button
                variant="ghost"
                className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
              >
                Ingresar
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300">
                Comenzar
              </Button>
            </div>

            <button
              className="md:hidden text-gray-900 dark:text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Abrir menú de navegación"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="md:hidden mt-4 pb-4 border-t border-gray-200/30 dark:border-gray-700/30"
              >
                <nav className="flex flex-col space-y-4 mt-4">
                  {[
                    { href: "#", label: "Inicio" },
                    { href: "#caracteristicas", label: "Características" },
                    { href: "#como-funciona", label: "Cómo funciona" },
                    { href: "#faq", label: "FAQ" },
                  ].map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        if (item.href === "#") {
                          e.preventDefault()
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }
                        setIsMobileMenuOpen(false)
                      }}
                      className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                  <div className="flex flex-col space-y-2 pt-4">
                    <Button
                      variant="ghost"
                      onClick={toggleDarkMode}
                      className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 flex items-center justify-center gap-2"
                    >
                      {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                      {isDarkMode ? "Modo claro" : "Modo oscuro"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-gray-600 dark:text-gray-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/50"
                    >
                      Ingresar
                    </Button>
                    <Button className="bg-teal-600 hover:bg-teal-700 text-white">Comenzar</Button>
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </>
  )
}
