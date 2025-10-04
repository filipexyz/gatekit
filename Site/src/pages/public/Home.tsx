import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  MessageSquare,
  Shield,
  TrendingUp,
  Code,
  Layers,
  CheckCircle,
  Github,
  BookOpen,
  Heart,
} from 'lucide-react';
import { FaWhatsapp, FaDiscord, FaTelegram, FaSlack, FaEnvelope, FaSms, FaBell, FaBullhorn, FaHeadset, FaBolt } from 'react-icons/fa';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

export function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: MessageSquare,
      title: 'Mensagens Unificadas',
      description:
        'Envie mensagens para WhatsApp, Discord, Telegram e mais, tudo através de uma única API simples e poderosa.',
    },
    {
      icon: Shield,
      title: 'Seguro e Confiável',
      description:
        'Autenticação robusta, criptografia de ponta a ponta e conformidade com LGPD para proteger seus dados.',
    },
    {
      icon: TrendingUp,
      title: 'Escalável',
      description:
        'De startups a empresas, nossa infraestrutura cresce com você. Milhões de mensagens processadas com confiabilidade.',
    },
    {
      icon: Code,
      title: 'SDK Moderno',
      description:
        'SDKs nativos em TypeScript/JavaScript, Python e mais. Integre em minutos com nossa documentação completa.',
    },
    {
      icon: Layers,
      title: 'Multi-Plataforma',
      description:
        'Suporte nativo para as principais plataformas de mensagens. Novos canais adicionados constantemente.',
    },
    {
      icon: Zap,
      title: 'Velocidade',
      description:
        'Latência ultra-baixa e processamento assíncrono garantem que suas mensagens cheguem instantaneamente.',
    },
  ];

  const platforms = [
    { name: 'WhatsApp', logo: <FaWhatsapp className="text-green-500 w-8 h-8" />, available: true },
    { name: 'Discord', logo: <FaDiscord className="text-indigo-500 w-8 h-8" />, available: true },
    { name: 'Telegram', logo: <FaTelegram className="text-blue-400 w-8 h-8" />, available: true },
    { name: 'Slack', logo: <FaSlack className="text-purple-500 w-8 h-8" />, available: true },
    { name: 'Email', logo: <FaEnvelope className="text-gray-500 w-8 h-8" />, available: false },
    { name: 'SMS', logo: <FaSms className="text-pink-500 w-8 h-8" />, available: false },
  ];

  const useCases = [
    {
      title: 'Notificações Transacionais',
      description: 'Envie confirmações de pedidos, atualizações de status e alertas importantes',
      icon: <FaBell className="text-yellow-500 w-8 h-8" />,
    },
    {
      title: 'Marketing e Campanhas',
      description: 'Alcance sua audiência com mensagens personalizadas e segmentadas',
      icon: <FaBullhorn className="text-blue-500 w-8 h-8" />,
    },
    {
      title: 'Suporte ao Cliente',
      description: 'Responda rapidamente e automatize atendimentos com bots inteligentes',
      icon: <FaHeadset className="text-green-500 w-8 h-8" />,
    },
    {
      title: 'Automações',
      description: 'Integre com ferramentas como n8n, Zapier e crie workflows poderosos',
      icon: <FaBolt className="text-cyan-500 w-8 h-8" />,
    },
  ];

  const stats = [
    { value: '10M+', label: 'Mensagens Enviadas' },
    { value: '99.9%', label: 'Uptime' },
    { value: '5+', label: 'Plataformas' },
    { value: '< 100ms', label: 'Latência Média' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">GateKit</span>
            </Link>

            {/* Menu desktop ajustado */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Início</Link>
              <Link to="/docs" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Documentos</Link>
              <Link to="/about" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Sobre</Link>
            </div>

            {/* Menu mobile hamburguer */}
            <div className="md:hidden flex items-center">
              <button
                id="menu-btn"
                className="text-gray-700 focus:outline-none"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Abrir menu"
              >
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
            </div>
          </div>
        </nav>
        {/* Mobile menu ajustado */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden bg-white border-t border-gray-200 px-4 py-2 absolute w-full left-0 top-16 z-40 shadow-lg">
            <Link to="/" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Início</Link>
            <Link to="/docs" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Documentos</Link>
            <Link to="/about" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Sobre</Link>
          </div>
        )}
      </header>

      <main className="pt-16">
        {/* Seção Objetivos */}
        <section id="objetivos" className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-gray-50 py-20 lg:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Gateway Universal de Mensagens
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                Unifique suas mensagens em{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                  uma única API
                </span>
              </h1>

              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                Conecte WhatsApp, Discord, Telegram e mais. Uma infraestrutura poderosa para
                desenvolvedores que precisam escalar comunicação multi-plataforma.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
                <Link to="/docs">
                  <Button 
                    size="lg" 
                    className="text-lg px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-out group"
                  >
                    <BookOpen className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
                    Ver Documentação
                  </Button>
                </Link>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Sem cartão necessário
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Setup em 5 minutos
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Open Source
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        </section>

        <section className="py-12 bg-white border-y border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-4xl font-bold text-gray-900 mb-2">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Por que escolher o GateKit?
              </h2>
              <p className="text-xl text-gray-600">
                Construído para desenvolvedores, escalado para empresas
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="border-2 hover:border-blue-300 transition-colors">
                    <CardContent className="pt-6">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        {feature.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Plataformas Suportadas
              </h2>
              <p className="text-xl text-gray-600">
                Conecte-se às principais plataformas de mensagens do mundo
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {platforms.map((platform) => (
                <Card
                  key={platform.name}
                  className={`text-center ${platform.available ? 'border-2 hover:border-blue-300' : 'opacity-50'} transition-colors`}
                >
                  <CardContent className="pt-6 pb-6">
                    <div className="flex justify-center mb-3">{platform.logo}</div>
                    <p className="font-semibold text-gray-900">{platform.name}</p>
                    {!platform.available && (
                      <p className="text-xs text-gray-500 mt-2">Em breve</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
                Casos de Uso
              </h2>
              <p className="text-xl text-gray-600">
                Soluções para todas as suas necessidades de comunicação
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {useCases.map((useCase) => (
                <Card key={useCase.title} className="border-2 hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="text-4xl">{useCase.icon}</div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {useCase.title}
                        </h3>
                        <p className="text-gray-600">{useCase.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 lg:py-32 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Pronto para começar?
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Junte-se a centenas de desenvolvedores que já usam o GateKit SDK para
              escalar suas comunicações
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://github.com/filipexyz/gatekit-sdk"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-white text-white hover:bg-white/10">
                  <Github className="w-5 h-5" />
                  Ver no GitHub
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">GateKit</span>
              </div>
              <p className="text-sm">
                Gateway universal de mensagens para desenvolvedores modernos.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Produto</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="https://www.npmjs.com/package/@gatekit/sdk" className="hover:text-white transition-colors">NpmJS</Link></li>
                <li><Link to="/docs" className="hover:text-white transition-colors">Documentação</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">Sobre</Link></li>
                <li><Link to="https://discord.gg/bQPsvycW" className="hover:text-white transition-colors">Comunidade</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacidade</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Termos</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm">© 2025 GateKit. Todos os direitos reservados.</p>
            <p className="text-sm">Feito com <Heart className="w-4 h-4 inline text-red-500" /> para o Brasil</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
