import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  BookOpen,
  Code,
  Terminal,
  Layers,
  MessageSquare,
  Key,
  Settings,
  ChevronRight,
  Copy,
  Check,
  Search,
  Rocket,
  ShieldCheck,
  BarChart2,
  Server,
  Github,
  Package,
  MessageCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { copyToClipboard } from '../../lib/utils';
import { useScrollToTop } from '../../components/ui/useScrollToTop';

export function Docs() {
  useScrollToTop(); // Add this hook to scroll to top when page loads

  const [activeSection, setActiveSection] = useState('introducao');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Novo estado para menu mobile

  const handleCopyCode = async (code: string, id: string) => {
    await copyToClipboard(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navigation = [
    {
      title: 'Começando',
      items: [
        { id: 'introducao', label: 'Introdução', icon: BookOpen },
        { id: 'instalacao', label: 'Instalação', icon: Terminal },
        { id: 'autenticacao', label: 'Autenticação', icon: Key },
        { id: 'quickstart', label: 'Início Rápido', icon: Zap },
      ],
    },
    {
      title: 'API Core',
      items: [
        { id: 'projetos', label: 'Projetos', icon: Layers },
        { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
        { id: 'plataformas', label: 'Plataformas', icon: Settings },
        { id: 'webhooks', label: 'Webhooks', icon: Code },
      ],
    },
  ];

  const codeExamples = {
    instalacao: `npm install @gatekit/sdk

# ou com yarn
yarn add @gatekit/sdk

# ou com pnpm
pnpm add @gatekit/sdk`,

    inicializacao: `import { GateKit } from '@gatekit/sdk';

const gatekit = new GateKit({
  apiUrl: 'https://api.gatekit.dev',
  apiKey: 'gk_live_sua_chave_aqui'
});`,

    enviarMensagem: `// Enviar uma mensagem simples
const mensagem = await gatekit.messages.send({
  projectId: 'seu-projeto-id',
  targets: [
    {
      platformId: 'whatsapp-123',
      type: 'user',
      id: '5511999999999'
    }
  ],
  content: 'Olá! Esta é uma mensagem do GateKit.'
});

console.log('Mensagem enviada:', mensagem.id);`,

    listarMensagens: `// Listar mensagens enviadas
const mensagens = await gatekit.messages.list({
  projectId: 'seu-projeto-id',
  limit: 50,
  status: 'delivered'
});

mensagens.forEach(msg => {
  console.log(\`\${msg.id}: \${msg.content}\`);
});`,

    criarPlataforma: `// Conectar uma plataforma Discord
const plataforma = await gatekit.platforms.create({
  projectId: 'seu-projeto-id',
  type: 'discord',
  name: 'Bot Principal',
  credentials: {
    token: 'seu-bot-token-aqui'
  }
});

console.log('Plataforma conectada:', plataforma.id);`,

    gerarChave: `// Gerar uma nova chave de API
const chave = await gatekit.keys.create({
  projectId: 'seu-projeto-id',
  name: 'Produção - API Principal',
  scopes: [
    'messages:send',
    'messages:read',
    'platforms:read'
  ]
});

console.log('Chave gerada:', chave.key);
// IMPORTANTE: Salve esta chave, ela só é exibida uma vez!`,

    webhook: `// Configurar webhook para receber eventos
app.post('/webhook/gatekit', async (req, res) => {
  const evento = req.body;

  switch (evento.type) {
    case 'message.delivered':
      console.log('Mensagem entregue:', evento.data.messageId);
      break;
    case 'message.failed':
      console.log('Falha no envio:', evento.data.error);
      break;
    case 'message.received':
      console.log('Mensagem recebida:', evento.data.content);
      break;
  }

  res.status(200).send('OK');
});`,
  };

  const sections = {
    introducao: {
      title: 'Introdução',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Bem-vindo ao GateKit</h2>
            <p className="text-lg text-gray-700 leading-relaxed">
              O GateKit é um gateway universal de mensagens que permite enviar e receber mensagens
              de múltiplas plataformas através de uma única API simples e consistente.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              <a
                href="https://github.com/filipexyz/gatekit-sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white font-medium shadow hover:bg-gray-800 transition"
              >
                <Github className="w-5 h-5" />
                GitHub SDK
              </a>
              <a
                href="https://www.npmjs.com/package/@gatekit/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium shadow hover:bg-blue-700 transition"
              >
                <Package className="w-5 h-5" />
                NPM Package
              </a>
              <a
                href="https://discord.gg/bQPsvycW"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-600 text-white font-medium shadow hover:bg-gray-700 transition"
              >
                <MessageCircle className="w-5 h-5" />
                Discord
              </a>
            </div>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-blue-900 mb-3">O que você pode fazer?</h3>
              <ul className="space-y-2 text-blue-800">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  Enviar mensagens para WhatsApp, Discord, Telegram e mais
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  Receber e processar mensagens de entrada via webhooks
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  Gerenciar múltiplos projetos e plataformas
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  Acompanhar métricas e logs em tempo real
                </li>
              </ul>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Recursos Principais</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-white border-2 border-gray-100 hover:border-blue-100 rounded-xl transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Simples e Rápido</h4>
                </div>
                <p className="text-gray-600">
                  Integre em minutos com nosso SDK TypeScript e comece a enviar mensagens
                </p>
              </div>
              <div className="p-6 bg-white border-2 border-gray-100 hover:border-blue-100 rounded-xl transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Seguro</h4>
                </div>
                <p className="text-gray-600">
                  Autenticação via API keys com escopos granulares e criptografia
                </p>
              </div>
              <div className="p-6 bg-white border-2 border-gray-100 hover:border-blue-100 rounded-xl transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BarChart2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Observável</h4>
                </div>
                <p className="text-gray-600">
                  Logs detalhados, métricas em tempo real e webhooks para eventos
                </p>
              </div>
              <div className="p-6 bg-white border-2 border-gray-100 hover:border-blue-100 rounded-xl transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Server className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-gray-900">Escalável</h4>
                </div>
                <p className="text-gray-600">
                  Infraestrutura preparada para milhões de mensagens por dia
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    instalacao: {
      title: 'Instalação',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Instalação</h2>
            <p className="text-lg text-gray-700 mb-6">
              Instale o SDK do GateKit usando seu gerenciador de pacotes favorito:
            </p>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <Badge>npm</Badge>
              <button
                onClick={() => handleCopyCode(codeExamples.instalacao, 'install')}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                {copiedCode === 'install' ? (
                  <>
                    <Check className="w-4 h-4 text-green-600" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar
                  </>
                )}
              </button>
            </div>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <code>{codeExamples.instalacao}</code>
            </pre>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Inicialização</h3>
            <p className="text-gray-700 mb-4">
              Após a instalação, inicialize o cliente com sua chave de API:
            </p>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Badge>TypeScript</Badge>
                <button
                  onClick={() => handleCopyCode(codeExamples.inicializacao, 'init')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {copiedCode === 'init' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                <code>{codeExamples.inicializacao}</code>
              </pre>
            </div>
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-amber-900 mb-2">⚠️ Importante</h4>
              <p className="text-sm text-amber-800">
                Nunca exponha sua chave de API no código front-end. Use variáveis de ambiente
                e mantenha suas chaves seguras no servidor.
              </p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    mensagens: {
      title: 'Mensagens',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Gerenciamento de Mensagens</h2>
            <p className="text-lg text-gray-700">
              Envie, liste e monitore mensagens através de múltiplas plataformas.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Enviar Mensagem</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Badge>TypeScript</Badge>
                <button
                  onClick={() => handleCopyCode(codeExamples.enviarMensagem, 'send')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {copiedCode === 'send' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{codeExamples.enviarMensagem}</code>
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Listar Mensagens</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Badge>TypeScript</Badge>
                <button
                  onClick={() => handleCopyCode(codeExamples.listarMensagens, 'list')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {copiedCode === 'list' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{codeExamples.listarMensagens}</code>
              </pre>
            </div>
          </div>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <h4 className="font-semibold text-green-900 mb-2">💡 Dica</h4>
              <p className="text-sm text-green-800">
                Use os filtros de status (delivered, sent, failed, pending) para monitorar
                o estado de suas mensagens e implementar lógica de retry quando necessário.
              </p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    plataformas: {
      title: 'Plataformas',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Gerenciamento de Plataformas</h2>
            <p className="text-lg text-gray-700">
              Conecte e gerencie múltiplas plataformas de mensagens.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Criar Plataforma</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Badge>TypeScript</Badge>
                <button
                  onClick={() => handleCopyCode(codeExamples.criarPlataforma, 'platform')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {copiedCode === 'platform' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{codeExamples.criarPlataforma}</code>
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Plataformas Disponíveis</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { name: 'Discord', type: 'discord', cred: 'Token do Bot' },
                { name: 'Telegram', type: 'telegram', cred: 'Bot Token' },
                { name: 'WhatsApp', type: 'whatsapp', cred: 'API Key' },
                { name: 'Slack', type: 'slack', cred: 'Bot Token' },
              ].map((platform) => (
                <div key={platform.type} className="p-4 border-2 border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">{platform.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">Type: <code className="bg-gray-100 px-2 py-1 rounded">{platform.type}</code></p>
                  <p className="text-sm text-gray-600">Credencial: {platform.cred}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    autenticacao: {
      title: 'Autenticação',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Autenticação e Chaves de API</h2>
            <p className="text-lg text-gray-700">
              O GateKit usa chaves de API para autenticar requisições. Cada chave possui
              escopos específicos que determinam quais operações pode realizar.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Gerando uma Chave</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Badge>TypeScript</Badge>
                <button
                  onClick={() => handleCopyCode(codeExamples.gerarChave, 'key')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {copiedCode === 'key' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{codeExamples.gerarChave}</code>
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Escopos Disponíveis</h3>
            <div className="space-y-2">
              {[
                { scope: 'messages:send', desc: 'Enviar mensagens' },
                { scope: 'messages:read', desc: 'Ler mensagens e estatísticas' },
                { scope: 'platforms:read', desc: 'Listar plataformas' },
                { scope: 'platforms:write', desc: 'Criar e gerenciar plataformas' },
                { scope: 'keys:read', desc: 'Visualizar chaves de API' },
                { scope: 'keys:write', desc: 'Criar e revogar chaves' },
                { scope: 'logs:read', desc: 'Acessar logs' },
                { scope: 'stats:read', desc: 'Ver estatísticas' },
              ].map((item) => (
                <div key={item.scope} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <code className="text-sm font-mono text-blue-600">{item.scope}</code>
                  <span className="text-sm text-gray-600">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    webhooks: {
      title: 'Webhooks',
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Webhooks</h2>
            <p className="text-lg text-gray-700">
              Receba notificações em tempo real sobre eventos em seu projeto.
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Configurando Webhooks</h3>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Badge>Node.js / Express</Badge>
                <button
                  onClick={() => handleCopyCode(codeExamples.webhook, 'webhook')}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {copiedCode === 'webhook' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                <code>{codeExamples.webhook}</code>
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Eventos Disponíveis</h3>
            <div className="space-y-2">
              {[
                { event: 'message.sent', desc: 'Mensagem foi enviada à plataforma' },
                { event: 'message.delivered', desc: 'Mensagem foi entregue ao destinatário' },
                { event: 'message.failed', desc: 'Falha no envio da mensagem' },
                { event: 'message.received', desc: 'Mensagem recebida de um usuário' },
                { event: 'platform.connected', desc: 'Plataforma conectada com sucesso' },
                { event: 'platform.error', desc: 'Erro na plataforma' },
              ].map((item) => (
                <div key={item.event} className="p-3 bg-gray-50 rounded-lg">
                  <code className="text-sm font-mono text-purple-600">{item.event}</code>
                  <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  };

  const currentSection = sections[activeSection as keyof typeof sections];

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {/* Botão de menu mobile à esquerda do logo */}
              <button
                className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
              </button>
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">GateKit Docs</span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/">
                <Button variant="ghost">← Voltar ao Site</Button>
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Aside desktop */}
        <aside className="hidden lg:block w-64 border-r border-gray-200 min-h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* ...existing aside code... */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm"
              />
            </div>
            {navigation.map((section) => (
              <div key={section.title}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {section.title}
                </h4>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveSection(item.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                            activeSection === item.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Drawer mobile */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="w-64 bg-white border-r border-gray-200 min-h-screen p-6 space-y-6 overflow-y-auto shadow-xl">
              <button
                className="mb-6 p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              {navigation.map((section) => (
                <div key={section.title}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {section.title}
                  </h4>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => {
                              setActiveSection(item.id);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              activeSection === item.id
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            {item.label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {/* Overlay para fechar o drawer */}
            <div className="flex-1 bg-black bg-opacity-30" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-12">
          <div className="max-w-4xl">
            {currentSection?.content}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Tem dúvidas? Participe da nossa comunidade no{' '}
                <a
                  href="https://discord.gg/bQPsvycW"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Discord
                </a>{' '}ou abra uma issue no{' '}
                <a
                  href="https://github.com/filipexyz/gatekit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  GitHub
                </a>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
