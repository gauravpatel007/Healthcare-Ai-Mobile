import React from 'react';
import { Link } from 'react-router-dom';

const MobileBottomNav = ({ items, checkIsActive }) => {
  return (
    <nav
      className="fixed z-50 left-3 right-3 md:hidden"
      style={{ bottom: 'calc(10px + env(safe-area-bottom, 0px))' }}
    >
      <div className="flex items-center justify-around bg-white/60 dark:bg-black/60 backdrop-blur-2xl backdrop-saturate-150 rounded-[28px] px-1 py-1 shadow-[0_4px_24px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.35)] border border-black/[0.05] dark:border-white/[0.08]">
        {items.map(item => {
          const isActive = checkIsActive(item.path);
          const isEmergency = item.id === 'emergency';
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              to={item.path}
              className="flex-1 flex flex-col items-center justify-center py-2 rounded-[22px] touch-manipulation active:scale-95 transition-transform duration-150 relative"
            >
              <Icon
                className={`w-[22px] h-[22px] transition-colors duration-200 ${
                  isActive
                    ? isEmergency
                      ? 'text-red-500'
                      : 'text-[#3b9dff]'
                    : 'text-[#8e8e93]'
                }`}
                strokeWidth={isActive ? 2.5 : 1.6}
                fill="none"
              />
              <span
                className={`text-[10px] mt-1 transition-colors duration-200 ${
                  isActive
                    ? isEmergency
                      ? 'text-red-400 font-semibold'
                      : 'text-[#3b9dff] font-semibold'
                    : 'text-[#8e8e93] font-medium'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
