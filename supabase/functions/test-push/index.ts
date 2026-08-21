import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_CONTACT_EMAIL = Deno.env.get('VAPID_CONTACT_EMAIL') || 'suporte@medicare.com';

webpush.setVapidDetails(`mailto:${VAPID_CONTACT_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    console.log(`[TEST-PUSH] Iniciando teste para usuário: ${user_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    
    // Buscar subscription
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user_id);

    if (error) throw error;
    
    if (!subs || subs.length === 0) {
      console.log("[TEST-PUSH] Nenhuma subscription encontrada.");
      return new Response(JSON.stringify({ ok: false, error: "No subscription found" }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[TEST-PUSH] Encontrada(s) ${subs.length} subscription(s). Usando a primeira.`);
    const sub = subs[0];

    // Payload de teste exigido:
    // Título: "MediCare — Teste"
    // Mensagem: "Push recebido com sucesso."
    const payload = JSON.stringify({
      title: "MediCare — Teste",
      body: "Push recebido com sucesso.",
      tag: `test-${Date.now()}`,
      url: "/"
    });

    console.log(`[TEST-PUSH] Disparando Web Push para o endpoint: ${sub.endpoint}`);
    
    // Aguarda 10 segundos antes de enviar para dar tempo do usuário fechar e bloquear a tela
    console.log("[TEST-PUSH] Aguardando 10 segundos antes do disparo...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    let pushResult;
    try {
      pushResult = await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      }, payload);
      console.log("[TEST-PUSH] Sucesso no disparo! StatusCode:", pushResult.statusCode);
    } catch (pushErr: any) {
      console.error("[TEST-PUSH] Falha no disparo do Web Push:", pushErr);
      return new Response(JSON.stringify({ 
        ok: false, 
        error: "Falha ao enviar push pelo WebPush",
        details: pushErr.message,
        statusCode: pushErr.statusCode
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Push disparado com sucesso",
      endpoint: sub.endpoint
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    console.error("[TEST-PUSH] Erro geral na Edge Function:", err.message);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
