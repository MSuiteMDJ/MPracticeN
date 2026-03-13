import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { setUserContext, clearUserContext } from './api-service';
import { initializeDemoAccount } from '@/lib/demo-account';
import type {
  User,
  AuthUser,
  SignupFormData,
} from '@/types';

type AuthContextType = {
  user: AuthUser;
  login: (username: string, password: string, remember?: boolean) => Promise<boolean>;
  register: (data: SignupFormData) => Promise<boolean>;
  enterDemoMode: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// USER STORAGE
// ============================================

// Demo user account (matches hybrid API)
export const DEMO_USER: User = {
  user_id: 'demo-user-001',
  username: 'demo@mpractice.com',
  password: 'demo1234',
  user_type: 'AGENT',
  profile: {
    declarant_name: 'Demo User',
    declarant_capacity: 'agent',
    declarant_organisation_name: 'Demo Company',
    email: 'demo@mpractice.com',
    phone: '+44 20 1234 5678',
    address: '100 Parliament Street',
    city: 'London',
    postcode: 'SW1A 2BQ',
    country: 'GB',
  },
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// In-memory user storage (will be replaced with backend)
export const users: User[] = [];
if (!users.some((u) => u.user_id === DEMO_USER.user_id)) {
  users.push(DEMO_USER);
}

const USERS_STORAGE_KEY = 'mdr-auth-users';
const CURRENT_USER_KEY = 'mdr-current-user';

const isBrowser = () => typeof window !== 'undefined';

const persistUsers = () => {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.warn('Failed to persist auth users:', error);
  }
};

const loadPersistedUsers = () => {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return;
    const storedUsers: User[] = JSON.parse(raw);
    storedUsers.forEach((storedUser) => {
      if (!users.some((u) => u.user_id === storedUser.user_id)) {
        users.push(storedUser);
      }
    });
  } catch (error) {
    console.warn('Failed to load persisted auth users:', error);
  }
};

