import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import type { SignupFormData } from '@/types';
import BrandingHeader from '@/components/auth/BrandingHeader';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<SignupFormData>({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirm: '',
    user_type: '',
    declarant_name: '',
    declarant_capacity: '',
    declarant_organisation_name: '',
    entity_type: '',
  });

  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof SignupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const validate = (): boolean => {
    if (!formData.company_name.trim()) {
      setError('Company name is required');
      return false;
    }
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Valid email address is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match');
      return false;
    }
    if (!agree) {
      setError('You must agree to the Terms of Service and Privacy Policy');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      <div className="authCard">
        <BrandingHeader />

        <h1 className="authTitle">Create Your Account</h1>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="authInput"
            placeholder="Company Name *"
            value={formData.company_name}
            onChange={(e) => updateField('company_name', e.target.value)}
            required
          />

          <input
            type="text"
            className="authInput"
            placeholder="First Name *"
            value={formData.first_name}
            onChange={(e) => updateField('first_name', e.target.value)}
            required
          />

          <input
            type="text"
            className="authInput"
            placeholder="Last Name *"
            value={formData.last_name}
            onChange={(e) => updateField('last_name', e.target.value)}
            required
          />

          <input
            type="email"
            className="authInput"
            placeholder="Email Address *"
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            required
          />

          <input
            type="password"
            className="authInput"
            placeholder="Password (min 8 characters) *"
            value={formData.password}
            onChange={(e) => updateField('password', e.target.value)}
            required
          />

          <input
            type="password"
            className="authInput"
            placeholder="Confirm Password *"
            value={formData.password_confirm}
            onChange={(e) => updateField('password_confirm', e.target.value)}
            required
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '1rem',
            }}
          >
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#d4af37', flexShrink: 0 }}
            />
            <label style={{ fontSize: '0.8rem', lineHeight: 1.3, textAlign: 'left' }}>
              I agree to the{' '}
              <a href="/terms" style={{ color: '#d4af37' }}>
                Terms of Service
              </a>
              <br />
              and{' '}
              <a href="/privacy" style={{ color: '#d4af37' }}>
                Privacy Policy
              </a>
            </label>
          </div>

          {error && (
            <div
              style={{
                color: '#ffb3b3',
                fontSize: '0.9rem',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(255, 179, 179, 0.1)',
                border: '1px solid rgba(255, 179, 179, 0.3)',
                borderRadius: '4px',
                textAlign: 'center',
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button type="submit" className="authButton" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ fontSize: '0.85rem', marginTop: '0.75rem', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#ffffff' }}>
            Sign in
          </Link>
        </p>

        <p className="authPowered" style={{ marginTop: '1rem' }}>
          Powered by M Assist
        </p>
      </div>
    </div>
  );
}
