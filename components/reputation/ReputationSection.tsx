"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Star, 
  Award, 
  Trophy, 
  Shield, 
  MessageCircle, 
  Clock, 
  TrendingUp,
  Users,
  Calendar,
  CheckCircle,
  AlertCircle,
  Crown,
  Heart,
  Zap,
  Target,
  BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UserReputationMetrics, UserReview, UserBadge } from "@/lib/actions/reputation"

interface ReputationSectionProps {
  userId: string
  className?: string
}

export function ReputationSection({ userId, className }: ReputationSectionProps) {
  const [metrics, setMetrics] = useState<UserReputationMetrics | null>(null)
  const [reviews, setReviews] = useState<UserReview[]>([])
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllReviews, setShowAllReviews] = useState(false)

  useEffect(() => {
    loadReputationData()
  }, [userId])

  const loadReputationData = async () => {
    try {
      setLoading(true)
      
      // Cargar métricas, reviews y badges en paralelo
      const [metricsRes, reviewsRes, badgesRes] = await Promise.all([
        fetch(`/api/reputation/metrics/${userId}`),
        fetch(`/api/reputation/reviews/${userId}?limit=5`),
        fetch(`/api/reputation/badges/${userId}`)
      ])

      const [metricsData, reviewsData, badgesData] = await Promise.all([
        metricsRes.json(),
        reviewsRes.json(),
        badgesRes.json()
      ])

      if (metricsData.success) setMetrics(metricsData.metrics)
      if (reviewsData.success) setReviews(reviewsData.reviews)
      if (badgesData.success) setBadges(badgesData.badges)
    } catch (error) {
      console.error('Error cargando datos de reputación:', error)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200"
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200"
    return "bg-red-100 text-red-800 border-red-200"
  }

  const getReputationLevel = (score: number) => {
    if (score >= 90) return { level: "Excelente", icon: Trophy, color: "text-yellow-600" }
    if (score >= 80) return { level: "Muy Bueno", icon: Award, color: "text-green-600" }
    if (score >= 70) return { level: "Bueno", icon: CheckCircle, color: "text-blue-600" }
    if (score >= 60) return { level: "Regular", icon: AlertCircle, color: "text-yellow-600" }
    return { level: "Necesita Mejorar", icon: AlertCircle, color: "text-red-600" }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          "h-4 w-4",
          i < Math.floor(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        )}
      />
    ))
  }

  const getBadgeIcon = (iconName: string) => {
    const icons: Record<string, any> = {
      Star,
      Award,
      Trophy,
      Shield,
      MessageCircle,
      Calendar,
      Crown,
      Heart,
      Zap,
      Target,
      CheckCircle,
      AlertCircle
    }
    return icons[iconName] || Star
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reputación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reputación
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No hay datos de reputación disponibles.</p>
        </CardContent>
      </Card>
    )
  }

  const reputationLevel = getReputationLevel(metrics.overall_score)
  const ReputationIcon = reputationLevel.icon

  return (
    <div className={cn("space-y-6", className)}>
      {/* Métricas principales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Reputación General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score principal */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <ReputationIcon className={cn("h-6 w-6", reputationLevel.color)} />
              <span className="text-2xl font-bold">{metrics.overall_score.toFixed(1)}</span>
              <span className="text-muted-foreground">/ 100</span>
            </div>
            <Badge className={getScoreBadgeColor(metrics.overall_score)}>
              {reputationLevel.level}
            </Badge>
            <Progress 
              value={metrics.overall_score} 
              className="w-full max-w-xs mx-auto"
            />
          </div>

          <Separator />

          {/* Estadísticas de reviews */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.total_reviews}</div>
              <div className="text-sm text-muted-foreground">Total Reviews</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics.positive_reviews}</div>
              <div className="text-sm text-muted-foreground">Positivas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{metrics.neutral_reviews}</div>
              <div className="text-sm text-muted-foreground">Neutrales</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{metrics.negative_reviews}</div>
              <div className="text-sm text-muted-foreground">Negativas</div>
            </div>
          </div>

          <Separator />

          {/* Métricas por categoría */}
          <div className="space-y-4">
            <h4 className="font-semibold">Calificaciones por Categoría</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Comunicación</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(metrics.avg_communication)}</div>
                  <span className="text-sm font-medium">{metrics.avg_communication.toFixed(1)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Confiabilidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(metrics.avg_reliability)}</div>
                  <span className="text-sm font-medium">{metrics.avg_reliability.toFixed(1)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Calidad</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">{renderStars(metrics.avg_quality)}</div>
                  <span className="text-sm font-medium">{metrics.avg_quality.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      {badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Badges y Logros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {badges.map((userBadge) => {
                const BadgeIcon = getBadgeIcon(userBadge.badge?.icon_name || 'Star')
                return (
                  <div
                    key={userBadge.id}
                    className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <BadgeIcon className={cn("h-8 w-8 mb-2", `text-${userBadge.badge?.color}-600`)} />
                    <h4 className="font-semibold text-sm text-center">{userBadge.badge?.display_name}</h4>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {userBadge.badge?.description}
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(userBadge.earned_at).toLocaleDateString()}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews recientes */}
      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Reviews Recientes
              </div>
              {reviews.length >= 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllReviews(!showAllReviews)}
                >
                  {showAllReviews ? 'Ver menos' : 'Ver todas'}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(showAllReviews ? reviews : reviews.slice(0, 3)).map((review) => (
                <div key={review.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex">{renderStars(review.overall_rating)}</div>
                      <span className="font-medium">{review.overall_rating.toFixed(1)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {review.review_title && (
                    <h4 className="font-semibold">{review.review_title}</h4>
                  )}
                  
                  {review.review_text && (
                    <p className="text-sm text-muted-foreground">{review.review_text}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {review.communication_rating}
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {review.reliability_rating}
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {review.quality_rating}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
