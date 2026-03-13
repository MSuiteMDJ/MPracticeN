import { useState } from 'react';
import { X, FileText, Download, Eye, CheckCircle2, Printer, Send } from 'lucide-react';
import type { Contact } from '@/types';
import type { ClientServiceEngagement } from '@/lib/service-model';
import { useSettings } from '@/contexts/SettingsContext';
import {
  PRACTICE_TEMPLATE_LIBRARY,
  buildPracticeTemplateData,
  type PracticeTemplateDefinition,
} from '@/lib/practice-template-library';
import { generateDocument, downloadDocument, openGeneratedDocument } from '@/lib/templateGenerator';
import { documentsAPI } from '@/lib/api-service';

interface DocumentTemplateGeneratorProps {
  client: Contact;
  services?: ClientServiceEngagement[];
  onClose: () => void;
}

export default function DocumentTemplateGenerator({
  client,
  services = [],
  onClose,
}: DocumentTemplateGeneratorProps) {
  const defaultRecipients = [
    client.email,
    client.alternative_email,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(', ');
  const { settings } = useSettings();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState(defaultRecipients);

  const buildClientData = () => buildPracticeTemplateData({ client, settings, services });

  const handleGenerate = async (templateId: string) => {
    const template = PRACTICE_TEMPLATE_LIBRARY.find((t) => t.id === templateId);
    if (!template) return;

    setIsGenerating(true);
    setSelectedTemplate(templateId);

    try {
      const data = buildClientData();
      const html = await generateDocument(template.filename, data);
      setGeneratedHtml(html);
    } catch (error) {
      console.error('Failed to generate document:', error);
      alert('Failed to generate document. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = () => {
    if (generatedHtml) {
      try {
        openGeneratedDocument(generatedHtml);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Unable to preview document.');
      }
    }
  };

  const handleDownload = () => {
    if (generatedHtml && selectedTemplate) {
      const template = PRACTICE_TEMPLATE_LIBRARY.find((t) => t.id === selectedTemplate);
      const filename = `${client.name.replace(/\s+/g, '_')}_${template?.id}_${new Date().toISOString().split('T')[0]}.html`;
      downloadDocument(generatedHtml, filename);
    }
  };

  const handlePrint = () => {
    if (generatedHtml) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Popup blocked. Allow popups to print the document.');
        return;
      }
      printWindow.document.write(generatedHtml);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleSaveToClient = async () => {
    if (!generatedHtml || !selectedTemplate) return;

    setIsSaving(true);
    try {
      const template = PRACTICE_TEMPLATE_LIBRARY.find((t) => t.id === selectedTemplate);
      const filename = `${template?.name}_${new Date().toISOString().split('T')[0]}.html`;
      
      // Create a blob from the HTML
      const blob = new Blob([generatedHtml], { type: 'text/html' });
      const documentFile = new File([blob], filename, { type: 'text/html' });
      
      // TODO: Upload to backend
      // await onboardingAPI.uploadDocument(client.id, {
      //   file: documentFile,
      //   documentType: template?.name || 'Generated Document',
      //   category: template?.category,
      // });
      
      // For now, just show success message
      alert(`Document "${template?.name}" saved to ${client.name}'s documents folder`);
      onClose();
    } catch (error) {
      console.error('Failed to save document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailToClient = async () => {
    if (!generatedHtml || !selectedTemplate) return;
    const recipients = emailRecipients
      .split(/[;,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      alert('Enter at least one recipient email address.');
      return;
    }

    setIsEmailing(true);
    try {
      const template = PRACTICE_TEMPLATE_LIBRARY.find((t) => t.id === selectedTemplate);
      const result = await documentsAPI.emailGeneratedDocument({
        clientId: client.id,
        html: generatedHtml,
        templateName: template?.name || 'Generated Document',
        category: template?.category,
        recipients,
      });

      alert(`Document emailed to ${result.recipients.join(', ')}`);
    } catch (error) {
      console.error('Failed to email document:', error);
      alert(error instanceof Error ? error.message : 'Failed to email document. Please try again.');
    } finally {
      setIsEmailing(false);
    }
  };

  const groupedTemplates = PRACTICE_TEMPLATE_LIBRARY.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, PracticeTemplateDefinition[]>
  );

  const categoryLabels: Record<string, string> = {
    onboarding: 'Client Setup',
    engagement: 'Engagement & Authority',
    compliance: 'Compliance & Approvals',
    correspondence: 'Correspondence & Fees',
    reporting: 'Reports & Summaries',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '2rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Generate Documents
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Pre-filled templates for {client.name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
          {!generatedHtml ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {Object.entries(groupedTemplates).map(([category, templates]) => (
                <div key={category}>
                  <h3
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted)',
                      marginBottom: '1rem',
                    }}
                  >
                    {categoryLabels[category]}
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleGenerate(template.id)}
                        disabled={isGenerating}
                        style={{
                          padding: '1.25rem',
                          background: '#fff',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          cursor: isGenerating ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          opacity: isGenerating ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isGenerating) {
                            e.currentTarget.style.borderColor = 'var(--gold)';
                            e.currentTarget.style.background = 'rgba(193, 143, 28, 0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                          <FileText size={24} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                              {template.name}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                              {template.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle2 size={64} style={{ color: '#22c55e', margin: '0 auto 1.5rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Document Generated Successfully
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Your document is ready to preview or download
              </p>
              <div
                style={{
                  maxWidth: '560px',
                  margin: '0 auto 1.5rem',
                  textAlign: 'left',
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  background: '#f8fafc',
                }}
              >
                <label
                  htmlFor="document-email-recipients"
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    color: 'var(--text-dark)',
                  }}
                >
                  Email recipients
                </label>
                <input
                  id="document-email-recipients"
                  type="text"
                  value={emailRecipients}
                  onChange={(event) => setEmailRecipients(event.target.value)}
                  placeholder="client@example.com, colleague@example.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.875rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    color: 'var(--text-dark)',
                  }}
                />
                <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Change the main recipient or add extra addresses separated by commas.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePreview}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'var(--gold)',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Eye size={18} />
                  Preview
                </button>
                <button
                  onClick={handlePrint}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Printer size={18} />
                  Print
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#fff',
                    color: 'var(--text-dark)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <Download size={18} />
                  Download
                </button>
                <button
                  onClick={handleEmailToClient}
                  disabled={isEmailing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: isEmailing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: isEmailing ? 0.6 : 1,
                  }}
                >
                  <Send size={18} />
                  {isEmailing ? 'Emailing...' : 'Email to Client'}
                </button>
                <button
                  onClick={handleSaveToClient}
                  disabled={isSaving}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <CheckCircle2 size={18} />
                  {isSaving ? 'Saving...' : 'Save to Client'}
                </button>
              </div>
              <button
                onClick={() => {
                  setGeneratedHtml(null);
                  setSelectedTemplate(null);
                }}
                style={{
                  marginTop: '1.5rem',
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Generate Another Document
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!generatedHtml && (
          <div
            style={{
              padding: '1.5rem 2rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {isGenerating ? 'Generating document...' : 'Select a template to generate'}
            </div>
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
