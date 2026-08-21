import React from 'react';
import { Activity, User, Droplet, AlertTriangle, HeartPulse, ShieldCheck } from 'lucide-react';
import './HealthIDCard.css';

const HealthIDCard = ({ profile, qrUrl, t }) => {
  return (
    <div className="hid-card">
      <div className="hid-glow-tr" />
      <div className="hid-glow-bl" />

      {/* Top-right ECG zig-zag line */}
      <div className="top-right-ecg">
        <svg viewBox="0 0 280 70" fill="none">
          <path
            d="M0 35H75L90 35L105 15L120 55L138 5L155 65L175 35H205L215 25L225 45L238 35H280"
            stroke="rgba(126, 97, 255, 0.45)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Top-right shield */}
      <div className="top-right-shield">
        <svg viewBox="0 0 100 100" fill="none">
          <path
            d="M50 8C50 8 27 25 12 25V48C12 70 28 87 50 94C72 87 88 70 88 48V25C73 25 50 8 50 8Z"
            stroke="rgba(126, 97, 255, 0.3)"
            strokeWidth="2.5"
          />

          <path
            d="M50 32V66M33 49H67"
            stroke="rgba(126, 97, 255, 0.22)"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="hid-header">
        <div className="hid-header-left">
          <div className="hid-icon-box">
            <Activity size={28} color="#fff" />
          </div>
          <div>
            <div className="hid-title">{t('LifeOS Health ID')}</div>
            <div className="hid-subtitle">{t('Emergency Medical Profile')}</div>
          </div>
        </div>
      </div>

      <div className="hid-name-section">
        <div className="hid-name-label">
          <User size={13} color="#475569" />
          {t('Patient Name')}
        </div>
        <div className="hid-name">{profile?.name || t('LifeOS User')}</div>
      </div>

      <div className="hid-stats">
        <div className="hid-stat">
          <div className="hid-stat-label">{t('Blood Type')}</div>
          <div className="hid-stat-value blood">
            <Droplet size={18} fill="#f43f5e" color="#f43f5e" />
            {profile?.blood_type || t('N/A')}
          </div>
        </div>
        <div className="hid-stat">
          <div className="hid-stat-label">{t('Age')}</div>
          <div className="hid-stat-value">{profile?.age ? `${profile.age}y` : t('N/A')}</div>
        </div>
        <div className="hid-stat">
          <div className="hid-stat-label">{t('Gender')}</div>
          <div className="hid-stat-value">{profile?.gender ? t(profile.gender) : t('N/A')}</div>
        </div>
      </div>

      <div className="hid-tags-grid">
        <div className="hid-tag-box allergies">
          <div className="hid-tag-title">
            <AlertTriangle size={13} />
            {t('Allergies')}
          </div>
          <div className="hid-tag-pills">
            {profile?.allergies?.length > 0
              ? profile.allergies.map(a => <span key={a} className="hid-pill allergy">{a}</span>)
              : <span className="hid-none">{t('None')}</span>}
          </div>
        </div>
        <div className="hid-tag-box conditions">
          <div className="hid-tag-title">
            <HeartPulse size={13} />
            {t('Conditions')}
          </div>
          <div className="hid-tag-pills">
            {profile?.conditions?.length > 0
              ? profile.conditions.map(c => <span key={c} className="hid-pill condition">{c}</span>)
              : <span className="hid-none">{t('None')}</span>}
          </div>
        </div>
      </div>

      <div className="hid-qr-box">
        <div className="hid-qr-glow" />
        <div className="hid-qr-wrapper">
          <div className="hid-qr-corner tl" />
          <div className="hid-qr-corner tr" />
          <div className="hid-qr-corner bl" />
          <div className="hid-qr-corner br" />
          <div className="hid-qr-img-box">
            <img src={qrUrl} alt="Health ID QR Code" />
          </div>
        </div>
        <div className="hid-qr-info">
          <div className="hid-scan-title-row">
            <div className="hid-scan-title">{t('Scan for records')}</div>
            <div className="hid-shield-circle">
              <ShieldCheck size={18} color="#818cf8" />
            </div>
          </div>
          <div className="hid-scan-sub">{t('Authorized Personnel Only')}</div>
        </div>
      </div>
    </div>
  );
};

export default HealthIDCard;