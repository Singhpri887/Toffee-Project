/**
 * js/gateway-settings.js — Toffee AI Email & SMS Gateway Configuration
 * Loads config from /api/config/gateway, saves via POST, tests via /api/config/test-email
 * Also shows OTP delivery status notification when SMTP is not configured.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // Fields
    const smtpHost = document.getElementById('gwSmtpHost');
    const smtpPort = document.getElementById('gwSmtpPort');
    const smtpUser = document.getElementById('gwSmtpUser');
    const smtpPass = document.getElementById('gwSmtpPass');
    const fromEmail = document.getElementById('gwFromEmail');
    const testEmail = document.getElementById('gwTestEmail');
    const smsUrl   = document.getElementById('gwSmsUrl');
    const smsKey   = document.getElementById('gwSmsKey');

    const saveBtn   = document.getElementById('btnSaveGateway');
    const testBtn   = document.getElementById('btnTestEmail');
    const statusBadge = document.getElementById('smtpStatusBadge');
    const msgDiv    = document.getElementById('gatewayMsg');

    if (!saveBtn) return; // Gateway panel not on page

    // Load config on page load
    loadGatewayConfig();

    saveBtn.addEventListener('click', saveGatewayConfig);
    testBtn.addEventListener('click', testEmailConfig);

    async function loadGatewayConfig() {
      try {
        const res  = await fetch('/api/config/gateway');
        const data = await res.json();
        if (!data.success) return;

        const cfg = data.config || {};
        if (smtpHost)  smtpHost.value  = cfg.smtp_host  || 'smtp.gmail.com';
        if (smtpPort)  smtpPort.value  = cfg.smtp_port  || 465;
        if (smtpUser)  smtpUser.value  = cfg.smtp_user  || '';
        if (smtpPass)  smtpPass.value  = cfg.smtp_password || '';
        if (fromEmail) fromEmail.value = cfg.from_name  || 'Toffee AI Security';
        if (smsUrl)    smsUrl.value    = cfg.sms_api_url || '';
        if (smsKey)    smsKey.value    = cfg.sms_api_key || '';

        updateStatusBadge(cfg.smtp_user && cfg.smtp_password && cfg.smtp_password !== '••••••••••••');
      } catch (err) {
        updateStatusBadge(false);
      }
    }

    async function saveGatewayConfig() {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving…';

      const payload = {
        smtp_host:     smtpHost?.value?.trim()  || 'smtp.gmail.com',
        smtp_port:     parseInt(smtpPort?.value || '465'),
        smtp_use_ssl:  parseInt(smtpPort?.value || '465') === 465,
        smtp_user:     smtpUser?.value?.trim()  || '',
        smtp_password: smtpPass?.value          || '',
        from_name:     fromEmail?.value?.trim() || 'Toffee AI Security',
        from_email:    `${fromEmail?.value?.trim() || 'Toffee AI Security'} <${smtpUser?.value?.trim() || 'no-reply@toffee.ai'}>`,
        sms_api_url:   smsUrl?.value?.trim()    || '',
        sms_api_key:   smsKey?.value?.trim()    || '',
      };

      try {
        const res  = await fetch('/api/config/gateway', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          showMsg('✅ Gateway configuration saved! OTPs will now be sent via Gmail SMTP.', 'success');
          updateStatusBadge(!!payload.smtp_user && !!payload.smtp_password);
          window.showToast?.('Gmail SMTP config saved successfully!', 'success');
        } else {
          showMsg(`❌ Save failed: ${data.error || 'Unknown error'}`, 'error');
        }
      } catch (err) {
        showMsg(`❌ Network error: ${err.message}`, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Config';
      }
    }

    async function testEmailConfig() {
      const to = testEmail?.value?.trim();
      if (!to || !to.includes('@')) {
        showMsg('⚠️ Please enter a valid test recipient email address.', 'warn');
        return;
      }

      testBtn.disabled = true;
      testBtn.textContent = '⏳ Sending…';
      showMsg('📤 Sending test email via Gmail SMTP…', 'info');

      try {
        const res  = await fetch('/api/config/test-email', {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ email: to })
        });
        const data = await res.json();

        if (data.success) {
          showMsg(`✅ Test email sent to <strong>${to}</strong>! Check your inbox.`, 'success');
          window.showToast?.('Test email sent! Check your inbox.', 'success');
        } else {
          const isNotConfig = data.smtp_configured === false;
          if (isNotConfig) {
            showMsg(`⚠️ SMTP not configured yet. Fill in your Gmail credentials above and click "Save Config" first.`, 'warn');
          } else {
            showMsg(`❌ Email delivery failed: ${data.message || data.error}`, 'error');
          }
        }
      } catch (err) {
        showMsg(`❌ Request failed: ${err.message}`, 'error');
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = '🧪 Test Email';
      }
    }

    function updateStatusBadge(isConfigured) {
      if (!statusBadge) return;
      if (isConfigured) {
        statusBadge.textContent = '✅ SMTP Configured';
        statusBadge.style.background = 'rgba(16,185,129,0.2)';
        statusBadge.style.color = '#34D399';
        statusBadge.style.border = '1px solid rgba(16,185,129,0.4)';
      } else {
        statusBadge.textContent = '⚠️ SMTP Not Set';
        statusBadge.style.background = 'rgba(245,158,11,0.15)';
        statusBadge.style.color = '#F59E0B';
        statusBadge.style.border = '1px solid rgba(245,158,11,0.35)';
      }
    }

    function showMsg(html, type = 'info') {
      if (!msgDiv) return;
      const colors = {
        success: { bg: 'rgba(16,185,129,0.12)', color: '#34D399', border: 'rgba(16,185,129,0.3)' },
        error:   { bg: 'rgba(239,68,68,0.12)',  color: '#F87171', border: 'rgba(239,68,68,0.3)' },
        warn:    { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
        info:    { bg: 'rgba(56,189,248,0.10)', color: '#38BDF8', border: 'rgba(56,189,248,0.3)' },
      };
      const c = colors[type] || colors.info;
      msgDiv.style.display = 'block';
      msgDiv.style.background = c.bg;
      msgDiv.style.color = c.color;
      msgDiv.style.border = `1px solid ${c.border}`;
      msgDiv.style.padding = '10px 14px';
      msgDiv.style.borderRadius = '8px';
      msgDiv.innerHTML = html;
    }

    // ─── Global OTP delivery status hook ───
    // auth.js will call this when OTP send fails due to SMTP not configured
    window.ToffeeGateway = {
      showSmtpNotConfiguredAlert(identifier) {
        const card = document.getElementById('db-studio');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        showMsg(
          `⚠️ <strong>SMTP Not Configured!</strong> OTP could not be sent to <em>${identifier}</em>.<br>
          Please scroll down to <strong>⚙️ Email & SMS Gateway Settings</strong> below, enter your Gmail App Password and click Save.`,
          'warn'
        );
        // Flash gateway card
        const gwCard = document.getElementById('gatewaySettingsCard');
        if (gwCard) {
          gwCard.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.6)';
          setTimeout(() => { gwCard.style.boxShadow = ''; }, 2500);
        }
      }
    };
  });

})();
