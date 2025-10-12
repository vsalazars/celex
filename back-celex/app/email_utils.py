# app/email_utils.py
import json
import urllib.request
import urllib.error
from typing import Optional
from app.config import settings

MAILJET_API_URL = "https://api.mailjet.com/v3.1/send"


def _send_via_mailjet_api(
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """
    Envío de correos usando la API HTTPS de Mailjet (no SMTP).
    """
    api_key = getattr(settings, "MAILJET_API_KEY", None)
    api_secret = getattr(settings, "MAILJET_API_SECRET", None)

    if not api_key or not api_secret:
        print("⚠ MAILJET_API_KEY o MAILJET_API_SECRET no configuradas.")
        return False

    payload = {
        "Messages": [
            {
                "From": {"Email": from_email, "Name": from_name},
                "To": [{"Email": to_email}],
                "Subject": subject,
                "TextPart": body_text or "",
                "HTMLPart": body_html,
                "CustomID": "CELEXEmail",
            }
        ]
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        MAILJET_API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )

    # Autenticación básica HTTP
    import base64
    auth_header = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    req.add_header("Authorization", f"Basic {auth_header}")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.getcode()
            body = resp.read().decode("utf-8", errors="ignore")
            if 200 <= status < 300:
                print(f"✅ [Mailjet] Correo enviado a {to_email}")
                return True
            else:
                print(f"⚠ [Mailjet API] Status {status}: {body}")
                return False
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="ignore")
        except Exception:
            body = str(e)
        print(f"⚠ [Mailjet API] HTTPError {e.code}: {body}")
        return False
    except Exception as e:
        print(f"⚠ [Mailjet API] Error general: {e}")
        return False


def send_email(to_email: str, subject: str, body_html: str, body_text: Optional[str] = None) -> bool:
    """
    API de envío unificada. Usa Mailjet vía HTTPS 443.
    """
    from_email = getattr(settings, "FROM_EMAIL", None)
    from_name = getattr(settings, "FROM_NAME", "CELEX")
    if not from_email:
        print("⚠ FROM_EMAIL no configurado.")
        return False

    return _send_via_mailjet_api(from_email, from_name, to_email, subject, body_html, body_text)
