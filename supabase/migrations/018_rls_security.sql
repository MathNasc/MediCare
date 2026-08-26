-- 1. Ativar a Segurança em Nível de Linha (RLS) para todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_doses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuidadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_conditions ENABLE ROW LEVEL SECURITY;

-- 2. Regras para os Perfis
CREATE POLICY "Perfis visíveis para usuários logados" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dono pode gerenciar seu perfil" ON profiles FOR ALL TO authenticated USING (auth.uid() = id);

-- 3. Regras de Saúde: Acesso bloqueado apenas para o dono (paciente) ou seu cuidador ativo
CREATE POLICY "Acesso seguro - medicamentos" ON medicamentos FOR ALL TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = medicamentos.user_id AND status = 'ativo')
);

CREATE POLICY "Acesso seguro - historico" ON historico_doses FOR ALL TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = historico_doses.user_id AND status = 'ativo')
);

CREATE POLICY "Acesso seguro - alergias" ON allergies FOR ALL TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = allergies.user_id AND status = 'ativo')
);

CREATE POLICY "Acesso seguro - emergencias" ON emergency_contacts FOR ALL TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = emergency_contacts.user_id AND status = 'ativo')
);

CREATE POLICY "Acesso seguro - profissionais" ON healthcare_professionals FOR ALL TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = healthcare_professionals.user_id AND status = 'ativo')
);

CREATE POLICY "Acesso seguro - condicoes" ON health_conditions FOR ALL TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM cuidadores WHERE cuidador_id = auth.uid() AND paciente_id = health_conditions.user_id AND status = 'ativo')
);

-- 4. Regras da tabela de Cuidadores (Paciente ou Cuidador podem acessar o vínculo)
CREATE POLICY "Acesso aos vinculos" ON cuidadores FOR ALL TO authenticated USING (
  auth.uid() = paciente_id OR auth.uid() = cuidador_id
);

-- 5. Regras para Notificações (Apenas o dono acessa)
CREATE POLICY "Acesso as notificacoes" ON push_subscriptions FOR ALL TO authenticated USING (
  auth.uid() = user_id
);
