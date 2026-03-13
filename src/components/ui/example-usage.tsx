// Example usage of LockIcon and InfoBanner components
// This file demonstrates how to use the new UI components

import React from 'react';
import { LockIcon } from './LockIcon';
import { InfoBanner } from './InfoBanner';

export const ExampleUsage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '600px' }}>
      <h2>LockIcon Examples</h2>

      {/* Basic locked field */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Declarant Name
          <LockIcon tooltip="Declarant information is locked and can only be changed by administrators" />
        </label>
        <input
          type="text"
          value="John Smith"
          disabled
          style={{
            width: '100%',
            padding: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'not-allowed',
          }}
        />
      </div>

      <h2 style={{ marginTop: '2rem' }}>InfoBanner Examples</h2>

      {/* Info banner for SELF users */}
      <InfoBanner
        message="Your claim is being submitted for your own entity. To update this information, go to Settings."
        variant="info"
      />

      {/* Warning banner for AGENT users */}
      <InfoBanner
        message="You are submitting as Agent Name on behalf of Contact Name"
        variant="warning"
      />

      {/* Dismissible banner */}
      <InfoBanner
        message="This is a dismissible information banner. Click the X to close it."
        variant="info"
        dismissible
        onDismiss={() => console.log('Banner dismissed')}
      />
    </div>
  );
};
