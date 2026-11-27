import { schema, type AnyDb } from "@astro/db";
import { Resend } from "resend";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

interface MailerConfig {
  driver: "resend" | "outbox";
  from: string;
  apiKey?: string;
  db: AnyDb;
}

/** `resend` sends through Resend. `outbox` (development and tests only) stores the message in `mail_outbox`. */
export function createMailer({ driver, from, apiKey, db }: MailerConfig): Mailer {
  if (driver === "outbox") {
    return {
      async send({ to, subject, text }) {
        await db.insert(schema.mailOutbox).values({ to, subject, text });
      }
    };
  }
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const resend = new Resend(apiKey);
  return {
    async send({ to, subject, text, html }) {
      const { error } = await resend.emails.send({ from, to, subject, text, html });
      if (error) throw new Error(`Email could not be sent: ${error.name}`);
    }
  };
}
