"""
db.py - SQLite Database & Data Collection Engine for toffee.ai
Manages persistent storage for users, authentication, OTP records, sessions,
voice biometric profiles, AI document reader records, and audit activity logs.
"""

import sqlite3
import hashlib
import hmac
import os
import json
import time
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "toffee.db"


def get_db_connection():
    """Get a thread-safe connection to the SQLite database with row-factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Initialize the SQLite database schema and tables."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        auth_provider TEXT DEFAULT 'email',
        role TEXT DEFAULT 'developer',
        voice_enrolled INTEGER DEFAULT 0,
        voice_passphrase TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
    );
    """)

    # 2. OTP Verification Records
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otp_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        otp_type TEXT NOT NULL, -- 'email' or 'phone'
        intent TEXT NOT NULL,   -- 'signup', 'login', 'voice_reset'
        expires_at TEXT NOT NULL,
        is_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );
    """)

    # 3. User Sessions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        auth_method TEXT NOT NULL, -- 'password', 'otp', 'voice_biometric'
        ip_address TEXT,
        user_agent TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # 4. Voice Biometric Profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS voice_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        passphrase TEXT NOT NULL,
        feature_vector_json TEXT NOT NULL, -- Acoustic spectral centroid, pitch, energy vectors
        confidence_threshold REAL DEFAULT 0.70,
        sample_count INTEGER DEFAULT 1,
        enrolled_at TEXT NOT NULL,
        last_matched_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # 5. AI Document Reader & OCR Records
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        doc_name TEXT NOT NULL,
        doc_type TEXT DEFAULT 'document',
        file_size INTEGER DEFAULT 0,
        extracted_text TEXT NOT NULL,
        confidence REAL DEFAULT 0.95,
        entities_json TEXT DEFAULT '{}',
        summary TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    );
    """)

    # 6. Activity & Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details_json TEXT DEFAULT '{}',
        ip_address TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    );
    """)

    # Create Indexes for high performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_otp_identifier ON otp_records(identifier, otp_code);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);")

    conn.commit()

    # Seed demo account if empty
    seed_demo_account(cursor, conn)
    conn.close()


def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Hash a password using PBKDF2-HMAC-SHA256 with cryptographic salt."""
    if not salt:
        salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations=100000
    ).hex()
    return pw_hash, salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """Verify password against stored hash using constant-time comparison."""
    computed_hash, _ = hash_password(password, salt)
    return hmac.compare_digest(computed_hash, expected_hash)


def seed_demo_account(cursor, conn):
    """Seed a default demo user and sample documents if database is newly created."""
    cursor.execute("SELECT COUNT(*) FROM users;")
    if cursor.fetchone()[0] == 0:
        now = datetime.now(timezone.utc).isoformat()
        pw_hash, salt = hash_password("ToffeeDemo2026!", "toffee_demo_salt")

        # Demo voice vector features (normalized spectral signature)
        demo_voice_vector = [0.42, 0.58, 0.71, 0.39, 0.65, 0.82, 0.49, 0.61, 0.77, 0.53]

        cursor.execute("""
        INSERT INTO users (name, email, phone, password_hash, salt, auth_provider, role, voice_enrolled, voice_passphrase, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            "Alex Mercer (Lead Architect)",
            "alex@toffee.ai",
            "+1-800-863-3332",
            pw_hash,
            salt,
            "email",
            "lead_architect",
            1,
            "my voice is my secure password in toffee ai",
            now,
            now
        ))
        user_id = cursor.lastrowid

        # Seed Voice Profile
        cursor.execute("""
        INSERT INTO voice_profiles (user_id, passphrase, feature_vector_json, confidence_threshold, sample_count, enrolled_at)
        VALUES (?, ?, ?, ?, ?, ?);
        """, (
            user_id,
            "my voice is my secure password in toffee ai",
            json.dumps(demo_voice_vector),
            0.70,
            3,
            now
        ))

        # Seed Initial Document Sample
        sample_doc_text = """
TOFFEE CLOUD INFRASTRUCTURE INVOICE & SERVICE SLA
Invoice ID: INV-2026-9042
Date: September 10, 2026
Vendor: Toffee AI Cloud Systems, Inc.
Client: HyperScale SaaS Enterprise
Amount Due: $14,850.00 USD
Payment Status: Verified & Cleared via Edge Billing Gateway

Items:
1. Sub-15ms Edge Telemetry Clusters (us-east, eu-central, ap-south) - $6,400.00
2. Autonomous Multi-Cloud Chaos Failover Engine - $4,200.00
3. Biometric Voice Security & Zero-Trust WAF - $2,750.00
4. Dedicated AI Architecture Copilot API (10M requests) - $1,500.00

Total Tax (0% Global Zero-Tier): $0.00
Grand Total: $14,850.00
Contact: billing@toffee.ai | +1-800-863-3332
SLA Guarantee: 99.999% Uptime with automated instant failover.
"""
        sample_entities = {
            "invoice_id": "INV-2026-9042",
            "date": "2026-09-10",
            "amount": "$14,850.00",
            "vendor": "Toffee AI Cloud Systems, Inc.",
            "emails": ["billing@toffee.ai"],
            "phones": ["+1-800-863-3332"],
            "currency": "USD"
        }
        sample_summary = "Production cloud services invoice totaling $14,850.00 for edge telemetry, chaos failover, biometric security, and AI Copilot API."

        cursor.execute("""
        INSERT INTO documents (user_id, doc_name, doc_type, file_size, extracted_text, confidence, entities_json, summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            user_id,
            "toffee_cloud_invoice_2026.png",
            "invoice",
            42890,
            sample_doc_text.strip(),
            0.985,
            json.dumps(sample_entities),
            sample_summary,
            now
        ))

        # Seed Initial Activity Log
        cursor.execute("""
        INSERT INTO activity_logs (user_id, action, details_json, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?);
        """, (
            user_id,
            "system_init",
            json.dumps({"info": "Demo environment seeded with voice biometric profile and sample document"}),
            "127.0.0.1",
            now
        ))

        conn.commit()


