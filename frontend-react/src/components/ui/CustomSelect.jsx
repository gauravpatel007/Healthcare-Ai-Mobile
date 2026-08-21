import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomSelect = ({ name, value, onChange, options, placeholder = "Select an option", className = "", containerClassName = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || null;

  return (
    <div className={`relative shrink-0 ${containerClassName}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl px-4 py-3 outline-none hover:border-indigo-300 dark:hover:border-indigo-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm ${className}`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 mt-2 w-full min-w-[150px] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden origin-top animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="p-1.5 flex flex-col gap-0.5 max-h-[300px] overflow-y-auto custom-scrollbar">
          {options.map(option => (
            <button
              type="button"
              key={option.value}
              onClick={() => {
                if (onChange) {
                  onChange({ target: { value: option.value, name: name } });
                }
                setIsOpen(false);
              }}
              className={`text-left px-3 py-2 text-sm font-bold rounded-lg transition-colors ${String(value) === String(option.value)
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};

export default CustomSelect;
