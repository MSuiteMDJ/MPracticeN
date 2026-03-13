import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Building2, MapPin, CalendarDays, FileSearch } from 'lucide-react';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import { companiesHouseAPI, type CompaniesHouseSearchResult } from '@/lib/api-service';

export default function CompaniesHouseSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CompaniesHouseSearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [lastQuery, setLastQuery] = useState('');
  const hydratedFromUrl = useRef(false);

  const hasSearched = useMemo(() => lastQuery.length > 0 || results.length > 0, [lastQuery, results]);

  const runSearch = useCallback(
    async (input: string) => {
      const trimmed = input.trim();
      if (trimmed.length < 2) {
        setError('Enter at least 2 characters to search Companies House.');
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await companiesHouseAPI.searchCompanies(trimmed, 20);
        setResults(data.results || []);
        setTotalResults(data.totalResults || 0);
        setLastQuery(trimmed);
        setSearchParams({ q: trimmed }, { replace: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to search Companies House.';
        setError(message);
        setResults([]);
        setTotalResults(0);
        setLastQuery(trimmed);
      } finally {
        setIsLoading(false);
      }
    },
    [setSearchParams]
  );

  useEffect(() => {
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;

    const initialQuery = (searchParams.get('q') || '').trim();
    if (initialQuery.length >= 2) {
      setQuery(initialQuery);
      void runSearch(initialQuery);
    }
  }, [runSearch, searchParams]);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError('Enter at least 2 characters to search Companies House.');
      return;
    }
    await runSearch(trimmed);
  };

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Companies House Search"
        subtitle="Search UK company records and prepare onboarding-ready company data"
        actions={
          <button className="btn-secondary" onClick={() => navigate('/onboarding')}>
            Back to Onboarding
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div
            className="card"
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        )}

        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <input
              className="authInput"
              style={{ flex: '1 1 320px' }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Search by company name or company number"
            />
            <button className="btn-primary btn-onboarding" onClick={handleSearch} disabled={isLoading}>
              <Search size={18} />
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Uses live Companies House API data. Next step will allow one-click import into onboarding.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3" style={{ marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Results Shown
            </p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{results.length}</p>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Total Matches
            </p>
            <p style={{ fontSize: '1.8rem', fontWeight: 700 }}>{totalResults}</p>
          </div>
          <div className="card" style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Search Query
            </p>
            <p style={{ fontSize: '1.05rem', fontWeight: 600 }}>{lastQuery || '—'}</p>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Company</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Number</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Registered Address</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Incorporated</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>
                    Searching Companies House…
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
                      <FileSearch size={42} style={{ color: 'var(--text-muted)', opacity: 0.7 }} />
                      <p style={{ fontWeight: 600, margin: 0 }}>
                        {hasSearched ? 'No companies found' : 'Search Companies House to begin'}
                      </p>
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        {hasSearched
                          ? 'Try a different company name or company number.'
                          : 'Use this to pre-collect company details before onboarding.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                results.map((company) => (
                  <tr key={company.companyNumber} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Building2 size={16} />
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/companies-house/${encodeURIComponent(company.companyNumber)}${
                                lastQuery ? `?q=${encodeURIComponent(lastQuery)}` : ''
                              }`
                            )
                          }
                          style={{
                            fontWeight: 600,
                            border: 0,
                            background: 'transparent',
                            padding: 0,
                            margin: 0,
                            textAlign: 'left',
                            color: '#0f172a',
                            cursor: 'pointer',
                          }}
                          title="View company profile"
                        >
                          {company.companyName || '—'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{company.companyNumber || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '999px',
                          background: company.companyStatus === 'active' ? '#dcfce7' : '#fef3c7',
                          color: '#1f2937',
                          fontSize: '0.8rem',
                        }}
                      >
                        {company.companyStatus || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{company.companyType || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                        <MapPin size={14} style={{ marginTop: '0.2rem', color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-muted)' }}>
                          {company.fullAddress || company.addressSnippet || '—'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CalendarDays size={14} style={{ color: 'var(--text-muted)' }} />
                        <span>{company.dateOfCreation || '—'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          navigate(
                            `/companies-house/${encodeURIComponent(company.companyNumber)}${
                              lastQuery ? `?q=${encodeURIComponent(lastQuery)}` : ''
                            }`
                          )
                        }
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </UniversalPageLayout>
  );
}
