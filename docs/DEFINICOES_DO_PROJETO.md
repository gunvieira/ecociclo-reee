# Definições do Projeto e Arquitetura — EcoCiclo REEE

Documento consolidado a partir do **Levantamento de Requisitos** e da **Atividade 2.3 – Definição das Tecnologias** (CAUF — IFPR Campus Londrina).

---

## 1. Visão Geral e Problema

O descarte inadequado de **Resíduos de Equipamentos Eletroeletrônicos (REEE)** ocorre principalmente por:
1. Falhas estruturais e pulverização geográfica na cadeia de logística reversa;
2. Desconhecimento do consumidor sobre o ciclo de vida de seus aparelhos e onde/como descartá-los, gerando retenção prolongada dos equipamentos obsoletos em residências.

### Perfis de Usuário
- **Consumidor (`consumer`):** Morador urbano que cadastra seus eletrônicos no Inventário Virtual, acompanha garantias/vida útil, recebe alertas e localiza pontos de coleta.
- **Gestor de Ponto de Coleta (`manager`):** Cooperativas, ONGs ou órgãos públicos responsáveis por manter atualizados os pontos de logística reversa na plataforma.

---

## 2. Arquitetura e Decisões Técnicas

### 2.1. Monorepo TypeScript
Optou-se por um **Monorepo** contendo `frontend/` e `backend/` no mesmo repositório Git para facilitar a colaboração entre os 3 integrantes (Andrey, Breno e Gustavo), mantendo contratos de dados sincronizados em TypeScript.

### 2.2. Estratégia de Persistência Híbrida (Firebase + Modo Local)
Para não bloquear o desenvolvimento nem testes em sala/laboratório:
- **Modo Produção / Nuvem (`STORAGE_MODE=firebase`):** Quando as variáveis `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` estão configuradas no `.env`, o Backend utiliza o **Firebase Admin SDK** (Firestore + Firebase Auth).
- **Modo Desenvolvimento Local (`STORAGE_MODE=local` - padrão inicial):** Quando não há chaves do Firebase configuradas, a API utiliza um repositório local persistente em JSON (`backend/data/db.json`) com autenticação por token assinado e senhas com hash criptográfico (`scrypt`), respeitando a segurança de dados (**RNF03 / LGPD**).

### 2.3. Regras do Motor de Alertas Automáticos (RF03)
Cada produto eletrônico cadastrado no **Inventário Virtual (RF02)** possui:
- `purchaseDate` (Data da compra)
- `warrantyMonths` (Tempo de garantia em meses — ex.: 12 meses)
- `estimatedLifespanMonths` (Vida útil estimada em meses, sugerida automaticamente conforme a categoria e ajustável pelo usuário):
  - **Smartphone / Celular:** 36 meses (3 anos)
  - **Notebook / Computador:** 60 meses (5 anos)
  - **TV / Monitor:** 72 meses (6 anos)
  - **Eletroportátil:** 48 meses (4 anos)
  - **Pilhas / Baterias / Acessórios:** 24 meses (2 anos)
  - **Outros:** 48 meses (4 anos)

**Gatilhos automáticos calculados dinamicamente:**
1. **Alerta de Garantia Expirando (`warranty_expiring`):** Faltam **30 dias ou menos** para o término da garantia.
2. **Informativo de Garantia Expirada (`warranty_expired`):** Garantia encerrada, produto segue em uso normal.
3. **Alerta de Fim de Vida Útil Próximo (`lifespan_nearing_end`):** Produto atingiu **85% ou mais** da vida útil estimada (ou faltam ≤ 60 dias). Orienta o usuário a planejar manutenção ou descarte consciente.
4. **Alerta Crítico de Fim de Vida Útil (`lifespan_reached`):** Produto atingiu **100% ou mais** da vida útil estimada (ou foi marcado como obsoleto/defeituoso). Recomenda encaminhamento para um Ecoponto de REEE.

---

## 3. Rastreabilidade dos Requisitos

| ID | Requisito | Prioridade | Parte / Sprint | Status |
| :--- | :--- | :---: | :---: | :---: |
| **RF01** | Cadastro e autenticação de usuário (Consumidor / Gestor) | Essencial | Parte 1 | Implementado |
| **RF02** | Inventário Virtual (categoria, data compra, nota fiscal) | Essencial | Parte 1 | Implementado |
| **RF03** | Alertas automáticos de fim de garantia e vida útil | Essencial | Parte 1 | Implementado |
| **RNF01** | Usabilidade clara e intuitiva (meta ≥ 70% aprovação) | Essencial | Parte 1 | Implementado |
| **RNF02** | Design Web responsivo *Mobile-First* | Essencial | Parte 1 | Implementado |
| **RNF03** | Segurança e conformidade LGPD (hash de senha, consentimento, anexo protegido) | Essencial | Parte 1 | Implementado |
| **RF04** | Mapa georreferenciado de pontos de coleta (Geolocation API) | Essencial | Parte 2 | Planejado |
| **RF05** | Filtro de pontos de coleta por tipo de resíduo aceito | Importante | Parte 2 | Planejado |
| **RF12** | Painel administrativo para gestores/cooperativas | Importante | Parte 2 | Planejado |
| **RF06** | Registro de descarte e gamificação de pontuação fixa simples | Importante | Parte 3 | Planejado |
| **RF07** | Feedback de impacto ambiental (metais recuperáveis) | Importante | Parte 3 | Planejado |
| **RF08** | Histórico de descartes realizados pelo usuário | Importante | Parte 3 | Planejado |
| **RF09-11** | Conteúdo educativo, avaliação de pontos e notificações | Desejável | Parte 4 | Planejado |

---

## 4. Padrão de Git e GitHub para o Grupo

### Estrutura de Branches
- `main`: Código estável e validado a cada entrega da disciplina.
- `develop`: Branch de integração das partes em desenvolvimento pela equipe.
- Branches de funcionalidade:
  - `feat/rf04-mapa-ecopontos`
  - `feat/rf06-gamificacao-descarte`
  - `fix/ajuste-validacao-nota`
  - `docs/atualizacao-requisitos`

### Padrão de Commits (Conventional Commits)
- `feat: adiciona cadastro de produtos no inventario virtual (RF02)`
- `fix: corrige calculo de dias restantes da garantia (RF03)`
- `docs: adiciona definicoes de arquitetura e requisitos`
- `chore: configura tailwind e scripts do monorepo`

### Fluxo Diário Recomendado (Andrey, Breno e Gustavo)
1. Atualizar a branch local antes de começar:
   ```bash
   git checkout develop
   git pull origin develop
   ```
2. Criar uma branch para sua tarefa:
   ```bash
   git checkout -b feat/nome-da-tarefa
   ```
3. Salvar alterações e enviar para o GitHub:
   ```bash
   git add .
   git commit -m "feat: descricao clara do que foi feito"
   git push -u origin feat/nome-da-tarefa
   ```
4. Abrir um **Pull Request (PR)** no GitHub apontando para `develop` (e depois `develop` -> `main` ao fechar a entrega).
