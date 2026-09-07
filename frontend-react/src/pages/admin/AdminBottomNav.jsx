import React from 'react';
import { Link } from 'react-router-dom';

const AdminBottomNav = ({ items, checkIsActive }) => {
  return (
    <nav
      className="md:hidden fixed z-50 left-2.5 right-2.5"
      style={{ bottom: 'calc(10px + env(safe-area-bottom, 0px))' }}
    >
      <div className="h-[58px] flex items-center justify-around bg-white/60 dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-[28px] px-1 shadow-[0_4px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-black/[0.05] dark:border-white/[0.08]">
        {items.map(item => {
          const isActive = checkIsActive(item.path);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.path}
              className="flex-1 h-full flex flex-col items-center justify-center py-1 rounded-[22px] touch-manipulation active:scale-95 transition-transform duration-150 relative"
            >
              <Icon
                className={`w-[22px] h-[22px] shrink-0 transition-colors duration-200 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-[#8e8e93]'
                }`}
                strokeWidth={isActive ? 2.5 : 1.6}
                fill="none"
              />
              <span
                className={`text-[10px] tracking-tight whitespace-nowrap mt-1 transition-colors duration-200 text-center ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-[#8e8e93] font-medium'
                }`}
              >
                {item.label || item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default AdminBottomNav;
