import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const API_KEY = Deno.env.get('GEMINI_API_KEY')
        if (!API_KEY) {
            console.error("GEMINI_API_KEY nao configurada")
            throw new Error('GEMINI_API_KEY is not set')
        }

        let body;
        try {
            body = await req.json()
        } catch (e) {
            throw new Error("Invalid Body")
        }

        const { prompt, context } = body

        // 1. Construir Contexto do Banco de Dados
        let contextString = "";
        if (context) {
            if (context.services && context.services.length > 0) {
                const servicesList = context.services.slice(0, 50).map((s: any) => `- ${s.name} (${s.salons?.nome || 'Salão'}): R$${s.price}`).join('\n');
                contextString += `\nCATÁLOGO DE SERVIÇOS:\n${servicesList}`;
            }
            if (context.products && context.products.length > 0) {
                const productsList = context.products.slice(0, 50).map((p: any) => `- ${p.name}: R$${p.price}`).join('\n');
                contextString += `\n\nBOUTIQUE DE PRODUTOS:\n${productsList}`;
            }
        }

        const systemInstructions = `Você é a Aura, assistente virtual técnica da Luxe Aura.
      
    ${contextString ? `CATÁLOGO OFICIAL DISPONÍVEL:` : ''}
    ${contextString}

    DIRETRIZES ESTRITAS DE COMPORTAMENTO:
    1.  **Objetividade Extrema**: Não faça "sala" nem use linguagem excessivamente afetiva. Seja formal e direta.
    2.  **Foco no Catálogo**: Sua única função é apresentar os serviços/produtos disponíveis e tirar dúvidas sobre eles.
    3.  **Resposta Padrão**: Se o usuário apenas cumprimentar (ex: "olá"), responda apresentando a lista de serviços principais de forma resumida e pergunte qual ele deseja.
    4.  **Agendamentos**: Se o cliente perguntar sobre agendamento, oriente-o a selecionar o serviço para prosseguir com a reserva.
    5.  **Tom de Voz**: Profissional, sério e eficiente. Sem emojis desnecessários.`;

        // 2. Chamada Direta à API REST do Gemini
        // Usando o modelo correto informado: gemini-3-flash-preview
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: `${systemInstructions}\n\nPergunta do cliente: "${prompt}"` }]
                }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini API Error:", errText);
            throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui formular uma resposta no momento.";

        return new Response(
            JSON.stringify({ response: text }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )

    } catch (error) {
        console.error("Function Error:", error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
    }
})
