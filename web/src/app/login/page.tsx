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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0c1829] text-slate-100 flex flex-col items-center justify-between py-10 px-4 select-none">
      {/* Imagen de edificios corporativos con mayor luminosidad y nitidez */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: "url('/img/edificios-fondo.jpg')",
          filter: "brightness(0.62) contrast(1.06) saturate(0.95)",
        }}
      />

      {/* Viñeta sutil en bordes para integrar sin apagar los edificios */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(12, 26, 46, 0.12) 0%, rgba(8, 17, 32, 0.65) 100%), linear-gradient(to bottom, rgba(10, 22, 40, 0.25) 0%, rgba(8, 16, 30, 0.55) 100%)",
        }}
      />

      {/* Emblema superior centrado */}
      <header className="relative z-10 flex flex-col items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-[#16243b]/45 backdrop-blur-md shadow-lg">
          <svg
            className="h-6 w-6 text-slate-100/90"
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

      {/* Tarjeta principal tipo cristal translúcido con esquinas suavemente redondeadas */}
      <main className="relative z-10 w-full max-w-2xl rounded-2xl shadow-[0_28px_70px_rgba(4,10,22,0.65)] border border-white/20 bg-[#152238]/42 backdrop-blur-md overflow-hidden">
        {/* Contenido central */}
        <div className="relative z-10 flex flex-col items-center px-6 py-14 md:py-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-[0.42em] text-[#e2be78] uppercase text-center pl-[0.42em] drop-shadow-sm">
            GAPSECURE
          </h1>
          <p className="mt-3 text-[11px] sm:text-xs tracking-[0.28em] uppercase text-slate-100/85 text-center">
            AUDITORÍA AUTOMATIZADA · ISO/IEC 27001:2022
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-10 w-full max-w-sm space-y-5"
          >
            <div>
              <label className="block text-[10px] tracking-[0.24em] uppercase text-slate-200/90 mb-2">
                Correo Corporativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="auditor@empresa.com"
                className="w-full rounded-full border border-white/20 bg-[#0d1829]/65 px-5 py-3 text-sm text-slate-100 placeholder-slate-400 focus:border-[#d4af6a] focus:bg-[#0d1829]/85 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.24em] uppercase text-slate-200/90 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-full border border-white/20 bg-[#0d1829]/65 px-5 py-3 pr-14 text-sm text-slate-100 placeholder-slate-400 focus:border-[#d4af6a] focus:bg-[#0d1829]/85 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] tracking-wider uppercase text-slate-300 hover:text-[#d4af6a] transition-colors"
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/40 bg-red-950/70 px-4 py-2.5 text-center text-xs text-red-200">
                {error}
              </div>
            )}

            <div className="pt-3 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full border border-[#d4af6a] bg-[#d4af6a]/20 px-12 py-3 text-xs font-medium tracking-[0.28em] uppercase text-[#f0d394] hover:bg-[#d4af6a] hover:text-[#121a2a] disabled:opacity-50 transition-all duration-300 shadow-[0_0_25px_rgba(212,175,106,0.25)]"
              >
                {loading ? "VERIFICANDO..." : "INGRESAR"}
              </button>
            </div>
          </form>
        </div>

        {/* Pie interno de la tarjeta */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/15 px-8 py-4 text-[10px] tracking-[0.2em] uppercase text-slate-200/85">
          <div className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SHA-256 ACTIVO</span>
          </div>

          <div className="hidden sm:block">
            <span>TLS 1.3 · SGSI</span>
          </div>
        </div>
      </main>

      {/* Pie de página inferior */}
      <footer className="relative z-10 text-center">
        <p className="text-[11px] font-medium tracking-[0.35em] uppercase text-slate-100/90 drop-shadow">
          GAPSECURE · PLATAFORMA SGSI
        </p>
      </footer>
    </div>
  );
}