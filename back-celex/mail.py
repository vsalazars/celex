# mail_titan_test.py
import smtplib, ssl
from smtplib import SMTPAuthenticationError, SMTPException
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_HOST = "smtp.titan.email"
SMTP_PORT = 465  # SSL directo
SMTP_USER = "celex@upiita.mx"
SMTP_PASS = "romi.2025"  # <-- cámbiala por la real

def main():
    to_email = input("📨 Ingresa correo destino de prueba: ").strip()

    subject = "Prueba SMTP Titan (SSL 465)"
    text_body = """\
Hola 👋,

Este es un correo de prueba enviado desde Python via Titan (HostGator).
Usando puerto 465 (SSL directo).

✅ Si ves este correo, todo funciona.
"""
    html_body = """\
<html>
  <body>
    <p>Hola 👋,<br><br>
       Prueba de envío con <b>Titan</b> vía <code>SMTP SSL 465</code> desde Python.<br>
       ✅ Si ves este correo, todo funciona.<br>
    </p>
  </body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_USER            # OBLIGATORIO: debe ser la misma cuenta Titan
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    server = None
    try:
        print(f"[DEBUG] Conectando a {SMTP_HOST}:{SMTP_PORT} con SSL ...")
        context = ssl.create_default_context()
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=30)
        server.set_debuglevel(1)  # 🔥 Log detallado del diálogo SMTP

        print(f"[DEBUG] Autenticando como {SMTP_USER} ...")
        server.login(SMTP_USER, SMTP_PASS)

        print(f"[DEBUG] Enviando a {to_email} ...")
        server.sendmail(msg["From"], [to_email], msg.as_string())
        print("✅ Correo enviado con éxito.")
    except SMTPAuthenticationError as e:
        print(f"❌ SMTPAuthenticationError: {e}\n"
              "Revisa:\n"
              "  1) Usuario/contraseña correctos.\n"
              "  2) ‘Enable Titan on other apps’ ACTIVADO.\n"
              "  3) 2FA DESACTIVADO para permitir SMTP de terceros.\n"
              "  4) ‘From’ = misma cuenta Titan (celex@upiita.mx).\n")
    except SMTPException as e:
        print(f"❌ SMTPException: {e}")
    except Exception as e:
        print(f"❌ Error genérico: {e}")
    finally:
        try:
            if server is not None:
                server.quit()
        except:
            pass

if __name__ == "__main__":
    main()
