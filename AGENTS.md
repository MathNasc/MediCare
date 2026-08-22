---
name: premortem  
description: "Executa um premortem sobre qualquer plano, lançamento, produto, contratação, estratégia ou decisão. Assume que já falhou 6 meses depois e trabalha de trás para frente para encontrar todos os motivos. Produz um plano revisado com os pontos cegos expostos. GATILHOS OBRIGATÓRIOS: 'premortem isso', 'meu premortem', 'execute um premortem', 'o que poderia matar isso', 'teste de estresse neste plano', 'o que estou perdendo aqui', 'encontre os pontos cegos'. GATILHOS FORTES: 'o que poderia dar errado', 'estou perdendo algo', 'faça buracos nisso', 'onde isso vai quebrar', 'advogado do diabo'. NÃO disparar em solicitações simples de feedback, perguntas factuais ou solicitações ao Conselho LLM. SIM disparar quando alguém tem um plano ou compromisso onde o custo de errar é alto."  
---

# Premortem

Um premortem é o oposto de um postmortem. Em vez de descobrir o que deu errado depois que algo falha, você imagina que já falhou e descobre o porquê antes de começar.

O método vem do psicólogo Gary Klein. Ele o publicou na Harvard Business Review. Daniel Kahneman (o psicólogo vencedor do Prêmio Nobel por trás de "Rápido e Devagar") chamou de sua técnica mais valiosa para a tomada de decisões. Google, Goldman Sachs e Procter & Gamble o usam antes de grandes decisões.

A ideia chave: quando você pergunta às pessoas "o que poderia dar errado?", elas dão respostas cautelosas e ambíguas. Quando você diz "isso já falhou, me diga o porquê", o cérebro muda para o modo narrativo e gera razões muito mais específicas, criativas e honestas. Pesquisadores da Wharton e de Cornell chamaram isso de "retrospectiva prospectiva" e descobriram que aumenta significativamente a capacidade de identificar causas de resultados futuros.

Por que isso importa para as decisões assistidas por IA: a IA (como Claude ou Gemini) tende a respostas gentis e otimistas. Se você perguntar "este é um bom plano?", ela encontrará razões para dizer que sim. O premortem quebra esse padrão forçando o enquadramento em "isso está morto, explique como morreu". A IA para de procurar razões pelas quais seu plano funcionará e começa a explicar como ele desmoronou.

---

## quando executar um premortem

Bons alvos para um premortem:  
- Um produto ou funcionalidade que você está prestes a construir  
- Um plano de lançamento com dinheiro ou reputação em jogo  
- Uma mudança de preço ou modelo de negócios  
- Uma contratação que você está prestes a fazer  
- Um pivô de estratégia ou posicionamento  
- Uma parceria ou acordo que você está avaliando  
- Qualquer compromisso onde o custo de errar é alto

Maus alvos para um premortem:  
- Ideias vagas sem nenhum plano concreto ainda (ajude-os a planejar primeiro, depois faça o premortem)  
- Perguntas com apenas uma resposta correta (simplesmente responda-as)  
- Solicitações de feedback criativo sobre um rascunho (isso é edição, não um premortem)  
- Decisões que já foram tomadas e são irreversíveis (um premortem só é útil quando você ainda pode mudar de rumo)

---

## coleta de contexto (o mínimo necessário)

Um premortem é tão bom quanto o contexto sobre o qual é executado. Informações vagas produzem cenários de falha vagos que não ajudam ninguém. Antes de executar o premortem, você precisa atingir um limite mínimo de contexto.

### passo 1: buscar contexto existente

Antes de perguntar qualquer coisa ao usuário, busque o contexto que já está disponível:

**A. A conversa atual.** O usuário pode ter estado discutindo um plano, um lançamento, um produto ou uma decisão anteriormente nesta sessão. Leia a conversa e extraia o que for relevante.

**B. O espaço de trabalho.** Escaneie rapidamente em busca de arquivos que possam conter contexto relevante:  
- `AGENTS.md` ou `GEMINI.md` (contexto de negócios, preferências, restrições)  
- Qualquer pasta `memory/` (perfis de público, detalhes do negócio, decisões passadas)  
- Arquivos que o usuário referenciou ou anexou explicitamente  
- Qualquer arquivo de projeto, briefs ou planos relacionados ao que está sendo submetido ao premortem

