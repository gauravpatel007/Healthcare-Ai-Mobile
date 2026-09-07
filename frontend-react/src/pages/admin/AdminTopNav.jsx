import React from 'react';
import { Link } from 'react-router-dom';

const AdminTopNav = ({ items, checkIsActive, topNavRef }) => {
  return (
    <div 
      className="md:hidden relative z-20 px-1 pt-2.5 pb-1 bg-transparent shrink-0 overflow-x-auto no-scrollbar pointer-events-auto flex w-full"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      ref={topNavRef}
    >
      <div className="flex items-center gap-1 bg-white/60 dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-[28px] p-1 shadow-[0_4px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-black/[0.05] dark:border-white/[0.08] min-w-max">
        {items.map(item => {
          const isActive = checkIsActive(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center justify-center px-3 py-2 min-h-[38px] rounded-[22px] transition-all duration-200 text-[12px] font-bold whitespace-nowrap touch-manipulation active:scale-95 ${
                isActive 
                  ? 'active-admin-nav bg-[#0f172a] text-white dark:bg-[#262626] shadow-sm' 
                  : 'text-[#6b7280] dark:text-gray-400 active:bg-gray-200/50 dark:active:bg-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AdminTopNav;
