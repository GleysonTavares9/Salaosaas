
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
  mp_access_token?: string; // Access Token privado do Mercado Pago
  paga_no_local?: boolean; // Opção de desabilitar cobrança antecipada
  subscription_plan?: 'free' | 'starter' | 'pro' | 'premium' | 'lifetime';
  trial_ends_at?: string;
  subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled';
  ai_promo_text?: string;
  ai_promo_discount?: number;
  ai_enabled?: boolean;
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
  email?: string;
  horario_funcionamento?: { [key: string]: WorkingDay };
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
  booked_by_ai?: boolean;
  // Legacy fields for backward compatibility (not in DB)
  clientName?: string;
  clientPhone?: string;
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

export interface Expense {
  id: string;
  salon_id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  status: 'paid' | 'pending';
  created_at?: string;
}
