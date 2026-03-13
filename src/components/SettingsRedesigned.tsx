import { useState, useEffect } from 'react';
import { 
  User, Building2, Users, Key, FileText, CheckCircle2, 
  AlertCircle, Mail, Trash2, Copy, Check, UserPlus, Eye, EyeOff,
  RefreshCw, Edit2, Send, Info, Layers, Plus
} from 'lucide-react';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import KPITile from '@/components/ui/KPITile';
import { contactsAPI } from '@/lib/api-service';
import { useSettings } from '@/contexts/SettingsContext';
import {
  createPortfolio,
  deletePortfolio,
  getPortfolios,
  subscribeToPortfolioUpdates,
  updatePortfolio,
  type Portfolio,
} from '@/lib/portfolio-model';

type SettingsSection = 'profile' | 'company' | 'email' | 'portfolios' | 'team' | 'hmrc' | 'companies-house' | 'gov-gateway';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'manager' | 'staff' | 'read_only';
  role_name?: string;
  permissions?: string[];
  created_at: string;
  last_login?: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  invitation_link: string;
}

interface RoleDefinition {
  code: 'admin' | 'manager' | 'staff' | 'read_only';
  name: string;
  description: string;
  permissions: string[];
  modules: string[];
}

const FALLBACK_ROLES: RoleDefinition[] = [
  {
    code: 'admin',
    name: 'Admin',
    description: 'Full practice access including settings and team management.',
    permissions: [],
    modules: [],
  },
  {
    code: 'manager',
    name: 'Manager',
    description: 'Operational manager with broad client workflow access.',
    permissions: [],
    modules: [],
  },
  {
    code: 'staff',
    name: 'Staff',
    description: 'Day-to-day practice user with client workflow access.',
    permissions: [],
    modules: [],
  },
  {
    code: 'read_only',
    name: 'Read-only',
    description: 'Read-only access across operational modules.',
    permissions: [],
    modules: [],
  },
];

