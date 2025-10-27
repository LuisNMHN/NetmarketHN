"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Star, MessageCircle, Shield, Award, Send } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { CreateReviewData } from "@/lib/actions/reputation"

interface CreateReviewModalProps {
  isOpen: boolean
  onClose: () => void
  reviewedUserId: string
  reviewedUserName: string
  transactionId?: string
  contextType?: 'transaction' | 'service' | 'general'
}

export function CreateReviewModal({
  isOpen,
  onClose,
  reviewedUserId,
  reviewedUserName,
  transactionId,
  contextType = 'transaction'
}: CreateReviewModalProps) {
  const [formData, setFormData] = useState<CreateReviewData>({
    reviewed_id: reviewedUserId,
    transaction_id: transactionId,
    context_type: contextType,
    communication_rating: 0,
    reliability_rating: 0,
    quality_rating: 0,
    review_text: '',
    review_title: '',
    is_anonymous: false
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleRatingChange = (category: 'communication' | 'reliability' | 'quality', rating: number) => {
    setFormData(prev => ({
      ...prev,
      [`${category}_rating`]: rating
    }))
  }

  const handleSubmit = async () => {
    // Validar que todas las calificaciones estén completas
    if (formData.communication_rating === 0 || 
        formData.reliability_rating === 0 || 
        formData.quality_rating === 0) {
      toast({
        title: "Error",
        description: "Por favor califica todas las categorías",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/reputation/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Calificación enviada",
          description: "Tu calificación ha sido registrada exitosamente.",
        })
        onClose()
        // Resetear formulario
        setFormData({
          reviewed_id: reviewedUserId,
          transaction_id: transactionId,
          context_type: contextType,
          communication_rating: 0,
          reliability_rating: 0,
          quality_rating: 0,
          review_text: '',
          review_title: '',
          is_anonymous: false
        })
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo enviar la calificación",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error enviando review:', error)
      toast({
        title: "Error",
        description: "Error inesperado al enviar la calificación",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStarRating = (
    category: 'communication' | 'reliability' | 'quality',
    label: string,
    icon: any,
    color: string
  ) => {
    const rating = formData[`${category}_rating`]
    const Icon = icon

    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {label}
        </Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingChange(category, star)}
              className="focus:outline-none"
            >
              <Star
                className={`h-6 w-6 transition-colors ${
                  star <= rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300 hover:text-yellow-300"
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            {rating > 0 ? `${rating}/5` : 'Sin calificar'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calificar a {reviewedUserName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información de la transacción */}
          {transactionId && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">
                  Calificando transacción: <span className="font-mono">{transactionId}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calificaciones por categoría */}
          <div className="space-y-4">
            <h3 className="font-semibold">Calificaciones</h3>
            
            {renderStarRating(
              'communication',
              'Comunicación',
              MessageCircle,
              'text-blue-600'
            )}
            
            {renderStarRating(
              'reliability',
              'Confiabilidad',
              Shield,
              'text-green-600'
            )}
            
            {renderStarRating(
              'quality',
              'Calidad del Servicio',
              Award,
              'text-purple-600'
            )}
          </div>

          <Separator />

          {/* Review textual */}
          <div className="space-y-4">
            <h3 className="font-semibold">Comentarios (Opcional)</h3>
            
            <div className="space-y-2">
              <Label htmlFor="review_title">Título del comentario</Label>
              <Input
                id="review_title"
                placeholder="Ej: Excelente experiencia de compra"
                value={formData.review_title}
                onChange={(e) => setFormData(prev => ({ ...prev, review_title: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="review_text">Comentario detallado</Label>
              <Textarea
                id="review_text"
                placeholder="Describe tu experiencia con este usuario..."
                value={formData.review_text}
                onChange={(e) => setFormData(prev => ({ ...prev, review_text: e.target.value }))}
                rows={4}
                maxLength={1000}
              />
              <div className="text-xs text-muted-foreground text-right">
                {formData.review_text.length}/1000 caracteres
              </div>
            </div>
          </div>

          <Separator />

          {/* Opciones adicionales */}
          <div className="space-y-4">
            <h3 className="font-semibold">Opciones</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_anonymous"
                checked={formData.is_anonymous}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, is_anonymous: !!checked }))
                }
              />
              <Label htmlFor="is_anonymous" className="text-sm">
                Enviar calificación de forma anónima
              </Label>
            </div>
          </div>

          {/* Resumen de la calificación */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen de tu calificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Comunicación:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= formData.communication_rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span>Confiabilidad:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= formData.reliability_rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span>Calidad:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= formData.quality_rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Calificación General:</span>
                <span>
                  {formData.communication_rating > 0 && 
                   formData.reliability_rating > 0 && 
                   formData.quality_rating > 0
                    ? ((formData.communication_rating + formData.reliability_rating + formData.quality_rating) / 3).toFixed(1)
                    : '0.0'
                  }/5.0
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || 
                formData.communication_rating === 0 || 
                formData.reliability_rating === 0 || 
                formData.quality_rating === 0
              }
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Calificación
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
