import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { IconInput } from "../components/IconInput";
import { IconLock, IconLogin, IconUser } from "../components/icons";

const RUTA_POR_ROL: Record<string, string> = {
  cajero: "/caja",
  cocina: "/cocina",
  parrilla: "/parrilla",
  entrega: "/entrega",
  admin: "/admin",
  empleado: "/asistencia",
};

export function LoginPage() {
  const { login, cargando, error } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const usuario = await login(username, password);
      navigate(RUTA_POR_ROL[usuario.rol] ?? "/login", { replace: true });
    } catch {
      // El mensaje de error ya se muestra vía el estado `error` de useAuth.
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-100 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm sm:p-8"
      >
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">BRASA ARISP</h1>
        <p className="mb-6 text-sm text-neutral-500">Ingresa con tu usuario de estación</p>

        <label htmlFor="login-username" className="mb-1 block text-sm font-medium text-neutral-700">
          Usuario
        </label>
        <IconInput
          id="login-username"
          icon={IconUser}
          className="mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />

        <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-neutral-700">
          Contraseña
        </label>
        <IconInput
          id="login-password"
          icon={IconLock}
          type="password"
          className="mb-6"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-base font-semibold text-white active:bg-neutral-700 disabled:opacity-50"
        >
          <IconLogin />
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
