# EcoCiclo REEE — Sistema de Acompanhamento do Ciclo de Vida de Produtos Eletrônicos

Aplicação Web (Mobile-First / PWA) para gestão do ciclo de vida de equipamentos eletroeletrônicos e apoio ao descarte consciente de **REEE (Resíduos de Equipamentos Eletroeletrônicos)**.

- **Instituição:** Instituto Federal do Paraná (IFPR) — Campus Londrina
- **Disciplina:** CAUF — Construção de Aplicações Utilizando Frameworks
- **Docente:** Felipe de A. Maia
- **Discentes:** Andrey Cardoso (Willians), Breno Vasconcelos, Gustavo Vieira

---

## Sumário da Stack Tecnológica

| Camada | Tecnologias | Papel no Projeto |
| :--- | :--- | :--- |
| **Linguagem** | TypeScript | Tipagem estática ponta a ponta (Frontend e Backend) |
| **Frontend** | ReactJS + Vite + Tailwind CSS | SPA/PWA responsiva (*mobile-first*), componentizada e leve |
| **Backend** | Node.js + ExpressJS | API RESTful para autenticação, inventário, notas fiscais e alertas |
| **Banco & Auth** | Firebase (Firestore + Auth) | Persistência NoSQL flexível e autenticação segura (+ modo local de dev) |
| **APIs Externas** | Nenhuma paga (Web Geolocation API) | Custo zero no MVP utilizando recursos nativos do navegador HTML5 |

---

## Estrutura do Monorepo

```text
.
├── docs/
│   └── DEFINICOES_DO_PROJETO.md   # Arquitetura, mapeamento RF/RNF, Sprints e fluxo Git
├── backend/                       # API RESTful (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── config/                # Configuração Firebase Admin + Fallback Local
│   │   ├── controllers/           # Controladores das rotas (Auth, Produtos/Inventário)
│   │   ├── middlewares/           # Autenticação Bearer Token e tratamento de erros
│   │   ├── routes/                # Rotas REST (/api/auth, /api/products, /api/health)
│   │   ├── services/              # Regras de negócio e motor de alertas (RF03)
│   │   ├── types/                 # Contratos TypeScript e modelos de domínio
│   │   └── server.ts              # Ponto de entrada da API Express
│   └── .env.example               # Modelo de variáveis de ambiente do servidor
└── frontend/                      # Aplicação Web Mobile-First (React + Vite + Tailwind)
    ├── src/
    │   ├── components/            # Componentes reutilizáveis (Cards, Alertas, Modal, Navbar)
    │   ├── contexts/              # Contexto de Autenticação (RF01)
    │   ├── pages/                 # Telas de Login/Cadastro e Dashboard do Inventário
    │   ├── services/              # Cliente HTTP e integração opcional Firebase Client
    │   └── types/                 # Interfaces compartilhadas com o Backend
    └── .env.example               # Modelo de variáveis de ambiente do cliente
```

---

## Entregas por Partes (Roadmap de Sprints)

- [x] **Parte 1 (Atual — MVP Base & Ciclo de Vida):**
  - Definições arquiteturais, padronização Git/GitHub e estrutura Monorepo TypeScript.
  - **RF01:** Cadastro e autenticação de usuários (Consumidor e Gestor de Coleta) com aceite LGPD (**RNF03**).
  - **RF02:** **Inventário Virtual** de eletrônicos com categoria, data de compra, garantia, vida útil estimada e anexo de Nota Fiscal.
  - **RF03:** **Alertas Automáticos** de proximidade do fim da garantia e do fim da vida útil estimada.
  - **RNF01 / RNF02:** Interface *mobile-first* responsiva e intuitiva.
- [ ] **Parte 2 (Geolocalização e Ecopontos):**
  - **RF04 & RF05:** Mapa georreferenciado de pontos de coleta (Geolocation API + visualização/filtros por resíduo) e **RF12** (Painel do Gestor/Cooperativa).
- [ ] **Parte 3 (Descarte, Gamificação e Impacto Ambiental):**
  - **RF06, RF07 & RF08:** Registro de descarte, pontuação fixa simples (*inspirado no Ecotrash*), tela de feedback químico/ambiental e histórico.
- [ ] **Parte 4 (Engajamento Complementar):**
  - **RF09, RF10 & RF11:** Conteúdo educativo sobre REEE, avaliações de ecopontos e lembretes.

---

## Como Executar Localmente

> **Nota sobre o Firebase:** O projeto já possui suporte híbrido! Enquanto o time ainda não preenche as chaves do Firebase no `.env`, o sistema opera automaticamente em **Modo Local Persistente** (salvando usuários, notas fiscais e inventário em disco local ignorado pelo Git), permitindo desenvolver e testar todas as telas imediatamente.

### 1. Instalar dependências

Em dois terminais (ou sequencialmente):

```powershell
cd backend
npm install
```

```powershell
cd frontend
npm install
```

### 2. Iniciar o Backend (porta `3333`)

```powershell
cd backend
npm run dev
```

### 3. Iniciar o Frontend (porta `5173`)

```powershell
cd frontend
npm run dev
```

Acesse `http://localhost:5173` no navegador.

---

## Fluxo de Trabalho com Git e GitHub para a Equipe

Consulte [`docs/DEFINICOES_DO_PROJETO.md`](./docs/DEFINICOES_DO_PROJETO.md) para o guia completo de branches (`main`, `develop`, `feat/...`), padrão de *Conventional Commits* e divisão de tarefas entre o grupo.
