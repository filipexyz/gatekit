# GateKit - Gateway Universal de Mensagens

Plataforma completa para gerenciamento de mensagens multi-plataforma com integração ao GateKit, Supabase e Stripe.

## 🚀 Características Principais

### Portal do Cliente
- **Dashboard Interativo**: Visão geral com métricas em tempo real
- **Gestão de Mensagens**: Envio, listagem e monitoramento de mensagens
- **Plataformas**: Conecte WhatsApp, Discord, Telegram e mais
- **Chaves de API**: Geração e gerenciamento de chaves com escopos granulares
- **Membros da Equipe**: Convide e gerencie membros com diferentes permissões
- **Faturamento**: Controle de uso, assinaturas e histórico de pagamentos
- **Configurações**: Personalização e preferências do projeto

### Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **UI/Design**: Tailwind CSS + Radix UI
- **Roteamento**: React Router v7
- **State Management**: TanStack Query (React Query)
- **Autenticação**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Pagamentos**: Stripe (preparado para integração)
- **Icons**: Lucide React

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase
- (Opcional) Conta no Stripe para pagamentos

## 🛠️ Instalação

1. Clone o repositório
2. Instale as dependências:

```bash
npm install
```

3. Configure as variáveis de ambiente no arquivo `.env`:

```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
VITE_GATEKIT_API_URL=https://api.gatekit.dev
```

4. Execute o projeto em desenvolvimento:

```bash
npm run dev
```

5. Para build de produção:

```bash
npm run build
```

## 🗄️ Estrutura do Database

O projeto utiliza Supabase com as seguintes tabelas principais:

- **organizations**: Empresas/clientes da plataforma
- **profiles**: Dados estendidos dos usuários
- **gatekit_projects**: Cache de projetos do GateKit
- **audit_logs**: Logs de auditoria e compliance
- **platform_credentials**: Credenciais seguras das plataformas

Todas as tabelas possuem Row Level Security (RLS) habilitado para garantir isolamento multi-tenant.

## 🔐 Segurança

### Autenticação
- Supabase Auth com email/password
- Sessões gerenciadas automaticamente
- Proteção de rotas por autenticação

### Autorização
- Sistema de papéis: `client_admin`, `client_member`, `system_admin`
- Row Level Security no database
- Escopos granulares para chaves de API

### Dados Sensíveis
- Credenciais de plataformas criptografadas
- Chaves de API mascaradas na interface
- Logs de auditoria para ações críticas

## 🎨 Design System

### Paleta de Cores
- **Primary**: Azul (#2563eb) - Ações principais
- **Success**: Verde (#16a34a) - Estados positivos
- **Warning**: Amarelo (#ca8a04) - Alertas
- **Danger**: Vermelho (#dc2626) - Ações destrutivas
- **Neutral**: Tons de cinza para backgrounds e textos

### Componentes Base
- Button (primary, secondary, outline, ghost, danger)
- Input (com validação e mensagens de erro)
- Card (header, content, footer)
- Badge (success, info, warning, danger)
- Alert (info, success, warning, danger)
- Spinner (loading states)

## 📱 Responsividade

A aplicação é totalmente responsiva com breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🔌 Integração com GateKit

### Client SDK
O projeto inclui um client TypeScript completo para a API do GateKit:

```typescript
import { GateKitClient } from './lib/gatekit';

const client = new GateKitClient('sua_chave_api');

// Enviar mensagem
await client.sendMessage(projectId, targets, content);

// Listar mensagens
const messages = await client.listMessages(projectId);

// Criar plataforma
await client.createPlatform(projectId, 'discord', 'Bot Principal', credentials);
```

### Escopos Disponíveis
- `messages:send` - Enviar mensagens
- `messages:read` - Ler mensagens
- `platforms:read` - Visualizar plataformas
- `platforms:write` - Gerenciar plataformas
- `keys:read` - Visualizar chaves
- `keys:write` - Gerenciar chaves
- `stats:read` - Acessar estatísticas
- `logs:read` - Visualizar logs

## 💳 Integração com Stripe

A aplicação está preparada para integração completa com Stripe:

1. Checkout de assinaturas
2. Portal do cliente
3. Webhooks para eventos
4. Controle de limites por plano
5. Histórico de faturas

## 🌐 Rotas da Aplicação

### Públicas
- `/login` - Página de login
- `/signup` - Cadastro de novos usuários

### Protegidas (Portal do Cliente)
- `/app` - Dashboard principal
- `/app/messages` - Gestão de mensagens
- `/app/platforms` - Plataformas conectadas
- `/app/keys` - Chaves de API
- `/app/members` - Membros da equipe
- `/app/billing` - Faturamento e planos
- `/app/settings` - Configurações

## 🚧 Próximos Passos

### Funcionalidades Pendentes
1. **Painel Administrativo**: Visão global para administradores do sistema
2. **Gráficos e Métricas**: Visualizações avançadas com Recharts
3. **Logs Detalhados**: Sistema completo de logs e auditoria
4. **Webhooks**: Configuração de webhooks customizados
5. **Exportação de Dados**: CSV/JSON das métricas
6. **Onboarding Guiado**: Wizard para novos usuários
7. **Internacionalização**: Suporte para múltiplos idiomas

### Integrações Futuras
- Mais plataformas (Slack, Email, SMS)
- Analytics avançado
- Automações e workflows
- Templates de mensagens
- Segmentação de audiência

## 📝 Scripts Disponíveis

```bash
npm run dev        # Servidor de desenvolvimento
npm run build      # Build de produção
npm run preview    # Preview do build
npm run lint       # Verificar código
npm run typecheck  # Verificar tipos TypeScript
```

## 🤝 Contribuindo

Este projeto foi desenvolvido para atender o mercado brasileiro com foco em:
- Interface totalmente em português
- Design moderno e profissional
- Performance otimizada
- Segurança de nível empresarial
- Escalabilidade multi-tenant

## 📄 Licença

© 2025 GateKit. Todos os direitos reservados.

## 🆘 Suporte

Para suporte, entre em contato através do painel administrativo ou abra uma issue no repositório.

---

**Desenvolvido com ❤️ para o Brasil**