Use ferramentas de busca e chamadas rápidas de leitura. Não dedique mais de 30 segundos a isso. Você está procurando os arquivos-chave que ancorarão os cenários de falha na realidade.

### passo 2: avaliar a suficiência do contexto

Depois de escanear, verifique se você tem o suficiente para executar um premortem útil. Você precisa de três coisas:

1. **O que é?** — Uma compreensão clara do que está sendo submetido ao premortem (um produto, um lançamento, uma contratação, uma mudança de preço, uma estratégia). Você deve ser capaz de descrevê-lo ao usuário em uma frase.

2. **Para quem é / a quem afeta?** — O público, o cliente, a equipe, as partes interessadas. Os cenários de falha dependem muito de quem está envolvido.

3. **Como é o sucesso?** — Que resultado o usuário espera? A falha é definida invertendo o sucesso. Se você não sabe o que o sucesso significa, não pode definir o que o fracasso significa.

### passo 3: preencher as lacunas de forma conversacional

Se você tem os três, prossiga imediatamente para o premortem. Não faça perguntas desnecessárias.

Se faltar um ou mais, pergunte primeiro pela peça mais importante que está faltando. Uma pergunta por vez. Avalie após cada resposta se agora você tem o suficiente. Continue perguntando até atingir o limite, mas nunca pergunte mais do que o necessário.

Exemplos de perguntas de contexto focadas:  
- "O que exatamente você está prestes a lançar/construir/decidir?" (se você não sabe o que é)  
- "Para quem é isso?" (se você conhece o plano, mas não o público)  
- "Como seria uma vitória para isso?" (se você conhece o plano e o público, mas não os critérios de sucesso)

O objetivo é atingir o mínimo o mais rápido possível sem fazer o usuário sentir que está preenchendo um formulário. Conversacional, não interrogativo. Se você puder inferir uma resposta do contexto, faça isso em vez de perguntar.

---

## como funciona uma sessão de premortem

### passo 1: estabelecer o enquadramento

Após coletar contexto suficiente, estabeleça o enquadramento do premortem explicitamente. Algo como:

"Certo, tenho contexto suficiente. Vamos executar o premortem. A premissa é: passaram-se 6 meses. [O plano/lançamento/decisão] falhou. Acabou. Olhamos para trás tentando entender o que deu errado."

Esse enquadramento importa. Ele muda o modo de "avalie este plano" (que desencadeia respostas complacentes) para "explique por que isso morreu" (que desencadeia uma identificação honesta e específica de falhas).

### passo 2: gerar razões de falha (premortem bruto)

Execute o premortem bruto como uma análise única e completa. Sem categorias prefixadas, sem lentes, sem restrições. Apenas o método básico de Klein:

"Este plano falhou 6 meses depois. Gere cada razão genuína pela qual ele poderia ter morrido. Seja exaustivo. Seja específico. Fundamente cada razão nos detalhes reais do plano. Não preencha com razões fracas e não pare cedo se houver mais."

O resultado deve ser uma lista completa de razões de falha, cada uma expressa em 1-2 frases. Seja honesto e exaustivo. Alguns planos podem ter 4 modos de falha genuínos. Outros podem ter 9. O número deve ser o que for real para este plano específico.

Cada razão de falha deve ser:  
- Específica deste plano (não um conselho genérico que se aplique a qualquer coisa)  
- Fundamentada em detalhes reais que o usuário forneceu  
- Uma ameaça genuína (não um inconveniente menor ou um caso extremamente improvável)

### passo 3: agentes de análise profunda (um por razão de falha, todos em paralelo)

Pegue cada razão de falha do passo 2 e lance um subagente por razão, todos em paralelo. Cada agente pega sua razão de falha atribuída e a analisa profundamente de forma independente.

**Modelo de prompt para o subagente:**

