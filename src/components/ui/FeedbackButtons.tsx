import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface FeedbackButtonsProps {
  pageId: string;
}

export default function FeedbackButtons({ pageId }: FeedbackButtonsProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);

  const handleFeedback = (type: 'helpful' | 'not-helpful') => {
    setFeedback(type);
    // TODO: Send feedback to analytics/backend
    console.log(`Feedback for ${pageId}:`, type);
  };

  if (feedback) {
    return (
      <div
        style={{
          padding: '1rem',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '0.95rem',
          color: '#16a34a',
        }}
      >
        ✓ Thank you for your feedback!
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '1.5rem',
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        textAlign: 'center',
      }}
    >
      <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
        Was this page helpful?
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button
          onClick={() => handleFeedback('helpful')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            color: '#22c55e',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#22c55e';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#22c55e';
          }}
        >
          <ThumbsUp size={18} />
          Yes, helpful
        </button>
        <button
          onClick={() => handleFeedback('not-helpful')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            color: '#ef4444',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 600,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#ef4444';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#ef4444';
          }}
        >
          <ThumbsDown size={18} />
          No, not helpful
        </button>
      </div>
    </div>
  );
}