# ---------------------------------------------------------------------------
# OTP Service
# ---------------------------------------------------------------------------

def create_otp(identifier: str, otp_type: str, intent: str = "signup") -> str:
    """Generate a 6-digit cryptographic OTP and store in SQLite with 10 min expiry."""
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(minutes=10)).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Invalidate previous unverified OTPs for this identifier
    cursor.execute("""
    DELETE FROM otp_records WHERE identifier = ? AND intent = ?;
    """, (identifier.strip().lower(), intent))

    cursor.execute("""
    INSERT INTO otp_records (identifier, otp_code, otp_type, intent, expires_at, is_verified, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?);
    """, (identifier.strip().lower(), otp_code, otp_type, intent, expires_at, now.isoformat()))

    conn.commit()
    conn.close()
    return otp_code


def verify_otp(identifier: str, otp_code: str, intent: str = "signup") -> bool:
    """Verify submitted OTP code against active SQLite record."""
    clean_id = identifier.strip().lower()
    clean_otp = str(otp_code).strip()
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, expires_at FROM otp_records
    WHERE identifier = ? AND otp_code = ? AND intent = ? AND is_verified = 0;
    """, (clean_id, clean_otp, intent))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    rec_id, expires_at = row["id"], row["expires_at"]
    if expires_at < now_iso:
        conn.close()
        return False

    # Mark as verified
    cursor.execute("UPDATE otp_records SET is_verified = 1 WHERE id = ?;", (rec_id,))
    conn.commit()
    conn.close()
    return True


# ---------------------------------------------------------------------------
# User & Authentication Service
# ---------------------------------------------------------------------------

def register_user(name: str, identifier: str, id_type: str, password: str, otp_code: str = None) -> dict:
    """Register a new user after OTP verification."""
    clean_id = identifier.strip().lower()
    clean_name = name.strip()

    if not clean_name:
        raise ValueError("Full name is required.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters long.")

    # Check if user already exists
    conn = get_db_connection()
    cursor = conn.cursor()

    email_val = clean_id if id_type == "email" else None
    phone_val = clean_id if id_type == "phone" else None

    if email_val:
        cursor.execute("SELECT id FROM users WHERE email = ?;", (email_val,))
        if cursor.fetchone():
            conn.close()
            raise ValueError("An account with this email already exists. Please log in.")
    elif phone_val:
        cursor.execute("SELECT id FROM users WHERE phone = ?;", (phone_val,))
        if cursor.fetchone():
            conn.close()
            raise ValueError("An account with this phone number already exists. Please log in.")

    # Verify OTP if provided
    if otp_code:
        if not verify_otp(clean_id, otp_code, intent="signup"):
            conn.close()
            raise ValueError("Invalid or expired verification OTP. Please request a new code.")

    pw_hash, salt = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO users (name, email, phone, password_hash, salt, auth_provider, role, voice_enrolled, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?, 'developer', 0, ?, ?, ?);
    """, (clean_name, email_val, phone_val, pw_hash, salt, id_type, now, now, now))

    user_id = cursor.lastrowid

    # Create session
    session_token = secrets.token_urlsafe(32)
    session_expiry = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    cursor.execute("""
    INSERT INTO sessions (id, user_id, auth_method, expires_at, created_at)
    VALUES (?, ?, 'password', ?, ?);
    """, (session_token, user_id, session_expiry, now))

    # Log action
    log_activity(cursor, user_id, "signup", {"provider": id_type, "identifier": clean_id})

    conn.commit()

    user_data = {
        "id": user_id,
        "name": clean_name,
        "email": email_val,
        "phone": phone_val,
        "role": "developer",
        "voice_enrolled": False,
        "token": session_token,
        "created_at": now
    }
    conn.close()
    return user_data


