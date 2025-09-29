# Lista de Pruebas de la Plataforma NMHN

## Estado Actual
- ✅ Supabase configurado y funcionando
- ✅ Sistema de autenticación operativo
- ✅ Navegación inteligente implementada
- ✅ Validaciones de pasos secuenciales
- ⏳ Sistema de correos pausado (esperando verificación de dominio)

## Funcionalidades a Probar

### 1. **Sistema de Autenticación**
- [ ] Registro de nuevos usuarios
- [ ] Inicio de sesión
- [ ] Recuperación de contraseña
- [ ] Cierre de sesión
- [ ] Persistencia de sesión

### 2. **Dashboard Principal**
- [ ] Carga correcta del dashboard
- [ ] Navegación entre secciones
- [ ] Información del usuario
- [ ] Notificaciones en tiempo real
- [ ] Responsive design

### 3. **Proceso de Verificación KYC**
- [ ] **Paso 1 - Datos Personales**
  - [ ] Validación de campos requeridos
  - [ ] Botón "Continuar" se habilita correctamente
  - [ ] Guardado de datos en base de datos
  - [ ] Navegación al paso 2

- [ ] **Paso 2 - Documentos de Identidad**
  - [ ] Carga de documento frontal
  - [ ] Carga de documento trasero
  - [ ] Validación de formatos de archivo
  - [ ] Navegación al paso 3

- [ ] **Paso 3 - Selfie**
  - [ ] Carga de selfie
  - [ ] Validación de imagen
  - [ ] Navegación al paso 4

- [ ] **Paso 4 - Comprobante de Domicilio**
  - [ ] Carga de comprobante
  - [ ] Validación de documento
  - [ ] Navegación al paso 5

- [ ] **Paso 5 - Revisión Final**
  - [ ] Resumen de todos los datos
  - [ ] Envío de verificación
  - [ ] Confirmación de envío

### 4. **Navegación Inteligente**
- [ ] Redirección al primer paso incompleto
- [ ] Persistencia de estado al recargar
- [ ] Validación de pasos completados
- [ ] Bloqueo de pasos no disponibles

### 5. **Panel de Administración**
- [ ] Acceso al panel de admin
- [ ] Lista de verificaciones pendientes
- [ ] Aprobación de verificaciones
- [ ] Rechazo de verificaciones
- [ ] Filtros y búsqueda

### 6. **Notificaciones en Tiempo Real**
- [ ] Notificación de "en revisión"
- [ ] Notificación de "aprobado"
- [ ] Notificación de "rechazado"
- [ ] Actualización automática de estado

### 7. **Funcionalidades Adicionales**
- [ ] **Gestión de Enlaces**
  - [ ] Creación de enlaces de pago
  - [ ] Lista de enlaces creados
  - [ ] Estadísticas de enlaces

- [ ] **Gestión de Saldo**
  - [ ] Visualización de saldo
  - [ ] Historial de transacciones
  - [ ] Filtros de transacciones

- [ ] **Subastas**
  - [ ] Lista de subastas activas
  - [ ] Participación en subastas
  - [ ] Historial de subastas

### 8. **Responsive Design**
- [ ] Funcionamiento en móviles
- [ ] Funcionamiento en tablets
- [ ] Funcionamiento en desktop
- [ ] Navegación táctil

### 9. **Rendimiento**
- [ ] Tiempo de carga de páginas
- [ ] Tiempo de respuesta de APIs
- [ ] Optimización de imágenes
- [ ] Caching de datos

### 10. **Seguridad**
- [ ] Validación de permisos
- [ ] Protección de rutas
- [ ] Sanitización de datos
- [ ] Validación de archivos

## URLs de Prueba

### Páginas Principales
- **Inicio**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Verificación**: http://localhost:3000/dashboard/verificacion
- **Perfil**: http://localhost:3000/dashboard/perfil
- **Saldo**: http://localhost:3000/dashboard/saldo
- **Enlaces**: http://localhost:3000/dashboard/links
- **Subastas**: http://localhost:3000/dashboard/subastas
- **Transacciones**: http://localhost:3000/dashboard/transacciones

### Panel de Administración
- **Admin**: http://localhost:3000/admin
- **KYC**: http://localhost:3000/admin/kyc
- **Usuarios**: http://localhost:3000/admin/users
- **Reportes**: http://localhost:3000/admin/reports
- **Configuración**: http://localhost:3000/admin/settings

### Autenticación
- **Login**: http://localhost:3000/login
- **Registro**: http://localhost:3000/register
- **Recuperar Contraseña**: http://localhost:3000/forgot-password

## Próximos Pasos

1. **Probar flujo completo de KYC**
2. **Verificar navegación inteligente**
3. **Probar panel de administración**
4. **Verificar notificaciones en tiempo real**
5. **Probar responsive design**
6. **Verificar rendimiento**

## Notas

- El sistema de correos está pausado hasta la verificación del dominio
- Las notificaciones en tiempo real funcionan correctamente
- La navegación inteligente está implementada y funcionando
- Todas las validaciones de pasos están activas

