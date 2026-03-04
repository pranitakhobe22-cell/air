import React from 'react';
import './SectionHeader.css';

const SectionHeader = ({ title, subtitle, icon, action }) => {
  return (
    <div className="section-header">
      <div className="section-header__left">
        {icon && <span className="section-header__icon">{icon}</span>}
        <div>
          <h2 className="section-header__title">{title}</h2>
          {subtitle && <p className="section-header__subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="section-header__action">{action}</div>}
    </div>
  );
};

export default SectionHeader;
