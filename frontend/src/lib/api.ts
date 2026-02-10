import { supabase } from './supabase';
import { Salon, Service, Product, Professional, Appointment, ChatMessage, Conversation } from '../types';

export const api = {
    supabase,
    // --- Salões ---
    salons: {
        async getAll() {
            const { data, error } = await supabase.from('salons').select('id, nome, slug_publico, segmento, descricao, logo_url, banner_url, endereco, cidade, rating, reviews, telefone, amenities, gallery_urls, location, horario_funcionamento, paga_no_local, subscription_plan, trial_ends_at, subscription_status, mp_public_key');
            if (error) throw error;
            return data as Salon[];
        },

        async getBySlug(slug: string) {
            const { data, error } = await supabase.from('salons').select('*, ai_enabled, ai_promo_text, ai_promo_discount, ai_voice_tone').eq('slug_publico', slug).maybeSingle();
            if (error) throw error;
            return data as Salon;
        },
        async getById(id: string) {
            const { data, error } = await supabase.from('salons').select('*, ai_enabled, ai_promo_text, ai_promo_discount, ai_voice_tone').eq('id', id).maybeSingle();
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
            try {
                // Tenta update minimalista retornando só o ID
                const { data, error } = await supabase.from('salons').update(updates).eq('id', id).select('id').single();
                if (error) throw error;
                return { ...updates, id } as Salon;
            } catch (err: any) {
                console.warn("Update padrão falhou, tentando estratégias de fallback...", err);

                // Tentativa 2: Update "Cego" (Sem retorno)
                // Se o trigger falhar no RETURNING, isso pode funcionar
                const { error: blindError } = await supabase.from('salons').update(updates).eq('id', id);
                if (!blindError) {
                    return { ...updates, id } as Salon;
                }

                // Tentativa 3: Mega Fallback RPC (Cobre todos os campos)
                try {
                    const { data: rpcData, error: rpcError } = await supabase.rpc('mega_update_salon', {
                        p_id: id,
                        p_data: updates
                    });

                    if (!rpcError) {
                        return { ...updates, id } as Salon;
                    }
                } catch (rpcErr) {
                    console.error("Fallback Mega RPC também falhou", rpcErr);
                }

                // Se tudo falhar, joga o erro original
                throw err;
            }
        },
        async registerNewSalon(params: any) {
            const { data, error } = await supabase.rpc('register_new_salon_and_owner', params);
            if (error) throw error;
            return data as string; // Retorna o ID do salão
        },
        async getBilling(id: string) {
            const { data, error } = await supabase.rpc('get_salon_billing_info', { p_salon_id: id });
            if (error) throw error;
            return data;
        },
        async getPlans() {
            const { data, error } = await supabase.from('subscription_plans').select('*').order('price', { ascending: true });
            if (error) throw error;
            return data;
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
        },
        async update(id: string, updates: Partial<Service>) {
            const { data, error } = await supabase.from('services').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data as Service;
        },
        async delete(id: string) {
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (error) throw error;
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
            console.log('🔄 API: Iniciando update do agendamento:', { id, updates });
            const { data, error } = await supabase.from('appointments').update(updates).eq('id', id).select().single();
            console.log('🔄 API: Resultado do update:', { data, error });
            if (error) {
                console.error('🔄 API: ERRO ao atualizar:', error);
                throw error;
            }
            console.log('🔄 API: Update concluído com sucesso!');
            return data as Appointment;
        },
        async updateStatus(id: string, status: Appointment['status']) {
            console.log('📊 API: Atualizando status para:', { id, status });
            return this.update(id, { status });
        },
        async delete(id: string) {
            console.log('🔥 API: Iniciando delete do agendamento:', id);
            const { data, error } = await supabase.from('appointments').delete().eq('id', id).select();
            console.log('🔥 API: Resultado do delete:', { data, error });

            if (error) {
                console.error('🔥 API: ERRO ao deletar:', error);
                throw error;
            }

            // VERIFICAÇÃO CRÍTICA: Se data está vazio, nada foi deletado!
            if (!data || data.length === 0) {
                const errorMsg = '❌ NENHUM registro foi deletado! Possíveis causas:\n' +
                    '1. RLS (Row Level Security) bloqueando a operação\n' +
                    '2. Registro não existe\n' +
                    '3. Usuário sem permissão para deletar';
                console.error('🔥 API:', errorMsg);
                throw new Error('Não foi possível deletar: sem permissão ou registro não encontrado');
            }

            console.log('🔥 API: Delete concluído com sucesso!', data.length, 'registro(s) deletado(s)');
            return { success: true, deleted: data };
        }
    },

    // --- Chat ---
    chat: {
        async getConversations(userId: string) {
            const { data, error } = await supabase
                .from('conversations')
                .select(`
                    *,
                    user1:profiles!user1_id(full_name, avatar_url),
                    user2:profiles!user2_id(full_name, avatar_url)
                `)
                .or(`user1_id.eq.${userId}, user2_id.eq.${userId}`)
                .order('updated_at', { ascending: false });

            if (error) throw error;

            // Formata os dados para identificar o outro participante e o contador correto
            return (data || []).map((c: any) => {
                const isUser1 = c.user1_id === userId;
                const otherProfile = isUser1 ? c.user2 : c.user1;
                const correctUnreadCount = isUser1 ? c.user1_unread_count : c.user2_unread_count;

                return {
                    ...c,
                    unread_count: correctUnreadCount || 0, // Mapeia para o nome simples que o UI já usa
                    participant_name: otherProfile?.full_name || 'Membro Aura',
                    participant_image: otherProfile?.avatar_url
                };
            }) as Conversation[];
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
            const { data, error } = await supabase.rpc('send_chat_message', {
                p_conv_id: message.conversation_id,
                p_sender_id: message.sender_id,
                p_text: message.text
            });
            if (error) throw error;
            return data as ChatMessage;
        },
        async markAsRead(conversationId: string) {
            console.log('📖 Chat: Marcando como lido:', conversationId);
            const { error } = await supabase.rpc('mark_chat_as_read', {
                p_conversation_id: conversationId
            });
            if (error) console.warn('Falha ao zerar contador:', error.message);
        },
        subscribeToMessages(conversationId: string, callback: (payload: any) => void) {
            console.log('📡 Chat: Iniciando inscrição Realtime para:', conversationId);
            const channel = supabase
                .channel(`messages:${conversationId}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                }, (payload) => {
                    console.log('📬 Nova Mensagem Recebida via Realtime:', payload);
                    callback(payload);
                })
                .subscribe((status) => {
                    console.log(`🔌 Status da Conexão Realtime (${conversationId}):`, status);
                    if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Erro Crítico: Falha ao conectar ao Realtime. Verifique se o Realtime está habilitado no Supabase para a tabela messages.');
                    }
                });
            return channel;
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
                payer: {
                    ...paymentData.payer,
                    email: paymentData.payer?.email || 'cliente@aura.com'
                }
            };
            if (token) payload.token = token;

            // Chamada Direta via Fetch (Autenticada com apikey para evitar 403)
            const functionUrl = `https://sycwdapzkvzvjedowfjq.supabase.co/functions/v1/billing-service`;
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    action: 'process_client_payment',
                    salonId: salon.id,
                    paymentData: payload,
                    userId: paymentData.metadata?.userId // Passa o ID pra buscar nome real
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Erro no servidor de pagamento (${response.status})`);
            }

            return await response.json();
        },
        async checkStatus(paymentId: string | number, salonId?: string) {
            try {
                const functionUrl = `https://sycwdapzkvzvjedowfjq.supabase.co/functions/v1/billing-service`;
                const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': anonKey,
                        'Authorization': `Bearer ${anonKey}`
                    },
                    body: JSON.stringify({
                        action: 'check_client_payment_status',
                        paymentId: paymentId,
                        salonId: salonId
                    })
                });
                if (!response.ok) return { status: 'pending' };
                return await response.json();
            } catch (e) {
                return { status: 'pending' };
            }
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
            const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${baseUrl}/reset-password`,
            });
            if (error) throw error;
        },
        async updatePassword(newPassword: string) {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
        }
    }
};
