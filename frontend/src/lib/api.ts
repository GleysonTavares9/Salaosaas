
import { supabase } from './supabase';
import { Salon, Service, Product, Professional, Appointment, ChatMessage, Conversation } from '../types';

export const api = {
    // --- Salões ---
    salons: {
        async getAll() {
            const { data, error } = await supabase.from('salons').select('*');
            if (error) throw error;
            return data as Salon[];
        },

        async getBySlug(slug: string) {
            const { data, error } = await supabase.from('salons').select('*').eq('slug_publico', slug).single();
            if (error) throw error;
            return data as Salon;
        },
        async getById(id: string) {
            const { data, error } = await supabase.from('salons').select('*').eq('id', id).single();
            if (error) throw error;
            return data as Salon;
        },
        async create(salon: Omit<Salon, 'id'>) {
            const { data, error } = await supabase.from('salons').insert(salon).select().single();
            if (error) throw error;
            return data as Salon;
        },
        async update(id: string, updates: Partial<Salon>) {
            const { data, error } = await supabase.from('salons').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data as Salon;
        }
    },

    // --- Perfis de Usuário ---
    profiles: {
        async getById(id: string) {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            return data as any;
        },
        async update(id: string, updates: any) {
            // Usamos upsert para evitar erro caso o perfil ainda não exista na tabela public.profiles
            const { data, error } = await supabase
                .from('profiles')
                .upsert({ id, ...updates })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // --- Serviços ---
    services: {
        async getBySalon(salonId: string) {
            const { data, error } = await supabase.from('services').select('*').eq('salon_id', salonId);
            if (error) throw error;
            return data as Service[];
        },
        async create(service: Omit<Service, 'id'>) {
            const { data, error } = await supabase.from('services').insert(service).select().single();
            if (error) throw error;
            return data as Service;
        }
    },

    // --- Produtos ---
    products: {
        async getAll() {
            const { data, error } = await supabase.from('products').select('*');
            if (error) throw error;
            return data as Product[];
        },
        async getBySalon(salonId: string) {
            const { data, error } = await supabase.from('products').select('*').eq('salon_id', salonId);
            if (error) throw error;
            return data as Product[];
        },

        async create(product: Omit<Product, 'id'>) {
            const { data, error } = await supabase.from('products').insert(product).select().single();
            if (error) throw error;
            return data as Product;
        },
        async updateStock(productId: string, quantity: number) {
            const { data, error } = await supabase.rpc('decrement_stock', { p_id: productId, p_qty: quantity });
            if (error) throw error;
            return data;
        }
    },

    // --- Profissionais ---
    professionals: {
        async getBySalon(salonId: string) {
            const { data, error } = await supabase.from('professionals').select('*').eq('salon_id', salonId);
            if (error) throw error;
            return data as Professional[];
        },
        async create(professional: Omit<Professional, 'id'>) {
            const { data, error } = await supabase.from('professionals').insert(professional).select().single();
            if (error) throw error;
            return data as Professional;
        },
        async update(id: string, updates: Partial<Professional>) {
            const { data, error } = await supabase.from('professionals').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data as Professional;
        },
        async delete(id: string) {
            const { error } = await supabase.from('professionals').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // --- Agendamentos ---
    appointments: {
        async create(appointment: Omit<Appointment, 'id'>) {
            const { data, error } = await supabase.from('appointments').insert(appointment).select().single();
            if (error) throw error;
            return data as Appointment;
        },
        async getByClient(clientId: string) {
            const { data, error } = await supabase.from('appointments').select('*').eq('client_id', clientId).order('date', { ascending: false });
            if (error) throw error;
            return data as Appointment[];
        },
        async getBySalon(salonId: string) {
            const { data, error } = await supabase.from('appointments').select('*').eq('salon_id', salonId).order('date', { ascending: false });
            if (error) throw error;
            return data as Appointment[];
        },
        async getByProfessional(proId: string) {
            const { data, error } = await supabase
                .from('appointments')
                .select('*, profiles:client_id(full_name)')
                .eq('professional_id', proId)
                .order('date', { ascending: false });

            if (error) throw error;

            return (data || []).map(appt => ({
                ...appt,
                clientName: (appt as any).profiles?.full_name || 'Cliente'
            })) as Appointment[];
        },
        async update(id: string, updates: Partial<Appointment>) {
            const { data, error } = await supabase.from('appointments').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data as Appointment;
        },
        async updateStatus(id: string, status: Appointment['status']) {
            return this.update(id, { status });
        },
        async delete(id: string) {
            const { error } = await supabase.from('appointments').delete().eq('id', id);
            if (error) throw error;
        }
    },

    // --- Chat (Realtime ready) ---
    chat: {
        async getConversations(userId: string) {
            const { data, error } = await supabase.from('conversations').select('*').or(`user1_id.eq.${userId}, user2_id.eq.${userId}`);
            if (error) throw error;
            return data as Conversation[];
        },
        async startConversation(currentUserId: string, targetUserId: string) {
            // Verificar se já existe conversa entre esses dois usuários
            const { data: existing } = await supabase
                .from('conversations')
                .select('*')
                .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUserId})`)
                .maybeSingle();

            if (existing) return existing as Conversation;

            // Criar nova seguindo estritamente o schema do banco: id, user1_id, user2_id, last_message, unread_count
            const { data, error } = await supabase.from('conversations').insert({
                user1_id: currentUserId,
                user2_id: targetUserId,
                last_message: 'Nova conexão',
                unread_count: 0
            }).select().single();

            if (error) throw error;
            return data as Conversation;
        },
        async getMessages(conversationId: string) {
            const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('timestamp', { ascending: true });
            if (error) throw error;
            return data as ChatMessage[];
        },
        async sendMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
            const { data, error } = await supabase.from('messages').insert(message).select().single();
            if (error) throw error;
            return data as ChatMessage;
        },
        subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
            return supabase
                .channel(`messages:${conversationId} `)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id = eq.${conversationId} ` }, callback)
                .subscribe();
        }
    },

    // --- Armazenamento (Supabase Storage) ---
    storage: {
        async upload(file: File, bucket: string = 'aura-public') {
            const fileExt = file.name.split('.').pop();
            // Sanitize file name to avoid 400 errors with weird characters
            const rawName = file.name.replace(/[^a-zA-Z0-9]/g, '');
            const fileName = `${rawName}_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt} `;
            const filePath = `${fileName} `;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            return data.publicUrl;
        }
    },

    // --- Avaliações (Reviews) ---
    reviews: {
        async create(review: { appointment_id: string; salon_id: string; professional_id?: string; client_id: string; rating: number; comment?: string }) {
            const { data, error } = await supabase.from('reviews').insert(review).select().single();
            if (error) throw error;

            // Atualizar rating médio do salão
            await this.updateSalonRating(review.salon_id);

            return data;
        },
        async getBySalon(salonId: string) {
            const { data, error } = await supabase
                .from('reviews')
                .select(`
    *,
    client: client_id(
        id,
        email,
        full_name,
        avatar_url
    )
        `)
                .eq('salon_id', salonId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        async updateSalonRating(salonId: string) {
            // Buscar todas as avaliações do salão
            const { data: reviews, error: reviewsError } = await supabase
                .from('reviews')
                .select('rating')
                .eq('salon_id', salonId);

            if (reviewsError) throw reviewsError;

            if (reviews && reviews.length > 0) {
                const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                const roundedRating = Math.round(avgRating * 10) / 10; // Arredondar para 1 casa decimal

                // Atualizar salão
                const { error: updateError } = await supabase
                    .from('salons')
                    .update({
                        rating: roundedRating,
                        reviews: reviews.length
                    })
                    .eq('id', salonId);

                if (updateError) throw updateError;
            }
        }
    },

    // --- Auth Helper ---
    auth: {
        async signUp(email: string, pass: string, metadata: any) {
            const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: metadata } });
            if (error) throw error;
            return data;
        },
        async signIn(email: string, pass: string) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
            return data;
        },
        async signOut() {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        }
    }
};
