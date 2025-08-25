# scripts/create_superuser.py
import re
from getpass import getpass

from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash  # debe existir en app/auth.py

CURP_REGEX = re.compile(r"^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$", re.IGNORECASE)

def split_name(full: str):
    parts = [p for p in full.strip().split() if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])

def main():
    print("=== Crear superusuario ===")
    email = input("Email: ").strip().lower()
    full_name = input("Nombre completo: ").strip()
    curp = input("CURP (18 caracteres): ").strip().upper()

    if not CURP_REGEX.match(curp):
        print("❌ CURP inválido. Debe tener 18 caracteres con formato oficial.")
        return

    pwd = getpass("Contraseña: ")
    pwd2 = getpass("Repite la contraseña: ")
    if pwd != pwd2:
        print("❌ Las contraseñas no coinciden.")
        return
    if len(pwd) < 6:
        print("❌ La contraseña debe tener al menos 6 caracteres.")
        return

    first_name, last_name = split_name(full_name)

    db = SessionLocal()
    try:
        # ¿ya existe?
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print("❌ Ya existe un usuario con ese email.")
            return

        existing_curp = db.query(User).filter(User.curp == curp).first()
        if existing_curp:
            print("❌ Ya existe un usuario con ese CURP.")
            return

        user = User(
            first_name=first_name or "Admin",
            last_name=last_name or "CELEX",
            email=email,
            email_verified=True,
            is_ipn=False,
            boleta=None,
            curp=curp,
            role="superuser",              # roles: student | teacher | coordinator | admin | superadmin
            hashed_password=get_password_hash(pwd),
            is_active=True,
        )
        db.add(user)
        db.commit()
        print("✅ Superusuario creado:", email)
    finally:
        db.close()

if __name__ == "__main__":
    main()
