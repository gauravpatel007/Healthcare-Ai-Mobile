import React, { useState } from 'react';
import { Dumbbell, CalendarRange } from 'lucide-react';
import AdminExerciseLibrary from './AdminExerciseLibrary';
import AdminWorkoutPlans from './AdminWorkoutPlans';
import { usePersistentTab } from '../../hooks/usePersistentTab';

export default function AdminFitness() {
  const [activeTab, setActiveTab] = usePersistentTab('admin_fitness', 'exercises');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-4 relative overflow-visible w-full">
        <div className="flex items-center gap-4 lg:gap-6 relative z-10 w-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Dumbbell className="w-8 h-8" />
          </div>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 text-left">
              Fitness Management
            </h1>
            <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2 text-left">
              Manage the exercise library and workout plans.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-fit">
        <button
          onClick={() => setActiveTab('exercises')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'exercises' 
              ? 'bg-rose-50 text-rose-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Dumbbell className={`w-4 h-4 ${activeTab === 'exercises' ? 'text-rose-600' : ''}`} />
          Exercise Library
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'plans' 
              ? 'bg-blue-50 text-blue-700 shadow-sm' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <CalendarRange className={`w-4 h-4 ${activeTab === 'plans' ? 'text-blue-600' : ''}`} />
          Workout Plans
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'exercises' && <AdminExerciseLibrary />}
        {activeTab === 'plans' && <AdminWorkoutPlans />}
      </div>

    </div>
  );
}