const syncAgentSystemSettings = (input: {
  fullName?: string;
  email?: string;
  companyName?: string;
}) => {
  if (!isBrowser()) return;

  try {
    const existingRaw = localStorage.getItem('systemSettings');
    const existing = existingRaw ? JSON.parse(existingRaw) : {};
    const nextSettings = {
      ...existing,
      userType: 'agent',
      fullName: input.fullName || existing.fullName || '',
      email: input.email || existing.email || '',
      companyName: input.companyName || existing.companyName || '',
      agentContact: input.fullName || existing.agentContact || '',
      hasEori: existing.hasEori ?? false,
      hasVat: existing.hasVat ?? false,
      allowBranding: existing.allowBranding ?? false,
    };

    localStorage.setItem('systemSettings', JSON.stringify(nextSettings));
    window.dispatchEvent(new Event('settingsUpdated'));
  } catch (error) {
    console.warn('Failed to sync system settings:', error);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isBrowser() || initializedRef.current) return;
    initializedRef.current = true;
    loadPersistedUsers();
    const storedUserId = localStorage.getItem(CURRENT_USER_KEY);
    if (storedUserId) {
      const existingUser = users.find((u) => u.user_id === storedUserId);
      if (existingUser) {
        const authUser: AuthUser = {
          id: existingUser.user_id,
          username: existingUser.username,
          email: existingUser.profile.email,
          user_type: existingUser.user_type,
          declarant_name: existingUser.profile.declarant_name,
          declarant_capacity: existingUser.profile.declarant_capacity,
          declarant_organisation_name: existingUser.profile.declarant_organisation_name,
          entity_type: existingUser.profile.entity_type,
          entity_id: existingUser.profile.entity_id,
        };
        setUser(authUser);
        if (isBrowser()) {
          localStorage.setItem(CURRENT_USER_KEY, existingUser.user_id);
        }
        syncAgentSystemSettings({
          fullName: existingUser.profile.declarant_name,
          email: existingUser.profile.email,
          companyName: existingUser.profile.declarant_organisation_name,
        });
        setUserContext({
          user_id: existingUser.user_id,
          user_type: existingUser.user_type,
          entity_id: existingUser.profile.entity_id,
          declarant_name: existingUser.profile.declarant_name,
          declarant_capacity: existingUser.profile.declarant_capacity,
          declarant_organisation_name: existingUser.profile.declarant_organisation_name,
        });
      }
    }
  }, []);

  async function login(username: string, password: string) {
    try {
      // Use hybrid API for login
      const { login: hybridLogin } = await import('./hybrid-api');
      const result = await hybridLogin(username, password);
      
      if (!result.success) {
        throw new Error('Invalid credentials');
      }

      // Create auth user object based on mode
      const authUser: AuthUser = {
        id: result.mode === 'demo' ? 'demo-user-001' : result.user.id || 'user-001',
        username: result.user.email,
        email: result.user.email,
        role: result.user.role,
        role_name: result.user.role_name,
        permissions: Array.isArray(result.user.permissions) ? result.user.permissions : undefined,
        user_type: 'AGENT',
        declarant_name: `${result.user.first_name} ${result.user.last_name}`,
        declarant_capacity: 'agent',
        declarant_organisation_name: result.user.company_name,
      };

      setUser(authUser);

      // Set user context for API calls
      setUserContext({
        user_id: authUser.id,
        user_type: authUser.user_type,
        entity_id: authUser.entity_id,
        declarant_name: authUser.declarant_name,
        declarant_capacity: authUser.declarant_capacity,
        declarant_organisation_name: authUser.declarant_organisation_name,
      });

      // Initialize demo account if in demo mode
      if (result.mode === 'demo' && isBrowser()) {
        try {
          initializeDemoAccount();
        } catch (error) {
          console.warn('Failed to initialize demo account settings:', error);
        }
      }

      if (isBrowser()) {
        localStorage.setItem(CURRENT_USER_KEY, authUser.id);
      }
      syncAgentSystemSettings({
        fullName: authUser.declarant_name,
        email: authUser.email,
        companyName: authUser.declarant_organisation_name,
      });

      return true;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Login failed');
    }
  }

  async function register(data: SignupFormData) {
    if (!data.company_name?.trim()) {
      throw new Error('Company name is required.');
    }
    if (!data.first_name.trim() || !data.last_name.trim()) {
      throw new Error('First name and last name are required.');
    }
    if (!data.email.trim() || !data.email.includes('@')) {
      throw new Error('Valid email address is required.');
    }
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }
    if (data.password !== data.password_confirm) {
      throw new Error('Passwords do not match.');
    }

    const { register: hybridRegister } = await import('./hybrid-api');
    const result = await hybridRegister({
      company_name: data.company_name.trim(),
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email.trim(),
      password: data.password,
    });

    const authUserId = result?.user?.id || result?.user_id || `user-${Date.now()}`;
    const authUser: AuthUser = {
      id: authUserId,
      username: result?.user?.email || data.email.trim(),
      email: result?.user?.email || data.email.trim(),
      role: result?.user?.role,
      role_name: result?.user?.role_name,
      permissions: Array.isArray(result?.user?.permissions) ? result.user.permissions : undefined,
      user_type: 'AGENT',
      declarant_name: `${data.first_name.trim()} ${data.last_name.trim()}`,
      declarant_capacity: 'agent',
      declarant_organisation_name: data.company_name.trim(),
    };

    const persistedUser: User = {
      user_id: authUserId,
      username: authUser.username,
      password: data.password,
      user_type: 'AGENT',
      profile: {
        declarant_name: authUser.declarant_name || '',
        declarant_capacity: 'agent',
        declarant_organisation_name: data.company_name.trim(),
        email: authUser.email || data.email.trim(),
        phone: '',
        address: '',
        city: '',
        postcode: '',
        country: 'GB',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!users.some((u) => u.user_id === persistedUser.user_id)) {
      users.push(persistedUser);
      persistUsers();
    }

    setUser(authUser);
    if (isBrowser()) {
      localStorage.setItem(CURRENT_USER_KEY, authUserId);
    }
    syncAgentSystemSettings({
      fullName: `${data.first_name.trim()} ${data.last_name.trim()}`,
      email: data.email.trim(),
      companyName: data.company_name.trim(),
    });

    setUserContext({
      user_id: authUserId,
      user_type: 'AGENT',
      entity_id: undefined,
      declarant_name: authUser.declarant_name || '',
      declarant_capacity: 'agent',
      declarant_organisation_name: data.company_name.trim(),
    });

    return true;
  }

  function logout() {
    // Use hybrid API logout
    import('./hybrid-api').then(({ logout: hybridLogout }) => {
      hybridLogout();
    });

    // Clear user context
    clearUserContext();

    setUser(null);
    if (isBrowser()) {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  }

  /**
   * Enter Demo Mode (deprecated - use regular login with demo@mpractice.com)
   * Kept for backward compatibility
   */
  async function enterDemoMode() {
    // Just login as demo user
    await login('demo@mpractice.com', 'demo1234');
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, enterDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthProvider;
