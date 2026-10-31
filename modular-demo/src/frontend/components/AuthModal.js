/**
 * Reusable AuthModal Component
 * Provides the interactive sign-in / sign-up overlay, password visibility toggle,
 * and status messaging.
 */
export function createAuthModal({ onSubmit, onSignup, onCancel } = {}) {
  const panel = document.createElement('div');
  panel.id = 'demo-login';
  panel.className = 'login-overlay';
  panel.innerHTML = `
    <section class="login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <span class="eyebrow">ARCHSCALE · SUPABASE</span>
      <h2 id="login-title">Sign in</h2>
      <p>Use your account for the ArchScale four-app platform.</p>
      <form id="demo-login-form">
        <label for="login-email">Email</label>
        <input id="login-email" name="email" type="email" autocomplete="username" required>
        <label for="login-password">Password</label>
        <div class="password-control">
          <input id="login-password" name="password" type="password" autocomplete="current-password" required>
          <button id="toggle-password" class="password-toggle" type="button" aria-label="Show password" aria-pressed="false">Show</button>
        </div>
        <div class="login-error" role="status" aria-live="polite"></div>
        <button class="primary" type="submit">Sign in</button>
        <button id="signup" class="secondary" type="button">Create Account</button>
        <p class="login-hint">Create your account once, then use Sign in next time.</p>
      </form>
    </section>
  `;

  const passwordInput = panel.querySelector('#login-password');
  const toggleBtn = panel.querySelector('#toggle-password');
  toggleBtn.addEventListener('click', () => {
    const reveal = passwordInput.type === 'password';
    passwordInput.type = reveal ? 'text' : 'password';
    toggleBtn.textContent = reveal ? 'Hide' : 'Show';
    toggleBtn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    toggleBtn.setAttribute('aria-pressed', String(reveal));
  });

  if (onSignup) {
    panel.querySelector('#signup').addEventListener('click', onSignup);
  }

  return panel;
}
