"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface FeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  index: number
}

export function FeatureCard({ icon: Icon, title, description, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
    >
      <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-gray-200 dark:border-gray-700 dark:bg-gray-800">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 bg-[#80CBC4]/20 dark:bg-[#80CBC4]/10 rounded-lg flex items-center justify-center mx-auto mb-4 hover:bg-[#80CBC4]/30 dark:hover:bg-[#80CBC4]/20 transition-colors">
            <Icon className="w-6 h-6 text-[#26A69A] dark:text-[#26A69A] transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-[#424242]/90 dark:text-white mb-2">{title}</h3>
          <p className="text-[#9E9E9E] dark:text-gray-300">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