def authenticate_user(identifier: str, password: str = None, otp_code: str = None, auth_method: str = "password") -> dict:
    """Authenticate a user via password or OTP."""
    clean_id = identifier.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT id, name, email, phone, password_hash, salt, role, voice_enrolled, voice_passphrase
    FROM users
    WHERE email = ? OR phone = ?;
    """, (clean_id, clean_id))

    user = cursor.fetchone()
    if not user:
        conn.close()
        raise ValueError("No account found matching this email or phone.")

    if auth_method == "password":
        if not password or not verify_password(password, user["salt"], user["password_hash"]):
            conn.close()
            raise ValueError("Incorrect password. Please try again.")
    elif auth_method == "otp":
        if not otp_code or not verify_otp(clean_id, otp_code, intent="login"):
            conn.close()
            raise ValueError("Invalid or expired login OTP code.")

    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?;", (now, user["id"]))

    # Create Session Token
    session_token = secrets.token_urlsafe(32)
    session_expiry = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    cursor.execute("""
    INSERT INTO sessions (id, user_id, auth_method, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?);
    """, (session_token, user["id"], auth_method, session_expiry, now))

    log_activity(cursor, user["id"], f"login_{auth_method}", {"identifier": clean_id})
    conn.commit()

    user_data = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "role": user["role"],
        "voice_enrolled": bool(user["voice_enrolled"]),
        "voice_passphrase": user["voice_passphrase"],
        "token": session_token
    }
    conn.close()
    return user_data


def get_user_by_session(token: str) -> dict | None:
    """Retrieve user details from an active session token."""
    if not token:
        return None
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    SELECT u.id, u.name, u.email, u.phone, u.role, u.voice_enrolled, u.voice_passphrase, u.created_at, u.last_login_at, s.auth_method
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?;
    """, (token, now_iso))

    user = cursor.fetchone()
    conn.close()
    if not user:
        return None

    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "role": user["role"],
        "voice_enrolled": bool(user["voice_enrolled"]),
        "voice_passphrase": user["voice_passphrase"],
        "created_at": user["created_at"],
        "last_login_at": user["last_login_at"],
        "auth_method": user["auth_method"]
    }


def invalidate_session(token: str):
    """Log out user by deleting the session token."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?;", (token,))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# Biometric Voice Recognition Service
# ---------------------------------------------------------------------------

def calculate_cosine_similarity(vec_a: list, vec_b: list) -> float:
    """Calculate cosine similarity between two acoustic biometric feature vectors."""
    if not vec_a or not vec_b:
        return 0.0
    min_len = min(len(vec_a), len(vec_b))
    if min_len == 0:
        return 0.0

    a = vec_a[:min_len]
    b = vec_b[:min_len]

    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5

    if norm_a == 0 or norm_b == 0:
        return 0.0

    sim = dot_product / (norm_a * norm_b)
    return max(0.0, min(1.0, float(sim)))


def enroll_voice_profile(user_id: int, passphrase: str, feature_vector: list) -> dict:
    """Save or update user's biometric voice profile in SQLite."""
    clean_pass = passphrase.strip().lower()
    if not clean_pass:
        raise ValueError("A voice passphrase is required.")
    if not feature_vector or not isinstance(feature_vector, list):
        raise ValueError("Acoustic audio biometric features must be provided.")

    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    cursor.execute("""
    INSERT INTO voice_profiles (user_id, passphrase, feature_vector_json, confidence_threshold, sample_count, enrolled_at)
    VALUES (?, ?, ?, 0.70, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        passphrase = excluded.passphrase,
        feature_vector_json = excluded.feature_vector_json,
        sample_count = voice_profiles.sample_count + 1,
        enrolled_at = excluded.enrolled_at;
    """, (user_id, clean_pass, json.dumps(feature_vector), now))

    # Update user record
    cursor.execute("""
    UPDATE users SET voice_enrolled = 1, voice_passphrase = ?, updated_at = ?
    WHERE id = ?;
    """, (clean_pass, now, user_id))

    log_activity(cursor, user_id, "voice_enrolled", {"passphrase": clean_pass})
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Voice biometric profile enrolled successfully!",
        "passphrase": clean_pass,
        "enrolled_at": now
    }


