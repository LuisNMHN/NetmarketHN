"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { 
  canUserCreateMarkets
} from "@/lib/actions/prediction_markets_client"
import { createPredictionMarket } from "@/app/actions/prediction_markets"
import { 
  ArrowLeft,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Sparkles
} from "lucide-react"
import { PREDICTION_CATEGORIES, getSuggestedTitles, getSuggestedQuestions } from "@/lib/data/prediction-templates"
import LoadingSpinner from "@/components/ui/loading-spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Outcome {
  name: string
  description: string
  order_index: number
}

export default function CreateMarketPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [canCreate, setCanCreate] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    question: "",
    category: "",
    market_type: "binary" as "binary" | "multiple",
    resolution_source: "",
    resolution_date: "",
    outcomes: [] as Outcome[]
  })

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("")
  const [suggestedTitles, setSuggestedTitles] = useState<string[]>([])
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    checkPermissions()
  }, [])

  const checkPermissions = async () => {
    try {
      const result = await canUserCreateMarkets()
      setCanCreate(result.canCreate)
      if (!result.canCreate) {
        toast({
          title: "Sin permisos",
          description: result.reason || "No tienes permisos para crear mercados",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error verificando permisos:', error)
      setCanCreate(false)
    } finally {
      setLoading(false)
    }
  }

  const addOutcome = () => {
    setFormData({
      ...formData,
      outcomes: [
        ...formData.outcomes,
        {
          name: "",
          description: "",
          order_index: formData.outcomes.length
        }
      ]
    })
  }

  const removeOutcome = (index: number) => {
    setFormData({
      ...formData,
      outcomes: formData.outcomes.filter((_, i) => i !== index).map((o, i) => ({
        ...o,
        order_index: i
      }))
    })
  }

  const updateOutcome = (index: number, field: keyof Outcome, value: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = {
      ...newOutcomes[index],
      [field]: value
    }
    setFormData({
      ...formData,
      outcomes: newOutcomes
    })
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = "El título es requerido"
    }
    if (!formData.question.trim()) {
      newErrors.question = "La pregunta es requerida"
    }
    if (formData.market_type === 'multiple' && formData.outcomes.length < 2) {
      newErrors.outcomes = "Debes agregar al menos 2 opciones para mercados múltiples"
    }
    if (formData.market_type === 'multiple') {
      formData.outcomes.forEach((outcome, index) => {
        if (!outcome.name.trim()) {
          newErrors[`outcome_${index}`] = "El nombre de la opción es requerido"
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      toast({
        title: "Error de validación",
        description: "Por favor corrige los errores en el formulario",
        variant: "destructive",
      })
      return
    }

    try {
      setCreating(true)
      const result = await createPredictionMarket({
        title: formData.title,
        description: formData.description || undefined,
        question: formData.question,
        category: formData.category || undefined,
        market_type: formData.market_type,
        resolution_source: formData.resolution_source || undefined,
        resolution_date: formData.resolution_date || undefined,
        outcomes: formData.market_type === 'multiple' ? formData.outcomes : undefined
      })

      if (result.success && result.marketId) {
        // No mostrar toast - la notificación aparecerá en la campana
        router.push(`/dashboard/predicciones/${result.marketId}`)
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al crear el mercado",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creando mercado:', error)
      toast({
        title: "Error",
        description: "Error inesperado al crear el mercado",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <LoadingSpinner message="Verificando permisos..." />
      </div>
    )
  }

  if (canCreate === false) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Sin permisos</CardTitle>
            <CardDescription>
              No tienes permisos para crear mercados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Solo los usuarios autorizados por el administrador pueden crear mercados.
                Contacta con el administrador si deseas obtener estos permisos.
              </AlertDescription>
            </Alert>
            <Button asChild className="mt-4">
              <Link href="/dashboard/predicciones">Volver a mercados</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/predicciones">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Crear mercado de predicción</h1>
          <p className="text-muted-foreground mt-1">
            Crea un nuevo mercado donde los usuarios pueden hacer predicciones
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información básica</CardTitle>
                <CardDescription>
                  Información principal
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Paso 1: Seleccionar Categoría */}
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría (opcional)</Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={(value) => {
                      setSelectedCategoryId(value)
                      const category = PREDICTION_CATEGORIES.find(c => c.id === value)
                      if (category) {
                        setFormData({ ...formData, category: category.name })
                        setSuggestedTitles(getSuggestedTitles(value))
                        // Limpiar título y pregunta cuando cambia la categoría
                        setFormData(prev => ({ ...prev, title: "", question: "" }))
                        setSuggestedQuestions([])
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría para ver sugerencias" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDICTION_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedCategoryId && (
                    <p className="text-xs text-muted-foreground">
                      {PREDICTION_CATEGORIES.find(c => c.id === selectedCategoryId)?.description}
                    </p>
                  )}
                </div>

                {/* Paso 2: Títulos Sugeridos (aparece cuando hay categoría) */}
                {suggestedTitles.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Títulos sugeridos
                    </Label>
                    <Select
                      value={formData.title}
                      onValueChange={(value) => {
                        setFormData({ ...formData, title: value })
                        const questions = getSuggestedQuestions(selectedCategoryId, value)
                        setSuggestedQuestions(questions)
                        // Si hay preguntas sugeridas, usar la primera por defecto
                        if (questions.length > 0) {
                          setFormData(prev => ({ ...prev, question: questions[0] }))
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un título sugerido" />
                      </SelectTrigger>
                      <SelectContent>
                        {suggestedTitles.map((title, index) => (
                          <SelectItem key={index} value={title}>
                            {title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O escribe un título personalizado en el campo siguiente
                    </p>
                  </div>
                )}

                {/* Paso 3: Título del Mercado */}
                <div className="space-y-2">
                  <Label htmlFor="title">Título del mercado *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value })
                      // Si hay un título personalizado, buscar preguntas sugeridas
                      if (selectedCategoryId && e.target.value) {
                        const questions = getSuggestedQuestions(selectedCategoryId, e.target.value)
                        setSuggestedQuestions(questions)
                      } else {
                        setSuggestedQuestions([])
                      }
                    }}
                    placeholder="Ej: ¿Ganará el equipo A en el próximo partido?"
                    className={errors.title ? "border-destructive" : ""}
                  />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title}</p>
                  )}
                </div>

                {/* Paso 4: Preguntas Sugeridas (aparece cuando hay título) */}
                {suggestedQuestions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Preguntas sugeridas
                    </Label>
                    <Select
                      value={formData.question}
                      onValueChange={(value) => setFormData({ ...formData, question: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una pregunta sugerida" />
                      </SelectTrigger>
                      <SelectContent>
                        {suggestedQuestions.map((question, index) => (
                          <SelectItem key={index} value={question}>
                            {question}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O escribe una pregunta personalizada en el campo siguiente
                    </p>
                  </div>
                )}

                {/* Paso 5: Pregunta de Predicción */}
                <div className="space-y-2">
                  <Label htmlFor="question">Pregunta de predicción *</Label>
                  <Textarea
                    id="question"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    placeholder="Ej: ¿Ganará el equipo A en el próximo partido?"
                    rows={3}
                    className={errors.question ? "border-destructive" : ""}
                  />
                  {errors.question && (
                    <p className="text-sm text-destructive">{errors.question}</p>
                  )}
                </div>

                {/* Paso 6: Descripción */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción (opcional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe el contexto del mercado..."
                    rows={4}
                  />
                </div>

                {/* Paso 7: Tipo de Mercado */}
                <div className="grid grid-cols-2 gap-4">

                  <div className="space-y-2">
                    <Label htmlFor="market_type">Tipo de mercado *</Label>
                    <Select
                      value={formData.market_type}
                      onValueChange={(value: "binary" | "multiple") => 
                        setFormData({ ...formData, market_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="binary">Binario (Sí/No)</SelectItem>
                        <SelectItem value="multiple">Múltiple Opciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {formData.market_type === 'multiple' && (
              <Card>
                <CardHeader>
                  <CardTitle>Opciones de predicción</CardTitle>
                  <CardDescription>
                    Define las opciones disponibles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.outcomes.map((outcome, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Opción {index + 1}</Label>
                        {formData.outcomes.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOutcome(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={outcome.name}
                          onChange={(e) => updateOutcome(index, 'name', e.target.value)}
                          placeholder="Nombre de la opción"
                          className={errors[`outcome_${index}`] ? "border-destructive" : ""}
                        />
                        {errors[`outcome_${index}`] && (
                          <p className="text-sm text-destructive">{errors[`outcome_${index}`]}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={outcome.description}
                          onChange={(e) => updateOutcome(index, 'description', e.target.value)}
                          placeholder="Descripción (opcional)"
                        />
                      </div>
                    </div>
                  ))}
                  {errors.outcomes && (
                    <p className="text-sm text-destructive">{errors.outcomes}</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addOutcome}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Opción
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Información de resolución</CardTitle>
                <CardDescription>
                  Información de resolución
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resolution_source">Fuente de resolución (opcional)</Label>
                  <Input
                    id="resolution_source"
                    value={formData.resolution_source}
                    onChange={(e) => setFormData({ ...formData, resolution_source: e.target.value })}
                    placeholder="URL o descripción de la fuente"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resolution_date">Fecha de resolución estimada (opcional)</Label>
                  <Input
                    id="resolution_date"
                    type="date"
                    value={formData.resolution_date}
                    onChange={(e) => setFormData({ ...formData, resolution_date: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Tipo</Label>
                  <p className="text-sm">
                    {formData.market_type === 'binary' ? 'Binario (Sí/No)' : 'Múltiple Opciones'}
                  </p>
                </div>
                {formData.market_type === 'multiple' && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Opciones</Label>
                    <p className="text-sm">{formData.outcomes.length} opciones definidas</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                asChild
              >
                <Link href="/dashboard/predicciones">Cancelar</Link>
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={creating}
              >
                {creating ? "Creando..." : "Crear mercado"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}


