# app/email_utils.py
import smtplib, ssl, email.utils
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from email.utils import formataddr
from app.config import settings

FROM_NAME = "CELEX CECyT 15 Diódoro Antúnez Echegaray"

def send_email(to_email: str, subject: str, body_html: str, body_text: str | None = None) -> bool:
    from_email = settings.FROM_EMAIL or settings.SMTP_USER

    # ✅ RFC 2047: display name con acentos correctamente codificado
    display_from = formataddr((str(Header(FROM_NAME, "utf-8")), from_email))
    display_to   = to_email  # si quisieras: formataddr((None, to_email))

    msg = MIMEMultipart("alternative")
    msg["From"] = display_from
    msg["To"] = display_to
    msg["Subject"] = str(Header(subject, "utf-8"))
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=from_email.split("@")[-1])
    msg["Reply-To"] = from_email
    msg["List-Unsubscribe"] = f"<mailto:{from_email}?subject=unsubscribe>"

    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        if settings.SMTP_USE_SSL:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
            server.ehlo(); server.starttls(); server.ehlo()

        if settings.SMTP_DEBUG:
            server.set_debuglevel(1)

        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        print(f"✅ Correo enviado a {to_email}: {subject}")
        return True
    except Exception as e:
        print(f"⚠ Error enviando correo a {to_email}: {e}")
        try:
            server.quit()
        except Exception:
            pass
        return False
