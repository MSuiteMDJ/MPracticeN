/**
 * Arcanus Practice branding header for auth pages.
 */

import './BrandingHeader.css';

export default function BrandingHeader() {
  return (
    <div className="mcm-full-container">
      <img 
        src={`${import.meta.env.BASE_URL}arcanus-logo.png`}
        alt="Arcanus Practice Logo"
        className="mcm-logo"
      />
      <div className="mcm-text-block">
        <div className="mcm-text-customs">PRACTICE</div>
        <div className="mcm-text-manager">MANAGER</div>
      </div>
    </div>
  );
}
