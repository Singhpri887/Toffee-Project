/**
 * js/auth.js - Authentication & User State Management for toffee.ai
 * Handles Email/Phone OTP Signup, Multi-factor Login, Sessions, and User Profile.
 */

(function () {
  const SESSION_KEY = 'toffee_auth_token';
  const USER_KEY    = 'toffee_auth_user';

  // Global State
  window.ToffeeAuth = {
    currentUser: null,
    token: null,

    init() {
      this.token = localStorage.getItem(SESSION_KEY);
      this.bindEvents();
      this.checkSession();
    },

    bindEvents() {
      const modal = document.getElementById('authModal');
      if (!modal) return;

      // Close handlers
      modal.querySelectorAll('.auth-modal-close').forEach(btn => {
        btn.addEventListener('click', () => this.closeModal());
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });

      // Open Triggers (Buttons with .open-auth-modal)
      document.querySelectorAll('.open-auth-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const tab = btn.dataset.tab || 'signup';
          const sub = btn.dataset.sub || 'email';
          this.openModal(tab, sub);
        });
      });

      // Main Tabs (Signup / Login / Voice)
      modal.querySelectorAll('.auth-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          this.switchTab(tab);
        });
      });

      // Sub-tabs (Email vs Phone)
      modal.querySelectorAll('.auth-sub-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          const sub = btn.dataset.sub;
          this.switchSubTab(sub);
        });
      });

      // OTP Send Buttons
      const sendSignupOtpBtn = document.getElementById('btnSendSignupOtp');
      if (sendSignupOtpBtn) {
        sendSignupOtpBtn.addEventListener('click', () => this.sendOtp('signup'));
      }

      const sendLoginOtpBtn = document.getElementById('btnSendLoginOtp');
      if (sendLoginOtpBtn) {
        sendLoginOtpBtn.addEventListener('click', () => this.sendOtp('login'));
      }

      // Signup Form
      const signupForm = document.getElementById('authSignupForm');
      if (signupForm) {
        signupForm.addEventListener('submit', (e) => this.handleSignup(e));
      }

      // Password Login Form
      const loginForm = document.getElementById('authLoginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => this.handlePasswordLogin(e));
      }

      // OTP Login Form
      const loginOtpForm = document.getElementById('authLoginOtpForm');
      if (loginOtpForm) {
        loginOtpForm.addEventListener('submit', (e) => this.handleOtpLogin(e));
      }

      // Header User Avatar Dropdown
      const avatarBtn = document.getElementById('headerUserAvatarBtn');
      const dropdown  = document.getElementById('userDropdownMenu');
      if (avatarBtn && dropdown) {
        avatarBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('show');
        });
        document.addEventListener('click', () => dropdown.classList.remove('show'));
      }

      // Logout buttons
      document.querySelectorAll('.btn-auth-logout').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.logout();
        });
      });

      // Setup OTP input auto-advance
      this.setupOtpInputs('signupOtpContainer');
      this.setupOtpInputs('loginOtpContainer');
    },

    setupOtpInputs(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const inputs = container.querySelectorAll('.otp-digit-input');

      inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
          const val = e.target.value;
          if (val && index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !input.value && index > 0) {
            inputs[index - 1].focus();
          }
        });

        input.addEventListener('paste', (e) => {
          e.preventDefault();
          const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
          if (/^\d{6}$/.test(pasteData)) {
            inputs.forEach((inp, idx) => inp.value = pasteData[idx] || '');
            inputs[inputs.length - 1].focus();
          }
        });
      });
    },

    getOtpValue(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return '';
      let otp = '';
      container.querySelectorAll('.otp-digit-input').forEach(inp => otp += inp.value);
      return otp;
    },

    setOtpValue(containerId, code) {
      const container = document.getElementById(containerId);
      if (!container || !code) return;
      const inputs = container.querySelectorAll('.otp-digit-input');
      inputs.forEach((inp, idx) => inp.value = code[idx] || '');
    },

    openModal(tab = 'signup', sub = 'email') {
      const modal = document.getElementById('authModal');
      if (!modal) return;
      modal.classList.add('open');
      this.switchTab(tab);
      this.switchSubTab(sub);
    },

    closeModal() {
      const modal = document.getElementById('authModal');
      if (!modal) return;
      modal.classList.remove('open');
    },

    switchTab(tab) {
      document.querySelectorAll('.auth-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });

      const signupView = document.getElementById('authSignupView');
      const loginView  = document.getElementById('authLoginView');
      const voiceView  = document.getElementById('authVoiceView');

      if (signupView) signupView.style.display = tab === 'signup' ? 'block' : 'none';
      if (loginView)  loginView.style.display  = tab === 'login'  ? 'block' : 'none';
      if (voiceView)  voiceView.style.display  = tab === 'voice'  ? 'block' : 'none';
    },

    switchSubTab(sub) {
      document.querySelectorAll('.auth-sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sub === sub);
      });

      // Toggle email vs phone inputs in signup
      const emailGroup = document.getElementById('signupEmailGroup');
      const phoneGroup = document.getElementById('signupPhoneGroup');
      if (emailGroup && phoneGroup) {
        emailGroup.style.display = sub === 'email' ? 'block' : 'none';
        phoneGroup.style.display = sub === 'phone' ? 'block' : 'none';
      }

      // Toggle Password vs OTP in Login
      const loginPassGroup = document.getElementById('loginPasswordGroup');
      const loginOtpGroup  = document.getElementById('loginOtpSection');
      if (loginPassGroup && loginOtpGroup) {
        loginPassGroup.style.display = sub === 'otp' ? 'none' : 'block';
        loginOtpGroup.style.display  = sub === 'otp' ? 'block' : 'none';
      }
    },

    async sendOtp(intent = 'signup') {
      const isSignup = intent === 'signup';
      const activeSub = document.querySelector('.auth-sub-tab.active')?.dataset.sub || 'email';
      
      let identifier = '';
      let type = activeSub;

      if (isSignup) {
        identifier = activeSub === 'email'
          ? document.getElementById('signupEmail')?.value.trim()
          : document.getElementById('signupPhone')?.value.trim();
      } else {
        identifier = document.getElementById('loginIdentifier')?.value.trim();
        type = identifier.includes('@') ? 'email' : 'phone';
      }

      if (!identifier) {
        window.showToast?.(`Please enter your ${type} first.`, 'error');
        return;
      }

      const btn = isSignup ? document.getElementById('btnSendSignupOtp') : document.getElementById('btnSendLoginOtp');
      const originalText = btn ? btn.innerHTML : 'Send Code';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Sending OTP…';
      }

      try {
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, type, intent })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');

        if (data.success && data.delivered) {
          // ✅ Real email/SMS delivered via Gmail SMTP
          window.showToast?.(`✅ Verification code sent to ${identifier}! Check your ${type === 'email' ? 'inbox' : 'phone'}.`, 'success');

          // Show OTP input section
          const otpSection = isSignup
            ? document.getElementById('signupOtpSection')
            : document.getElementById('loginOtpContainer');
          if (otpSection) otpSection.style.display = 'block';

          if (btn) {
            let timer = 60;
            const interval = setInterval(() => {
              btn.innerHTML = `Resend in ${timer}s`;
              timer--;
              if (timer < 0) {
                clearInterval(interval);
                btn.disabled = false;
                btn.innerHTML = originalText;
              }
            }, 1000);
          }
        } else {
          // ⚠️ SMTP not configured — guide user to Gateway Settings
          if (btn) { btn.disabled = false; btn.innerHTML = originalText; }

          const smtpMsg = data.smtp_configured === false
            ? `⚠️ SMTP Gateway not configured. To receive real OTPs, please set up your Gmail App Password in the ⚙️ Gateway Settings (scroll down to 🗄️ DB Studio section).`
            : (data.message || 'Could not send verification code.');

          window.showToast?.(smtpMsg, 'error');

          // Scroll and highlight gateway settings
          window.ToffeeGateway?.showSmtpNotConfiguredAlert(identifier);
        }
      } catch (err) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
        window.showToast?.(err.message, 'error');
      }
    },

    async handleSignup(e) {
      e.preventDefault();
      const activeSub = document.querySelector('.auth-sub-tab.active')?.dataset.sub || 'email';
      const name = document.getElementById('signupName')?.value.trim();
      const identifier = activeSub === 'email'
        ? document.getElementById('signupEmail')?.value.trim()
        : document.getElementById('signupPhone')?.value.trim();
      const password = document.getElementById('signupPassword')?.value;
      const otp = this.getOtpValue('signupOtpContainer');

      if (!name || !identifier || !password) {
        window.showToast?.('Please fill in all required fields.', 'error');
        return;
      }
      if (!otp) {
        window.showToast?.('Please enter the 6-digit verification code.', 'error');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitSignup');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, identifier, type: activeSub, password, otp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');

        this.setSession(data.user);
        this.closeModal();
        window.showToast?.(`Welcome to Toffee AI, ${data.user.name}! 🚀`, 'success');

        // Prompt voice enrollment
        setTimeout(() => {
          if (confirm("Would you like to enroll your Voice Biometrics for 1-click voice login?")) {
            window.ToffeeVoice?.openEnrollment();
          }
        }, 800);
      } catch (err) {
        window.showToast?.(err.message, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    },

    async handlePasswordLogin(e) {
      e.preventDefault();
      const identifier = document.getElementById('loginIdentifier')?.value.trim();
      const password = document.getElementById('loginPassword')?.value;

      if (!identifier || !password) {
        window.showToast?.('Please enter your email/phone and password.', 'error');
        return;
      }

      const submitBtn = document.getElementById('btnSubmitLogin');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');

        this.setSession(data.user);
        this.closeModal();
        window.showToast?.(`Welcome back, ${data.user.name}! 👋`, 'success');
      } catch (err) {
        window.showToast?.(err.message, 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    },

    async handleOtpLogin(e) {
      e.preventDefault();
      const identifier = document.getElementById('loginIdentifier')?.value.trim();
      const otp = this.getOtpValue('loginOtpContainer');

      if (!identifier || !otp) {
        window.showToast?.('Please enter identifier and the 6-digit OTP.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/auth/login-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, otp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'OTP Login failed.');

        this.setSession(data.user);
        this.closeModal();
        window.showToast?.(`Logged in via OTP! Welcome, ${data.user.name}.`, 'success');
      } catch (err) {
        window.showToast?.(err.message, 'error');
      }
    },

    async checkSession() {
      if (!this.token) {
        this.renderLoggedOutUI();
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        if (res.ok && data.authenticated) {
          this.currentUser = data.user;
          this.renderLoggedInUI(data.user);
        } else {
          this.logout(false);
        }
      } catch (err) {
        this.renderLoggedOutUI();
      }
    },

    setSession(user) {
      if (!user) return;
      this.currentUser = user;
      this.token = user.token;
      localStorage.setItem(SESSION_KEY, user.token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      this.renderLoggedInUI(user);
    },

    logout(notify = true) {
      if (this.token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.token}` }
        }).catch(() => {});
      }
      this.token = null;
      this.currentUser = null;
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(USER_KEY);
      this.renderLoggedOutUI();
      if (notify) window.showToast?.('You have been logged out.', 'info');
    },

    renderLoggedInUI(user) {
      const guestGroup = document.getElementById('headerGuestAuthGroup');
      const userGroup  = document.getElementById('headerUserAuthGroup');
      const userNameEl = document.getElementById('headerUserName');
      const userInitEl = document.getElementById('headerUserInitial');
      const dropNameEl = document.getElementById('userDropdownName');
      const dropMailEl = document.getElementById('userDropdownEmail');
      const voiceBadge = document.getElementById('userVoiceStatusBadge');

      if (guestGroup) guestGroup.style.display = 'none';
      if (userGroup)  userGroup.style.display  = 'flex';

      const initial = user.name ? user.name[0].toUpperCase() : 'U';
      if (userNameEl) userNameEl.textContent = user.name.split(' ')[0];
      if (userInitEl) userInitEl.textContent = initial;
      if (dropNameEl) dropNameEl.textContent = user.name;
      if (dropMailEl) dropMailEl.textContent = user.email || user.phone || 'Developer Account';
      if (voiceBadge) {
        voiceBadge.textContent = user.voice_enrolled ? '🎙️ Voice Active' : '🎙️ Voice Not Set';
        voiceBadge.className = `badge ${user.voice_enrolled ? 'badge-emerald' : 'badge-amber'}`;
      }
    },

    renderLoggedOutUI() {
      const guestGroup = document.getElementById('headerGuestAuthGroup');
      const userGroup  = document.getElementById('headerUserAuthGroup');
      if (guestGroup) guestGroup.style.display = 'flex';
      if (userGroup)  userGroup.style.display  = 'none';
    }
  };

  document.addEventListener('DOMContentLoaded', () => window.ToffeeAuth.init());
})();