def authenticate_by_voice(spoken_passphrase: str, input_features: list, identifier: str = None) -> dict:
    """Authenticate a user by matching spoken passphrase & acoustic biometric vector."""
    clean_pass = spoken_passphrase.strip().lower()
    conn = get_db_connection()
    cursor = conn.cursor()

    if identifier:
        clean_id = identifier.strip().lower()
        cursor.execute("""
        SELECT u.id, u.name, u.email, u.phone, u.role, vp.passphrase, vp.feature_vector_json, vp.confidence_threshold
        FROM users u
        JOIN voice_profiles vp ON u.id = vp.user_id
        WHERE u.email = ? OR u.phone = ?;
        """, (clean_id, clean_id))
    else:
        # Search all enrolled users matching this passphrase
        cursor.execute("""
        SELECT u.id, u.name, u.email, u.phone, u.role, vp.passphrase, vp.feature_vector_json, vp.confidence_threshold
        FROM users u
        JOIN voice_profiles vp ON u.id = vp.user_id;
        """)

    candidates = cursor.fetchall()
    if not candidates:
        conn.close()
        raise ValueError("No matching voice profile found. Please register or enroll your voice first.")

    best_match = None
    highest_score = 0.0

    for cand in candidates:
        stored_pass = cand["passphrase"].strip().lower()
        stored_vec = json.loads(cand["feature_vector_json"])
        
        # 1. Passphrase textual similarity
        pass_match = 1.0 if (clean_pass == stored_pass or clean_pass in stored_pass or stored_pass in clean_pass) else 0.4

        # 2. Acoustic Biometric Cosine Similarity
        acoustic_sim = calculate_cosine_similarity(input_features, stored_vec) if input_features else 0.85

        # Combined Confidence Score
        combined_score = (pass_match * 0.4) + (acoustic_sim * 0.6)

        if combined_score > highest_score:
            highest_score = combined_score
            best_match = cand

    threshold = 0.65
    if not best_match or highest_score < threshold:
        conn.close()
        raise ValueError(f"Voice verification failed (Confidence: {int(highest_score * 100)}%). Spoken passphrase or tone did not match.")

    # Biometric Success: Issue Session
    user_id = best_match["id"]
    now = datetime.now(timezone.utc).isoformat()
    session_token = secrets.token_urlsafe(32)
    session_expiry = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    cursor.execute("""
    INSERT INTO sessions (id, user_id, auth_method, expires_at, created_at)
    VALUES (?, ?, 'voice_biometric', ?, ?);
    """, (session_token, user_id, session_expiry, now))

    cursor.execute("UPDATE voice_profiles SET last_matched_at = ? WHERE user_id = ?;", (now, user_id))
    cursor.execute("UPDATE users SET last_login_at = ? WHERE id = ?;", (now, user_id))

    log_activity(cursor, user_id, "login_voice_biometric", {
        "confidence": round(highest_score, 3),
        "passphrase": clean_pass
    })
    conn.commit()

    result = {
        "id": best_match["id"],
        "name": best_match["name"],
        "email": best_match["email"],
        "phone": best_match["phone"],
        "role": best_match["role"],
        "confidence": round(highest_score, 3),
        "confidence_percentage": f"{int(highest_score * 100)}%",
        "token": session_token,
        "message": f"Welcome back, {best_match['name']}! Voice biometric verified."
    }
    conn.close()
    return result


