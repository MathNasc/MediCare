-- Adiciona suporte a fuso horário na tabela de assinaturas de push
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';
