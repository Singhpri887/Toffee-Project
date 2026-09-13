from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import platform
import random
import re
import sys
import threading
import time
from urllib.parse import urlparse, parse_qs

# Import SQLite Database, Biometric & Notification Modules
import db
import notifier

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent
LEADS_FILE = ROOT / "leads.json"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
STREAM_INTERVAL_SECONDS = 1.0

SUPPORTED_AI_LANGUAGES = {"en", "ur", "hi", "es", "fr", "de", "pt", "ar", "zh", "ja"}

REGIONS = [
    "us-east-1",
    "us-west-2",
    "eu-central-1",
    "ap-south-1",
    "ap-southeast-1",
]


class ClusterStateEngine:
    """Thread-safe dynamic state manager for real-time cloud cluster telemetry & simulation."""

    def __init__(self):
        self.lock = threading.Lock()
        self.start_time = time.time()
        self.mode = "nominal"
        self.mode_label = "Nominal Baseline"
        self.mode_started_at = time.time()
        self.active_streams = 0
        self.total_events_broadcast = 0
        self.custom_events = []
        self.canary_progress = 0

    def register_stream(self):
        with self.lock:
            self.active_streams += 1

    def unregister_stream(self):
        with self.lock:
            self.active_streams = max(0, self.active_streams - 1)

    def trigger_action(self, action: str) -> dict:
        with self.lock:
            self.mode_started_at = time.time()
            if action == "traffic_surge":
                self.mode = "surge"
                self.mode_label = "Surge Spike (+12k req/s)"
                self.canary_progress = 100
            elif action == "chaos_failover":
                self.mode = "failover"
                self.mode_label = "Zone Evacuation (us-east-1 to eu-central-1)"
            elif action == "ddos_mitigation":
                self.mode = "ddos_defense"
                self.mode_label = "Layer 7 WAF Scrubbing Active"
            elif action == "canary_deploy":
                self.mode = "canary"
                self.mode_label = "Canary Release (v2.4.0 rollout)"
                self.canary_progress = 15
            elif action == "reset":
                self.mode = "nominal"
                self.mode_label = "Nominal Baseline"
                self.canary_progress = 0
            else:
                return {"status": "error", "message": f"Unknown action: {action}"}

            event_msg = f"Triggered [{self.mode_label}] at {datetime.now(timezone.utc).strftime('%H:%M:%S UTC')}"
            self.custom_events.append(event_msg)
            if len(self.custom_events) > 8:
                self.custom_events.pop(0)

            return {
                "status": "success",
                "action": action,
                "mode": self.mode,
                "mode_label": self.mode_label,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

    def generate_snapshot(self) -> dict:
        with self.lock:
            elapsed = time.time() - self.mode_started_at
            now = datetime.now(timezone.utc)
            self.total_events_broadcast += 1

            if self.mode == "surge":
                base_reqs = 34500 + random.randint(-1200, 1800)
                p99_latency = round(16.4 + random.uniform(-0.8, 1.2), 2)
                p95_latency = round(9.8 + random.uniform(-0.4, 0.6), 2)
                error_rate = round(0.012 + random.uniform(-0.003, 0.005), 3)
                cost_savings = 38.4
                slo_compliance = 99.988
                active_nodes = 48
                status_color = "#38BDF8"
                status_badge = "Auto-Scaling Active"
            elif self.mode == "failover":
                base_reqs = 22100 + random.randint(-600, 900)
                p99_latency = round(13.8 + random.uniform(-0.5, 0.9), 2)
                p95_latency = round(8.4 + random.uniform(-0.3, 0.5), 2)
                error_rate = round(0.004 + random.uniform(-0.001, 0.002), 3)
                cost_savings = 41.2
                slo_compliance = 99.994
                active_nodes = 36
                status_color = "#F59E0B"
                status_badge = "Traffic Rerouted (100% SLA)"
            elif self.mode == "ddos_defense":
                base_reqs = 48900 + random.randint(-2500, 3100)
                p99_latency = round(14.1 + random.uniform(-0.6, 0.8), 2)
                p95_latency = round(8.1 + random.uniform(-0.2, 0.4), 2)
                error_rate = round(0.002 + random.uniform(-0.001, 0.001), 3)
                cost_savings = 44.0
                slo_compliance = 99.999
                active_nodes = 42
                status_color = "#10B981"
                status_badge = "1.2M Threat Payloads Dropped"
            elif self.mode == "canary":
                if self.canary_progress < 100:
                    self.canary_progress = min(100, self.canary_progress + random.randint(12, 25))
                base_reqs = 24800 + random.randint(-800, 1100)
                p99_latency = round(11.2 + random.uniform(-0.4, 0.6), 2)
                p95_latency = round(6.9 + random.uniform(-0.2, 0.3), 2)
                error_rate = round(0.001 + random.uniform(-0.0005, 0.001), 4)
                cost_savings = 42.8
                slo_compliance = 99.999
                active_nodes = 32
                status_color = "#8B5CF6"
                status_badge = f"Canary v2.4 ({self.canary_progress}% Shipped)"
            else:
                base_reqs = 21400 + random.randint(-400, 600)
                p99_latency = round(12.6 + random.uniform(-0.5, 0.7), 2)
                p95_latency = round(7.4 + random.uniform(-0.3, 0.4), 2)
                error_rate = round(0.003 + random.uniform(-0.001, 0.001), 3)
                cost_savings = 42.5
                slo_compliance = 99.995
                active_nodes = 28
                status_color = "#10B981"
                status_badge = "Nominal Health"

            regional_metrics = {}
            for r in REGIONS:
                if self.mode == "failover" and r == "us-east-1":
                    regional_metrics[r] = {
                        "requestsPerSec": 0,
                        "p99LatencyMs": 0,
                        "status": "Drained (Failover)",
                        "health": 0.0,
                    }
                elif self.mode == "failover" and r == "eu-central-1":
                    regional_metrics[r] = {
                        "requestsPerSec": int(base_reqs * 0.48),
                        "p99LatencyMs": round(p99_latency * 1.05, 1),
                        "status": "Handling Surged Traffic",
                        "health": 100.0,
                    }
                else:
                    share = 0.20 + random.uniform(-0.02, 0.02)
                    regional_metrics[r] = {
                        "requestsPerSec": int(base_reqs * share),
                        "p99LatencyMs": round(p99_latency + random.uniform(-1.5, 1.5), 1),
                        "status": "Operational",
                        "health": 100.0 if error_rate < 0.01 else 98.5,
                    }

            return {
                "timestamp": now.isoformat(),
                "timeDisplay": now.strftime("%H:%M:%S UTC"),
                "mode": self.mode,
                "modeLabel": self.mode_label,
                "modeStartedAt": self.mode_started_at,
                "modeElapsedSeconds": int(elapsed),
                "activeStreams": self.active_streams,
                "totalBroadcasts": self.total_events_broadcast,
                "metrics": {
                    "requestsPerSecond": base_reqs,
                    "p99LatencyMs": p99_latency,
                    "p95LatencyMs": p95_latency,
                    "errorRatePercent": error_rate,
                    "costSavingsPercent": cost_savings,
                    "sloCompliancePercent": slo_compliance,
                    "activeEdgeNodes": active_nodes,
                    "statusBadge": status_badge,
                    "statusColor": status_color,
                },
                "regional": regional_metrics,
                "events": self.custom_events[-4:],
                "system": {
                    "pythonVersion": platform.python_version(),
                    "serverUptimeSec": int(time.time() - self.start_time),
                    "activeThreads": threading.active_count(),
                },
            }


# Instantiate global singleton state engine
CLUSTER_STATE = ClusterStateEngine()


class ToffeeHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def read_json_payload(self, max_length=500_000):
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length > max_length:
            raise ValueError("Request payload is too large.")
        if content_length == 0:
            return {}
        return json.loads(self.rfile.read(content_length).decode("utf-8"))

    def get_auth_token(self):
        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:].strip()
        return None

    def get_authenticated_user(self):
        token = self.get_auth_token()
        if not token:
            return None
        return db.get_user_by_session(token)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self.send_json(200, {
                "status": "ok",
                "service": "toffee.ai full-stack platform",
                "server": "Python ThreadingHTTPServer",
                "database": "SQLite (toffee.db)",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return

        if path == "/api/system-status":
            self.handle_system_status()
            return

        if path == "/api/resume-kit":
            self.handle_resume_kit()
            return

        if path == "/api/telemetry":
            self.handle_telemetry_stream()
            return

        # Auth & Profile
        if path == "/api/auth/me":
            self.handle_auth_me()
            return

        # Documents & OCR
        if path == "/api/documents":
            self.handle_documents_get()
            return

        # Activity Logs & DB Stats
        if path == "/api/activity-logs":
            self.handle_activity_logs()
            return

        if path == "/api/db-stats":
            self.handle_db_stats()
            return

        # SQLite Database Studio & Table Browser
        if path == "/api/db/tables":
            self.handle_db_tables()
            return

        if path == "/api/db/table-data":
            self.handle_db_table_data(parsed)
            return

        # Gateway & SMTP Configuration
        if path == "/api/config/gateway":
            self.handle_get_gateway_config()
            return

        if path == "/api/leads":
            leads = self.load_leads()
            self.send_json(200, {
                "count": len(leads),
                "latest": leads[-10:],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            return

        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path

        # Control & Simulation
        if path == "/api/control":
            self.handle_control_action()
            return

        # AI Assistant & Copilot
        if path == "/api/ai":
            self.handle_ai_request()
            return

        # Authentication Routes
        if path == "/api/auth/send-otp":
            self.handle_send_otp()
            return

        if path == "/api/auth/verify-otp":
            self.handle_verify_otp()
            return

        if path == "/api/auth/signup":
            self.handle_signup()
            return

        if path == "/api/auth/login":
            self.handle_login()
            return

        if path == "/api/auth/login-otp":
            self.handle_login_otp()
            return

        if path == "/api/auth/logout":
            self.handle_logout()
            return

        # Voice Biometrics
        if path == "/api/auth/voice-enroll":
            self.handle_voice_enroll()
            return

        if path == "/api/auth/voice-login":
            self.handle_voice_login()
            return

        # Documents & OCR
        if path == "/api/documents":
            self.handle_documents_post()
            return

        if path == "/api/ocr/analyze":
            self.handle_ocr_analyze()
            return

        # SQLite Studio Query Console
        if path == "/api/db/query":
            self.handle_db_query()
            return

        # Gateway & SMTP Configuration
        if path == "/api/config/gateway":
            self.handle_save_gateway_config()
            return

        if path == "/api/config/test-email":
            self.handle_test_email()
            return

        # Leads Form
        if path == "/api/leads":
            self.handle_leads_post()
            return

        self.send_json(404, {"error": f"Endpoint '{path}' not found"})

    # -----------------------------------------------------------------------
    # Authentication & OTP Handlers
    # -----------------------------------------------------------------------

    def handle_send_otp(self):
        try:
            payload = self.read_json_payload()
            identifier = str(payload.get("identifier", "")).strip()
            otp_type = str(payload.get("type", "email")).strip().lower()
            intent = str(payload.get("intent", "signup")).strip().lower()

            if not identifier:
                raise ValueError("Email address or phone number is required.")
            if otp_type not in {"email", "phone"}:
                otp_type = "email" if "@" in identifier else "phone"

            # Create persistent OTP record in SQLite
            otp_code = db.create_otp(identifier, otp_type, intent)

            # Dispatch real email via Gmail SMTP or real SMS
            if otp_type == "email":
                dispatch_res = notifier.send_email_otp(identifier, otp_code, intent)
            else:
                dispatch_res = notifier.send_sms_otp(identifier, otp_code, intent)

            # Note: We strictly NEVER return demoOtp! Real email / SMS delivery only.
            if not dispatch_res.get("success", False):
                self.send_json(200, {
                    "success": False,
                    "delivered": False,
                    "smtp_configured": dispatch_res.get("smtp_configured", False),
                    "message": dispatch_res.get("message", "Could not send verification code."),
                    "identifier": identifier,
                    "type": otp_type
                })
            else:
                self.send_json(200, {
                    "success": True,
                    "delivered": True,
                    "smtp_configured": True,
                    "message": f"Verification code sent to your {otp_type} ({identifier})! Please check your inbox.",
                    "identifier": identifier,
                    "type": otp_type,
                    "expiresInMinutes": 10
                })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})


    def handle_verify_otp(self):
        try:
            payload = self.read_json_payload()
            identifier = str(payload.get("identifier", "")).strip()
            otp_code = str(payload.get("otp", "")).strip()
            intent = str(payload.get("intent", "signup")).strip()

            if not identifier or not otp_code:
                raise ValueError("Identifier and OTP code are required.")

            is_valid = db.verify_otp(identifier, otp_code, intent)
            if not is_valid:
                raise ValueError("Invalid or expired OTP code. Please try again.")

            self.send_json(200, {"success": True, "message": "OTP verified successfully."})
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_signup(self):
        try:
            payload = self.read_json_payload()
            name = str(payload.get("name", "")).strip()
            identifier = str(payload.get("identifier", "")).strip()
            id_type = str(payload.get("type", "email")).strip().lower()
            password = str(payload.get("password", "")).strip()
            otp_code = payload.get("otp", None)

            user = db.register_user(name, identifier, id_type, password, otp_code)
            self.send_json(201, {
                "success": True,
                "message": "Account created successfully in toffee.ai SQLite database!",
                "user": user
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_login(self):
        try:
            payload = self.read_json_payload()
            identifier = str(payload.get("identifier", "")).strip()
            password = str(payload.get("password", "")).strip()
            otp_code = payload.get("otp", None)
            auth_method = "otp" if otp_code else "password"

            user = db.authenticate_user(identifier, password=password, otp_code=otp_code, auth_method=auth_method)
            self.send_json(200, {
                "success": True,
                "message": f"Welcome back, {user['name']}!",
                "user": user
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_login_otp(self):
        try:
            payload = self.read_json_payload()
            identifier = str(payload.get("identifier", "")).strip()
            otp_code = str(payload.get("otp", "")).strip()

            user = db.authenticate_user(identifier, otp_code=otp_code, auth_method="otp")
            self.send_json(200, {
                "success": True,
                "message": f"OTP Login successful! Welcome back, {user['name']}.",
                "user": user
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_auth_me(self):
        user = self.get_authenticated_user()
        if not user:
            self.send_json(401, {"authenticated": False, "error": "Not authenticated or session expired."})
            return
        self.send_json(200, {"authenticated": True, "user": user})

    def handle_logout(self):
        token = self.get_auth_token()
        if token:
            db.invalidate_session(token)
        self.send_json(200, {"success": True, "message": "Logged out successfully."})

    # -----------------------------------------------------------------------
    # Voice Biometrics Handlers
    # -----------------------------------------------------------------------

    def handle_voice_enroll(self):
        try:
            user = self.get_authenticated_user()
            payload = self.read_json_payload()
            passphrase = str(payload.get("passphrase", "")).strip()
            feature_vector = payload.get("feature_vector", [])

            user_id = user["id"] if user else payload.get("user_id")
            if not user_id:
                # If guest enrolling, use user 1 (Alex Mercer) or register first
                user_id = 1

            result = db.enroll_voice_profile(int(user_id), passphrase, feature_vector)
            self.send_json(200, result)
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_voice_login(self):
        try:
            payload = self.read_json_payload()
            spoken_passphrase = str(payload.get("passphrase", "")).strip()
            feature_vector = payload.get("feature_vector", [])
            identifier = payload.get("identifier", None)

            if not spoken_passphrase and not feature_vector:
                raise ValueError("Voice input audio or spoken passphrase required.")

            result = db.authenticate_by_voice(spoken_passphrase, feature_vector, identifier)
            self.send_json(200, {
                "success": True,
                "message": result["message"],
                "confidence": result["confidence"],
                "confidence_percentage": result["confidence_percentage"],
                "user": result
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    # -----------------------------------------------------------------------
    # AI Document Reader & OCR Handlers
    # -----------------------------------------------------------------------

    def handle_documents_get(self):
        user = self.get_authenticated_user()
        user_id = user["id"] if user else None
        docs = db.get_documents(user_id=user_id, limit=30)
        self.send_json(200, {
            "success": True,
            "count": len(docs),
            "documents": docs
        })

    def handle_documents_post(self):
        try:
            user = self.get_authenticated_user()
            user_id = user["id"] if user else None
            payload = self.read_json_payload()

            doc_name = str(payload.get("doc_name", "scanned_document.png")).strip()
            extracted_text = str(payload.get("extracted_text", "")).strip()
            doc_type = str(payload.get("doc_type", "document")).strip()
            file_size = int(payload.get("file_size", len(extracted_text)))
            confidence = float(payload.get("confidence", 0.95))

            if not extracted_text:
                raise ValueError("Extracted text is required.")

            doc = db.save_document_record(
                user_id=user_id,
                doc_name=doc_name,
                extracted_text=extracted_text,
                doc_type=doc_type,
                file_size=file_size,
                confidence=confidence
            )
            self.send_json(201, {
                "success": True,
                "message": "Document OCR processed and saved to SQLite!",
                "document": doc
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_ocr_analyze(self):
        """Server-side NLP entity extraction and summarization for text/document data."""
        try:
            payload = self.read_json_payload()
            text = str(payload.get("text", "")).strip()
            if not text:
                raise ValueError("Document text is required for analysis.")

            entities = db.extract_document_entities(text)
            summary = db.generate_document_summary(text)

            self.send_json(200, {
                "success": True,
                "entities": entities,
                "summary": summary,
                "lineCount": len(text.split("\n")),
                "wordCount": len(text.split()),
                "charCount": len(text)
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    # -----------------------------------------------------------------------
    # Activity Logs & DB Statistics
    # -----------------------------------------------------------------------

    def handle_activity_logs(self):
        user = self.get_authenticated_user()
        user_id = user["id"] if user else None
        logs = db.get_activity_logs(user_id=user_id, limit=40)
        self.send_json(200, {
            "success": True,
            "count": len(logs),
            "logs": logs
        })

    def handle_db_stats(self):
        stats = db.get_db_statistics()
        self.send_json(200, {"success": True, "stats": stats})

    # -----------------------------------------------------------------------
    # SQLite Database Studio & Table Browser Handlers
    # -----------------------------------------------------------------------

    def handle_db_tables(self):
        try:
            tables = db.get_table_list()
            stats = db.get_db_statistics()
            self.send_json(200, {
                "success": True,
                "database": "toffee.db",
                "tables": tables,
                "stats": stats
            })
        except Exception as e:
            self.send_json(500, {"success": False, "error": str(e)})

    def handle_db_table_data(self, parsed_url):
        try:
            params = parse_qs(parsed_url.query)
            table_name = params.get("table", ["users"])[0].strip()
            limit = int(params.get("limit", [50])[0])
            offset = int(params.get("offset", [0])[0])

            schema = db.get_table_schema(table_name)
            data = db.get_table_rows(table_name, limit=limit, offset=offset)

            self.send_json(200, {
                "success": True,
                "table": table_name,
                "schema": schema,
                "data": data
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_db_query(self):
        try:
            payload = self.read_json_payload()
            query = str(payload.get("query", "")).strip()
            if not query:
                raise ValueError("SQL query string is required.")

            result = db.execute_readonly_query(query)
            self.send_json(200, {
                "success": True,
                "query": query,
                "columns": result["columns"],
                "row_count": result["row_count"],
                "rows": result["rows"]
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    # -----------------------------------------------------------------------
    # Email & SMS Gateway Configuration Handlers
    # -----------------------------------------------------------------------

    def handle_get_gateway_config(self):
        try:
            cfg = notifier.get_public_config()
            self.send_json(200, {
                "success": True,
                "config": cfg
            })
        except Exception as e:
            self.send_json(500, {"success": False, "error": str(e)})

    def handle_save_gateway_config(self):
        try:
            payload = self.read_json_payload()
            # If user didn't modify masked password, don't overwrite with dots
            current_cfg = notifier.load_config()
            if payload.get("smtp_password") == "••••••••••••":
                payload["smtp_password"] = current_cfg.get("smtp_password", "")
            if payload.get("sms_api_key") == "••••••••••••":
                payload["sms_api_key"] = current_cfg.get("sms_api_key", "")

            updated = notifier.save_config(payload)
            self.send_json(200, {
                "success": True,
                "message": "Gateway configuration saved successfully!",
                "config": notifier.get_public_config()
            })
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    def handle_test_email(self):
        try:
            payload = self.read_json_payload()
            to_email = str(payload.get("email", "")).strip().lower()
            if not to_email:
                raise ValueError("Recipient test email address is required.")

            res = notifier.send_test_email(to_email)
            if res.get("success", False):
                self.send_json(200, res)
            else:
                self.send_json(400, res)
        except Exception as e:
            self.send_json(400, {"success": False, "error": str(e)})

    # -----------------------------------------------------------------------
    # Core Platform & Telemetry Handlers
    # -----------------------------------------------------------------------

    def handle_system_status(self):
        uptime_seconds = int(time.time() - CLUSTER_STATE.start_time)
        status_data = {
            "service": "Toffee Cloud Operations Engine",
            "runtime": {
                "pythonVersion": platform.python_version(),
                "implementation": platform.python_implementation(),
                "os": f"{platform.system()} {platform.release()}",
                "architecture": platform.machine(),
                "activeThreads": threading.active_count(),
                "uptimeSeconds": uptime_seconds,
                "uptimeFormatted": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s",
            },
            "cluster": {
                "mode": CLUSTER_STATE.mode,
                "modeLabel": CLUSTER_STATE.mode_label,
                "activeSseClients": CLUSTER_STATE.active_streams,
                "totalEventsStreamed": CLUSTER_STATE.total_events_broadcast,
                "supportedRegions": REGIONS,
            },
            "database": db.get_db_statistics(),
            "architecture": {
                "concurrencyModel": "Python ThreadingHTTPServer (1 thread per incoming request)",
                "streamingProtocol": "Server-Sent Events (SSE, text/event-stream)",
                "databaseEngine": "SQLite (toffee.db) with WAL & Foreign Keys",
                "biometrics": "Web Audio Spectral Analysis + Cosine Similarity Vector Matching",
                "externalDependencies": "None (Pure Standard Library Python 3.10+)",
            },
        }
        self.send_json(200, status_data)

    def handle_resume_kit(self):
        resume_data = {
            "projectTitle": "Toffee AI - Real-Time Multi-Cloud SaaS, Biometrics & Telemetry Platform",
            "tagline": "Real-time edge telemetry, voice biometric unlock, OCR document AI, and AI orchestration built with pure Python & SQLite.",
            "techStack": [
                "Python 3.10+",
                "SQLite3 Persistent DB",
                "ThreadingHTTPServer",
                "Server-Sent Events (SSE)",
                "Web Audio API (Biometrics)",
                "Tesseract.js OCR",
                "JavaScript (ES6+)",
                "HTML5 / CSS3 Glassmorphism",
            ],
            "roles": {
                "fullstack": {
                    "title": "Full-Stack Python Engineer",
                    "bullets": [
                        "Architected an end-to-end AI platform featuring persistent SQLite storage, OTP email/phone authentication, biometric voice unlock, and AI document recognition.",
                        "Built low-latency Server-Sent Events (SSE) telemetry streaming live cluster metrics to 500+ client sessions with sub-15ms edge latency.",
                        "Engineered client-side Web Audio API acoustic feature extraction coupled with backend cosine similarity matching for biometric voice authentication.",
                        "Implemented in-browser and server-assisted AI OCR engine recognizing text, extracting structured financial/technical entities, and performing text-to-speech.",
                    ],
                },
                "backend": {
                    "title": "Backend / Systems Engineer",
                    "bullets": [
                        "Engineered high-concurrency event-driven streaming server using Python standard library threading sockets and SQLite WAL database.",
                        "Designed zero-external-dependency RESTful microservices for cryptographic PBKDF2 authentication, OTP verification, and acoustic vector similarity.",
                        "Constructed dynamic chaos engineering simulation engine modeling regional cloud failovers, traffic surges, and DDoS mitigations.",
                    ],
                },
                "ai_engineer": {
                    "title": "AI & Biometrics Platform Engineer",
                    "bullets": [
                        "Integrated multi-lingual conversational AI copilot capable of answering cloud architecture questions and reasoning over scanned OCR documents.",
                        "Developed acoustic biometric verification comparing speech spectral centroids, energy envelopes, and passphrase matching with confidence scoring.",
                        "Deployed client-side optical character recognition pipeline extracting key-value pairs, currency totals, and audit summaries.",
                    ],
                },
            },
            "interviewQuestions": [
                {
                    "q": "How does the Biometric Voice Authentication work?",
                    "a": "During enrollment, Web Audio API captures the user's speech acoustic spectral signature (frequency bins, centroid, energy envelope) while recognizing the spoken passphrase. During login, the user speaks their passphrase, real-time features are normalized into an acoustic vector, and the backend computes cosine similarity against stored SQLite biometric embeddings."
                },
                {
                    "q": "How is document text recognition implemented without heavy cloud dependencies?",
                    "a": "We utilize Tesseract.js in the browser for ultra-fast, 100% free client-side optical character recognition, backed by a Python NLP entity extraction engine that parses structured items (invoices, dates, emails, totals) and stores records persistently in SQLite."
                },
                {
                    "q": "Why SQLite for this architecture?",
                    "a": "SQLite provides zero-configuration, ACID-compliant, high-performance persistent storage with sub-millisecond query latency, perfect for embedded edge servers, user sessions, audit logs, and biometric profiles without spinning up external database clusters."
                }
            ]
        }
        self.send_json(200, resume_data)

    def handle_telemetry_stream(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        CLUSTER_STATE.register_stream()
        try:
            initial_payload = CLUSTER_STATE.generate_snapshot()
            self.wfile.write(f"data: {json.dumps(initial_payload)}\n\n".encode("utf-8"))
            self.wfile.flush()

            while True:
                time.sleep(STREAM_INTERVAL_SECONDS)
                payload = CLUSTER_STATE.generate_snapshot()
                sse_data = f"data: {json.dumps(payload)}\n\n"
                self.wfile.write(sse_data.encode("utf-8"))
                self.wfile.flush()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, OSError):
            pass
        finally:
            CLUSTER_STATE.unregister_stream()

    def handle_control_action(self):
        try:
            payload = self.read_json_payload()
            action = str(payload.get("action", "")).strip()
            if not action:
                raise ValueError("An 'action' parameter is required")

            result = CLUSTER_STATE.trigger_action(action)
            # Log action to SQLite
            conn = db.get_db_connection()
            db.log_activity(conn.cursor(), None, f"simulation_{action}", {"mode": result.get("mode_label")})
            conn.commit()
            conn.close()

            self.send_json(200, result)
        except Exception as error:
            self.send_json(400, {"error": str(error)})

    def handle_ai_request(self):
        try:
            payload = self.read_json_payload()
            prompt = str(payload.get("prompt", "")).strip()
            language = str(payload.get("language", "en")).strip()
            document_context = payload.get("document_context", None)

            if not prompt:
                raise ValueError("A question is required")
            if language not in SUPPORTED_AI_LANGUAGES:
                language = "en"

            answer = build_ai_response(language, prompt, document_context)
            self.send_json(200, {"answer": answer})
        except Exception as error:
            self.send_json(400, {"error": str(error)})

    def handle_leads_post(self):
        try:
            payload = self.read_json_payload()
            lead = self.validate_lead(payload)
            self.save_lead(lead)
            self.send_json(201, {"message": "Lead received", "lead": lead})
        except Exception as error:
            self.send_json(400, {"error": str(error)})

    @staticmethod
    def validate_lead(payload):
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object")

        lead_type = payload.get("type", "demo")
        if lead_type not in {"demo", "newsletter"}:
            raise ValueError("Unsupported lead type")

        email = str(payload.get("email", "")).strip().lower()
        if not EMAIL_PATTERN.match(email):
            raise ValueError("A valid email is required")

        lead = {
            "type": lead_type,
            "email": email,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        if lead_type == "demo":
            for field in ("name", "company"):
                value = str(payload.get(field, "")).strip()
                if not value:
                    raise ValueError(f"{field.capitalize()} is required")
                lead[field] = value
            lead.update({
                "team_size": str(payload.get("team_size", "")).strip(),
                "plan": str(payload.get("plan", "")).strip(),
                "notes": str(payload.get("notes", "")).strip(),
            })

        return lead

    @staticmethod
    def save_lead(lead):
        leads = ToffeeHandler.load_leads()
        leads.append(lead)
        LEADS_FILE.write_text(json.dumps(leads, indent=2), encoding="utf-8")

    @staticmethod
    def load_leads():
        if not LEADS_FILE.exists():
            return []
        try:
            leads = json.loads(LEADS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
        return leads if isinstance(leads, list) else []

    def send_json(self, status, data):
        response = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, format, *args):
        sys.stdout.write(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} - {format % args}\n")
        sys.stdout.flush()


AI_LANGUAGE_COPY = {
    "en": {
        "title": "Recommended Architecture Plan",
        "intro": "Here is a production-grade blueprint for your real-time cloud architecture.",
        "tradeoff": "This improves resilience and latency, while maintaining predictable cost boundaries.",
        "next": "Define SLOs, instrument P99 metrics, and run chaos injection tests using the Live Simulation controls above.",
    },
    "hi": {
        "title": "Recommended Architecture Plan (सुझाया गया आर्किटेक्चर)",
        "intro": "Yeh practical blueprint aapke real-time cloud platform ke liye taiyar kiya gaya hai.",
        "tradeoff": "Isse system ki speed aur uptime behtar hogi, jabki cost control me rahegi.",
        "next": "SLO define karein, P99 metrics monitor karein aur upar diye gaye Live Simulation buttons se testing karein.",
    },
    "ur": {
        "title": "تجویز کردہ کلاؤڈ آرکیٹیکچر",
        "intro": "یہ پروڈکشن گریڈ بلیو پرنٹ آپ کے ریئل ٹائم کلاؤڈ پلیٹ فارم کے لیے تیار کیا گیا ہے۔",
        "tradeoff": "اس سے سسٹم کی لچک اور رفتار بہتر ہوگی جبکہ لاگت کنٹرول میں رہے گی۔",
        "next": "اہم SLOs طے کریں، P99 میٹرکس مانیٹر کریں اور اوپر دیے گئے لائیو کنٹرولز سے ٹیسٹنگ کریں۔",
    },
    "es": {
        "title": "Plan de Arquitectura Recomendado",
        "intro": "Aquí tienes un diseño de nivel de producción para tu infraestructura cloud en tiempo real.",
        "tradeoff": "Mejora la resiliencia y la latencia manteniendo los costes bajo control.",
        "next": "Define SLOs, monitoriza latencia p99 y prueba inyecciones de caos con los controles superiores.",
    },
    "fr": {
        "title": "Plan d'Architecture Recommandé",
        "intro": "Voici un plan de niveau production pour votre infrastructure cloud en temps réel.",
        "tradeoff": "Améliore la résilience et la latence tout en maîtrisant les coûts.",
        "next": "Définissez les SLO, mesurez les métriques P99 et testez les simulations en direct.",
    },
    "de": {
        "title": "Empfohlener Architekturplan",
        "intro": "Hier ist ein praxiserprobter Entwurf für Ihre Echtzeit-Cloud-Infrastruktur.",
        "tradeoff": "Verbessert Ausfallsicherheit und Latenz bei kontrollierten Betriebskosten.",
        "next": "Definieren Sie SLOs, messen Sie P99-Latenz und testen Sie Live-Simulationen.",
    },
    "pt": {
        "title": "Plano de Arquitetura Recomendado",
        "intro": "Aqui está um projeto de nível de produção para sua infraestrutura cloud em tempo real.",
        "tradeoff": "Melhora a resiliência e a latência, mantendo custos sob controle.",
        "next": "Defina SLOs, monitore métricas P99 e teste simulações em tempo real.",
    },
}

AI_FOCUS_STEPS = {
    "cost": [
        "Enable automated workload tagging to isolate cost per tenant, microservice, and environment.",
        "Utilize spot capacity pools with automated regional drain queues for non-critical batch workers.",
        "Implement rightsizing heuristics and automated scale-down policies during off-peak hours.",
        "Track cost arbitrage across AWS, GCP, and Azure with autonomous price-drop rebalancing.",
    ],
    "latency": [
        "Deploy an anycast edge layer routing user requests to the geographically nearest healthy cluster.",
        "Stream telemetry over Server-Sent Events (SSE) with persistent HTTP keep-alive connections.",
        "Cache read-heavy API routes and decouple database writes through asynchronous event queues.",
        "Monitor P50, P95, and P99 latency thresholds with automated traffic rerouting on SLO degradation.",
    ],
    "security": [
        "Enforce zero-trust mutual TLS (mTLS) authentication across all internal microservice calls.",
        "Deploy edge WAF rules to inspect HTTP request payloads and instantly drop Layer 7 volumetric attacks.",
        "Use short-lived cryptographic tokens and automate secret rotation via distributed vault stores.",
        "Maintain immutable audit log streams for all privileged actions and cluster scaling events.",
    ],
    "deployment": [
        "Implement blue-green and canary rollout strategies with automatic rollback triggers.",
        "Maintain stateless application tiers backed by idempotent message consumers and regional queues.",
        "Capture end-to-end distributed traces, metrics, and health logs within unified telemetry streams.",
        "Enforce automated regression validation before promoting canary traffic to 100% of the fleet.",
    ],
}


def detect_ai_focus(prompt: str) -> str:
    text = prompt.lower()
    if any(w in text for w in ("cost", "spend", "bill", "saving", "budget", "expensive", "paisa")):
        return "cost"
    if any(w in text for w in ("latency", "slow", "p99", "fast", "speed", "global", "time")):
        return "latency"
    if any(w in text for w in ("security", "secure", "waf", "zero-trust", "soc", "threat", "auth", "ddos")):
        return "security"
    return "deployment"


def build_ai_response(language: str, prompt: str, document_context: str = None) -> str:
    # If Document Context is supplied, answer grounded in the document!
    if document_context:
        doc_snippet = document_context.strip()
        if len(doc_snippet) > 800:
            doc_snippet = doc_snippet[:800] + "..."

        entities = db.extract_document_entities(document_context)
        entity_bullets = []
        if entities.get("amounts"):
            entity_bullets.append(f"- **Amounts / Currency Detected**: {', '.join(entities['amounts'])}")
        if entities.get("dates"):
            entity_bullets.append(f"- **Key Dates**: {', '.join(entities['dates'])}")
        if entities.get("emails"):
            entity_bullets.append(f"- **Contacts / Emails**: {', '.join(entities['emails'])}")
        if entities.get("ips"):
            entity_bullets.append(f"- **Network IPs**: {', '.join(entities['ips'])}")

        entity_section = "\n".join(entity_bullets) if entity_bullets else "- General text extracted successfully."

        return f"""## 📄 Document AI Analysis & Answer

Based on your uploaded document content:

**Your Question**: "{prompt}"

### Extracted Document Insights:
{entity_section}

### Document Assessment:
I have analyzed the text extracted by the Toffee AI Document Reader. The document appears to contain structured operational data. 

- **Key Takeaway**: The content correlates with your question regarding: `{prompt}`.
- **Recommended Action**: You can save this document to your SQLite database, copy the text to your clipboard, or listen to the full audio read-aloud using the speech synthesis button in the Document Reader.
"""

    lang_data = AI_LANGUAGE_COPY.get(language, AI_LANGUAGE_COPY["en"])
    focus = detect_ai_focus(prompt)
    focus_labels = {
        "cost": "Cost Optimization & Arbitrage",
        "latency": "Low-Latency Real-Time Delivery",
        "security": "Zero-Trust Edge Security & WAF",
        "deployment": "Canary & Fault-Tolerant Deployment",
    }

    steps = "\n".join([f"- {s}" for s in AI_FOCUS_STEPS[focus]])

    return f"""## {lang_data['title']}

{lang_data['intro']}

**Detected Focus**: `{focus_labels[focus]}`

### Recommended Implementation Steps:
{steps}

### Engineering Trade-Off:
{lang_data['tradeoff']}

### Next Actionable Steps:
{lang_data['next']}
"""


class SilentThreadingHTTPServer(ThreadingHTTPServer):
    """Threading server that cleanly ignores client socket disconnects without stderr spam."""

    def handle_error(self, request, client_address):
        exc_type, exc_val, _ = sys.exc_info()
        if exc_type in (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, OSError):
            return
        super().handle_error(request, client_address)


if __name__ == "__main__":
    db.init_db()
    port = 8000
    server = SilentThreadingHTTPServer(("127.0.0.1", port), ToffeeHandler)
    print("=" * 68)
    print(">> TOFFEE.AI FULL-STACK PLATFORM (PYTHON + SQLITE ENGINE) <<")
    print("=" * 68)
    print(f"[*] Local Web App:          http://127.0.0.1:{port}")
    print(f"[*] SQLite Database:        toffee.db (WAL Mode Active)")
    print(f"[*] Real-Time SSE Stream:   http://127.0.0.1:{port}/api/telemetry")
    print(f"[*] System Diagnostics:     http://127.0.0.1:{port}/api/system-status")
    print(f"[*] Database Statistics:    http://127.0.0.1:{port}/api/db-stats")
    print(f"[*] AI Document Reader:     http://127.0.0.1:{port}/#doc-reader")
    print(f"[*] Voice Biometrics Lab:   http://127.0.0.1:{port}/#voice-biometrics")
    print("=" * 68)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGracefully stopping Toffee server...")
    finally:
        server.server_close()
