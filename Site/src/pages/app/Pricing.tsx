import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: 'Grátis',
      period: 'para sempre',
      description: 'Perfeito para experimentar e projetos pessoais',
      features: [
        '1.000 mensagens/mês',
        '2 plataformas conectadas',
        'Suporte por email',
        'Retenção de 7 dias',
        'API REST completa',
        'Dashboard básico',
      ],
      cta: 'Começar Grátis',
      highlighted: false,
    },
    {
      name: 'Starter',
      price: 'R$ 99',
      period: '/mês',
      description: 'Ideal para startups e pequenos projetos',
      features: [
        '50.000 mensagens/mês',
        '10 plataformas conectadas',
        'Suporte prioritário',
        'Retenção de 30 dias',
        'API REST + Webhooks',
        'Dashboard avançado',
        'Múltiplos projetos',
        'Chaves de API ilimitadas',
      ],
      cta: 'Começar Trial 14 dias',
      highlighted: true,
      badge: 'Mais Popular',
    },
    {
      name: 'Pro',
      price: 'R$ 299',
      period: '/mês',
      description: 'Para empresas que precisam de escala',
      features: [
        '250.000 mensagens/mês',
        'Plataformas ilimitadas',
        'Suporte 24/7 prioritário',
        'Retenção de 90 dias',
        'API REST + Webhooks + WebSocket',
        'Dashboard enterprise',
        'Projetos ilimitados',
        'Webhooks customizados',
        'Rate limits maiores',
        'SLA 99.9%',
      ],
      cta: 'Começar Trial 14 dias',
      highlighted: false,
    },
    {
      name: 'Enterprise',
      price: 'Customizado',
      period: '',
      description: 'Soluções personalizadas para grandes volumes',
      features: [
        'Mensagens ilimitadas',
        'Plataformas ilimitadas',
        'Suporte dedicado 24/7',
        'Retenção customizada',
        'Infraestrutura dedicada',
        'SLA 99.99% garantido',
        'Onboarding dedicado',
        'Consultoria técnica',
        'Integrações customizadas',
        'Conformidade e auditoria',
      ],
      cta: 'Falar com Vendas',
      highlighted: false,
    },
  ];

  const faqs = [
    {
      question: 'Posso mudar de plano a qualquer momento?',
      answer:
        'Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento através do dashboard. As alterações são aplicadas imediatamente.',
    },
    {
      question: 'O que acontece se eu exceder o limite de mensagens?',
      answer:
        'Se você exceder o limite do seu plano, suas mensagens serão pausadas. Você pode fazer upgrade do plano ou aguardar a renovação mensal.',
    },
    {
      question: 'Existe período de trial?',
      answer:
        'Sim! Os planos Starter e Pro oferecem 14 dias de trial gratuito. Não é necessário cartão de crédito para começar.',
    },
    {
      question: 'Como funciona o suporte técnico?',
      answer:
        'Plano Free tem suporte por email em até 48h. Starter e Pro têm suporte prioritário em até 4h. Enterprise tem suporte dedicado 24/7.',
    },
    {
      question: 'Vocês emitem nota fiscal?',
      answer:
        'Sim, emitimos nota fiscal para todos os planos pagos automaticamente após cada pagamento.',
    },
    {
      question: 'Posso cancelar a qualquer momento?',
      answer:
        'Sim, você pode cancelar sua assinatura a qualquer momento sem taxas ou multas. Seu acesso continuará até o fim do período pago.',
    },
  ];

  return null;
}
