import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Heart, Book, Lock, Shield, FileText, Package, UserCheck, MessageSquare } from 'lucide-react';
import { FaGithub, FaDiscord } from 'react-icons/fa';
import { useScrollToTop } from '../../components/ui/useScrollToTop';

export function Terms() {
    useScrollToTop(); // Add this hook to scroll to top when page loads
    
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const sections = [
        {
            icon: Package,
            title: 'Natureza do Software',
            description: <div className="space-y-4 text-justify">
                <p>
                    O Gatekit é uma plataforma de código aberto para autenticação e autorização, projetada para ser auto-hospedada (self-hosted). Nós fornecemos o código-fonte para que você, o usuário, possa executar, modificar e gerenciar sua própria instância do serviço em sua própria infraestrutura.
                </p>
                <p>
                    Nós não operamos um serviço hospedado (SaaS) do Gatekit. A responsabilidade pela instalação, manutenção, segurança e operação de qualquer instância do Gatekit é inteiramente sua.
                </p>
            </div>
        },
        {
            icon: FileText,
            title: 'Licença de Software',
            description: <div className="space-y-4 text-justify">
                <p>
                    O Software Gatekit é distribuído sob os termos da Licença MIT. Uma cópia da Licença MIT pode ser encontrada no arquivo LICENSE em nossos repositórios no GitHub.
                </p>
                <p>
                    A licença concede a você, de forma gratuita, permissão para:
                </p>
                <div className="space-y-2 pl-4">
                    <p>• Usar o Software para qualquer propósito, incluindo comercial.</p>
                    <p>• Modificar o código-fonte para atender às suas necessidades.</p>
                    <p>• Distribuir cópias originais ou modificadas do Software.</p>
                    <p>• Sublicenciar o Software.</p>
                </div>
                <p>
                    A única condição é que o aviso de copyright e o texto da licença original sejam incluídos em todas as cópias ou partes substanciais do Software.
                </p>
            </div>
        },
        {
            icon: Shield,
            title: 'Ausência de Garantias',
            description: <div className="space-y-4 text-justify">
                <p>
                    O SOFTWARE É FORNECIDO "COMO ESTÁ" ("AS IS"), SEM GARANTIA DE QUALQUER TIPO, EXPRESSA OU IMPLÍCITA, INCLUINDO, MAS NÃO SE LIMITANDO A, GARANTIAS DE COMERCIALIZAÇÃO, ADEQUAÇÃO A UM PROPÓSITO ESPECÍFICO E NÃO INFRAÇÃO.
                </p>
                <p>
                    Os mantenedores e contribuidores do projeto Gatekit não garantem que o Software atenderá aos seus requisitos, que operará de forma ininterrupta, segura, livre de bugs ou erros. Todo o risco relacionado à qualidade e ao desempenho do Software é seu.
                </p>
            </div>
        }
    ];

    const details = [
        {
            icon: Lock,
            title: 'Suas Responsabilidades',
            description: <div className="space-y-4 text-justify">
                <p>
                    Ao utilizar o Gatekit, você concorda que é o único responsável por:
                </p>
                <div className="space-y-2 pl-4">
                    <p><strong>• Segurança:</strong> Implementar as melhores práticas de segurança para proteger sua instância do Gatekit, os dados de seus usuários e as chaves de acesso.</p>
                    
                    <p><strong>• Dados:</strong> Gerenciar e proteger todos os dados processados pela sua instância do Software, incluindo informações de identificação pessoal de seus usuários finais.</p>
                    
                    <p><strong>• Conformidade:</strong> Cumprir todas as leis e regulamentações aplicáveis, incluindo leis de privacidade e proteção de dados (como LGPD, GDPR, etc.).</p>
                    
                    <p><strong>• Backups:</strong> Manter backups adequados de seus dados.</p>
                </div>
            </div>
        },
        {
            icon: UserCheck,
            title: 'Uso Aceitável',
            description: 'Você concorda em não utilizar o Software para fins ilegais, fraudulentos ou maliciosos. É sua responsabilidade garantir que o uso da sua instância do Gatekit esteja em conformidade com todas as leis aplicáveis.'
        },
        {
            icon: MessageSquare,
            title: 'Contato e Alterações',
            description: 'Para dúvidas sobre estes Termos de Uso, abra uma "issue" no repositório oficial do projeto no GitHub. Reservamo-nos o direito de modificar estes Termos a qualquer momento.'
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Header igual ao existente */}
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
                                <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
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
                            Termos de Uso do Gatekit
                        </h1>
                        <p className="py-2 text-lg text-gray-600 mb-2">
                            Última atualização: 4 de Outubro de 2025
                        </p>
                        <div className="text-xl text-gray-600 space-y-4">
                            <p>
                                Bem-vindo ao Gatekit!
                            </p>
                            <p className="text-justify">
                                Estes Termos de Uso ("Termos") governam o seu acesso e uso do software Gatekit, incluindo o servidor Gatekit (gatekit) e o Kit de Desenvolvimento de Software (gatekit-sdk), coletivamente referidos como "o Software".
                            </p>
                            <p className="text-justify">
                                Ao baixar, instalar, modificar ou utilizar o Software, você concorda em cumprir estes Termos.
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
                                        <div className="text-lg text-gray-600">{section.description}</div>
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
                                        <p className="text-lg text-gray-600 mb-6">{detail.description}</p>
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
                        Comprometidos com o Código Aberto
                    </h2>
                    <p className="text-xl mb-8 opacity-90">
                        Conheça nosso código e junte-se à nossa comunidade
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

            {/* Footer igual ao existente */}
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
