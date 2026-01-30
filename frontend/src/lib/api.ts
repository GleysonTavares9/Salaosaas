import { supabase } from './supabase';
import { Salon, Service, Product, Professional, Appointment, ChatMessage, Conversation } from '../types';

export const api = {
    supabase,
    // --- Salões ---
    salons: {
        async getAll() {
            const { data, error } = await supabase.from('salons').select('id, nome, slug_publico, segmento, descricao, logo_url, banner_url, endereco, cidade, rating, reviews, telefone, amenities, gallery_urls, location, horario_funcionamento, mp_public_key');
            if (error) throw error;
            return data as Salon[];
        },

        async getBySlug(slug: string) {
            const { data, error } = await supabase.from('salons').select('id, nome, slug_publico, segmento, descricao, logo_url, banner_url, endereco, cidade, rating, reviews, telefone, amenities, gallery_urls, location, horario_funcionamento, mp_public_key').eq('slug_publico', slug).single();
            if (error) throw error;
            return data as Salon;
        },
        async getById(id: string) {
            const { data, error } = await supabase.from('salons').select('id, nome, slug_publico, segmento, descricao, logo_url, banner_url, endereco, cidade, rating, reviews, telefone, amenities, gallery_urls, location, horario_funcionamento, mp_public_key').eq('id', id).single();
            if (error) throw error;
            return data as Salon;
        },
        async getSecureConfig(id: string) {
            const { data, error } = await supabase.from('salons').select('mp_public_key, mp_access_token, paga_no_local').eq('id', id).single();
            if (error) throw error;
            return data;
        },
        async create(salon: Omit<Salon, 'id'>) {
            const { data, error } = await supabase.from('salons').insert(salon).select().single();
            if (error) throw error;
            return data as Salon;
        },
        async update(id: string, updates: Partial<Salon>) {
            const { data, error } = await supabase.from('salons').update(updates).eq('id', id).select().single();
            if (error) {
                console.error(`API Error updating salon:`, error.message);
                throw error;
            }
            return data as Salon;
        },
        async registerNewSalon(params: any) {
            const { data, error } = await supabase.rpc('register_new_salon_and_owner', params);
            if (error) throw error;
            return data as string; // Retorna o ID do salão
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
        },
        async getAll() {
            const { data, error } = await supabase.from('services').select('*, salons(nome)');
            if (error) throw error;
            return data as any[];
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
        },
        async update(id: string, updates: Partial<Product>) {
            const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data as Product;
        },
        async delete(id: string) {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;
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
        async update(id: string, updates: Partial<Professional>, salonId?: string) {
            // Removemos campos que não devem ser atualizados manualmente
            const { id: _, created_at: __, ...validUpdates } = updates as any;

            let query = supabase.from('professionals').update(validUpdates).eq('id', id);
            if (salonId) query = query.eq('salon_id', salonId);

            const { data, error } = await query.select();

            if (error) {
                console.error(`Erro na API ao atualizar profissional (${id}):`, error);
                throw error;
            }

            if (!data || data.length === 0) {
                // Tentativa de cura: Se falhou com filtro de salon_id, tenta apenas por ID
                // O banco de dados (RLS) ainda vai proteger se o usuário não tiver permissão
                if (salonId) {
                    console.warn(`Update com salon_id ${salonId} não afetou linhas. Tentando recovery por ID.`);
                    const retry = await supabase.from('professionals').update(validUpdates).eq('id', id).select();
                    if (retry.data && retry.data.length > 0) return retry.data[0] as Professional;
                }

                console.error(`Falha no update RLS: Registro ${id} não afetado.`);
                throw new Error(`Não foi possível salvar: Profissional não encontrado ou permissão negada.`);
            }
            return data[0] as Professional;
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

    // --- Chat ---
    chat: {
        async getConversations(userId: string) {
            const { data, error } = await supabase.from('conversations').select('*').or(`user1_id.eq.${userId}, user2_id.eq.${userId}`);
            if (error) throw error;
            return data as Conversation[];
        },
        async startConversation(currentUserId: string, targetUserId: string) {
            const { data: existing } = await supabase
                .from('conversations')
                .select('*')
                .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${targetUserId}),and(user1_id.eq.${targetUserId},user2_id.eq.${currentUserId})`)
                .maybeSingle();
            if (existing) return existing as Conversation;
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
                .channel(`messages:${conversationId}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id = eq.${conversationId}` }, callback)
                .subscribe();
        }
    },

    // --- Armazenamento ---
    storage: {
        async upload(file: File, bucket: string = 'aura-public') {
            const fileExt = file.name.split('.').pop();
            const rawName = file.name.replace(/[^a-zA-Z0-9]/g, '');
            const fileName = `${rawName}_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;
            const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
            return data.publicUrl;
        }
    },

    // --- Avaliações ---
    reviews: {
        async create(review: { appointment_id?: string; salon_id: string; client_id: string; professional_id?: string; rating: number; comment?: string }) {
            const { data, error } = await supabase.from('reviews').insert(review).select().single();
            if (error) throw error;
            await this.updateSalonRating(review.salon_id);
            return data;
        },
        async getBySalon(salonId: string) {
            const { data: reviews, error: reviewsError } = await supabase
                .from('reviews')
                .select('*')
                .eq('salon_id', salonId)
                .order('created_at', { ascending: false });
            if (reviewsError) throw reviewsError;
            if (!reviews || reviews.length === 0) return [];
            const clientIds = [...new Set(reviews.map(r => r.client_id))];
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', clientIds);
            if (profilesError) return reviews;
            return reviews.map(review => ({
                ...review,
                client: profiles.find(p => p.id === review.client_id) || null
            }));
        },
        async delete(reviewId: string, salonId: string) {
            const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
            if (error) throw error;
            await this.updateSalonRating(salonId);
        },
        async updateSalonRating(salonId: string) {
            // Conta TODAS as avaliações no banco para ser o mais fiel possível
            const { data: reviews, error: reviewsError } = await supabase
                .from('reviews')
                .select('rating')
                .eq('salon_id', salonId);

            if (reviewsError) throw reviewsError;

            const count = reviews?.length || 0;
            const avgRating = count > 0
                ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / count) * 10) / 10
                : 0.0; // Agora volta para 0 se não houver reviews

            const { error: updateError } = await supabase
                .from('salons')
                .update({
                    rating: avgRating,
                    reviews: count
                })
                .eq('id', salonId);

            if (updateError) {
                console.error("Falha ao atualizar contador no salão:", updateError);
            }
        }
    },

    // --- Pagamentos (Mercado Pago API) ---
    payments: {
        async createOrder(salon: Salon, paymentData: any) {
            let accessToken = salon.mp_access_token;
            if (!accessToken) {
                const { data } = await supabase.from('salons').select('mp_access_token').eq('id', salon.id).single();
                if (data?.mp_access_token) accessToken = data.mp_access_token;
            }
            if (!accessToken) throw new Error("Acesso negado ao Mercado Pago.");
            const amount = paymentData.transaction_amount || paymentData.amount || (paymentData.formData && paymentData.formData.transaction_amount);
            const token = paymentData.token || (paymentData.formData && paymentData.formData.token);
            const paymentMethodId = paymentData.payment_method_id || (paymentData.formData && paymentData.formData.payment_method_id);
            const isPix = paymentMethodId === 'pix';
            if (!amount || (!token && !isPix)) throw new Error("Dados de pagamento incompletos.");
            const payload: any = {
                transaction_amount: Number(amount),
                description: paymentData.description || `Pagamento em ${salon.nome}`,
                payment_method_id: paymentMethodId,
                installments: Number(paymentData.installments || 1),
                payer: { email: paymentData.payer?.email || 'cliente@aura.com' }
            };
            if (token) payload.token = token;
            const mpEndpoint = 'https://api.mercadopago.com/v1/payments';
            const targetUrl = 'https://corsproxy.io/?' + encodeURIComponent(mpEndpoint);
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return await response.json();
        },
        async checkStatus(paymentId: string | number, accessToken: string) {
            const mpEndpoint = `https://api.mercadopago.com/v1/payments/${paymentId}`;
            const targetUrl = 'https://corsproxy.io/?' + encodeURIComponent(mpEndpoint);
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            return await response.json();
        }
    },

    // --- Auth ---
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
        },
        async resetPassword(email: string) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#/reset-password`,
            });
            if (error) throw error;
        },
        async updatePassword(newPassword: string) {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
        }
    }
};
