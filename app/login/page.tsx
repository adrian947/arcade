import { LoginForm } from "./login-form";

// Credenciales de prueba precargadas desde EMAIL_LOGIN / PASSWORD_LOGIN.
// Solo en desarrollo: en producción el formulario arranca vacío y no se envían al cliente.
export default function LoginPage() {
  const dev = process.env.NODE_ENV === "development";
  return (
    <LoginForm
      defaultEmail={dev ? process.env.EMAIL_LOGIN : undefined}
      defaultPassword={dev ? process.env.PASSWORD_LOGIN : undefined}
    />
  );
}
