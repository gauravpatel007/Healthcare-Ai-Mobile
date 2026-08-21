import React, { useState } from 'react';
import { MessageSquare, Terminal, Bot } from 'lucide-react';
import AdminAIPrompts from './AdminAIPrompts';
import AdminAIChats from './AdminAIChats';
import { usePersistentTab } from '../../hooks/usePersistentTab';

export default function AdminAI() {
  const [activeTab, setActiveTab] = usePersistentTab('admin_ai', 'chats');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Bot className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              AI Management
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Configure system prompts, versioning, and monitor AI interactions.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-fit">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'chats' 
              ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <MessageSquare className={`w-4 h-4 ${activeTab === 'chats' ? 'text-emerald-600' : ''}`} />
          Chat Logs & Analytics
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'prompts' 
              ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Terminal className={`w-4 h-4 ${activeTab === 'prompts' ? 'text-indigo-600' : ''}`} />
          Prompt Studio
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'prompts' && <AdminAIPrompts />}
        {activeTab === 'chats' && <AdminAIChats />}
      </div>

    </div>
  );
}
