import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, MessageSquare, Heart, Book, Code, Users, Lock, Globe } from 'lucide-react';
import { FaDiscord, FaGithub } from 'react-icons/fa';
import { Card, CardContent } from '../../components/ui/Card';
import { useScrollToTop } from '../../components/ui/useScrollToTop';

export function About() {
  useScrollToTop(); // Add this hook to scroll to top when page loads
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const stats = [
    { value: '2023', label: 'Ano de Fundação' },
    { value: '5+', label: 'Plataformas Integradas' },
    { value: '100%', label: 'Open Source' },
    { value: '24/7', label: 'Suporte via Discord' },
  ];

  const pillars = [
    {
      icon: Lock,
      title: 'Segurança Primeiro',
      description: 'Criptografia de ponta a ponta, conformidade com LGPD e práticas modernas de segurança.'
    },
    {
      icon: Code,
      title: 'Tecnologia de Ponta',
      description: 'Stack moderna com React, TypeScript, Supabase e ferramentas de última geração.'
    },
    {
      icon: MessageSquare,
      title: 'Comunicação Unificada',
      description: 'Integração simplificada com as principais plataformas de mensagens do mercado.'
    },
    {
      icon: Globe,
      title: 'Pensado para o Brasil',
      description: 'Interface em português, documentação local e suporte ao mercado brasileiro.'
    }
  ];

  const team = [
    {
      name: 'Luis Filipe Silva de Sousa',
      role: 'CEO & Fundador',
      description: 'Desenvolvedor Full Stack com mais de 10 anos de experiência em tecnologias web e comunicação digital.',
      links: [
        { icon: FaGithub, url: 'https://github.com/filipexyz' },
        { icon: FaDiscord, url: 'https://discord.gg/bQPsvycW' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header igual ao Home */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">GateKit</span>
            </Link>

            {/* Menu desktop */}
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
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden bg-white border-t border-gray-200 px-4 py-2 absolute w-full left-0 top-16 z-40 shadow-lg">
            <Link to="/" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Início</Link>
            <Link to="/docs" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Documentos</Link>
            <Link to="/about" className="block py-2 text-blue-600" onClick={() => setMobileMenuOpen(false)}>Sobre</Link>
          </div>
        )}
      </header>

      {/* Hero Section with animated background */}
      <section className="relative overflow-hidden pt-32 pb-20">
        {/* Animated background overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-gray-50 animate-gradient" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1)_0%,rgba(59,130,246,0)_50%)] animate-pulse" />
            <div className="absolute w-full h-full bg-[linear-gradient(to_right,transparent_0%,rgba(59,130,246,0.1)_50%,transparent_100%)] animate-shine" />
          </div>
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Sobre a GateKit
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                          Simplificando a comunicação digital para desenvolvedores e empresas brasileiras através de uma plataforma unificada e moderna.
            </p>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center backdrop-blur-sm bg-white/50 rounded-xl p-4 shadow-lg border border-white/20">
                <p className="text-4xl font-bold text-blue-600 mb-2">{stat.value}</p>
                <p className="text-gray-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* História Section com fundo animado de linhas diagonais */}
      <section className="relative py-20 bg-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-100 via-white to-gray-100 animate-gradient" />
          <div className="absolute inset-0 bg-diagonal-lines opacity-10" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Nossa História</h2>
            <p className="text-lg text-gray-600">
              A GateKit nasceu da necessidade real de simplificar a integração entre diferentes plataformas de mensagens. Fundada por Luis Filipe Silva de Sousa em 2023, a plataforma rapidamente se tornou uma solução essencial para empresas que buscam unificar suas comunicações.
            </p>
          </div>

          {/* Pilares */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card key={pillar.title} className="border-2 hover:border-blue-200 transition-colors">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {pillar.title}
                    </h3>
                    <p className="text-gray-600">{pillar.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Equipe Section com fundo animado de pontos/pulsos */}
      <section className="relative py-20 bg-gray-50 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-gray-50 to-blue-100 animate-gradient" />
          <div className="absolute inset-0 bg-pulse-dots opacity-10" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Nossa Equipe</h2>
            <p className="text-lg text-gray-600">
              Conheça as pessoas por trás da GateKit, trabalhando para tornar a comunicação digital mais acessível.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {team.map((member) => (
              <Card key={member.name} className="border-2 hover:border-blue-200 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-12 h-12 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 mb-1">
                      {member.name}
                    </h3>
                    <p className="text-blue-600 font-medium mb-4">{member.role}</p>
                    <p className="text-gray-600 mb-6">{member.description}</p>
                    <div className="flex items-center gap-4">
                      {member.links.map((link, index) => {
                        const Icon = link.icon;
                        return (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:text-blue-600 transition-colors"
                          >
                            <Icon className="w-6 h-6" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Faça Parte da Nossa Comunidade
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Junte-se a desenvolvedores e empresas que estão revolucionando a comunicação digital
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/docs"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              <Book className="w-6 h-6" />
              Documentação
            </Link>
            <a
              href="https://discord.gg/bQPsvycW"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              <FaDiscord className="w-6 h-6" />
              Entrar no Discord
            </a>
            <a
              href="https://github.com/filipexyz/gatekit-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-transparent border-2 border-white text-white rounded-lg font-semibold hover:bg-white/10 transition-colors"
            >
              <FaGithub className="w-6 h-6" />
              Ver no GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Rodapé clonado do Home */}
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
