import bcrypt
from getpass import getpass

def main():
    pwd = getpass("Escribe la contraseña: ")
    if len(pwd) < 6:
        print("❌ La contraseña debe tener al menos 6 caracteres.")
        return

    hashed = bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt())
    print("\n✅ Hash generado (guárdalo en la BD en hashed_password):\n")
    print(hashed.decode("utf-8"))

if __name__ == "__main__":
    main()