```  
Você é um pesquisador em uma análise de premortem. Foi atribuída a você uma razão de falha específica para analisar profundamente.

O plano:  
---  
[contexto completo: o que é, para quem é, como é o sucesso, mais contexto relevante do espaço de trabalho]  
---

ENQUADRAMENTO DO PREMORTEM: Passaram-se 6 meses. Este plano falhou.

SUA RAZÃO DE FALHA ATRIBUÍDA: [a razão de falha específica do passo 2]

Seu trabalho é se aprofundar nessa falha. Escreva a história de como ela realmente se desenrolou. Seja específico. Use detalhes do plano. Faça parecer real, como um estudo de caso de algo que realmente aconteceu.

Seu resultado deve incluir:

1. A HISTÓRIA DA FALHA: Uma narrativa de 2-3 parágrafos de como essa falha específica se desenrolou. Use detalhes do plano. Nomeie momentos específicos onde as coisas deram errado e por quê.

2. A PREMISSA SUBJACENTE: A única coisa que o usuário tomou como certa e que tornou essa falha possível. Expresse isso em uma frase.

3. SINAIS DE ALERTA ANTECIPADOS: 1-2 sinais concretos e observáveis que o usuário poderia monitorar e que indicariam que este modo de falha está começando a se desenrolar. Devem ser coisas que podem ser realmente vistas ou medidas, não sentimentos vagos.

Mantenha a resposta total abaixo de 300 palavras. Seja direto. Não atenue. Não suavize.  
```

### passo 4: síntese

Depois que todos os agentes terminarem, leia cada análise profunda e produza a síntese:

**RELATÓRIO DE PREMORTEM**

1. **A Falha Mais Provável** — Qual cenário de falha é mais provável, dado o que você sabe sobre o plano? Por quê? Este é aquele em que o usuário deve focar primeiro.

2. **A Falha Mais Perigosa** — Qual cenário de falha causaria mais danos se ocorresse, mesmo sendo menos provável? Este é o que vale a pena proteger contra.

3. **A Premissa Oculta** — De todas as análises de falha, qual é a suposição mais importante que o usuário está fazendo e que provavelmente não questionou? É aqui que muitas vezes reside o verdadeiro valor do premortem: o que é tão óbvio para o usuário que ele esqueceu que era uma suposição.

4. **O Plano Revisado** — Com base nos cenários de falha, quais mudanças específicas tornariam o plano mais resiliente? Seja concreto. Não diga "considere testar seu preço". Diga "execute um piloto de US$ 47 com 20 pessoas antes de se comprometer com o workshop completo de US$ 297". Cada revisão deve corresponder diretamente a um cenário de falha específico.

5. **A Lista de Verificação Pré-Lançamento** — 3 a 5 coisas específicas que o usuário deve verificar, testar ou implementar antes de executar. Cada uma deve prevenir ou detectar um dos modos de falha identificados.

### passo 5: gerar o relatório de premortem

Gere um relatório HTML visual e salve-o no espaço de trabalho do usuário.

**Arquivo:** `premortem-report-[timestamp].html`

