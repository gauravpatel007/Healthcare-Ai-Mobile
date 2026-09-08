import React from 'react';
import { Link } from 'react-router-dom';

const MobileTopNav = ({ items, checkIsActive, topNavRef }) => {
  const getShortLabel = (id, label) => {
    if (id === 'ai-symptom') return 'Symptoms';
    if (id === 'ai-mental') return 'Mental';
    if (id === 'ai-chat') return 'AI Chat';
    if (id === 'dashboard') return 'Dashboard';
    return label;
  };

  return (
    <div
      className="relative z-20 px-1 pt-2.5 pb-1 bg-transparent shrink-0 no-scrollbar pointer-events-none md:hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      ref={topNavRef}
    >
      <div className="pointer-events-auto flex items-center w-full justify-between gap-1 bg-white/60 dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-[28px] p-1 shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-black/[0.05] dark:border-white/[0.08]">
        {items.map(item => {
          const isActive = checkIsActive(item.path);
          const Icon = item.icon;
          const labelText = getShortLabel(item.id, item.label);

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex-1 flex items-center justify-center px-1 py-2 min-h-[38px] rounded-[22px] transition-all duration-200 text-[12px] font-bold whitespace-nowrap touch-manipulation active:scale-95 ${isActive
                  ? 'active-mobile-nav bg-[#0f172a] text-white dark:bg-[#262626] shadow-sm'
                  : 'text-[#6b7280] dark:text-gray-400 active:bg-gray-200/50 dark:active:bg-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
                }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span>{labelText}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobileTopNav;
