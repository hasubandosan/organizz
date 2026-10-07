// Отправка писем через Brevo (HTTP API: на бесплатном Render обычная почта/SMTP заблокирована).
// Переменные окружения: BREVO_API_KEY (ключ API), MAIL_FROM (подтверждённая в Brevo почта-отправитель),
// MAIL_FROM_NAME (необязательно, по умолчанию «LifeOS»).

export class MailNotConfigured extends Error {}
export class MailSendFailed extends Error {}

const TITLES: Record<string, { subject: string; lead: string }> = {
  register: { subject: 'LifeOS: код подтверждения почты', lead: 'Код для подтверждения почты' },
  reset: { subject: 'LifeOS: код для смены пароля', lead: 'Код для смены пароля' },
};

export async function sendCodeMail(to: string, code: string, purpose: 'register' | 'reset'): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) throw new MailNotConfigured('Отправка почты не настроена');
  const t = TITLES[purpose];
  const html = `<div style="font-family:Arial,sans-serif;max-width:420px">
<p>${t.lead}:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:12px 0">${code}</p>
<p style="color:#666">Код действует 15 минут. Если вы ничего не запрашивали — просто проигнорируйте письмо.</p></div>`;

  let res: Response;
  try {
    res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.MAIL_FROM_NAME || 'LifeOS', email: from },
        to: [{ email: to }],
        subject: t.subject,
        htmlContent: html,
        textContent: `${t.lead}: ${code}\nКод действует 15 минут.`,
      }),
    });
  } catch (e) {
    console.error('Brevo: нет связи', e instanceof Error ? e.message : e);
    throw new MailSendFailed('network');
  }
  if (!res.ok) {
    console.error('Brevo: ошибка отправки', res.status, (await res.text().catch(() => '')).slice(0, 300));
    throw new MailSendFailed(String(res.status));
  }
}
