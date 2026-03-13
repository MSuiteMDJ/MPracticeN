/**
 * M Practice Manager branding header for auth pages.
 */

import './BrandingHeader.css';

export default function BrandingHeader() {
  return (
    <div className="mcm-full-container">
      <img 
        src={`${import.meta.env.BASE_URL}M_Logo_PurpleD.png`}
        alt="M Practice Manager Logo"
        className="mcm-logo"
      />
      <div className="mcm-text-block">
        <div className="mcm-text-customs">PRACTICE</div>
        <div className="mcm-text-manager">MANAGER</div>
      </div>
    </div>
  );
}
