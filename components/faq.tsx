"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqData = [
  {
    question: "¿Qué es P2P?",
    answer:
      "P2P (peer-to-peer) permite transacciones directas entre usuarios sin intermediarios tradicionales, con mayor control y mejores tarifas.",
  },
  {
    question: "¿Cómo funciona el depósito en garantía?",
    answer:
      "Nuestro sistema de depósito en garantía protege tanto a compradores como vendedores manteniendo los fondos seguros hasta que ambas partes confirmen la transacción.",
  },
  {
    question: "Métodos de pago soportados",
    answer:
      "Soportamos múltiples métodos de pago adaptados para el mercado hondureño, incluyendo transferencias bancarias y billeteras digitales locales.",
  },
  {
    question: "Límites y verificación",
    answer:
      "Los límites dependen de tu nivel de verificación. Usuarios verificados tienen acceso a límites más altos y funciones premium.",
  },
  {
    question: "Comisiones",
    answer:
      "Nuestras comisiones son transparentes y competitivas. Las tarifas finales dependen del método de pago y de la inmediatez del retiro solicitado.",
  },
  {
    question: "Soporte y disputas",
    answer:
      "Ofrecemos soporte personalizado en español y un sistema robusto de resolución de disputas para garantizar transacciones seguras.",
  },
]

export function FAQ() {
  return (
    <section id="faq" className="py-20 bg-muted">
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Preguntas Frecuentes</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Todo lo que necesitas saber sobre NetmarketHN
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqData.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-background rounded-lg px-6 border-border"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