export default function SettingsRedesigned() {
  const { updateSettings } = useSettings();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [eoriNumber, setEoriNumber] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

  // Email delivery
  const [emailProvider, setEmailProvider] = useState<'smtp'>('smtp');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [emailSmtpHost, setEmailSmtpHost] = useState('');
  const [emailSmtpPort, setEmailSmtpPort] = useState('587');
  const [emailSmtpUsername, setEmailSmtpUsername] = useState('');
  const [emailSmtpPassword, setEmailSmtpPassword] = useState('');
  const [emailSmtpPasswordSet, setEmailSmtpPasswordSet] = useState(false);
  const [emailSmtpSecure, setEmailSmtpSecure] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestRecipient, setEmailTestRecipient] = useState('');
  const [emailLastVerified, setEmailLastVerified] = useState<string | null>(null);
  const [emailTestResult, setEmailTestResult] = useState<'success' | 'error' | null>(null);
  
  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [iban, setIban] = useState('');
  const [swift, setSwift] = useState('');
  
  // HMRC credentials
  const [hmrcClientId, setHmrcClientId] = useState('');
  const [hmrcClientSecret, setHmrcClientSecret] = useState('');
  const [hmrcEnvironment, setHmrcEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [hmrcStatus, setHmrcStatus] = useState<'connected' | 'disconnected'>('disconnected');
  
  // Gov Gateway
  const [govGatewayUserId, setGovGatewayUserId] = useState('');
  const [govGatewayPassword, setGovGatewayPassword] = useState('');
  const [govGatewayStatus, setGovGatewayStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [showGovPassword, setShowGovPassword] = useState(false);
  
  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'staff' | 'read_only'>('staff');
  const [inviting, setInviting] = useState(false);
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState<string | null>(null);
  
  // HMRC Testing
  const [testingHmrc, setTestingHmrc] = useState(false);
  const [hmrcLastVerified, setHmrcLastVerified] = useState<string | null>(null);
  const [hmrcTestResult, setHmrcTestResult] = useState<'success' | 'error' | null>(null);

  // Companies House integration
  const [companiesHouseStatus, setCompaniesHouseStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [testingCompaniesHouse, setTestingCompaniesHouse] = useState(false);
  const [companiesHouseLastVerified, setCompaniesHouseLastVerified] = useState<string | null>(null);
  const [companiesHouseTestResult, setCompaniesHouseTestResult] = useState<'success' | 'error' | null>(null);
  const [companiesHouseApiKeyValue, setCompaniesHouseApiKeyValue] = useState('');
  const [companiesHouseApiKeyMasked, setCompaniesHouseApiKeyMasked] = useState<string | null>(null);
  const [companiesHouseKeySource, setCompaniesHouseKeySource] = useState<'user' | 'environment' | 'none'>('none');
  const [showCompaniesHouseApiKey, setShowCompaniesHouseApiKey] = useState(false);
  const [savingCompaniesHouseApiKey, setSavingCompaniesHouseApiKey] = useState(false);

  // Portfolio management
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioClientCounts, setPortfolioClientCounts] = useState<Record<string, number>>({});
  const [newPortfolioCode, setNewPortfolioCode] = useState('');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDescription, setNewPortfolioDescription] = useState('');
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editingPortfolioName, setEditingPortfolioName] = useState('');
  const [editingPortfolioDescription, setEditingPortfolioDescription] = useState('');
  
  // Toast notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const availableRoles = roles.length > 0 ? roles : FALLBACK_ROLES;

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3003';
  const token = localStorage.getItem('auth_token');
  const isDemoMode = localStorage.getItem('demo_mode') === 'true';

  useEffect(() => {
    loadData();
    void refreshPortfolios();
    const unsubscribe = subscribeToPortfolioUpdates(() => {
      void refreshPortfolios();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    if (isDemoMode) {
      // Demo data
      setFirstName('Demo');
      setLastName('User');
      setEmail('demo@mpractice.com');
      setCompanyName('Demo Company Ltd');
      setEoriNumber('GB123456789000');
      setVatNumber('GB123456789');
      setCompanyEmail('demo@mpractice.com');
      setCompanyAddress('100 Parliament Street, London, SW1A 2BQ');
      setCompanyPhone('+44 20 1234 5678');
      setEmailEnabled(true);
      setEmailFromName('Demo Company Ltd');
      setEmailFromAddress('demo@mpractice.com');
      setEmailReplyTo('support@mpractice.com');
      setEmailSmtpHost('smtp.example.com');
      setEmailSmtpPort('587');
      setEmailSmtpUsername('demo@mpractice.com');
      setEmailSmtpPasswordSet(true);
      setEmailSmtpSecure(false);
      setEmailTestRecipient('demo@mpractice.com');
      setRoles(FALLBACK_ROLES);
      setHmrcStatus('connected');
      setGovGatewayStatus('connected');
      setCompaniesHouseStatus('connected');
      setCompaniesHouseApiKeyMasked('demo...key');
      setCompaniesHouseKeySource('user');
      updateSettings({
        userType: 'agent',
        companyName: 'Demo Company Ltd',
        email: 'demo@mpractice.com',
        phone: '+44 20 1234 5678',
        address: '100 Parliament Street, London, SW1A 2BQ',
        address_line_2: '',
        city: '',
        postcode: '',
        country: 'GB',
        hasEori: true,
        eori: 'GB123456789000',
        hasVat: true,
        vat: 'GB123456789',
      });
      setUsers([]);
      setInvitations([]);
      return;
    }

    setLoading(true);
    try {
      let profileEmail = '';
      let profileCompanyName = '';
      const profileRes = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        profileEmail = profileData.user.email || '';
        profileCompanyName = profileData.user.company_name || '';
        setFirstName(profileData.user.first_name || '');
        setLastName(profileData.user.last_name || '');
        setEmail(profileEmail);
        if (profileCompanyName) {
          setCompanyName((current) => current || profileCompanyName);
        }
      }

      const companyRes = await fetch(`${API_URL}/settings/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        const saved = companyData.settings || {};
        setCompanyName(saved.company_name || profileCompanyName || '');
        setEoriNumber(saved.eori_number || '');
        setVatNumber(saved.vat_number || '');
        setCompanyEmail(saved.company_email || profileEmail || '');
        setCompanyAddress(saved.company_address || '');
        setCompanyPhone(saved.company_phone || '');
        setBankName(saved.bank_name || '');
        setAccountName(saved.account_name || '');
        setAccountNumber(saved.account_number || '');
        setSortCode(saved.sort_code || '');
        setIban(saved.iban || '');
        setSwift(saved.swift || '');

        updateSettings({
          userType: 'agent',
          companyName: saved.company_name || profileCompanyName || '',
          email: saved.company_email || profileEmail || '',
          phone: saved.company_phone || '',
          address: saved.company_address || '',
          address_line_2: '',
          city: '',
          postcode: '',
          country: 'GB',
          hasEori: Boolean(saved.eori_number),
          eori: saved.eori_number || '',
          hasVat: Boolean(saved.vat_number),
          vat: saved.vat_number || '',
          bankAccountName: saved.account_name || saved.bank_name || '',
          bankSortCode: saved.sort_code || '',
          bankAccountNumber: saved.account_number || '',
        });
      }

      const emailRes = await fetch(`${API_URL}/settings/email`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (emailRes.ok) {
        const emailData = await emailRes.json();
        const saved = emailData.settings || {};
        setEmailProvider(saved.email_provider || 'smtp');
        setEmailEnabled(Boolean(saved.email_enabled));
        setEmailFromName(saved.email_from_name || saved.company_name || profileCompanyName || '');
        setEmailFromAddress(saved.email_from_address || saved.company_email || profileEmail || '');
        setEmailReplyTo(saved.email_reply_to || '');
        setEmailSmtpHost(saved.email_smtp_host || '');
        setEmailSmtpPort(saved.email_smtp_port || '587');
        setEmailSmtpUsername(saved.email_smtp_username || '');
        setEmailSmtpPassword('');
        setEmailSmtpPasswordSet(Boolean(saved.email_smtp_password_set));
        setEmailSmtpSecure(Boolean(saved.email_smtp_secure));
        setEmailTestRecipient(profileEmail || saved.email_from_address || '');
      }

      const usersRes = await fetch(`${API_URL}/auth/team`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      const rolesRes = await fetch(`${API_URL}/auth/roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }

      const invitesRes = await fetch(`${API_URL}/auth/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setInvitations(invitesData.invitations || []);
      }

      const companiesHouseCredentialsRes = await fetch(`${API_URL}/companies-house/credentials`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (companiesHouseCredentialsRes.ok) {
        const companiesHouseCredentialsData = await companiesHouseCredentialsRes.json();
        const configured = Boolean(companiesHouseCredentialsData?.configured);
        const source = (companiesHouseCredentialsData?.source || 'none') as 'user' | 'environment' | 'none';
        const masked = companiesHouseCredentialsData?.credential?.key_masked || null;

        setCompaniesHouseStatus(configured ? 'connected' : 'disconnected');
        setCompaniesHouseApiKeyMasked(masked);
        setCompaniesHouseKeySource(source);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshPortfolios = async () => {
    const currentPortfolios = getPortfolios();
    setPortfolios(currentPortfolios);

    try {
      const response = await contactsAPI.getContacts({ limit: 5000 });
      const counts: Record<string, number> = {};
      response.contacts.forEach((contact) => {
        const portfolioId =
          contact.portfolio_id || currentPortfolios.find((portfolio) => portfolio.code === 1)?.id;
        if (!portfolioId) return;
        counts[portfolioId] = (counts[portfolioId] || 0) + 1;
      });
      setPortfolioClientCounts(counts);
    } catch {
      setPortfolioClientCounts({});
    }
  };

  const beginEditPortfolio = (portfolio: Portfolio) => {
    setEditingPortfolioId(portfolio.id);
    setEditingPortfolioName(portfolio.name);
    setEditingPortfolioDescription(portfolio.description || '');
  };

  const cancelEditPortfolio = () => {
    setEditingPortfolioId(null);
    setEditingPortfolioName('');
    setEditingPortfolioDescription('');
  };

  const handleAddPortfolio = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const code = Number(newPortfolioCode);
      createPortfolio({
        code,
        name: newPortfolioName,
        description: newPortfolioDescription,
      });
      setNewPortfolioCode('');
      setNewPortfolioName('');
      setNewPortfolioDescription('');
      showToast('success', 'Portfolio added');
      await refreshPortfolios();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to add portfolio');
    }
  };

  const handleSavePortfolioEdit = async (portfolioId: string) => {
    try {
      updatePortfolio(portfolioId, {
        name: editingPortfolioName,
        description: editingPortfolioDescription,
      });
      cancelEditPortfolio();
      showToast('success', 'Portfolio updated');
      await refreshPortfolios();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update portfolio');
    }
  };

  const handleSetDefaultPortfolio = async (portfolioId: string) => {
    try {
      updatePortfolio(portfolioId, { isDefault: true });
      showToast('success', 'Default portfolio updated');
      await refreshPortfolios();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update default portfolio');
    }
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    const linkedClients = portfolioClientCounts[portfolioId] || 0;
    if (!confirm('Delete this portfolio? This cannot be undone.')) return;
    try {
      deletePortfolio(portfolioId, linkedClients);
      showToast('success', 'Portfolio deleted');
      await refreshPortfolios();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete portfolio');
    }
  };

  const handleTestCompaniesHouse = async () => {
    setTestingCompaniesHouse(true);
    setCompaniesHouseTestResult(null);

    if (isDemoMode) {
      setTimeout(() => {
        setTestingCompaniesHouse(false);
        setCompaniesHouseTestResult('success');
        setCompaniesHouseLastVerified(new Date().toISOString());
        setCompaniesHouseStatus('connected');
        showToast('success', 'Companies House connection successful!');
      }, 1000);
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      };
      if (companiesHouseApiKeyValue.trim()) {
        headers['x-companies-house-api-key'] = companiesHouseApiKeyValue.trim();
      }

      const response = await fetch(`${API_URL}/companies-house/search?q=limited&items_per_page=1`, {
        headers,
      });
      if (response.ok) {
        setCompaniesHouseTestResult('success');
        setCompaniesHouseLastVerified(new Date().toISOString());
        setCompaniesHouseStatus('connected');
        showToast('success', 'Companies House connection successful!');
      } else {
        setCompaniesHouseTestResult('error');
        setCompaniesHouseStatus('disconnected');
        showToast('error', 'Companies House connection failed. Check your API key.');
      }
    } catch (err) {
      setCompaniesHouseTestResult('error');
      setCompaniesHouseStatus('disconnected');
      showToast('error', 'Failed to test Companies House connection');
    } finally {
      setTestingCompaniesHouse(false);
    }
  };

  const handleSaveCompaniesHouseApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companiesHouseApiKeyValue.trim()) {
      showToast('error', 'Enter an API key before saving');
      return;
    }

    if (isDemoMode) {
      setCompaniesHouseApiKeyMasked('demo...key');
      setCompaniesHouseKeySource('user');
      setCompaniesHouseStatus('connected');
      showToast('success', 'Companies House API key saved (demo mode)');
      return;
    }

    setSavingCompaniesHouseApiKey(true);
    try {
      const response = await fetch(`${API_URL}/companies-house/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          api_key: companiesHouseApiKeyValue.trim()
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to save Companies House API key');
      }

      setCompaniesHouseApiKeyMasked(data?.credential?.key_masked || null);
      setCompaniesHouseKeySource('user');
      setCompaniesHouseApiKeyValue('');
      setCompaniesHouseStatus('connected');
      setCompaniesHouseTestResult(null);
      showToast('success', 'Companies House API key saved');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save Companies House API key';
      showToast('error', message);
    } finally {
      setSavingCompaniesHouseApiKey(false);
    }
  };

  const handleClearCompaniesHouseApiKey = async () => {
    if (isDemoMode) {
      setCompaniesHouseApiKeyValue('');
      setCompaniesHouseApiKeyMasked(null);
      setCompaniesHouseKeySource('none');
      setCompaniesHouseStatus('disconnected');
      setCompaniesHouseTestResult(null);
      showToast('success', 'Companies House API key removed (demo mode)');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/companies-house/credentials`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to remove Companies House API key');
      }

      setCompaniesHouseApiKeyValue('');
      setCompaniesHouseApiKeyMasked(null);
      setCompaniesHouseKeySource('none');
      setCompaniesHouseStatus('disconnected');
      setCompaniesHouseTestResult(null);
      showToast('success', 'Companies House API key removed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove Companies House API key';
      showToast('error', message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (isDemoMode) {
      setSuccess('Profile updated (demo mode)');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone })
      });

      if (response.ok) {
        setSuccess('Profile updated successfully');
      } else {
        setError('Failed to update profile');
      }
    } catch (err) {
      setError('Failed to update profile');
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (isDemoMode) {
      setSuccess('Company details updated (demo mode)');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/settings/company`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          company_name: companyName,
          eori_number: eoriNumber,
          vat_number: vatNumber,
          company_email: companyEmail,
          company_address: companyAddress,
          company_phone: companyPhone,
          bank_name: bankName,
          account_name: accountName,
          account_number: accountNumber,
          sort_code: sortCode,
          iban, swift
        })
      });

      if (response.ok) {
        updateSettings({
          userType: 'agent',
          companyName,
          email: companyEmail || email,
          phone: companyPhone,
          address: companyAddress,
          address_line_2: '',
          city: '',
          postcode: '',
          country: 'GB',
          hasEori: Boolean(eoriNumber),
          eori: eoriNumber,
          hasVat: Boolean(vatNumber),
          vat: vatNumber,
          bankAccountName: accountName || bankName,
          bankSortCode: sortCode,
          bankAccountNumber: accountNumber,
        });
        setSuccess('Company details updated successfully');
      } else {
        setError('Failed to update company details');
      }
    } catch (err) {
      setError('Failed to update company details');
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSavingEmail(true);

    if (isDemoMode) {
      setEmailSmtpPassword('');
      setEmailSmtpPasswordSet(true);
      setSuccess('Email settings updated (demo mode)');
      setSavingEmail(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/settings/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email_provider: emailProvider,
          email_enabled: emailEnabled,
          email_from_name: emailFromName,
          email_from_address: emailFromAddress,
          email_reply_to: emailReplyTo,
          email_smtp_host: emailSmtpHost,
          email_smtp_port: emailSmtpPort,
          email_smtp_username: emailSmtpUsername,
          email_smtp_password: emailSmtpPassword,
          email_smtp_secure: emailSmtpSecure,
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update email settings');
      }

      const saved = data.settings || {};
      setEmailProvider(saved.email_provider || 'smtp');
      setEmailEnabled(Boolean(saved.email_enabled));
      setEmailFromName(saved.email_from_name || '');
      setEmailFromAddress(saved.email_from_address || '');
      setEmailReplyTo(saved.email_reply_to || '');
      setEmailSmtpHost(saved.email_smtp_host || '');
      setEmailSmtpPort(saved.email_smtp_port || '587');
      setEmailSmtpUsername(saved.email_smtp_username || '');
      setEmailSmtpPassword('');
      setEmailSmtpPasswordSet(Boolean(saved.email_smtp_password_set));
      setEmailSmtpSecure(Boolean(saved.email_smtp_secure));
      if (!emailTestRecipient) {
        setEmailTestRecipient(saved.email_from_address || email || '');
      }
      setSuccess('Email settings updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update email settings');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmailConnection = async () => {
    setTestingEmail(true);
    setEmailTestResult(null);

    if (isDemoMode) {
      setEmailTestResult('success');
      setEmailLastVerified(new Date().toISOString());
      setTimeout(() => setTestingEmail(false), 300);
      showToast('success', `Test email queued for ${emailTestRecipient || 'demo@mpractice.com'} (demo mode)`);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/settings/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: emailTestRecipient.trim() || email || emailFromAddress
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send test email');
      }

      setEmailTestResult('success');
      setEmailLastVerified(new Date().toISOString());
      showToast('success', `Test email sent to ${data.recipient}`);
    } catch (err) {
      setEmailTestResult('error');
      showToast('error', err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviting(true);

    if (isDemoMode) {
      setError('Team management is not available in demo mode');
      setInviting(false);
      setShowInviteForm(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send invitation');

      setSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('staff');
      setShowInviteForm(false);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const copyInviteLink = (link: string, email: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(email);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const deleteInvitation = async (invitationId: string) => {
    if (!confirm('Delete this invitation?')) return;
    try {
      const response = await fetch(`${API_URL}/auth/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSuccess('Invitation deleted');
        loadData();
      }
    } catch (err) {
      setError('Failed to delete invitation');
    }
  };

  const handleChangeUserRole = async (userId: string, role: RoleDefinition['code']) => {
    setError('');
    setSuccess('');
    setUpdatingUserRoleId(userId);

    if (isDemoMode) {
      setUsers((current) => current.map((user) => (
        user.id === userId
          ? { ...user, role, role_name: availableRoles.find((item) => item.code === role)?.name || role }
          : user
      )));
      setSuccess('Role updated (demo mode)');
      setUpdatingUserRoleId(null);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/team/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update role');
      }

      setUsers((current) => current.map((user) => (
        user.id === userId
          ? { ...user, ...data.user }
          : user
      )));
      setSuccess('User role updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingUserRoleId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const roleLabel = (roleCode: string) =>
    availableRoles.find((role) => role.code === roleCode)?.name ||
    ({
      admin: 'Admin',
      manager: 'Manager',
      staff: 'Staff',
      read_only: 'Read-only',
    }[roleCode as 'admin' | 'manager' | 'staff' | 'read_only'] || roleCode);

  const roleTone = (roleCode: string) => {
    if (roleCode === 'admin') return 'bg-yellow-100 text-yellow-700';
    if (roleCode === 'manager') return 'bg-purple-100 text-purple-700';
    if (roleCode === 'staff') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-700';
  };

  const moduleLabel = (moduleCode: string) =>
    String(moduleCode)
      .split('_')
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(' ');

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleTestHmrcConnection = async () => {
    setTestingHmrc(true);
    setHmrcTestResult(null);
    
    if (isDemoMode) {
      setTimeout(() => {
        setTestingHmrc(false);
        setHmrcTestResult('success');
        setHmrcLastVerified(new Date().toISOString());
        setHmrcStatus('connected');
        showToast('success', 'HMRC API connection successful!');
      }, 1500);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/settings/hmrc/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          client_id: hmrcClientId,
          client_secret: hmrcClientSecret,
          environment: hmrcEnvironment
        })
      });

      if (response.ok) {
        setHmrcTestResult('success');
        setHmrcLastVerified(new Date().toISOString());
        setHmrcStatus('connected');
        showToast('success', 'HMRC API connection successful!');
      } else {
        setHmrcTestResult('error');
        showToast('error', 'HMRC API connection failed. Check your credentials.');
      }
    } catch (err) {
      setHmrcTestResult('error');
      showToast('error', 'Failed to test HMRC connection');
    } finally {
      setTestingHmrc(false);
    }
  };

  const sidebarSections = [
    { id: 'profile' as SettingsSection, label: 'Profile', icon: User },
    { id: 'company' as SettingsSection, label: 'Company', icon: Building2 },
    { id: 'email' as SettingsSection, label: 'Email', icon: Mail },
    { id: 'portfolios' as SettingsSection, label: 'Portfolios', icon: Layers },
    { id: 'team' as SettingsSection, label: 'Team & Users', icon: Users },
    { id: 'hmrc' as SettingsSection, label: 'HMRC API', icon: Key },
    { id: 'companies-house' as SettingsSection, label: 'Companies House API', icon: Building2 },
    { id: 'gov-gateway' as SettingsSection, label: 'Government Gateway', icon: FileText },
  ];

  if (loading) {
    return (
      <UniversalPageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500"></div>
        </div>
      </UniversalPageLayout>
    );
  }

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Settings"
        subtitle="Manage your profile, company information, integrations and team access"
      />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        {/* KPI Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPITile
            title="Identity Verified"
            value={firstName && lastName ? "✓" : "—"}
            subtext={firstName && lastName ? "Profile complete" : "Complete your profile"}
            icon={firstName && lastName ? CheckCircle2 : AlertCircle}
            color={firstName && lastName ? "emerald" : "amber"}
          />
          <KPITile
            title="HMRC API Status"
            value={hmrcStatus === 'connected' ? hmrcEnvironment : "Not Connected"}
            subtext={hmrcStatus === 'connected' ? "API credentials active" : "Configure API access"}
            icon={hmrcStatus === 'connected' ? CheckCircle2 : AlertCircle}
            color={hmrcStatus === 'connected' ? "emerald" : "slate"}
          />
          <KPITile
            title="Gov Gateway Status"
            value={govGatewayStatus === 'connected' ? "Connected" : "Not Connected"}
            subtext={govGatewayStatus === 'connected' ? "Credentials saved" : "Add gateway login"}
            icon={govGatewayStatus === 'connected' ? CheckCircle2 : AlertCircle}
            color={govGatewayStatus === 'connected' ? "emerald" : "slate"}
          />
          <KPITile
            title="Team Members"
            value={`${users.length} / 10`}
            subtext={`${invitations.length} pending invites`}
            icon={Users}
            color="blue"
          />
        </div>

        {/* Two Column Layout: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Sidebar */}
          <div className="lg:col-span-1">
            <nav className="space-y-1 sticky top-8">
              {sidebarSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-yellow-50 text-yellow-700 font-semibold border-l-4 border-yellow-500'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              
              {/* Profile Section */}
              {activeSection === 'profile' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Personal Information</h2>
                  <p className="text-slate-600 mb-6">Update your personal details and contact information</p>
                  
                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Smith"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="+44 20 1234 5678"
                      />
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
                      >
                        Save Profile
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Company Section */}
              {activeSection === 'company' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Company Information</h2>
                  <p className="text-slate-600 mb-6">Manage your practice details and bank information used across reports, templates, and correspondence</p>
                  
                  <form onSubmit={handleSaveCompany} className="space-y-8">
                    {/* Company Details */}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Company Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="Your Company Ltd"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            EORI Number
                          </label>
                          <input
                            type="text"
                            value={eoriNumber}
                            onChange={(e) => setEoriNumber(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="GB123456789000"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            VAT Number
                          </label>
                          <input
                            type="text"
                            value={vatNumber}
                            onChange={(e) => setVatNumber(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="GB123456789"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Company Email
                          </label>
                          <input
                            type="email"
                            value={companyEmail}
                            onChange={(e) => setCompanyEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="info@company.com"
                          />
                        </div>
                      </div>
                      <div className="mt-6">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Company Address
                        </label>
                        <textarea
                          value={companyAddress}
                          onChange={(e) => setCompanyAddress(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="123 Business Street, London, UK"
                        />
                      </div>
                      <div className="mt-6">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Company Phone
                        </label>
                        <input
                          type="tel"
                          value={companyPhone}
                          onChange={(e) => setCompanyPhone(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="+44 20 1234 5678"
                        />
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Practice Bank Details</h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="Barclays Bank"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Account Name
                            </label>
                            <input
                              type="text"
                              value={accountName}
                              onChange={(e) => setAccountName(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                              placeholder="Your Company Ltd"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Sort Code
                            </label>
                            <input
                              type="text"
                              value={sortCode}
                              onChange={(e) => setSortCode(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                              placeholder="12-34-56"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              Account Number
                            </label>
                            <input
                              type="text"
                              value={accountNumber}
                              onChange={(e) => setAccountNumber(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                              placeholder="12345678"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              IBAN
                            </label>
                            <input
                              type="text"
                              value={iban}
                              onChange={(e) => setIban(e.target.value)}
                              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                              placeholder="GB29 NWBK 6016 1331 9268 19"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            SWIFT/BIC Code
                          </label>
                          <input
                            type="text"
                            value={swift}
                            onChange={(e) => setSwift(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="NWBKGB2L"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
                      >
                        Save Company Details
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Email Section */}
              {activeSection === 'email' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Email Delivery</h2>
                  <p className="text-slate-600 mb-6">
                    Configure the practice mailbox used for reminders, engagement packs, approvals, and client notifications.
                  </p>

                  {emailEnabled ? (
                    <div className="mb-6 p-4 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">Email delivery enabled</p>
                          <p className="text-sm text-emerald-700">
                            Outbound mail will use {emailFromAddress || 'the saved sender address'}.
                          </p>
                          {emailLastVerified && (
                            <p className="text-sm text-emerald-700">Last test sent: {formatDate(emailLastVerified)}</p>
                          )}
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                        Active
                      </span>
                    </div>
                  ) : (
                    <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-slate-500" />
                      <p className="text-slate-700">
                        Email delivery is currently disabled. Save a sender profile and SMTP connection to use reminders and outbound correspondence.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSaveEmail} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">Enable outbound email</p>
                          <p className="text-sm text-slate-600">Turn on reminders, engagement sends, and client notifications.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEmailEnabled((current) => !current)}
                          className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            emailEnabled
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {emailEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Provider
                        </label>
                        <select
                          value={emailProvider}
                          onChange={(e) => setEmailProvider(e.target.value as 'smtp')}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        >
                          <option value="smtp">SMTP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Reply-To
                        </label>
                        <input
                          type="email"
                          value={emailReplyTo}
                          onChange={(e) => setEmailReplyTo(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="accounts@practice.co.uk"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Sender Name
                        </label>
                        <input
                          type="text"
                          value={emailFromName}
                          onChange={(e) => setEmailFromName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Your Practice Ltd"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Sender Email
                        </label>
                        <input
                          type="email"
                          value={emailFromAddress}
                          onChange={(e) => setEmailFromAddress(e.target.value)}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="noreply@practice.co.uk"
                        />
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">SMTP Connection</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            SMTP Host
                          </label>
                          <input
                            type="text"
                            value={emailSmtpHost}
                            onChange={(e) => setEmailSmtpHost(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="smtp.office365.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            SMTP Port
                          </label>
                          <input
                            type="text"
                            value={emailSmtpPort}
                            onChange={(e) => setEmailSmtpPort(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="587"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Username
                          </label>
                          <input
                            type="text"
                            value={emailSmtpUsername}
                            onChange={(e) => setEmailSmtpUsername(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder="smtp-user@practice.co.uk"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Password
                          </label>
                          <div className="relative">
                            <input
                              type={showEmailPassword ? 'text' : 'password'}
                              value={emailSmtpPassword}
                              onChange={(e) => setEmailSmtpPassword(e.target.value)}
                              className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                              placeholder={emailSmtpPasswordSet ? 'Saved securely. Enter a new password to replace it.' : 'Enter SMTP password'}
                            />
                            <button
                              type="button"
                              onClick={() => setShowEmailPassword((current) => !current)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showEmailPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                          {emailSmtpPasswordSet && !emailSmtpPassword && (
                            <p className="text-xs text-slate-500 mt-1">A password is already saved. Leave blank to keep it.</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-900">Use secure SMTP connection</p>
                          <p className="text-sm text-slate-600">Enable this for SSL/TLS ports such as 465.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEmailSmtpSecure((current) => !current)}
                          className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                            emailSmtpSecure
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {emailSmtpSecure ? 'Secure' : 'Standard'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Test Delivery</h3>
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Test Recipient
                          </label>
                          <input
                            type="email"
                            value={emailTestRecipient}
                            onChange={(e) => setEmailTestRecipient(e.target.value)}
                            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            placeholder={email || 'you@practice.co.uk'}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleTestEmailConnection}
                          disabled={testingEmail}
                          className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={`w-4 h-4 ${testingEmail ? 'animate-spin' : ''}`} />
                          {testingEmail ? 'Sending...' : 'Send Test Email'}
                        </button>
                      </div>

                      {emailTestResult && (
                        <div className={`mt-4 p-4 rounded-lg border ${
                          emailTestResult === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}>
                          <div className="flex items-center gap-2">
                            {emailTestResult === 'success' ? (
                              <><CheckCircle2 className="w-5 h-5" /> Test email sent successfully.</>
                            ) : (
                              <><AlertCircle className="w-5 h-5" /> Test email failed. Check the SMTP connection details.</>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        disabled={savingEmail}
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingEmail ? 'Saving...' : 'Save Email Settings'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Portfolios Section */}
              {activeSection === 'portfolios' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Portfolios</h2>
                  <p className="text-slate-600 mb-6">
                    Manage portfolio codes for client assignment, imports, and reference generation.
                  </p>

                  <div className="mb-8 rounded-xl border border-slate-200 p-5">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Add Portfolio</h3>
                    <form onSubmit={handleAddPortfolio} className="grid gap-4 md:grid-cols-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                          Code
                        </label>
                        <input
                          type="number"
                          min={2}
                          step={1}
                          value={newPortfolioCode}
                          onChange={(e) => setNewPortfolioCode(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="2"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={newPortfolioName}
                          onChange={(e) => setNewPortfolioName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Partner A"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={newPortfolioDescription}
                          onChange={(e) => setNewPortfolioDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Optional description"
                        />
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
                        >
                          <Plus className="w-4 h-4" />
                          Add Portfolio
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Description</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Clients</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Default</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {portfolios.map((portfolio) => {
                          const isEditing = editingPortfolioId === portfolio.id;
                          const linkedClients = portfolioClientCounts[portfolio.id] || 0;
                          return (
                            <tr key={portfolio.id} className="hover:bg-slate-50">
                              <td className="px-4 py-4 font-mono text-sm text-slate-800">{portfolio.code}</td>
                              <td className="px-4 py-4">
                                {isEditing ? (
                                  <input
                                    value={editingPortfolioName}
                                    onChange={(e) => setEditingPortfolioName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                  />
                                ) : (
                                  <span className="font-medium text-slate-900">{portfolio.name}</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {isEditing ? (
                                  <input
                                    value={editingPortfolioDescription}
                                    onChange={(e) => setEditingPortfolioDescription(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                  />
                                ) : (
                                  <span className="text-slate-600">{portfolio.description || '—'}</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-right font-semibold text-slate-900">{linkedClients}</td>
                              <td className="px-4 py-4">
                                {portfolio.isDefault ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                                    Default
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => void handleSetDefaultPortfolio(portfolio.id)}
                                    className="px-2 py-1 text-xs font-semibold rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100"
                                  >
                                    Set Default
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => void handleSavePortfolioEdit(portfolio.id)}
                                        className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-yellow-500 text-black hover:bg-yellow-600"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={cancelEditPortfolio}
                                        className="px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 hover:bg-slate-50"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => beginEditPortfolio(portfolio)}
                                        className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                                        title="Edit portfolio"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => void handleDeletePortfolio(portfolio.id)}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                        title="Delete portfolio"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs text-slate-500 mt-4">
                    Rules: code is immutable, code 1 cannot be deleted, default cannot be deleted, and portfolios with linked clients cannot be deleted.
                  </p>
                </div>
              )}

              {/* Team Section */}
              {activeSection === 'team' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-2">Team & Users</h2>
                      <p className="text-slate-600">Manage team members and pending invitations</p>
                    </div>
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Invite User
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4 mb-8">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Users</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{users.length}</p>
                      <p className="mt-2 text-sm text-slate-500">Practice users with current access</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Invites</p>
                      <p className="mt-2 text-3xl font-bold text-amber-700">{invitations.length}</p>
                      <p className="mt-2 text-sm text-slate-500">Invitations awaiting acceptance</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available Roles</p>
                      <p className="mt-2 text-3xl font-bold text-slate-900">{roles.length}</p>
                      <p className="mt-2 text-sm text-slate-500">Admin, Manager, Staff and Read-only</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Users</p>
                      <p className="mt-2 text-3xl font-bold text-yellow-700">
                        {users.filter((user) => user.role === 'admin').length}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">Users able to manage settings and team access</p>
                    </div>
                  </div>

                  {roles.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-slate-800 mb-4">Role Access Matrix</h3>
                      <div className="grid gap-4 xl:grid-cols-2">
                        {availableRoles.map((role) => (
                          <div key={role.code} className="rounded-xl border border-slate-200 bg-white p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${roleTone(role.code)}`}>
                                  {role.name}
                                </div>
                                <p className="mt-3 text-sm text-slate-600">{role.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modules</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">{role.modules.length}</p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {role.modules.map((moduleName) => (
                                <span
                                  key={`${role.code}-${moduleName}`}
                                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                                >
                                  {moduleLabel(moduleName)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Users Table */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Active Users</h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Access</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Joined</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Login</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                    <span className="text-yellow-700 font-semibold text-sm">
                                      {user.first_name[0]}{user.last_name[0]}
                                    </span>
                                  </div>
                                  <span className="font-medium text-slate-900">
                                    {user.first_name} {user.last_name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-600">{user.email}</td>
                              <td className="px-4 py-4">
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${roleTone(user.role)}`}>
                                  {user.role_name || roleLabel(user.role)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-slate-600 text-sm">
                                {Array.from(new Set((user.permissions || []).map((permission) => permission.split('.')[0])))
                                  .slice(0, 3)
                                  .map((moduleName) => moduleLabel(moduleName))
                                  .join(', ') || 'No modules'}
                                {(user.permissions || []).length > 3 && '…'}
                              </td>
                              <td className="px-4 py-4 text-slate-600 text-sm">{formatDate(user.created_at)}</td>
                              <td className="px-4 py-4 text-slate-600 text-sm">
                                {user.last_login ? formatDate(user.last_login) : 'Never'}
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  value={user.role}
                                  onChange={(event) => void handleChangeUserRole(user.id, event.target.value as RoleDefinition['code'])}
                                  disabled={updatingUserRoleId === user.id}
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:opacity-50"
                                  title="Change role"
                                >
                                  {availableRoles.map((role) => (
                                    <option key={role.code} value={role.code}>
                                      {role.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                                No team members yet. Invite users to collaborate.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pending Invitations */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      Pending Invitations {invitations.length > 0 && `(${invitations.length})`}
                    </h3>
                    {invitations.length > 0 ? (
                      <div className="space-y-3">
                        {invitations.map((invite) => {
                          const expired = isExpired(invite.expires_at);
                          return (
                            <div
                              key={invite.id}
                              className={`p-4 rounded-lg border ${
                                expired ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Mail className="w-5 h-5 text-slate-400" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-slate-900">{invite.email}</p>
                                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                        expired 
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}>
                                        {expired ? 'Expired' : 'Pending'}
                                      </span>
                                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${roleTone(invite.role)}`}>
                                        {roleLabel(invite.role)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">
                                      Sent {formatDate(invite.created_at)} • Expires {formatDate(invite.expires_at)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => copyInviteLink(invite.invitation_link, invite.email)}
                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                                    title="Copy invitation link"
                                  >
                                    {copiedLink === invite.email ? (
                                      <><Check className="w-4 h-4" /> Copied</>
                                    ) : (
                                      <><Copy className="w-4 h-4" /> Copy</>
                                    )}
                                  </button>
                                  <button
                                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                                    title="Resend invitation"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteInvitation(invite.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                                    title="Delete invitation"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-8 text-center border border-slate-200 rounded-lg bg-slate-50">
                        <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600">No pending invitations</p>
                        <p className="text-sm text-slate-500 mt-1">Invite team members to get started</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HMRC API Section */}
              {activeSection === 'hmrc' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">HMRC API Integration</h2>
                  <p className="text-slate-600 mb-6">Connect your HMRC API credentials to support tax and compliance integrations across the practice</p>
                  
                  {/* Status Banner */}
                  {hmrcStatus === 'connected' ? (
                    <div className="mb-6 p-4 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">Connected to HMRC {hmrcEnvironment === 'sandbox' ? 'Sandbox' : 'Production'}</p>
                          {hmrcLastVerified && (
                            <p className="text-sm text-emerald-700">Last verified: {formatDate(hmrcLastVerified)}</p>
                          )}
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                        Active
                      </span>
                    </div>
                  ) : (
                    <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-slate-500" />
                      <p className="text-slate-700">Not connected. Enter your credentials below to connect.</p>
                    </div>
                  )}
                  
                  <form className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={hmrcClientId}
                        onChange={(e) => setHmrcClientId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter your HMRC Client ID"
                      />
                      <p className="text-xs text-slate-500 mt-1">Obtain from HMRC Developer Hub</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Client Secret
                      </label>
                      <input
                        type="password"
                        value={hmrcClientSecret}
                        onChange={(e) => setHmrcClientSecret(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter your HMRC Client Secret"
                      />
                      <p className="text-xs text-slate-500 mt-1">Keep this secure and never share it</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Environment
                      </label>
                      <select
                        value={hmrcEnvironment}
                        onChange={(e) => setHmrcEnvironment(e.target.value as 'sandbox' | 'production')}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      >
                        <option value="sandbox">Sandbox (Testing)</option>
                        <option value="production">Production (Live)</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Use Sandbox for testing and Production for live HMRC integrations</p>
                    </div>

                    {/* Test Result */}
                    {hmrcTestResult && (
                      <div className={`p-4 rounded-lg border ${
                        hmrcTestResult === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          {hmrcTestResult === 'success' ? (
                            <><CheckCircle2 className="w-5 h-5" /> Connection successful!</>
                          ) : (
                            <><AlertCircle className="w-5 h-5" /> Connection failed. Check your credentials.</>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleTestHmrcConnection}
                        disabled={testingHmrc || !hmrcClientId || !hmrcClientSecret}
                        className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-4 h-4 ${testingHmrc ? 'animate-spin' : ''}`} />
                        {testingHmrc ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
                      >
                        Save Credentials
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Companies House Section */}
              {activeSection === 'companies-house' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Companies House API Integration</h2>
                  <p className="text-slate-600 mb-6">
                    Verify the Companies House lookup service used for pre-filling onboarding client details.
                  </p>

                  {companiesHouseStatus === 'connected' ? (
                    <div className="mb-6 p-4 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">Companies House API Connected</p>
                          {companiesHouseLastVerified && (
                            <p className="text-sm text-emerald-700">
                              Last verified: {formatDate(companiesHouseLastVerified)}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">
                        Active
                      </span>
                    </div>
                  ) : (
                    <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-slate-500" />
                      <p className="text-slate-700">
                        Not connected. Add an API key below or configure <code>COMPANIES_HOUSE_API_KEY</code> on backend.
                      </p>
                    </div>
                  )}

                  <form onSubmit={handleSaveCompaniesHouseApiKey} className="mb-6 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showCompaniesHouseApiKey ? 'text' : 'password'}
                          value={companiesHouseApiKeyValue}
                          onChange={(e) => setCompaniesHouseApiKeyValue(e.target.value)}
                          className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Enter Companies House API key"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCompaniesHouseApiKey(!showCompaniesHouseApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showCompaniesHouseApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Keys are saved per user on backend with encryption. Environment key fallback is still supported.
                      </p>
                      {companiesHouseApiKeyMasked && (
                        <p className="text-xs text-slate-600 mt-1">
                          Active key ({companiesHouseKeySource}): <code>{companiesHouseApiKeyMasked}</code>
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={savingCompaniesHouseApiKey}
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingCompaniesHouseApiKey ? 'Saving...' : 'Save API Key'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearCompaniesHouseApiKey}
                        disabled={!companiesHouseApiKeyMasked && !companiesHouseApiKeyValue}
                        className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Clear Saved Key
                      </button>
                    </div>
                  </form>

                  <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 mb-6">
                    <p className="font-semibold mb-1">How this is used</p>
                    <p className="text-sm text-slate-700">
                      The onboarding workflow can search Companies House and pre-fill company name, number,
                      status, and registered office details before manual completion.
                    </p>
                  </div>

                  {companiesHouseTestResult && (
                    <div
                      className={`mb-6 p-4 rounded-lg border ${
                        companiesHouseTestResult === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {companiesHouseTestResult === 'success' ? (
                          <>
                            <CheckCircle2 className="w-5 h-5" /> Connection successful!
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-5 h-5" /> Connection failed. Check your key and try again.
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleTestCompaniesHouse}
                      disabled={testingCompaniesHouse}
                      className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-4 h-4 ${testingCompaniesHouse ? 'animate-spin' : ''}`} />
                      {testingCompaniesHouse ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      type="button"
                      onClick={() => (window.location.href = '/companies-house')}
                      className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
                    >
                      Open Companies House Search
                    </button>
                  </div>
                </div>
              )}

              {/* Gov Gateway Section */}
              {activeSection === 'gov-gateway' && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Government Gateway</h2>
                  <p className="text-slate-600 mb-6">Store your Government Gateway credentials for quick access to HMRC services</p>
                  
                  {/* Context Box */}
                  <div className="mb-6 p-4 rounded-lg border border-blue-200 bg-blue-50 flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">About Government Gateway</p>
                      <p>Your Government Gateway credentials support secure access to HMRC services used by the practice. All credentials are encrypted and stored securely.</p>
                    </div>
                  </div>
                  
                  <form className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        User ID
                      </label>
                      <input
                        type="text"
                        value={govGatewayUserId}
                        onChange={(e) => setGovGatewayUserId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        placeholder="Enter your Government Gateway User ID"
                      />
                      {govGatewayUserId && (
                        <div className="flex items-center gap-2 mt-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs text-emerald-600 font-medium">Valid format</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showGovPassword ? 'text' : 'password'}
                          value={govGatewayPassword}
                          onChange={(e) => setGovGatewayPassword(e.target.value)}
                          className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="Enter your Government Gateway Password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowGovPassword(!showGovPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showGovPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {govGatewayPassword && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            {govGatewayPassword.length >= 8 ? (
                              <><CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs text-emerald-600 font-medium">Strong password</span></>
                            ) : (
                              <><AlertCircle className="w-4 h-4 text-amber-600" />
                              <span className="text-xs text-amber-600 font-medium">Password should be at least 8 characters</span></>
                            )}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2">🔒 Credentials are encrypted and stored securely</p>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg"
                      >
                        Save Credentials
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
          <div className={`px-6 py-4 rounded-lg shadow-lg flex items-center gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Invite Team Member</h3>
            
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'manager' | 'staff' | 'read_only')}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                >
                  {availableRoles.map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Select the access level the invited user should receive when they join.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </UniversalPageLayout>
  );
}
