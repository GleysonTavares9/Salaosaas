
export type ViewRole = 'client' | 'pro' | 'admin';
export type BusinessSegment = 'Salão' | 'Manicure' | 'Sobrancelha' | 'Barba' | 'Estética' | 'Spa';

export interface WorkingDay {
  open: string;
  close: string;
  closed: boolean;
}

export interface Salon {
  id: string;
  nome: string;
  slug_publico: string;
  segmento: BusinessSegment;
  descricao: string;
  logo_url: string;
  banner_url: string;
  endereco: string;
  cidade: string;
  distancia?: string;
  rating: number;
  reviews: number;
  telefone: string;
  amenities: string[];
  gallery_urls?: string[];
  location: {
    lat: number;
    lng: number;
  };
  horario_funcionamento: {
    [key: string]: WorkingDay;
  };
  mp_public_key?: string; // Chave pública do Mercado Pago salva no banco
}

export interface Product {
  id: string;
  salon_id: string;
  salon_name?: string; // Cache do nome para exibição rápida
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stock: number; // Controle de estoque obrigatório
}

export interface Service {
  id: string;
  salon_id: string;
  name: string;
  duration_min: number;
  price: number;
  category: string;
  description: string;
  image: string;
  premium?: boolean;
}

export interface Professional {
  id: string;
  salon_id: string;
  user_id?: string; // Vincluo com Supabase Auth
  name: string;
  role: string;
  image: string;
  productivity: number;
  rating: number;
  status: 'active' | 'away';
  comissao: number;
}

export interface Appointment {
  id: string;
  salon_id: string;
  client_id: string;
  professional_id?: string | null;
  service_names: string;
  date: string;
  time: string;
  duration_min?: number;
  status: 'confirmed' | 'pending' | 'completed' | 'canceled';
  valor: number;
  // Legacy fields for backward compatibility (not in DB)
  clientName?: string;
  professionalName?: string;
  salonName?: string;
  serviceName?: string;
}

// Added missing GalleryItem interface
export interface GalleryItem {
  id: string;
  salon_id: string;
  category: string;
  url: string;
  title: string;
}

// Added missing Conversation interface
export interface Conversation {
  id: string;
  participant_name: string;
  participant_image: string;
  last_message: string;
  timestamp: string;
  unread_count: number;
}

// Added missing ChatMessage interface
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  timestamp: string;
  is_me?: boolean;
}
