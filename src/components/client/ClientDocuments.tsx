import { useEffect, useState } from 'react';
import type { ClientDocument, ClientDocumentVersion } from '@/types/onboarding';
import { onboardingAPI } from '@/lib/api-service';
import DocumentUploader from '@/components/documents/DocumentUploader';

interface Props {
  clientId: string;
}

export default function ClientDocuments({ clientId }: Props) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ClientDocumentVersion[]>([]);
  const [isVersionsLoading, setIsVersionsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await onboardingAPI.listDocuments(clientId);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const loadVersions = async (documentId: string) => {
    setIsVersionsLoading(true);
    setError(null);
    try {
      const res = await onboardingAPI.listDocumentVersions(documentId);
      setSelectedDocumentId(documentId);
      setVersions(res.versions || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to load versions');
    } finally {
      setIsVersionsLoading(false);
    }
  };

  const handleUploadVersion = (targetDocument: ClientDocument) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setError(null);
        await onboardingAPI.uploadDocumentVersion(targetDocument.document_id, {
          file,
          documentType: targetDocument.document_type,
          category: targetDocument.category,
        });
        await load();
        await loadVersions(targetDocument.document_id);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unable to upload new version');
      }
    };
    input.click();
  };

  const selectedDocument = documents.find((document) => document.document_id === selectedDocumentId) || null;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          alignItems: 'center',
        }}
      >
        <div>
          <h3>Client Documents</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Drag & drop files, categorize, and track versions
          </p>
        </div>
        <select
          className="authInput"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          <option value="Identity">Identity</option>
          <option value="HMRC">HMRC</option>
          <option value="Finance">Finance</option>
          <option value="General">General</option>
          <option value="Evidence">Evidence</option>
        </select>
      </div>
      <DocumentUploader clientId={clientId} onComplete={load} />
      {isLoading ? (
        <p>Loading documents…</p>
      ) : error ? (
        <p style={{ color: '#ef4444' }}>{error}</p>
      ) : documents.filter((doc) => categoryFilter === 'all' || doc.category === categoryFilter)
          .length === 0 ? (
        <p>No documents yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {documents
            .filter((doc) => categoryFilter === 'all' || doc.category === categoryFilter)
            .map((doc) => (
              <div
                key={doc.document_id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{doc.document_type}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Uploaded {new Date(doc.created_at).toLocaleDateString()} · v{doc.version}
                    {doc.version_count && doc.version_count > 1 ? ` · ${doc.version_count} versions` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="secondaryButton" onClick={() => void loadVersions(doc.document_id)}>
                    Versions
                  </button>
                  <button className="secondaryButton" onClick={() => handleUploadVersion(doc)}>
                    New Version
                  </button>
                  <button
                    className="dangerButton"
                    onClick={() => onboardingAPI.deleteDocument(doc.document_id).then(load)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
      {selectedDocument && (
        <div
          style={{
            marginTop: '1rem',
            borderTop: '1px solid var(--border)',
            paddingTop: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0 }}>Version History</h4>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
                {selectedDocument.file_name || selectedDocument.document_type}
              </p>
            </div>
            <button className="secondaryButton" onClick={() => setSelectedDocumentId(null)}>
              Close
            </button>
          </div>
          {isVersionsLoading ? (
            <p style={{ marginTop: '0.75rem' }}>Loading versions…</p>
          ) : versions.length === 0 ? (
            <p style={{ marginTop: '0.75rem' }}>No versions found.</p>
          ) : (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {versions.map((version) => (
                <div
                  key={version.version_id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>Version {version.version}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {version.file_name || 'Document'} · {new Date(version.created_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {version.mime_type || 'File'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
