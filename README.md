## NetmarketHN - Autenticación Supabase + Next.js

### Requisitos
- Node 18+
- Variables de entorno en `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://hnjxnwmvkgqetkwurvcv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuanhud212a2dxZXRrd3VydmN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwOTIyMzYsImV4cCI6MjA3MTY2ODIzNn0.CS8d12RmcbOVb7BWODfiQVh5gBLb5u8HATHgYJgILBI
```

Tips: si faltan estas env verás avisos en consola al cargar las páginas de auth.

### Instalación y ejecución
```
npm install
npm run dev
```
Abre `http://localhost:3000`.

### Rutas
- `/register`: registro con email/contraseña. Guarda `full_name` en `profiles` vía `user_metadata`. Tras registro: mensaje “Revisa tu correo”. Si hay sesión, redirige a `/dashboard`.
- `/login`: inicio de sesión con Supabase. Si éxito, redirige a `/dashboard`.
- `/dashboard`: ruta protegida. Se obtiene la sesión en el servidor y se consulta `profiles(full_name)` por `session.user.id`. Incluye botón “Cerrar sesión”.

### Notas de Base de Datos
- Crea la tabla `profiles` en Supabase con al menos: `id uuid primary key references auth.users on delete cascade`, `full_name text`.

