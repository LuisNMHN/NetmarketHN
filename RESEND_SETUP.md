# Configuración de Resend para NMHN

## Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env.local`:

```env
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxx
FROM_EMAIL=NMHN <noreply@tudominio.com>

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Configuración de Resend

### 1. **Crear cuenta en Resend**
1. Ve a [resend.com](https://www.resend.com)
2. Crea una cuenta gratuita
3. Verifica tu correo electrónico

### 2. **Obtener API Key**
1. Ve al dashboard de Resend
2. Navega a **API Keys**
3. Crea una nueva API key
4. Copia la API key generada

### 3. **Configurar dominio (opcional)**
1. Ve a **Domains**
2. Agrega tu dominio
3. Configura los registros DNS

## Funcionalidades Implementadas

### ✅ Correos Automáticos
- **Aprobación**: Se envía cuando un admin aprueba una verificación
- **Rechazo**: Se envía cuando un admin rechaza una verificación con motivo

### ✅ Plantillas HTML
- Diseño responsive y profesional
- Incluye branding de NMHN
- Mensajes personalizados según el estado

### ✅ API Routes
- `/api/send-email` - Endpoint para envío de correos
- Manejo de errores y logging

### ✅ Acciones de Admin
- `approveKyc(userId, reason?)` - Aprueba y envía correo
- `rejectKyc(userId, reason)` - Rechaza y envía correo
- `getKycSubmissions()` - Obtiene verificaciones pendientes

## Uso

```typescript
import { approveKyc, rejectKyc } from '@/app/actions/kyc_admin'

// Aprobar verificación
const result = await approveKyc('user-id-123')

// Rechazar verificación
const result = await rejectKyc('user-id-123', 'Documentos ilegibles')
```

## Próximos Pasos

1. Configurar las variables de entorno con tu API key de Resend
2. Crear panel de administración para usar las acciones
3. Probar el envío de correos
4. Personalizar las plantillas según necesidades

## Ventajas de Resend

- ✅ API moderna y confiable
- ✅ 3,000 correos gratuitos por mes
- ✅ Plantillas HTML avanzadas
- ✅ Analytics de entrega
- ✅ Soporte técnico
- ✅ Sin configuración SMTP compleja

## Estructura de la API

```javascript
const emailData = {
  from: 'NMHN <noreply@tudominio.com>',
  to: ['usuario@ejemplo.com'],
  subject: 'Asunto del correo',
  html: '<h1>Contenido HTML</h1>'
}
```

## Configuración del Cliente

```javascript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
```

## Envío de Correo

```javascript
const data = await resend.emails.send(emailData)
```

