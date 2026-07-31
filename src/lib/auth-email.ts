import { Resend } from "resend";

type AuthEmail = {
  to: string;
  subject: string;
  text: string;
};

export async function sendAuthEmail({ to, subject, text }: AuthEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and AUTH_EMAIL_FROM are required");
  }

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    subject,
    text,
  });

  if (error) {
    throw new Error(`Authentication email delivery failed: ${error.message}`);
  }
}
