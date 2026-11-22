"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUsuario, verificarCodigo2FALogin } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("auditor.prueba@gapsecure.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Estado para el segundo paso (TOTP 6 dígitos)
  const [step2FA, setStep2FA] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code2FA, setCode2FA] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await loginUsuario(email, password);
      if (res.requires_2fa && res.temp_token) {
        setTempToken(res.temp_token);
        setStep2FA(true);
        setCode2FA("");
      } else {
        router.push("/");
      }
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

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken) return;
    setError(null);
    setLoading(true);

    try {
      await verificarCodigo2FALogin(tempToken, code2FA);
      router.push("/");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Código 2FA inválido");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVolverCredenciales = () => {
    setStep2FA(false);
    setTempToken(null);
    setCode2FA("");
    setError(null);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0c1829] text-slate-100 flex flex-col items-center justify-between py-10 px-4 select-none">
      {/* Imagen de edificios corporativos */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{
          backgroundImage: "url('/img/edificios-fondo.jpg')",
          filter: "brightness(0.62) contrast(1.06) saturate(0.95)",
        }}
      />

      {/* Viñeta sutil */}
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

      {/* Tarjeta principal */}
      <main className="relative z-10 w-full max-w-2xl rounded-2xl shadow-[0_28px_70px_rgba(4,10,22,0.65)] border border-white/20 bg-[#152238]/42 backdrop-blur-md overflow-hidden">
        <div className="relative z-10 flex flex-col items-center px-6 py-14 md:py-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-light tracking-[0.42em] text-[#e2be78] uppercase text-center pl-[0.42em] drop-shadow-sm">
            GAPSECURE
          </h1>
          <p className="mt-3 text-[11px] sm:text-xs tracking-[0.28em] uppercase text-slate-100/85 text-center">
            {step2FA
              ? "VERIFICACIÓN EN DOS PASOS · CONTROL A.8.5"
              : "AUDITORÍA AUTOMATIZADA · ISO/IEC 27001:2022"}
          </p>

          {!step2FA ? (
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
          ) : (
            <form
              onSubmit={handleVerify2FA}
              className="mt-10 w-full max-w-sm space-y-5"
            >
              <div className="rounded-2xl border border-[#d4af6a]/30 bg-[#0d1829]/60 p-4 text-center">
                <p className="text-xs text-slate-200">
                  Ingresa el código de 6 dígitos generado por tu aplicación
                  autenticadora para{" "}
                  <span className="font-semibold text-[#f0d394]">{email}</span>.
                </p>
              </div>

              <div>
                <label className="block text-center text-[10px] tracking-[0.24em] uppercase text-slate-200/90 mb-2">
                  Código de Verificación (TOTP)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code2FA}
                  onChange={(e) =>
                    setCode2FA(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="w-full rounded-full border border-[#d4af6a]/50 bg-[#0d1829]/75 px-5 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-[#f0d394] placeholder-slate-500 focus:border-[#d4af6a] focus:outline-none transition-all"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-400/40 bg-red-950/70 px-4 py-2.5 text-center text-xs text-red-200">
                  {error}
                </div>
              )}

              <div className="pt-2 flex flex-col items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || code2FA.length !== 6}
                  className="w-full rounded-full border border-[#d4af6a] bg-[#d4af6a]/20 px-10 py-3 text-xs font-medium tracking-[0.28em] uppercase text-[#f0d394] hover:bg-[#d4af6a] hover:text-[#121a2a] disabled:opacity-50 transition-all duration-300 shadow-[0_0_25px_rgba(212,175,106,0.25)]"
                >
                  {loading ? "VALIDANDO CÓDIGO..." : "CONFIRMAR ACCESO"}
                </button>

                <button
                  type="button"
                  onClick={handleVolverCredenciales}
                  className="text-[11px] tracking-[0.18em] uppercase text-slate-300 hover:text-[#f0d394] transition-colors"
                >
                  ← Volver a credenciales
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pie interno de la tarjeta */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/15 px-8 py-4 text-[10px] tracking-[0.2em] uppercase text-slate-200/85">
          <div className="flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SHA-256 · MFA TOTP</span>
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