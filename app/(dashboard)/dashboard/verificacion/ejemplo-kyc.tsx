'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import KycUploader from './KycUploader';

export default function EjemploKycPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUserId() {
      try {
        const supabase = supabaseBrowser();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          setUserId(session.user.id);
        } else {
          console.error('No hay sesión activa');
        }
      } catch (error) {
        console.error('Error obteniendo usuario:', error);
      } finally {
        setLoading(false);
      }
    }

    getUserId();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Cargando...</div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-600">
          Error: No hay sesión activa. Por favor inicia sesión.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Verificación de Identidad</h1>
      
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Documentos de Identidad</h2>
          <KycUploader 
            userId={userId} 
            docType="document_front" 
            maxSizeMB={5}
            minWidth={600}
            minHeight={400}
            compress={true}
          />
          
          <KycUploader 
            userId={userId} 
            docType="document_back" 
            maxSizeMB={5}
            minWidth={600}
            minHeight={400}
            compress={true}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-medium">Verificación Adicional</h2>
          <KycUploader 
            userId={userId} 
            docType="selfie" 
            maxSizeMB={3}
            minWidth={400}
            minHeight={400}
            compress={true}
          />
          
          <KycUploader 
            userId={userId} 
            docType="address_proof" 
            maxSizeMB={10}
            minWidth={300}
            minHeight={200}
            compress={false} // Los PDFs no se comprimen
          />
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Instrucciones:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Selecciona un archivo para ver la vista previa</li>
          <li>• Revisa que la imagen sea clara y legible</li>
          <li>• Haz clic en "Confirmar y subir" para guardar</li>
          <li>• Puedes usar "Reintentar" para cambiar el archivo</li>
        </ul>
      </div>
    </div>
  );
}