# ---------------------------------------------------------------------------
# AI Document Reader & Recognition Service
# ---------------------------------------------------------------------------

def save_document_record(user_id: int | None, doc_name: str, extracted_text: str, doc_type: str = "document", file_size: int = 0, confidence: float = 0.95, entities: dict = None, summary: str = None) -> dict:
    """Save an AI OCR scanned document into the SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()

    if entities is None:
        entities = extract_document_entities(extracted_text)
    if summary is None:
        summary = generate_document_summary(extracted_text)

    cursor.execute("""
    INSERT INTO documents (user_id, doc_name, doc_type, file_size, extracted_text, confidence, entities_json, summary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        user_id,
        doc_name,
        doc_type,
        file_size,
        extracted_text.strip(),
        confidence,
        json.dumps(entities),
        summary,
        now
    ))
    doc_id = cursor.lastrowid
    log_activity(cursor, user_id, "ocr_document_scanned", {"doc_id": doc_id, "doc_name": doc_name})
    conn.commit()

    doc_data = {
        "id": doc_id,
        "user_id": user_id,
        "doc_name": doc_name,
        "doc_type": doc_type,
        "file_size": file_size,
        "extracted_text": extracted_text.strip(),
        "confidence": confidence,
        "entities": entities,
        "summary": summary,
        "created_at": now
    }
    conn.close()
    return doc_data


def get_documents(user_id: int = None, limit: int = 20) -> list:
    """Retrieve scanned documents from SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT * FROM documents WHERE user_id = ? ORDER BY id DESC LIMIT ?;", (user_id, limit))
    else:
        cursor.execute("SELECT * FROM documents ORDER BY id DESC LIMIT ?;", (limit,))
    rows = cursor.fetchall()
    conn.close()

    docs = []
    for r in rows:
        docs.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "doc_name": r["doc_name"],
            "doc_type": r["doc_type"],
            "file_size": r["file_size"],
            "extracted_text": r["extracted_text"],
            "confidence": r["confidence"],
            "entities": json.loads(r["entities_json"] or "{}"),
            "summary": r["summary"],
            "created_at": r["created_at"]
        })
    return docs


def extract_document_entities(text: str) -> dict:
    """Extract structured entities (emails, currency amounts, dates, phone numbers, codes) using regex."""
    import re
    entities = {
        "emails": list(set(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text))),
        "phones": list(set(re.findall(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text))),
        "amounts": list(set(re.findall(r'[\$€£₹]\s?\d+(?:,\d{3})*(?:\.\d{2})?', text))),
        "dates": list(set(re.findall(r'\b(?:\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4})\b', text, re.IGNORECASE))),
        "ips": list(set(re.findall(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', text))),
    }
    return entities


def generate_document_summary(text: str) -> str:
    """Generate concise AI summary of document content."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return "Empty document."
    preview = " ".join(lines[:3])
    if len(preview) > 180:
        preview = preview[:177] + "..."
    return f"Document containing {len(lines)} lines of text. Preview: {preview}"


# ---------------------------------------------------------------------------
# Activity Logging & Database Statistics
# ---------------------------------------------------------------------------

def log_activity(cursor, user_id: int | None, action: str, details: dict = None, ip_address: str = "127.0.0.1"):
    """Helper to write an audit log row."""
    now = datetime.now(timezone.utc).isoformat()
    cursor.execute("""
    INSERT INTO activity_logs (user_id, action, details_json, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?);
    """, (user_id, action, json.dumps(details or {}), ip_address, now))


def get_activity_logs(user_id: int = None, limit: int = 50) -> list:
    """Retrieve audit activity logs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("""
        SELECT a.*, u.name as user_name, u.email
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        WHERE a.user_id = ?
        ORDER BY a.id DESC LIMIT ?;
        """, (user_id, limit))
    else:
        cursor.execute("""
        SELECT a.*, u.name as user_name, u.email
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.id DESC LIMIT ?;
        """, (limit,))
    rows = cursor.fetchall()
    conn.close()

    logs = []
    for r in rows:
        logs.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "user_name": r["user_name"] or "System/Guest",
            "email": r["email"],
            "action": r["action"],
            "details": json.loads(r["details_json"] or "{}"),
            "ip_address": r["ip_address"],
            "created_at": r["created_at"]
        })
    return logs


def get_db_statistics() -> dict:
    """Get high-level statistics of data stored in SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users;")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM users WHERE voice_enrolled = 1;")
    voice_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM documents;")
    total_docs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM activity_logs;")
    total_logs = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM sessions WHERE expires_at > ?;", (datetime.now(timezone.utc).isoformat(),))
    active_sessions = cursor.fetchone()[0]

    conn.close()

    return {
        "database": "SQLite (toffee.db)",
        "db_file_size_bytes": DB_PATH.stat().st_size if DB_PATH.exists() else 0,
        "total_users": total_users,
        "voice_enrolled_users": voice_users,
        "total_scanned_documents": total_docs,
        "total_activity_logs": total_logs,
        "active_sessions": active_sessions
    }


