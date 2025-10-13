"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  MoreVertical, 
  Trash2, 
  Archive, 
  RotateCcw,
  AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

interface ConversationActionsProps {
  conversationId: string
  conversationTitle: string
  onDelete?: () => void
  onRestore?: () => void
  onArchive?: () => void
  isDeleted?: boolean
}

export function ConversationActions({
  conversationId,
  conversationTitle,
  onDelete,
  onRestore,
  onArchive,
  isDeleted = false
}: ConversationActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      if (onDelete) {
        await onDelete()
      }
      toast.success('Conversación eliminada')
      setShowDeleteDialog(false)
    } catch (error) {
      toast.error('Error al eliminar conversación')
      console.error('Error eliminando conversación:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async () => {
    setIsLoading(true)
    try {
      if (onRestore) {
        await onRestore()
      }
      toast.success('Conversación restaurada')
    } catch (error) {
      toast.error('Error al restaurar conversación')
      console.error('Error restaurando conversación:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleArchive = async () => {
    setIsLoading(true)
    try {
      if (onArchive) {
        await onArchive()
      }
      toast.success('Conversación archivada')
    } catch (error) {
      toast.error('Error al archivar conversación')
      console.error('Error archivando conversación:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 hover:bg-muted"
            disabled={isLoading}
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">Acciones de conversación</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {isDeleted ? (
            <DropdownMenuItem 
              onClick={handleRestore}
              disabled={isLoading}
              className="text-green-600 focus:text-green-600"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar conversación
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar conversación
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleArchive}
                disabled={isLoading}
                className="text-orange-600 focus:text-orange-600"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archivar conversación
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Eliminar conversación
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar la conversación con{' '}
              <span className="font-semibold">{conversationTitle}</span>?
              <br />
              <br />
              <span className="text-sm text-muted-foreground">
                Esta acción solo eliminará la conversación de tu vista. 
                El otro participante seguirá viendo la conversación hasta que también la elimine.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

