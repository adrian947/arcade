import { Resend } from "resend";

type ContactResponse = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const HAS_NEWLINE = /[\r\n]/;

const reply = (body: ContactResponse, status = 200) => Response.json(body, { status });

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return reply({ ok: false, error: "Solicitud inválida." }, 400);
  }

  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const name = str(payload.name).trim();
  const email = str(payload.email).trim();
  const message = str(payload.message).trim();
  const website = str(payload.website);

  // Honeypot: bots rellenan este campo oculto. Fingimos éxito sin enviar nada.
  if (website !== "") return reply({ ok: true });

  if (!name || name.length > 80 || HAS_NEWLINE.test(name)) {
    return reply({ ok: false, error: "Nombre inválido (1–80 caracteres)." }, 400);
  }
  if (!email || email.length > 254 || HAS_NEWLINE.test(email) || !EMAIL_RE.test(email)) {
    return reply({ ok: false, error: "Correo electrónico inválido." }, 400);
  }
  if (!message || message.length > 2000) {
    return reply({ ok: false, error: "Mensaje inválido (1–2000 caracteres)." }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) {
    return reply({ ok: false, error: "El servicio de contacto no está configurado." }, 500);
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`,
    });
    if (error) {
      return reply({ ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." }, 502);
    }
  } catch {
    return reply({ ok: false, error: "No se pudo enviar el mensaje. Inténtalo de nuevo." }, 502);
  }

  return reply({ ok: true });
}