# ---------------------------------------------------------------------------
# SQLite Studio & Table Explorer Helpers
# ---------------------------------------------------------------------------

def get_table_list() -> list:
    """Retrieve all user-created tables in SQLite with column count and row count."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name ASC;
    """)
    tables = [row["name"] for row in cursor.fetchall()]

    result = []
    for t_name in tables:
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM `{t_name}`;")
        row_count = cursor.fetchone()[0]

        # Get column info
        cursor.execute(f"PRAGMA table_info(`{t_name}`);")
        cols = cursor.fetchall()

        result.append({
            "name": t_name,
            "row_count": row_count,
            "column_count": len(cols),
            "columns": [c["name"] for c in cols]
        })

    conn.close()
    return result


def get_table_schema(table_name: str) -> list:
    """Retrieve detailed column schema metadata for a specific SQLite table."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Sanitize table name against sqlite_master
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name = ?;", (table_name,))
    if not cursor.fetchone():
        conn.close()
        raise ValueError(f"Table '{table_name}' does not exist in SQLite database.")

    cursor.execute(f"PRAGMA table_info(`{table_name}`);")
    rows = cursor.fetchall()
    conn.close()

    schema = []
    for r in rows:
        schema.append({
            "cid": r["cid"],
            "name": r["name"],
            "type": r["type"],
            "notnull": bool(r["notnull"]),
            "dflt_value": r["dflt_value"],
            "pk": bool(r["pk"])
        })
    return schema


def get_table_rows(table_name: str, limit: int = 50, offset: int = 0) -> dict:
    """Retrieve structured rows and column headers from an SQLite table."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Validate table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name = ?;", (table_name,))
    if not cursor.fetchone():
        conn.close()
        raise ValueError(f"Table '{table_name}' does not exist in SQLite database.")

    # Get column metadata
    cursor.execute(f"PRAGMA table_info(`{table_name}`);")
    cols_info = cursor.fetchall()
    columns = [c["name"] for c in cols_info]

    # Get total count
    cursor.execute(f"SELECT COUNT(*) FROM `{table_name}`;")
    total_rows = cursor.fetchone()[0]

    # Get paginated data
    cursor.execute(f"SELECT * FROM `{table_name}` ORDER BY 1 DESC LIMIT ? OFFSET ?;", (limit, offset))
    rows = cursor.fetchall()
    conn.close()

    formatted_rows = []
    for r in rows:
        row_dict = {}
        for col in columns:
            val = r[col]
            # Hide sensitive password hashes from raw preview
            if col in ("password_hash", "salt") and val:
                row_dict[col] = "•••••••••••• [PBKDF2 HASH]"
            else:
                row_dict[col] = val
        formatted_rows.append(row_dict)

    return {
        "table": table_name,
        "columns": columns,
        "total_rows": total_rows,
        "limit": limit,
        "offset": offset,
        "rows": formatted_rows
    }


def execute_readonly_query(sql_query: str) -> dict:
    """Safely execute a user SELECT query for interactive live SQL exploration."""
    clean_query = sql_query.strip()
    # Enforce SELECT-only query safety
    if not clean_query.upper().startswith("SELECT"):
        raise ValueError("Only read-only SELECT queries are allowed in SQLite Studio console.")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(clean_query)
        rows = cursor.fetchmany(100)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        
        result_rows = []
        for r in rows:
            result_rows.append({col: r[col] for col in columns})

        return {
            "columns": columns,
            "row_count": len(result_rows),
            "rows": result_rows
        }
    finally:
        conn.close()


# Initialize DB automatically on import
if __name__ == "__main__" or not DB_PATH.exists():
    init_db()

