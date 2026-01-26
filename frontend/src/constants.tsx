
import { Service, Professional, Salon, Product, GalleryItem, Appointment } from './types.ts';

export const INITIAL_HOURS = {
  'Seg': { open: '09:00', close: '18:00', closed: false },
  'Ter': { open: '09:00', close: '18:00', closed: false },
  'Qua': { open: '09:00', close: '18:00', closed: false },
  'Qui': { open: '09:00', close: '19:00', closed: false },
  'Sex': { open: '09:00', close: '20:00', closed: false },
  'Sáb': { open: '08:00', close: '17:00', closed: false },
  'Dom': { open: '00:00', close: '00:00', closed: true },
};

// Limpando dados de demonstração para versão real
export const SALONS: Salon[] = [];
export const PRODUCTS: Product[] = [];
export const SERVICES: Service[] = [];
export const PROFESSIONALS: Professional[] = [];
export const GALLERY_ITEMS: GalleryItem[] = [];
export const INITIAL_APPOINTMENTS: Appointment[] = [];
