# app/email_utils.py
import logging, email.utils, ssl, smtplib, requests, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from email.utils import formataddr
from app.config import settings

FROM_NAME = "CELEX CECyT 15 Diódoro Antúnez Echegaray"

def _build_mime(from_email: str, to_email: str, subject: str, body_html: str, body_text: str | None):
    display_from = formataddr((str(Header(FROM_NAME, "utf-8")), from_email))
    msg = MIMEMultipart("alternative")
    msg["From"] = display_from
    msg["To"] = to_email
    msg["Subject"] = str(Header(subject, "utf-8"))
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=from_email.split("@")[-1])
    msg["Reply-To"] = from_email
    msg["List-Unsubscribe"] = f"<mailto:{from_email}?subject=unsubscribe>"
    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    return msg

def _send_via_resend(to_email: str, subject: str, body_html: str, body_text: str | None) -> bool:
    api_key = (settings.RESEND_API_KEY or "").strip()
    if not api_key:
        logging.error("❌ Resend: falta RESEND_API_KEY")
        return False

    # Forzar destino de pruebas si está configurado (Resend test mode)
    test_to = (os.getenv("RESEND_TEST_TO") or "").strip()
    if test_to:
        logging.warning(f"🔒 RESEND_TEST_TO activo: enviando a {test_to} en lugar de {to_email}")
        to_email = test_to

    # Si el dominio no está verificado, usa onboarding@resend.dev
    sender = (settings.RESEND_FROM or "CELEX UPIITA <onboarding@resend.dev>").strip()
    if "@resend.dev" not in sender and "@onboarding" not in sender:
        logging.warning(f"⚠️ Dominio no verificado. Usando fallback onboarding@resend.dev en lugar de {sender}")
        sender = "CELEX UPIITA <onboarding@resend.dev>"

    try:
        payload = {"from": sender, "to": [to_email], "subject": subject, "html": body_html}
        if body_text:
            payload["text"] = body_text

        r = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=15,
        )

        if r.status_code >= 400:
            logging.error(f"❌ Resend HTTP {r.status_code}: {r.text}")
        r.raise_for_status()

        data = r.json()
        logging.info(f"✅ Resend OK → {to_email} ({subject}) id={data.get('id')}")
        return True
    except Exception as e:
        logging.exception(f"❌ Resend error: {e}")
        return False

def _send_via_smtp(to_email: str, subject: str, body_html: str, body_text: str | None) -> bool:
    from_email = settings.FROM_EMAIL or settings.SMTP_USER
    host = settings.SMTP_HOST
    port = int(settings.SMTP_PORT or 587)
    use_ssl = bool(settings.SMTP_USE_SSL)
    debug = bool(settings.SMTP_DEBUG)
    msg = _build_mime(from_email, to_email, subject, body_html, body_text)

    ctx = ssl.create_default_context()
    server = None
    try:
        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=15, context=ctx)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo(); server.starttls(context=ctx); server.ehlo()
        if debug:
            server.set_debuglevel(1)
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(from_email, [to_email], msg.as_string())
        logging.info(f"✅ SMTP OK → {to_email} ({subject})")
        return True
    except Exception as e:
        logging.exception(f"❌ SMTP error: {e}")
        return False
    finally:
        try:
            if server: server.quit()
        except Exception:
            pass

def send_email(to_email: str, subject: str, body_html: str, body_text: str | None = None) -> bool:
    # 1) Resend primero
    if _send_via_resend(to_email, subject, body_html, body_text):
        return True
    # 2) Fallback SMTP (solo útil en local; en DO está bloqueado)
    return _send_via_smtp(to_email, subject, body_html, body_text)
