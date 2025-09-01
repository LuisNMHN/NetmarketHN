export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border p-6 shadow bg-card text-card-foreground">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Crear cuenta</h1>
            <p className="text-muted-foreground">La primera plataforma P2P diseñada para catrachos 🇭🇳</p>
          </div>

          <form className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Ingresa tu nombre completo"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="tu@ejemplo.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <input
                type="password"
                id="password"
                name="password"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Crea una contraseña segura"
                required
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium mb-2">
                Confirmar contraseña
              </label>
              <input
                type="password"
                id="confirm"
                name="confirm"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Confirma tu contraseña"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl px-4 py-2 font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              style={{ background: "var(--primary)" }}
            >
              Crear cuenta
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <a href="/login" className="font-medium text-primary hover:underline focus:outline-none focus:underline">
                Inicia sesión
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
