
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Salon, BusinessSegment } from '../../types';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface BusinessSetupProps {
  salon: Salon | undefined;
  userId: string | null;
  onSave: (salon: Salon) => void;
}

const BusinessSetup: React.FC<BusinessSetupProps> = ({ salon, userId, onSave }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Salon | null>(null);
  const [mpConfig, setMpConfig] = useState({ publicKey: '', accessToken: '' });
  const [newGalleryUrl, setNewGalleryUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [district, setDistrict] = useState('');

  // Sincronizar Address Fields quando formData for carregado
  useEffect(() => {
    if (formData?.endereco) {
      const parts = formData.endereco.split(',');
      if (parts.length >= 2) {
        setStreet(parts[0].trim());
        const secondPart = parts[1].trim();
        if (secondPart.includes('-')) {
          const subParts = secondPart.split('-');
          setNumber(subParts[0].trim());
          setDistrict(subParts.slice(1).join('-').trim());
        } else {
          setNumber(secondPart);
        }
      } else {
        setStreet(formData.endereco);
      }
    }
  }, [formData?.id]);

  // Address Fetch Logic
  const fetchAddressByCEP = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        alert("CEP não encontrado.");
        setCepLoading(false);
        return;
      }

      setStreet(data.logradouro);
      setDistrict(data.bairro);
      setNumber(''); // Limpa número para o usuário digitar

      setFormData(prev => prev ? ({
        ...prev,
        cidade: `${data.localidade} - ${data.uf}`,
        location: prev.location
      }) : null);

    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      alert("Erro ao buscar endereço.");
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => {
    const config = localStorage.getItem('aura_mp_config');
    if (config) setMpConfig(JSON.parse(config));


    const loadSalon = async () => {
      setIsLoading(true);

      // 1. Tentar prop direta
      if (salon) {
        setFormData({ ...salon, gallery_urls: salon.gallery_urls || [] });
        setIsLoading(false);
        return;
      }

      // 2. Tentar buscar pelo userId
      if (userId) {
        try {
          const { data: proData } = await supabase
            .from('professionals')
            .select('salon_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (proData?.salon_id) {
            const allSalons = await api.salons.getAll();
            const mySalon = allSalons.find(s => s.id === proData.salon_id);
            if (mySalon) {
              setFormData({ ...mySalon, gallery_urls: mySalon.gallery_urls || [] });
              setIsLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error("Erro ao carregar salão via userId:", e);
        }
      }

      // 3. Fallback: Se não encontrar nada, inicializa vazio para cadastro
      setFormData({
        id: '',
        nome: '',
        slug_publico: '',
        segmento: 'Salão',
        rating: 5,
        reviews: 0,
        gallery_urls: [],
        amenities: [],
        descricao: '',
        logo_url: '',
        banner_url: '',
        endereco: '',
        cidade: '',
        telefone: '',
        location: { lat: 0, lng: 0 },
        horario_funcionamento: {}
      } as Salon);

      setIsLoading(false);
    };

    loadSalon();
  }, [salon, userId]);

  if (isLoading || !formData) {
    return (
      <div className="flex-1 bg-background-dark min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="size-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">Sincronizando sua Unidade...</p>
        </div>
      </div>
    );
  }

  const amenitiesOptions = ['Wifi', 'Estacionamento', 'Café VIP', 'Pet Friendly', 'Ar Condicionado', 'Acessibilidade'];

  const fetchCoordinates = async (fullAddress: string) => {
    try {
      // Limpa o endereço para o geocoder (remove excesso de espaços e hifens soltos)
      const cleanAddress = fullAddress.replace(/\s+/g, ' ').replace(/-\s*,/g, ',').trim();
      const query = encodeURIComponent(cleanAddress);

      const response = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=1`);
      const data = await response.json();

      if (data && data.features && data.features.length > 0) {
        // Photon retorna [lng, lat]
        const [lng, lat] = data.features[0].geometry.coordinates;
        return { lat, lng };
      }
      return null;
    } catch (error) {
      console.warn("Geocoding lookup failed. Ignoring.", error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    // Combina endereço
    const fullAddress = `${street}, ${number} - ${district}, ${formData.cidade}`;
    let finalData: any = {
      ...formData,
      endereco: `${street}, ${number} - ${district}`,
      mp_public_key: mpConfig.publicKey
    };

    if (mpConfig.accessToken) {
      finalData.mp_access_token = mpConfig.accessToken;
    }

    // Tenta obter coordenadas apenas se estiverem zeradas ou se forem o fallback de SP
    const isDefaultLocation = (finalData.location.lat === 0 && finalData.location.lng === 0) ||
      (finalData.location.lat === -23.55052 && finalData.location.lng === -46.633308);

    if (isDefaultLocation) {
      const coords = await fetchCoordinates(fullAddress);
      if (coords) {
        finalData.location = coords;
      }
    }

    try {
      localStorage.setItem('aura_mp_config', JSON.stringify(mpConfig));
      localStorage.setItem('aura_salon_data', JSON.stringify(finalData));

      if (finalData.id) {
        // Update existing
        const updated = await api.salons.update(finalData.id, finalData);
        onSave(updated);
      } else {
        // Create new
        const { id, ...newSalonData } = finalData;
        const created = await api.salons.create(newSalonData);

        // Link created salon to the current professional User
        if (userId) {
          const { data: pro } = await supabase.from('professionals').select('id').eq('user_id', userId).maybeSingle();
          if (pro) {
            await supabase.from('professionals').update({ salon_id: created.id }).eq('user_id', userId);
          } else {
            await api.professionals.create({
              salon_id: created.id,
              user_id: userId,
              name: formData.nome || 'Proprietário',
              role: 'owner',
              status: 'active',
              comissao: 100,
              rating: 5,
              productivity: 0,
              image: ''
            });
          }
        }

        onSave(created);
      }

      alert("Configurações da Unidade atualizadas com sucesso!");
      navigate('/pro');
    } catch (error: any) {
      console.error(error);
      alert("Erro ao salvar: " + error.message);
    }
  };

  const addGalleryImage = () => {
    if (!newGalleryUrl.trim() || !formData) return;
    const current = formData.gallery_urls || [];
    setFormData({ ...formData, gallery_urls: [...current, newGalleryUrl] });
    setNewGalleryUrl('');
  };

  const removeGalleryImage = (index: number) => {
    if (!formData) return;
    const current = formData.gallery_urls || [];
    setFormData({ ...formData, gallery_urls: current.filter((_, i) => i !== index) });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'banner_url' | 'gallery') => {
    const file = e.target.files?.[0];
    if (!file || !formData) return;

    try {
      const publicUrl = await api.storage.upload(file);
      if (field === 'gallery') {
        const current = formData.gallery_urls || [];
        setFormData({ ...formData, gallery_urls: [...current, publicUrl] });
      } else {
        setFormData({ ...formData, [field]: publicUrl });
      }
    } catch (err: any) {
      alert("Erro no upload: " + err.message);
    }
  };

  const updateLocation = (field: string, value: any) => {
    if (!formData) return;
    // Converte vírgula para ponto se for string e tenta transformar em número
    let cleanValue = typeof value === 'string' ? value.replace(',', '.') : value;
    const numValue = parseFloat(cleanValue);

    setFormData({
      ...formData,
      location: { ...formData.location, [field]: isNaN(numValue) ? 0 : numValue }
    });
  };

  return (
    <div className="flex-1 bg-background-dark min-h-screen">
      <header className="p-6 pt-16 flex items-center justify-between sticky top-0 bg-background-dark/95 backdrop-blur-xl z-50 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="text-white size-10 flex items-center justify-center rounded-full border border-white/5 active:scale-95 transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-display text-xl font-black text-white italic tracking-tight uppercase">Gestão Aura</h1>
        <button onClick={handleSave} className="text-primary font-black text-[10px] uppercase tracking-[0.2em] bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 shadow-lg active:scale-95 transition-all">Salvar</button>
      </header>

      <main className="p-6 space-y-12 pb-40 no-scrollbar overflow-y-auto max-w-[450px] mx-auto animate-fade-in">

        {/* IDENTIDADE VISUAL */}
        <section className="space-y-6">
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] ml-1">Branding Elite</h3>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-8 space-y-8 shadow-2xl">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Luxuoso</label>
              <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-primary shadow-inner" />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Slug da Unidade</label>
              <div className="flex items-center gap-2 bg-background-dark border border-white/10 rounded-2xl px-6 py-5 shadow-inner">
                <span className="text-slate-600 text-[10px]">aura.sh/</span>
                <input type="text" value={formData.slug_publico} onChange={(e) => setFormData({ ...formData, slug_publico: e.target.value })} className="flex-1 bg-transparent text-primary text-xs font-bold outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-4">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 text-center block">Logo Redonda</label>
                <div className="size-24 rounded-full mx-auto overflow-hidden border-2 border-primary/20 bg-black/40 shadow-2xl relative group">
                  <img src={formData.logo_url} className="size-full object-cover" alt="Logo" />
                  <input type="file" id="logo-up" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'logo_url')} />
                  <label htmlFor="logo-up" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <span className="material-symbols-outlined text-white text-sm">photo_camera</span>
                  </label>
                </div>
                <p className="text-center text-[7px] text-slate-600 font-bold uppercase">Toque na foto para mudar</p>
              </div>
              <div className="space-y-4">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 text-center block">Banner Aura</label>
                <div className="w-full h-24 rounded-2xl overflow-hidden border-2 border-white/5 bg-black/40 shadow-2xl relative group">
                  <img src={formData.banner_url} className="size-full object-cover" alt="Banner" />
                  <input type="file" id="banner-up" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'banner_url')} />
                  <label htmlFor="banner-up" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <span className="material-symbols-outlined text-white text-sm">photo_camera</span>
                  </label>
                </div>
                <p className="text-center text-[7px] text-slate-600 font-bold uppercase">Ideal: 1200x400px</p>
              </div>
            </div>

            {/* Contato Section inside Branding container or separate? Lets keep it inside or right after. I'll add a divider */}
            <div className="border-t border-white/5 pt-6 space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp / Telefone</label>
              <input
                type="text"
                value={formData.telefone || ''}
                onChange={(e) => {
                  // Permite apenas números e caracteres de formatação básicos durante digitação
                  const val = e.target.value.replace(/[^\d\(\)\-\s]/g, '');
                  setFormData({ ...formData, telefone: val });
                }}
                onBlur={(e) => {
                  // Formata automaticamente ao sair do campo
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.length === 11) {
                    val = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7)}`;
                  } else if (val.length === 10) {
                    val = `(${val.substring(0, 2)}) ${val.substring(2, 6)}-${val.substring(6)}`;
                  }
                  setFormData({ ...formData, telefone: val });
                }}
                placeholder="(11) 99999-9999"
                className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-primary shadow-inner tracking-widest font-mono"
              />
              <p className="text-[8px] text-slate-500 font-bold uppercase ml-2">Usado para o botão de WhatsApp no site</p>
            </div>

          </div>
        </section>

        {/* GALERIA DE PORTFÓLIO */}
        <section className="space-y-6">
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] ml-1">Rituais em Fotos</h3>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-8 space-y-6 shadow-2xl">
            <div className="flex gap-4">
              <div className="flex-1 bg-background-dark border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-inner">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Adicionar Foto Real</span>
                <input type="file" id="gal-up" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'gallery')} />
                <label htmlFor="gal-up" className="bg-primary/10 text-primary px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all">Upload</label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(formData.gallery_urls || []).map((url, idx) => (
                <div key={idx} className="relative aspect-[4/3] rounded-[24px] overflow-hidden border border-white/10 group shadow-lg">
                  <img src={url} className="size-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt={`Portfolio ${idx}`} />
                  <button onClick={() => removeGalleryImage(idx)} className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-sm">
                    <span className="material-symbols-outlined text-2xl font-black">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* LOCALIZAÇÃO */}
        <section className="space-y-6">
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Localização Premium</h3>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-8 space-y-6 shadow-2xl">

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">CEP</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-1/2 bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner tracking-widest"
                  onBlur={(e) => fetchAddressByCEP(e.target.value)}
                />
                <button
                  disabled={cepLoading}
                  className="flex-1 bg-surface-dark border border-white/5 rounded-2xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                >
                  {cepLoading ? 'Buscando...' : 'Buscar Auto'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Endereço (Logradouro)</label>
              <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner" placeholder="Rua, Avenida..." />
            </div>

            <div className="flex gap-4">
              <div className="space-y-2 w-1/3">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Número</label>
                <input type="text" value={number} onChange={(e) => setNumber(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner text-center font-bold" placeholder="123" />
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Bairro</label>
                <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner" placeholder="Bairro" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cidade / UF</label>
              <input type="text" value={formData.cidade} onChange={(e) => setFormData({ ...formData, cidade: e.target.value })} className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner" />
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">map</span>
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest">Precisão Google Maps</p>
                </div>
                <p className="text-[8px] text-slate-400">Cole o link do Google Maps para o pino ficar exatamente sobre seu salão.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="gmaps-input"
                    placeholder="Cole o link aqui..."
                    className="flex-1 bg-background-dark border border-white/10 rounded-lg p-3 text-[10px] text-white outline-none focus:border-primary shadow-inner"
                    onChange={(e) => {
                      const url = e.target.value;
                      const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
                      const match = url.match(regex);
                      if (match) {
                        updateLocation('lat', match[1]);
                        updateLocation('lng', match[2]);
                        alert("📍 Localização importada com sucesso!");
                      }
                    }}
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  const fullAddress = `${street}, ${number} - ${district}, ${formData.cidade}`;
                  const coords = await fetchCoordinates(fullAddress);
                  if (coords) {
                    updateLocation('lat', coords.lat);
                    updateLocation('lng', coords.lng);
                    alert("📍 Coordenadas detectadas via endereço!");
                  } else {
                    alert("❌ Não foi possível geolocalizar este endereço.");
                  }
                }}
                className="w-full mt-2 py-3 rounded-xl bg-surface-dark border border-white/5 text-slate-400 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Sincronizar via Endereço
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.location?.lat || 0}
                  onChange={(e) => updateLocation('lat', parseFloat(e.target.value))}
                  className="w-full bg-background-dark border border-white/10 rounded-2xl p-4 text-white text-xs outline-none shadow-inner font-mono text-center"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={formData.location?.lng || 0}
                  onChange={(e) => updateLocation('lng', parseFloat(e.target.value))}
                  className="w-full bg-background-dark border border-white/10 rounded-2xl p-4 text-white text-xs outline-none shadow-inner font-mono text-center"
                />
              </div>
              <p className="col-span-2 text-center text-[8px] text-slate-500 uppercase font-black tracking-widest mt-2">
                Pino ajustado com precisão de satélite
              </p>
            </div>
          </div>
        </section>





        {/* CONFIGURAÇÃO FINANCEIRA (MERCADO PAGO) */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em]">Financeiro</h3>
            <a
              href="https://www.mercadopago.com.br/developers/panel/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-blue-400 font-bold hover:underline flex items-center gap-1"
            >
              Obter Credenciais <span className="material-symbols-outlined text-xs">open_in_new</span>
            </a>
          </div>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-8 w-12 bg-[#009EE3] rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white">handshake</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Integração Mercado Pago</p>
                <p className="text-[8px] text-slate-600">Configure suas chaves de Produção ou Teste.</p>
              </div>
            </div>


            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Public Key (Chave Pública)</label>
              <input
                type="text"
                value={mpConfig.publicKey}
                onChange={(e) => setMpConfig({ ...mpConfig, publicKey: e.target.value })}
                className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner font-mono text-xs"
                placeholder="APP_USR-..."
              />
              <p className="text-[8px] text-slate-600 font-bold uppercase ml-2">Usada no checkout para criptografar dados do cartão.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token (Chave Privada)</label>
              <input
                type="password"
                value={mpConfig.accessToken}
                onChange={(e) => setMpConfig({ ...mpConfig, accessToken: e.target.value })}
                className="w-full bg-background-dark border border-white/10 rounded-2xl p-5 text-white outline-none shadow-inner font-mono text-xs"
                placeholder="APP_USR-..."
              />
              <p className="text-[8px] text-slate-600 font-bold uppercase ml-2">Chave secreta para operações financeiras. Mantenha segura!</p>
            </div>
          </div>
        </section>

        {/* COMODIDADES */}
        <section className="space-y-6">
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] ml-1">Mimos & Amenities</h3>
          <div className="bg-surface-dark border border-white/5 rounded-[40px] p-8 shadow-2xl">
            <div className="grid grid-cols-2 gap-4">
              {amenitiesOptions.map(amenity => {
                const isSelected = formData.amenities?.includes(amenity) || false;
                return (
                  <button
                    key={amenity}
                    onClick={() => {
                      const current = formData.amenities || [];
                      const next = current.includes(amenity) ? current.filter(a => a !== amenity) : [...current, amenity];
                      setFormData({ ...formData, amenities: next });
                    }}
                    className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-md ${isSelected ? 'gold-gradient text-background-dark border-primary' : 'bg-background-dark border-white/5 text-slate-600'}`}
                  >
                    {amenity}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="pt-10">
          <button onClick={handleSave} className="w-full gold-gradient text-background-dark py-6 rounded-[32px] font-black uppercase tracking-[0.4em] text-[13px] shadow-[0_20px_50px_rgba(193,165,113,0.3)] active:scale-95 transition-all">Sincronizar Unidade</button>
        </div>
      </main>
    </div >
  );
};

export default BusinessSetup;
