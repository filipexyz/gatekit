import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Heart, Book, Shield, Package, Database, UserCheck, MessageSquare } from 'lucide-react';
import { FaGithub, FaDiscord } from 'react-icons/fa';
import { useScrollToTop } from '../../components/ui/useScrollToTop';

export function Privacy() {
  useScrollToTop(); // Add this hook to scroll to top when page loads
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sections = [
    {
      icon: Package,
      title: 'O que é o GateKit SDK?',
      description: 'O Gatekeep SDK é uma biblioteca de cliente que facilita a comunicação com uma API Gatekeeper. Ele não é um serviço independente, mas sim uma ferramenta que desenvolvedores podem incorporar em seus projetos de frontend para gerenciar o login, o registro, a validação de sessão e o controle de acesso de seus próprios usuários.'
    },
    {
      icon: Database,
      title: 'Dados Coletados e Processados',
      description: <div className="space-y-4">
        <p>O GateKit SDK por si só não coleta, armazena ou transmite quaisquer dados pessoais para os mantenedores do projeto. Todo o processamento de dados ocorre entre o cliente (navegador do usuário final) e o servidor da aplicação na qual o SDK foi implementado.</p>
        
        <p>Quando um desenvolvedor integra o GateKit SDK em sua aplicação, o SDK pode lidar com os seguintes tipos de dados, sempre no contexto da aplicação do desenvolvedor:</p>
        
        <div className="space-y-2 pl-4">
          <p><strong>• Tokens de Autenticação:</strong> O SDK gerencia tokens (como JWTs - JSON Web Tokens) que são utilizados para autenticar e autorizar as requisições do usuário. Estes tokens são tipicamente armazenados no navegador do usuário final, seja em localStorage, sessionStorage ou cookies. A gestão e a segurança desses tokens são de responsabilidade do desenvolvedor que implementa o SDK.</p>
          
          <p><strong>• Credenciais do Usuário:</strong> O SDK pode capturar temporariamente credenciais como e-mail e senha durante o processo de login para enviá-las de forma segura ao servidor de autenticação definido pelo desenvolvedor. Essas informações não são armazenadas pelo SDK.</p>
          
          <p><strong>• Dados de Sessão:</strong> Informações sobre o estado da sessão do usuário (se está logado ou não) são gerenciadas localmente no navegador.</p>
        </div>
      </div>
    },
    {
      icon: UserCheck,
      title: 'Responsabilidade do Desenvolvedor',
      description: <div className="space-y-4">
        <p>Os desenvolvedores que utilizam o Gatekeep SDK em suas aplicações são os controladores dos dados de seus usuários. Isso significa que eles são responsáveis por:</p>
        
        <div className="space-y-2 pl-4">
          <p>• Criar sua própria Política de Privacidade, informando aos seus usuários finais como seus dados são coletados, utilizados e protegidos.</p>
          
          <p>• Garantir a segurança do servidor e da API com a qual o Gatekeep SDK se comunica.</p>
          
          <p>• Implementar o SDK de acordo com as melhores práticas de segurança.</p>
          
          <p>• Cumprir as leis e regulamentações de proteção de dados aplicáveis, como a LGPD (Lei Geral de Proteção de Dados) no Brasil ou o GDPR na Europa.</p>
        </div>
      </div>
    }
  ];

  const details = [
    {
      icon: Shield,
      title: 'Segurança',
      description: 'O Gatekeep SDK foi desenvolvido com a segurança em mente, seguindo as melhores práticas para o gerenciamento de tokens e autenticação no frontend. No entanto, a segurança geral da aplicação depende fundamentalmente da implementação feita pelo desenvolvedor e da segurança de sua infraestrutura de backend.'
    },
    {
      icon: Book,
      title: 'Código Aberto',
      description: 'O GateKit SDK é um projeto de código aberto. Seu código-fonte está disponível no GitHub para inspeção, auditoria e contribuição da comunidade. Acreditamos que a transparência é um pilar fundamental da segurança e da privacidade.'
    },
    {
      icon: MessageSquare,
      title: 'Contato',
      description: 'Se você tiver alguma dúvida sobre o funcionamento do GateKit SDK em relação à privacidade e ao tratamento de dados, sinta-se à vontade para abrir uma "issue" no nosso repositório do GitHub ou entrar em nossa comunidade no Discord.'
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

            {/* Menu desktop igual ao Home */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Início</Link>
              <Link to="/docs" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Documentos</Link>
              <Link to="/about" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">Sobre</Link>
            </div>

            {/* Menu mobile hamburguer igual ao Home */}
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
        {/* Mobile menu igual ao Home */}
        {mobileMenuOpen && (
          <div id="mobile-menu" className="md:hidden bg-white border-t border-gray-200 px-4 py-2 absolute w-full left-0 top-16 z-40 shadow-lg">
            <Link to="/" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Início</Link>
            <Link to="/docs" className="block py-2" onClick={() => setMobileMenuOpen(false)}>Documentos</Link>
            <Link to="/about" className="block py-2 text-blue-600" onClick={() => setMobileMenuOpen(false)}>Sobre</Link>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-gray-50 animate-gradient" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1)_0%,rgba(59,130,246,0)_50%)] animate-pulse" />
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Política de Privacidade do GateKit SDK
            </h1>
            <p className="py-2 text-lg text-gray-600 mb-2">
              Última atualização: 4 de Outubro de 2025
            </p>
            <div className="text-xl text-gray-600 space-y-4">
              <p className="text-justify">
                Esta Política de Privacidade descreve como o Gatekeep SDK opera em relação aos dados e à privacidade. É importante notar que o Gatekeep SDK é uma ferramenta de software (Software Development Kit) de código aberto, projetada para que desenvolvedores integrem funcionalidades de autenticação e autorização em suas próprias aplicações.
              </p>
              <p className="text-justify">
                Esta política é direcionada principalmente aos desenvolvedores que utilizam o SDK.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-0 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <div key={index} className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{section.title}</h2>
                    <div className="text-lg text-gray-600 text-justify">
                      {section.description}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Detailed Sections com ícones */}
            {details.map((detail, index) => {
              const Icon = detail.icon;
              return (
                <div key={index} className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{detail.title}</h2>
                    <p className="text-lg text-gray-600 mb-6 text-justify">{detail.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Transparência é Nossa Prioridade
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Conheça nosso código aberto e participe da nossa comunidade
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
