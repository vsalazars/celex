# app/email_utils.py
import json
import urllib.request
import urllib.error
from typing import Optional, Tuple, Dict, Any
from app.config import settings

POSTMARK_API_URL = "https://api.postmarkapp.com/email"


def _postmark_request(payload: dict, server_token: str) -> Tuple[bool, int, str, Optional[dict]]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        POSTMARK_API_URL,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": server_token,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.getcode()
            raw = resp.read().decode("utf-8", errors="ignore")
            body_json = None
            try:
                body_json = json.loads(raw) if raw else None
            except Exception:
                body_json = None
            return (200 <= status < 300, status, raw, body_json)
    except urllib.error.HTTPError as e:
        try:
            raw = e.read().decode("utf-8", errors="ignore")
        except Exception:
            raw = str(e)
        body_json = None
        try:
            body_json = json.loads(raw)
        except Exception:
            body_json = None
        return (False, e.code, raw, body_json)
    except Exception as e:
        return (False, 0, f"{e}", None)


def _interpret_postmark_result(ok: bool, status: int, raw: str, body_json: Optional[dict]) -> Dict[str, Any]:
    """
    Normaliza la respuesta de Postmark para que puedas registrar/mostrar causas comunes.
    No lanza excepciones; devuelve un dict con campos útiles.
    """
    result: Dict[str, Any] = {
        "ok": ok,
        "http_status": status,
        "raw": raw,
        "message_id": None,
        "to": None,
        "error_code": None,
        "error_message": None,
        "hint": None,  # recomendación de qué hacer
    }

    if body_json:
        # OK típico: {"To":"x@y","SubmittedAt":"...","MessageID":"...","ErrorCode":0,"Message":"OK"}
        result["to"] = body_json.get("To")
        result["message_id"] = body_json.get("MessageID")
        result["error_code"] = body_json.get("ErrorCode")
        result["error_message"] = body_json.get("Message")

    # Hints para causas frecuentes
    if not ok:
        # Test mode: dominio distinto
        if status == 422 and body_json and body_json.get("ErrorCode") == 412:
            result["hint"] = (
                "En Test mode solo puedes enviar a tu mismo dominio (upiita.mx) "
                "o a test@blackhole.postmarkapp.com. Solicita aprobación para enviar a externos."
            )
        # Stream inexistente
        if status == 422 and body_json and body_json.get("ErrorCode") == 1235:
            result["hint"] = (
                "El MessageStream no existe en este Server. Usa 'POSTMARK_MESSAGE_STREAM=outbound' "
                "o elimina la variable para que use el default."
            )
        # Destinatario inactivo/suprimido (rebote previo)
        if status == 422 and body_json and body_json.get("ErrorCode") in (406, 409):
            result["hint"] = (
                "El destinatario está suprimido (bounce/complaint previo). Debes eliminarlo de la supresión "
                "o usar otra dirección."
            )
        # Email inválido
        if status == 422 and body_json and body_json.get("ErrorCode") in (300,):
            result["hint"] = "El email parece inválido para Postmark. Verifica el formato del destinatario."

    return result


def _send_via_postmark_api(
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    message_stream: Optional[str] = None,
    tag: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Envío de correos usando la API HTTPS de Postmark (no SMTP).
    Devuelve un dict con detalles: ok, http_status, message_id, error_code, error_message, hint, raw.
    """
    server_token = getattr(settings, "POSTMARK_SERVER_TOKEN", None)
    if not server_token:
        msg = "⚠ POSTMARK_SERVER_TOKEN no configurado."
        print(msg)
        return {"ok": False, "http_status": 0, "raw": msg, "error_code": None, "error_message": msg}

    # Si no configuras stream, dejamos que Postmark use el default (transaccional: 'outbound').
    stream = message_stream or getattr(settings, "POSTMARK_MESSAGE_STREAM", None)

    payload = {
        "From": f"{from_name} <{from_email}>" if from_name else from_email,
        "To": to_email,
        "Subject": subject,
        "HtmlBody": body_html,
        "TextBody": body_text or "",
    }
    if stream:
        payload["MessageStream"] = stream
    if tag:
        payload["Tag"] = tag

    ok, status, raw, body_json = _postmark_request(payload, server_token)
    result = _interpret_postmark_result(ok, status, raw, body_json)

    if result["ok"]:
        print(f"✅ [Postmark] Correo enviado a {to_email} (stream={stream or 'default'}) MessageID={result['message_id']}")
    else:
        print(f"⚠ [Postmark API] HTTP {status}: {result.get('error_message') or raw}")
        if result.get("hint"):
            print(f"👉 Sugerencia: {result['hint']}")

    return result


def send_email_with_result(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    tag: Optional[str] = "CELEXEmail",
) -> Dict[str, Any]:
    """
    Úsala cuando necesites saber el motivo exacto si falla (MessageID, ErrorCode, hint, etc.).
    """
    from_email = getattr(settings, "FROM_EMAIL", None)
    from_name = getattr(settings, "FROM_NAME", "CELEX")
    if not from_email:
        msg = "⚠ FROM_EMAIL no configurado."
        print(msg)
        return {"ok": False, "http_status": 0, "raw": msg}

    return _send_via_postmark_api(
        from_email=from_email,
        from_name=from_name,
        to_email=to_email,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
        message_stream=getattr(settings, "POSTMARK_MESSAGE_STREAM", None),
        tag=tag,
    )


def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    tag: Optional[str] = "CELEXEmail",
) -> bool:
    """
    Compatibilidad hacia atrás: devuelve solo True/False.
    """
    result = send_email_with_result(to_email, subject, body_html, body_text, tag)
    return bool(result.get("ok"))
