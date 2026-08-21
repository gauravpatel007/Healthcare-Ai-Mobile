import React, { useState } from 'react';
import { CalendarDays, History, UtensilsCrossed, Camera } from 'lucide-react';
import AdminMealPlans from './AdminMealPlans';
import AdminMeals from './AdminMeals';
import AdminScannedMeals from './AdminScannedMeals';
import { usePersistentTab } from '../../hooks/usePersistentTab';

export default function AdminDiet() {
  const [activeTab, setActiveTab] = usePersistentTab('admin_diet', 'meals');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Diet Management
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage recipes, meal plans, nutrition, and shopping lists.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-fit">
        <button
          onClick={() => setActiveTab('meals')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'meals'
              ? 'bg-teal-50 dark:!bg-white text-teal-700 dark:!text-teal-700 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <UtensilsCrossed className={`w-4 h-4 ${activeTab === 'meals' ? 'text-teal-600 dark:!text-teal-600' : ''}`} />
          All Meals
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'history'
              ? 'bg-blue-50 dark:!bg-white text-blue-700 dark:!text-blue-700 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-blue-600 dark:!text-blue-600' : ''}`} />
          Generation History
        </button>
        <button
          onClick={() => setActiveTab('scanned')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'scanned'
              ? 'bg-purple-50 dark:!bg-white text-purple-700 dark:!text-purple-700 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Camera className={`w-4 h-4 ${activeTab === 'scanned' ? 'text-purple-600 dark:!text-purple-600' : ''}`} />
          Scanned Meals
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'meals' && <AdminMeals />}
        {activeTab === 'history' && <AdminMealPlans activeTab="history" />}
        {activeTab === 'scanned' && <AdminScannedMeals />}
      </div>

    </div>
  );
}
