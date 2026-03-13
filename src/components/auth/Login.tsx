import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import BrandingHeader from '@/components/auth/BrandingHeader';

export default function Login() {
  const { login } = useAuth();
  
  // Load saved credentials or use demo as default
  const savedEmail = localStorage.getItem('saved_email') || 'demo@mpractice.com';
  const savedPassword = localStorage.getItem('saved_password') || 'demo1234';
  const savedRememberMe = localStorage.getItem('remember_me') === 'true';
  
  const [username, setUsername] = useState(savedEmail);
  const [password, setPassword] = useState(savedPassword);
  const [rememberMe, setRememberMe] = useState(savedRememberMe);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Use existing auth system (will be enhanced with hybrid API later)
      await login(username, password);
      
      // Mark mode for hybrid API
      if (username === 'demo@mpractice.com') {
        localStorage.setItem('current_user_email', username);
        localStorage.setItem('demo_mode', 'true');
      } else {
        localStorage.setItem('current_user_email', username);
        localStorage.removeItem('demo_mode');
      }
      
      // Save credentials if "Remember me" is checked
      if (rememberMe) {
        localStorage.setItem('saved_email', username);
        localStorage.setItem('saved_password', password);
        localStorage.setItem('remember_me', 'true');
      } else {
        // Clear saved credentials if unchecked
        localStorage.removeItem('saved_email');
        localStorage.removeItem('saved_password');
        localStorage.setItem('remember_me', 'false');
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Invalid credentials');
      setError(error.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="authPage">
      <div className="authCard">
        <BrandingHeader />
        <p className="authSubtitle">
          Streamline your client customs
          <br />
          operations and compliance
        </p>
        <p className="authPowered">Powered by M Assist</p>
        <form onSubmit={onSubmit}>
          <input
            className="authInput"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Email or username"
            required
          />
          <input
            className="authInput"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          {error && (
            <div
              style={{ color: '#ffb3b3', marginBottom: '0.75rem', fontSize: '0.9rem' }}
              role="alert"
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.75rem' }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            />
            <label
              htmlFor="rememberMe"
              style={{ fontSize: '0.9rem', color: '#ffffff', cursor: 'pointer' }}
            >
              Remember my credentials
            </label>
          </div>
          <button type="submit" className="authButton" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: '0.9rem', marginTop: '0.75rem', textAlign: 'center' }}>
          <Link to="/forgot-password" style={{ color: 'var(--gold)' }}>
            Forgot password?
          </Link>
        </p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.75rem', textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#ffffff' }}>
            Sign up
          </Link>
        </p>
        <p className="authFooter">Questions? Reach out to M Assist anytime.</p>
      </div>
    </div>
  );
}
