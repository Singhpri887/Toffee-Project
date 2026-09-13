"""
notifier.py - Real Email & SMS Dispatch Engine for toffee.ai
Uses Python smtplib (Gmail SMTP SSL/TLS) and SMS HTTP Gateways to deliver genuine 6-digit OTP codes.
"""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone

CONFIG_FILE = Path(__file__).resolve().parent / "config.json"

DEFAULT_CONFIG = {
    "smtp_enabled": True,
    "smtp_provider": "gmail",
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 465,
    "smtp_use_ssl": True,
    "smtp_user": "",
    "smtp_password": "",
    "from_email": "Toffee AI Auth <no-reply@toffee.ai>",
    "from_name": "Toffee AI Security",
    "sms_enabled": False,
    "sms_provider": "generic_webhook",
    "sms_api_url": "",
    "sms_api_key": "",
    "sms_sender_id": "TOFFEE"
}


def load_config() -> dict:
    """Load email and SMS gateway configuration from config.json."""
    if not CONFIG_FILE.exists():
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        cfg = DEFAULT_CONFIG.copy()
        cfg.update(data)
        return cfg
    except Exception:
        return DEFAULT_CONFIG.copy()


def save_config(new_config: dict) -> dict:
    """Save updated gateway configuration."""
    cfg = load_config()
    cfg.update(new_config)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    return cfg


def get_public_config() -> dict:
    """Return configuration with sensitive passwords masked."""
    cfg = load_config()
    masked = cfg.copy()
    if masked.get("smtp_password"):
        masked["smtp_password"] = "••••••••••••"
    if masked.get("sms_api_key"):
        masked["sms_api_key"] = "••••••••••••"
    return masked


def build_otp_html_email(otp_code: str, identifier: str, intent: str = "signup") -> str:
    """Generate a high-converting, professional dark-mode glassmorphic HTML email."""
    action_title = "Account Verification Code" if intent == "signup" else "Login Authorization Code"
    
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{action_title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090D16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F8FAFC;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090D16; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background: linear-gradient(165deg, #0F172A 0%, #1E1B4B 100%); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <div style="display: inline-block; padding: 6px 16px; border-radius: 20px; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); color: #38BDF8; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">
                ⚡ Toffee.ai Zero-Trust Security
              </div>
              <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 800;">{action_title}</h1>
              <p style="margin: 8px 0 0; color: #94A3B8; font-size: 14px;">Use the one-time code below to verify your account.</p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td style="padding: 36px 36px 24px; text-align: center;">
              <p style="margin: 0 0 16px; color: #CBD5E1; font-size: 14px;">Your 6-Digit Verification Code is:</p>
              <div style="display: inline-block; padding: 18px 36px; background: #020617; border: 2px solid #38BDF8; border-radius: 16px; box-shadow: 0 0 30px rgba(56, 189, 248, 0.35);">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #38BDF8;">{otp_code}</span>
              </div>
              <p style="margin: 18px 0 0; color: #F59E0B; font-size: 13px; font-weight: 600;">⏱️ This code expires in 10 minutes.</p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 36px 32px; font-size: 13px; color: #94A3B8; line-height: 1.6;">
              <div style="background: rgba(255,255,255,0.04); border-radius: 12px; padding: 14px 18px; border-left: 3px solid #6366F1;">
                <strong style="color: #E2E8F0;">Security Tip:</strong> Never share this code with anyone. Toffee AI support will never ask for your verification code. If you did not request this code, please ignore this email.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background: rgba(2, 6, 23, 0.6); border-top: 1px solid rgba(255,255,255,0.06); text-align: center; font-size: 12px; color: #64748B;">
              © 2026 Toffee AI Cloud Operations Platform. All rights reserved.<br>
              Real-time telemetry, zero-trust voice biometrics, and autonomous cloud resilience.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_email_otp(to_email: str, otp_code: str, intent: str = "signup") -> dict:
    """Send genuine email verification code via Gmail SMTP or custom configured SMTP."""
    cfg = load_config()
    clean_to = to_email.strip().lower()

    smtp_user = cfg.get("smtp_user", "").strip()
    smtp_pass = cfg.get("smtp_password", "").strip()
    smtp_host = cfg.get("smtp_host", "smtp.gmail.com").strip()
    smtp_port = int(cfg.get("smtp_port", 465))
    use_ssl = cfg.get("smtp_use_ssl", True)

    if not smtp_user or not smtp_pass:
        # SMTP credentials not configured yet
        return {
            "success": False,
            "smtp_configured": False,
            "message": f"SMTP Not Configured: Please configure your Gmail App Password in Settings to send real emails to {clean_to}.",
            "recipient": clean_to
        }

    try:
        from_email = cfg.get("from_email", smtp_user)
        subject = f"Toffee AI Verification Code: {otp_code}"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_email
        msg["To"] = clean_to

        # Plain text fallback
        plain_text = f"Your Toffee AI verification code is: {otp_code}\nThis code expires in 10 minutes."
        html_content = build_otp_html_email(otp_code, clean_to, intent)

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if use_ssl and smtp_port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=12.0) as server:
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, clean_to, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=12.0) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, clean_to, msg.as_string())

        return {
            "success": True,
            "smtp_configured": True,
            "message": f"Verification code sent successfully to {clean_to} via Gmail SMTP!",
            "recipient": clean_to
        }
    except Exception as e:
        return {
            "success": False,
            "smtp_configured": True,
            "error": str(e),
            "message": f"Failed to send email via SMTP ({e}). Please verify your Gmail App Password in Gateway Settings."
        }


def send_sms_otp(phone_number: str, otp_code: str, intent: str = "signup") -> dict:
    """Send SMS verification code via configured SMS gateway."""
    cfg = load_config()
    clean_phone = phone_number.strip()
    sms_url = cfg.get("sms_api_url", "").strip()
    sms_key = cfg.get("sms_api_key", "").strip()

    if not sms_url:
        return {
            "success": False,
            "sms_configured": False,
            "message": f"SMS Gateway Not Configured: Please set up SMS API URL / Twilio webhook in Settings to dispatch SMS to {clean_phone}.",
            "recipient": clean_phone
        }

    try:
        sms_text = f"Your Toffee AI code is: {otp_code}. Valid for 10 minutes."
        payload = json.dumps({
            "to": clean_phone,
            "message": sms_text,
            "api_key": sms_key,
            "sender_id": cfg.get("sms_sender_id", "TOFFEE")
        }).encode("utf-8")

        req = urllib.request.Request(
            sms_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10.0) as response:
            res_body = response.read().decode("utf-8")

        return {
            "success": True,
            "sms_configured": True,
            "message": f"SMS OTP dispatched to {clean_phone} successfully!",
            "response": res_body
        }
    except Exception as e:
        return {
            "success": False,
            "sms_configured": True,
            "error": str(e),
            "message": f"Failed to dispatch SMS: {e}"
        }


def send_test_email(to_email: str) -> dict:
    """Test SMTP connection and send a test confirmation email."""
    test_otp = "889922"
    return send_email_otp(to_email, test_otp, intent="test")
