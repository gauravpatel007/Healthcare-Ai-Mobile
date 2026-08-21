/**
 * UnitContext — Metric/Imperial display conversion
 * All values are STORED in the DB as metric (kg, cm).
 * This context converts on-the-fly for display only.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const UnitContext = createContext();

export const useUnit = () => useContext(UnitContext);

export const UnitProvider = ({ children }) => {
  const [unit, setUnitState] = useState(() => {
    return localStorage.getItem('app_unit') || 'metric';
  });

  const setUnit = useCallback((u) => {
    setUnitState(u);
    localStorage.setItem('app_unit', u);
  }, []);

  React.useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'app_unit' && e.newValue) {
        setUnitState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  /**
   * Display weight: takes kg, returns formatted string with unit label.
   * @param {number} kg - weight in kg
   * @returns {{ value: string, label: string, raw: number }}
   */
  const displayWeight = useCallback((kg) => {
    if (!kg && kg !== 0) return { value: '--', label: unit === 'imperial' ? 'lbs' : 'kg', raw: 0 };
    if (unit === 'imperial') {
      const lbs = (kg * 2.20462).toFixed(1);
      return { value: lbs, label: 'lbs', raw: parseFloat(lbs) };
    }
    return { value: parseFloat(kg).toFixed(1), label: 'kg', raw: parseFloat(kg) };
  }, [unit]);

  /**
   * Display height: takes cm, returns formatted string with unit label.
   * @param {number} cm - height in cm
   * @returns {{ value: string, label: string }}
   */
  const displayHeight = useCallback((cm) => {
    if (!cm && cm !== 0) return { value: '--', label: unit === 'imperial' ? 'ft/in' : 'cm' };
    if (unit === 'imperial') {
      const totalInches = cm / 2.54;
      const feet = Math.floor(totalInches / 12);
      const inches = Math.round(totalInches % 12);
      return { value: `${feet}'${inches}"`, label: 'ft/in' };
    }
    return { value: parseFloat(cm).toFixed(0), label: 'cm' };
  }, [unit]);

  /**
   * Convert user-input weight back to kg for storage.
   * @param {number} val - value in current unit
   * @returns {number} value in kg
   */
  const toStorageWeight = useCallback((val) => {
    if (!val) return val;
    if (unit === 'imperial') return parseFloat((val / 2.20462).toFixed(2));
    return parseFloat(val);
  }, [unit]);

  /**
   * Convert user-input height back to cm for storage.
   * @param {number} val - value in current unit (cm if metric, total inches if imperial)
   * @returns {number} value in cm
   */
  const toStorageHeight = useCallback((val) => {
    if (!val) return val;
    if (unit === 'imperial') return parseFloat((val * 2.54).toFixed(1));
    return parseFloat(val);
  }, [unit]);

  /**
   * Get weight unit label.
   */
  const weightUnit = unit === 'imperial' ? 'lbs' : 'kg';

  /**
   * Get height unit label.
   */
  const heightUnit = unit === 'imperial' ? 'ft/in' : 'cm';

  return (
    <UnitContext.Provider value={{
      unit,
      setUnit,
      displayWeight,
      displayHeight,
      toStorageWeight,
      toStorageHeight,
      weightUnit,
      heightUnit,
      isImperial: unit === 'imperial',
    }}>
      {children}
    </UnitContext.Provider>
  );
};
