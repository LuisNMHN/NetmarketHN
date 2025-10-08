## Configuración de ZeptoMail

Variables de entorno requeridas:
- ZEPTOMAIL_TOKEN: token API de ZeptoMail (Authorization: `Zoho-enczapikey <TOKEN>`)
- ZEPTOMAIL_FROM_EMAIL: remitente verificado (ej. `notificaciones@tudominio.com`)

Opcionales:
- FROM_EMAIL: respaldo si no defines `ZEPTOMAIL_FROM_EMAIL`
- ZEPTOMAIL_TEST_TO: destino por defecto para pruebas
- NEXT_PUBLIC_APP_URL: URL de tu aplicación para enlaces de verificación

Endpoints:
- POST `/api/send-email` con body `{ to, subject, html, type?, userName? }`
- POST `/api/auth/verify-email` con body `{ email, userName, verificationUrl }`
- POST `/api/auth/webhook` (webhook de Supabase para verificación automática)
- GET `/api/test-zeptomail?to=correo@dominio.com` (usa `ZEPTOMAIL_TEST_TO` si no envías `to`)

Páginas:
- `/auth/confirm` - Página de confirmación de email

Notas:
- Se usa `fetch` a `https://api.zeptomail.com/v1.1/email` (sin SDK).
- Plantillas en `lib/email-templates.ts` y `lib/email-templates-verification.ts`.
- Servicio `lib/email-service.ts` y `lib/zeptomail.ts` para envío.
- Webhook configurado para verificación automática de emails.

