/**
 * ONLINE STUDY PLATFORM — MANDATORY AUTH GUARD & SESSION MANAGER
 * Enforces role-based security, persistent 30-day sessions, and Google Password Manager compatibility.
 */
const AuthGuard = {
  activeRole: '',
  onSuccess: null,

  injectOverlay() {
    if (document.getElementById('authGateOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'authGateOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #090d16;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #FFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
      box-sizing: border-box;
    `;
    overlay.innerHTML = `
      <style>
        @keyframes authSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .auth-card-box {
          background: #121826;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 28px 24px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.5);
          box-sizing: border-box;
        }
        .auth-form-input {
          width: 100%;
          height: 42px;
          background: #090d16;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          color: #FFF;
          padding: 0 12px;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        }
        .auth-form-input:focus {
          border-color: #F5C542;
        }
        .auth-btn-submit {
          width: 100%;
          height: 42px;
          background: #F5C542;
          color: #000;
          font-weight: 700;
          font-size: 14px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .auth-btn-submit:hover {
          opacity: 0.92;
        }
      </style>
      <div id="authGateSpinner" style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:38px;height:38px;border:3px solid rgba(245,197,66,0.2);border-top:3px solid #F5C542;border-radius:50%;animation:authSpin 0.7s linear infinite;margin-bottom:14px;"></div>
        <div style="font-size:14px;color:#94a3b8;font-weight:600;">Verifying Session Access...</div>
      </div>
      <div id="authGateContent" style="display:none;width:100%;max-width:400px;"></div>
    `;
    document.body.appendChild(overlay);
  },

  async init(requiredRole, callback) {
    this.activeRole = requiredRole;
    this.onSuccess = callback;
    this.injectOverlay();

    const result = await LiveAPI.verifySession(requiredRole);

    if (result.authenticated && result.authorized) {
      // Valid Session!
      this.removeOverlay();
      if (typeof callback === 'function') {
        callback(result.user);
      }
      return;
    }

    if (result.authenticated && !result.authorized) {
      // Logged in with wrong role
      this.renderAccessDenied(result.user, requiredRole);
      return;
    }

    // Unauthenticated
    this.renderLoginForm(requiredRole);
  },

  removeOverlay() {
    const overlay = document.getElementById('authGateOverlay');
    if (overlay) {
      overlay.remove();
    }
  },

  renderLoginForm(role) {
    const spinner = document.getElementById('authGateSpinner');
    const content = document.getElementById('authGateContent');
    if (spinner) spinner.style.display = 'none';
    if (!content) return;

    content.style.display = 'block';

    const roleName = role.charAt(0).toUpperCase() + role.slice(1);
    const defaultEmail = role === 'admin' ? 'kumarshubham3187@gmail.com' : '';

    content.innerHTML = `
      <div class="auth-card-box">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <div style="width:32px;height:32px;background:rgba(245,197,66,0.12);color:#F5C542;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">
            ${role === 'admin' ? '🛡️' : role === 'teacher' ? '👨‍🏫' : '🎓'}
          </div>
          <div>
            <div style="font-size:17px;font-weight:800;color:#FFF;">${roleName} Authentication</div>
            <div style="font-size:12px;color:#94a3b8;">Login required to enter this protected workspace</div>
          </div>
        </div>

        <div id="authGateError" style="display:none;color:#ff5c5c;background:rgba(255,92,92,0.12);border:1px solid rgba(255,92,92,0.25);padding:9px 12px;border-radius:6px;margin-bottom:14px;font-size:12.5px;line-height:1.4;"></div>

        <form id="authGuardForm" action="#" method="POST" autocomplete="on" onsubmit="event.preventDefault(); AuthGuard.submitLogin();">
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin-bottom:6px;" for="authEmail">Email Address</label>
            <input class="auth-form-input" type="email" name="email" id="authEmail" autocomplete="username" required placeholder="name@university.edu" value="${defaultEmail}" />
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12px;font-weight:700;color:#cbd5e1;margin-bottom:6px;" for="authPassword">Password</label>
            <div style="position:relative;display:flex;align-items:center;">
              <input class="auth-form-input" type="password" name="password" id="authPassword" autocomplete="current-password" required placeholder="••••••••" style="padding-right:38px;" />
              <button type="button" onclick="AuthGuard.togglePass()" style="position:absolute;right:8px;background:none;border:none;color:#94a3b8;cursor:pointer;padding:4px;display:flex;align-items:center;" title="Show/Hide Password">
                👁
              </button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;color:#94a3b8;">
              <input type="checkbox" id="authRememberMe" checked style="accent-color:#F5C542;cursor:pointer;width:14px;height:14px;" />
              <span>Remember login</span>
            </label>
            <a href="index.html" style="color:#F5C542;text-decoration:none;font-weight:600;">Switch Portal</a>
          </div>

          <button type="submit" class="auth-btn-submit" id="authSubmitBtn">Sign In to ${roleName} Panel →</button>
        </form>

        ${role === 'student' ? `
          <div style="text-align:center;margin-top:14px;font-size:12px;color:#94a3b8;">
            New student? <a href="student.html?mode=register" onclick="window.location.search='?mode=register';return false;" style="color:#F5C542;font-weight:700;text-decoration:underline;">Create Account</a>
          </div>
        ` : ''}
      </div>
    `;
  },

  togglePass() {
    const input = document.getElementById('authPassword');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  },

  async submitLogin() {
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    const errEl = document.getElementById('authGateError');
    const submitBtn = document.getElementById('authSubmitBtn');

    if (errEl) errEl.style.display = 'none';

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'Please enter both email and password.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Authenticating...';
    }

    try {
      let res;
      if (this.activeRole === 'teacher') {
        res = await LiveAPI.teacherLogin(email, password);
      } else {
        res = await LiveAPI.login(email, password, this.activeRole);
      }

      const user = res.user || res.data?.user;
      if (res.success && user) {
        if (user.role === 'teacher' || this.activeRole === 'teacher') {
          sessionStorage.setItem('osp_active_teacher_id', user._id || user.id);
        }
        this.removeOverlay();
        if (typeof this.onSuccess === 'function') {
          this.onSuccess(user);
        }
      } else {
        throw new Error(res.message || 'Login failed.');
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = `Login failed: ${err.message || 'Invalid credentials'}`;
        errEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = `Sign In to ${this.activeRole.charAt(0).toUpperCase() + this.activeRole.slice(1)} Panel →`;
      }
    }
  },

  renderAccessDenied(user, requiredRole) {
    const spinner = document.getElementById('authGateSpinner');
    const content = document.getElementById('authGateContent');
    if (spinner) spinner.style.display = 'none';
    if (!content) return;

    content.style.display = 'block';
    const userRole = (user.role || 'user').toUpperCase();
    const reqRole = requiredRole.toUpperCase();

    let correctUrl = 'index.html';
    if (user.role === 'admin' || user.role === 'super_admin') correctUrl = 'admin.html';
    else if (user.role === 'teacher') correctUrl = 'teacher.html';
    else if (user.role === 'student') correctUrl = 'student.html';

    content.innerHTML = `
      <div class="auth-card-box" style="text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">🚫</div>
        <div style="font-size:18px;font-weight:800;color:#ef4444;margin-bottom:6px;">Access Restricted</div>
        <div style="font-size:13px;color:#94a3b8;line-height:1.5;margin-bottom:18px;">
          You are currently signed in as <strong>${user.name || user.email}</strong> (<span style="color:#F5C542;">${userRole}</span>).<br>
          This panel requires <strong>${reqRole}</strong> privileges.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <a href="${correctUrl}" class="auth-btn-submit" style="display:flex;align-items:center;justify-content:center;text-decoration:none;">
            Go to Your ${userRole} Dashboard →
          </a>
          <button type="button" onclick="AuthGuard.logout()" style="background:#1e293b;color:#FFF;border:1px solid rgba(255,255,255,0.15);height:40px;border-radius:8px;font-weight:600;cursor:pointer;">
            Sign In with Different Account
          </button>
        </div>
      </div>
    `;
  },

  logout() {
    LiveAPI.logout();
  },
};

window.AuthGuard = AuthGuard;
