import { useState } from 'react';
import { Plus, FileEdit, Eye, FileText, Folder, Search } from 'lucide-react';
import UniversalPageLayout from '@/components/ui/UniversalPageLayout';
import UniversalPageHeader from '@/components/ui/UniversalPageHeader';
import { generateDocument, getSampleData } from '@/lib/templateGenerator';
import {
  PRACTICE_TEMPLATE_LIBRARY,
  PRACTICE_TEMPLATE_SECTIONS,
  type PracticeTemplateDefinition,
} from '@/lib/practice-template-library';

function formatCategoryLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DocumentTemplates() {
  const [templates] = useState<PracticeTemplateDefinition[]>(PRACTICE_TEMPLATE_LIBRARY);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'Client Setup',
    'Compliance & Correspondence',
    'Reports',
  ]);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'updated'>('name');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    template: PracticeTemplateDefinition | null;
    html: string;
  }>({
    isOpen: false,
    template: null,
    html: '',
  });

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionTitle)
        ? prev.filter((s) => s !== sectionTitle)
        : [...prev, sectionTitle]
    );
  };

  const filteredTemplates = templates.filter((template) =>
    searchQuery.trim()
      ? template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.category.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const handlePreview = async (template: PracticeTemplateDefinition) => {
    setIsPreviewing(true);
    try {
      const sampleData = getSampleData();
      const html = await generateDocument(template.filename, sampleData);
      
      setPreviewState({
        isOpen: true,
        template,
        html,
      });
    } catch (err) {
      console.error('Failed to preview template:', err);
      alert('Failed to load template preview. Please check the template file exists.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const closePreview = () => {
    setPreviewState({
      isOpen: false,
      template: null,
      html: '',
    });
  };

  const handlePrint = () => {
    const iframe = document.querySelector('iframe[title="Template Preview"]') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleDownload = () => {
    if (previewState.html && previewState.template) {
      const blob = new Blob([previewState.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${previewState.template.name.replace(/\s+/g, '_')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <UniversalPageLayout>
      <UniversalPageHeader
        title="Letter Templates"
        subtitle="Manage and preview pre-filled client letters, packs, summaries, and practice correspondence templates."
        actions={
          <button
            className="btn-primary btn-templates"
            onClick={() => alert('Custom template creation coming soon')}
          >
            <Plus size={20} />
            Upload Custom Letter
          </button>
        }
      />

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700"
            style={{ marginBottom: '1.5rem' }}
          >
            {error}
          </div>
        )}

        {/* Search and Sort Controls */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates by name, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="name">Name</option>
              <option value="category">Category</option>
              <option value="updated">Last Updated</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <FileText className="mb-3 h-8 w-8 text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Letters
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{templates.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Folder className="mb-3 h-8 w-8 text-blue-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sections
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{PRACTICE_TEMPLATE_SECTIONS.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <FileEdit className="mb-3 h-8 w-8 text-emerald-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Setup Letters
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {templates.filter((t) => ['onboarding', 'engagement'].includes(t.category)).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <FileText className="mb-3 h-8 w-8 text-purple-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reporting Letters
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {templates.filter((t) => t.category === 'reporting').length}
            </p>
          </div>
        </div>

        {/* Sectioned Template List */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-slate-500">Loading templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <FileText className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">No letter templates match your search.</p>
            </div>
          ) : (
            PRACTICE_TEMPLATE_SECTIONS.map((section) => {
              const sectionTemplates = filteredTemplates.filter((t) =>
                section.categories.includes(t.category)
              );
              if (sectionTemplates.length === 0) return null;

              const isExpanded = expandedSections.includes(section.title);

              return (
                <div
                  key={section.title}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* Section Header */}
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="flex w-full items-center justify-between p-6 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{section.icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                        <p className="text-sm text-slate-500">{section.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                        {sectionTemplates.length} templates
                      </span>
                      <svg
                        className={`h-5 w-5 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </button>

                  {/* Section Content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50">
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Template Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Category
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Fields
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sectionTemplates.map((template) => (
                            <tr key={template.filename} className="hover:bg-slate-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-amber-500" />
                                  <span className="font-semibold text-slate-900">
                                  {template.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="text-sm text-slate-600">{template.description}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                  {formatCategoryLabel(template.category)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                                  {template.placeholders.length}
                                  <span className="text-xs font-normal text-slate-500">fields</span>
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handlePreview(template)}
                                    disabled={isPreviewing}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    <Eye className="h-4 w-4" />
                                    Preview
                                  </button>
                                  <button
                                    onClick={() => handlePreview(template)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
                                  >
                                    <Plus className="h-4 w-4" />
                                    Generate
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div
        style={{
          marginTop: '2rem',
          background: 'linear-gradient(135deg, rgba(193, 143, 28, 0.1) 0%, rgba(193, 143, 28, 0.05) 100%)',
          border: '1px solid rgba(193, 143, 28, 0.2)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          Using Letter Templates
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-muted)' }}>
          <li>Letter templates automatically fill with client data when generated from client pages</li>
          <li>Preview shows sample data to verify template formatting</li>
          <li>All letter templates include M Practice branding and professional formatting</li>
          <li>Templates are stored in <code>template_library/</code></li>
        </ul>
      </div>

      {/* Preview Modal */}
      {previewState.isOpen && previewState.template && (
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
            zIndex: 9999,
            padding: '2rem',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              width: 'min(92vw, 1200px)',
              height: 'min(92vh, 900px)',
              background: '#fff',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 40px 80px rgba(15,23,42,0.35)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(15,23,42,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>{previewState.template.name}</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Scroll to review. Use actions to print, download, or share.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePrint}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Print
                </button>
                <button
                  onClick={handleDownload}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Download
                </button>
                <button
                  onClick={closePreview}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--gold)',
                    color: '#000',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                background: '#f8fafc',
                padding: '1.5rem',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  background: '#fff',
                  border: '1px solid rgba(15,23,42,0.08)',
                  boxShadow: '0 12px 40px rgba(15,23,42,0.1)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  minHeight: '100%',
                  width: '100%',
                  maxWidth: '900px',
                }}
              >
                <iframe
                  title="Template Preview"
                  srcDoc={previewState.html}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 'calc(90vh - 240px)',
                    border: 'none',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </UniversalPageLayout>
  );
}
