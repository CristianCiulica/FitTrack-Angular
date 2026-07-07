import { Units } from '../models/user-profile.model';

// Stocarea canonica e mereu metrica (kg, cm). Unitatile afecteaza doar afisarea/inputul.

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cmToInches(cm));
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}

export const weightUnitLabel = (units: Units): string => (units === 'imperial' ? 'lb' : 'kg');
export const heightUnitLabel = (units: Units): string => (units === 'imperial' ? 'ft/in' : 'cm');

// valoarea de greutate afisata in unitatea aleasa, dintr-o valoare canonica in kg
export function displayWeight(kg: number, units: Units): number {
  return units === 'imperial' ? Math.round(kgToLb(kg)) : Math.round(kg);
}

// converteste inapoi in kg (canonic) dintr-o valoare introdusa in unitatea aleasa
export function toCanonicalWeight(value: number, units: Units): number {
  return units === 'imperial' ? Math.round(lbToKg(value) * 10) / 10 : value;
}

export function formatWeight(kg: number, units: Units): string {
  return `${displayWeight(kg, units)} ${weightUnitLabel(units)}`;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}
