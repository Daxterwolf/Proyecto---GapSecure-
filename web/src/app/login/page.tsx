"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUsuario } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("auditor.prueba@gapsecure.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await loginUsuario(email, password);
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error de conexión con el servidor SGSI");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#162033] text-slate-100 flex flex-col items-center justify-between py-10 px-4 select-none">
      {/* Iluminación ambiental y sombras diagonales suaves estilo editorial */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(56, 78, 114, 0.35), transparent 50%), radial-gradient(circle at 80% 75%, rgba(45, 65, 98, 0.4), transparent 55%), linear-gradient(125deg, #121a2a 0%, #1d293f 48%, #141d2e 100%)",
        }}
      />

      {/* Emblema superior centrado */}
      <header className="relative z-10 flex flex-col items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-400/20 bg-slate-800/40 backdrop-blur-sm shadow-lg">
          <svg
            className="h-6 w-6 text-slate-300/80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3l7 3v6c0 4.97-3.05 8.85-7 10-3.95-1.15-7-5.03-7-10V6l7-3z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.5 12.2l1.8 1.8 3.5-3.8"
            />
          </svg>
        </div>
      </header>

      {/* Tarjeta principal con estética arquitectónica oscura y acentos dorados */}
      <main className="relative z-10 w-full max-w-4xl shadow-[0_28px_70px_rgba(5,10,20,0.65)] border border-slate-400/15 bg-[#1b273d]/90 backdrop-blur-md overflow-hidden">
        {/* Patrón geométrico/arquitectónico sutil de fondo */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 36px), linear-gradient(to bottom, rgba(15,23,42,0.2), rgba(15,23,42,0.85))",
          }}
        />

        {/* Contenido central: Título espaciado en dorado y formulario limpio */}
        <div className="relative z-10 flex flex-col items-center px-6 py-14 md:py-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-[0.42em] text-[#d4af6a] uppercase text-center pl-[0.42em]">
            GAPSECURE
          </h1>
          <p className="mt-3 text-[11px] sm:text-xs tracking-[0.28em] uppercase text-slate-300/80 text-center">
            AUDITORÍA AUTOMATIZADA · ISO/IEC 27001:2022
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-10 w-full max-w-sm space-y-5"
          >
            <div>
              <label className="block text-[10px] tracking-[0.24em] uppercase text-slate-300/75 mb-2">
                Correo Corporativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="auditor@empresa.com"
                className="w-full rounded-full border border-slate-400/25 bg-[#121b2c]/75 px-5 py-3 text-sm text-slate-100 placeholder-slate-500 focus:border-[#d4af6a] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.24em] uppercase text-slate-300/75 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-full border border-slate-400/25 bg-[#121b2c]/75 px-5 py-3 pr-14 text-sm text-slate-100 placeholder-slate-500 focus:border-[#d4af6a] focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] tracking-wider uppercase text-slate-400 hover:text-[#d4af6a] transition-colors"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/30 bg-red-950/50 px-4 py-2.5 text-center text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="pt-3 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full border border-[#d4af6a] bg-[#d4af6a]/10 px-12 py-3 text-xs font-medium tracking-[0.28em] uppercase text-[#e6c687] hover:bg-[#d4af6a] hover:text-[#121a2a] disabled:opacity-50 transition-all duration-300 shadow-[0_0_25px_rgba(212,175,106,0.15)]"
              >
                {loading ? "VERIFICANDO..." : "INGRESAR"}
              </button>
            </div>
          </form>
        </div>

        {/* Pie interno de la tarjeta */}
        <div className="relative z-10 flex items-center justify-between px-8 pb-6 pt-2 text-[10px] tracking-[0.2em] uppercase text-slate-400/80">
          <div className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>SHA-256 ACTIVO</span>
          </div>

          <div className="hidden sm:block">
            <span>TLS 1.3 · SGSI</span>
          </div>
        </div>
      </main>

      {/* Pie de página inferior */}
      <footer className="relative z-10 text-center">
        <p className="text-[11px] font-medium tracking-[0.35em] uppercase text-slate-200/80">
          GAPSECURE · PLATAFORMA SGSI
        </p>
      </footer>
    </div>
  );
}