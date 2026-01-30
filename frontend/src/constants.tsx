
import { Service, Professional, Salon, Product, GalleryItem, Appointment } from './types.ts';

export const INITIAL_HOURS = {
  'monday': { open: '09:00', close: '18:00', closed: false },
  'tuesday': { open: '09:00', close: '18:00', closed: false },
  'wednesday': { open: '09:00', close: '18:00', closed: false },
  'thursday': { open: '09:00', close: '19:00', closed: false },
  'friday': { open: '09:00', close: '20:00', closed: false },
  'saturday': { open: '08:00', close: '17:00', closed: false },
  'sunday': { open: '00:00', close: '00:00', closed: true },
};

// Limpando dados de demonstração para versão real
export const SALONS: Salon[] = [];
export const PRODUCTS: Product[] = [];
export const SERVICES: Service[] = [];
export const PROFESSIONALS: Professional[] = [];
export const GALLERY_ITEMS: GalleryItem[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