O relatório deve ser um único arquivo HTML autocontido com CSS inline. Princípios de design:  
- Fundo escuro (#0a0e1a ou similar), tipografia limpa, fácil de escanear  
- A seção de síntese (falha mais provável, falha mais perigosa, premissa oculta, plano revisado, lista de verificação) deve ser exibida com destaque no início, pois é o que a maioria das pessoas lerá primeiro  
- Um cartão visual por razão de falha que mostre a análise profunda. Cada cartão deve mostrar a razão da falha como título, a história da falha, a premissa subjacente e os sinais de alerta antecipados. Use cores de destaque diferentes para cada cartão, para que sejam visualmente fáceis de escanear.  
- Um indicador visual claro de gravidade/probabilidade para cada modo de falha  
- O visual rotativo: mostre o número de agentes que foram executados e suas descobertas como uma grade ou layout de cartões, para que o usuário possa ver a extensão total do premortem de relance  
- Rodapé com carimbo de data/hora e o que foi submetido ao premortem

Abra o arquivo HTML depois de gerá-lo.

### passo 6: salvar a transcrição

Salve a transcrição completa do premortem como `premortem-transcript-[timestamp].md` no mesmo local. Isso inclui:  
- O contexto que foi coletado (o que, quem, critérios de sucesso)  
- As razões de falha do premortem bruto  
- Todas as análises profundas dos agentes  
- A síntese completa

---

## formato de saída

Cada sessão de premortem produz dois arquivos:

```  
premortem-report-[timestamp].html    # relatório visual para escanear  
premortem-transcript-[timestamp].md  # transcrição completa como referência  
```

O usuário vê primeiro o relatório HTML. A transcrição está disponível caso queira se aprofundar no raciocínio por trás de cada cenário de falha.

Também forneça um resumo conciso no chat: a falha mais provável, a premissa oculta e a única revisão mais importante do plano. Máximo de três frases. O relatório contém todos os detalhes.

---

## exemplo: premortem de um lançamento de produto

**Usuário:** "premortem isso: estou prestes a lançar um workshop ao vivo de US$ 297 sobre como usar Claude/Gemini para equipes de marketing. 50 vagas. Direcionado a diretores de marketing em empresas com 10-50 funcionários."

**O premortem bruto identifica 6 razões de falha:**  
1. Diretores de marketing em empresas desse tamanho precisam de aprovação para gastar US$ 297 em desenvolvimento profissional, adicionando atrito que você não considerou  
2. "IA para marketing" é um pitch centrado em uma ferramenta em um mercado onde a maioria dos diretores ainda está decidindo se a IA é relevante para eles  
3. O público que realmente compra pode ser de empreendedores individuais, não diretores de equipe, criando um descompasso entre o conteúdo e os participantes  
4. Construir um workshop para equipes de marketing exige ambientes de demonstração com dados de marketing realistas e configurações multiusuário, o que leva 5 semanas de preparação, não as 2 que você orçou  
5. Se 60% dos participantes forem empreendedores individuais, suas avaliações e estudos de caso não ressoarão com o público de diretores de marketing que você precisa para futuras turmas  
6. A US$ 297 com 50 vagas, a receita máxima é de US$ 14.850, o que pode não justificar o tempo de preparação em comparação com outras oportunidades de receita

**6 agentes se aprofundam em cada razão de forma independente, produzindo histórias de falhas, premissas subjacentes e sinais de alerta antecipados.**

**Síntese:** A falha mais provável é o descompasso de público: você está visando pessoas que precisam de aprovação para gastar US$ 297, o que adiciona atrito que você não considerou. A falha mais perigosa: atrair empreendedores individuais em vez de diretores de equipe significa que seus estudos de caso e depoimentos não ressoarão com o comprador-alvo real para futuras turmas, agravando o problema com o tempo. Premissa oculta: você assume que "diretores de marketing em empresas de 10-50 pessoas" é um público alcançável, mas essas pessoas não se identificam dessa forma e não estão nos mesmos lugares. Plano revisado: execute uma sessão piloto de US$ 47 para 20 pessoas primeiro. Use isso para identificar se seus compradores reais são diretores de equipe ou empreendedores individuais, e construa o workshop completo para quem realmente aparecer.

---

## notas importantes

- **Sempre lance todos os agentes de falha em paralelo.** O lançamento sequencial desperdiça tempo e permite que respostas anteriores influenciem as posteriores.  
- **Sempre estabeleça o enquadramento do premortem explicitamente.** "Isso já falhou" é o mecanismo psicológico que faz isso funcionar. Sem ele, a análise volta a ser uma avaliação de risco educada em vez de uma identificação honesta de falhas.  
- **Seja exaustivo, mas não encha linguiça.** Encontre cada razão de falha genuína. Não pare em 3 se houver 7. Mas não force 7 se houver apenas 3. O número deve ser o que for real para este plano específico.  
- **A síntese é o produto.** A maioria dos usuários lerá a síntese e dará uma olhada nos cartões de falha individuais. Torne a síntese específica e acionável.  
- **Não suavize.** O objetivo de um premortem é dizer ao usuário coisas que ele não quer ouvir antes que a realidade o faça. Se um plano tiver problemas sérios, diga diretamente.  
- **O plano revisado deve ser concreto.** Não diga "considere testar seu preço". Diga "execute um piloto de US$ 47 com 20 pessoas antes de se comprometer com o workshop completo de US$ 297". Cada revisão deve ser algo que o usuário possa realmente fazer nesta semana.  
- **Respeite o limite mínimo de contexto.** Executar um premortem com contexto insuficiente produz falhas genéricas que desperdiçam o tempo do usuário. É melhor fazer uma pergunta a mais do que produzir um premortem ruim.  
- **Isso não é o Conselho LLM.** O conselho fornece várias perspectivas sobre uma decisão agora mesmo. O premortem envia a IA para o futuro, onde a decisão já falhou, e trabalha de trás para frente para explicar o porquê. Mecanismo psicológico diferente, resultado diferente. Se o usuário parece querer várias perspectivas em vez de uma análise de falhas, sugira o conselho em vez disso.
