import { CreditCard, TrendingUp, Calendar, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatNumber, formatPercentage } from '../../lib/utils';

export function Billing() {
  const currentPlan = {
    name: 'Starter',
    price: 'R$ 99/mês',
    status: 'active',
    billingCycle: 'Mensal',
    nextBillingDate: '15 de Novembro de 2025',
  };

  const usage = {
    messages: {
      used: 8542,
      limit: 50000,
      percentage: (8542 / 50000) * 100,
    },
    platforms: {
      used: 3,
      limit: 10,
    },
  };

  const invoices = [
    {
      id: '1',
      date: '15 Out 2025',
      amount: 'R$ 99,00',
      status: 'paid',
      invoiceUrl: '#',
    },
    {
      id: '2',
      date: '15 Set 2025',
      amount: 'R$ 99,00',
      status: 'paid',
      invoiceUrl: '#',
    },
    {
      id: '3',
      date: '15 Ago 2025',
      amount: 'R$ 99,00',
      status: 'paid',
      invoiceUrl: '#',
    },
  ];

  const plans = [
    {
      name: 'Free',
      price: 'Grátis',
      period: '',
      features: [
        '1.000 mensagens/mês',
        '2 plataformas',
        'Suporte por email',
        'Retenção de 7 dias',
      ],
      current: false,
    },
    {
      name: 'Starter',
      price: 'R$ 99',
      period: '/mês',
      features: [
        '50.000 mensagens/mês',
        '10 plataformas',
        'Suporte prioritário',
        'Retenção de 30 dias',
        'API avançada',
      ],
      current: true,
    },
    {
      name: 'Pro',
      price: 'R$ 299',
      period: '/mês',
      features: [
        '250.000 mensagens/mês',
        'Plataformas ilimitadas',
        'Suporte 24/7',
        'Retenção de 90 dias',
        'API avançada',
        'Webhooks customizados',
      ],
      current: false,
    },
    {
      name: 'Enterprise',
      price: 'Customizado',
      period: '',
      features: [
        'Mensagens ilimitadas',
        'Plataformas ilimitadas',
        'Suporte dedicado',
        'Retenção customizada',
        'SLA garantido',
        'Onboarding dedicado',
      ],
      current: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Faturamento</h1>
          <p className="text-gray-600 mt-1">
            Gerencie sua assinatura e histórico de pagamentos
          </p>
        </div>
        <Button variant="outline">
          <ExternalLink className="w-4 h-4" />
          Portal do Cliente
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Plano Atual</p>
                <p className="text-xl font-bold text-gray-900">{currentPlan.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-gray-900">
                {currentPlan.price}
              </span>
              <Badge variant="success">Ativo</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Uso de Mensagens</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatNumber(usage.messages.used)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>
                  {formatPercentage(usage.messages.used, usage.messages.limit)} usado
                </span>
                <span>{formatNumber(usage.messages.limit)} total</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${usage.messages.percentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Próxima Cobrança</p>
                <p className="text-base font-bold text-gray-900">
                  {currentPlan.nextBillingDate}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Ciclo: {currentPlan.billingCycle}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Histórico de Faturas</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                    <Download className="w-5 h-5 text-gray-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{invoice.date}</p>
                    <p className="text-sm text-gray-600">{invoice.amount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="success">Pago</Badge>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                    Baixar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Planos Disponíveis</h3>
            <Badge variant="info">Upgrade disponível</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-6 rounded-xl border-2 ${
                  plan.current
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="mb-4">
                  <h4 className="text-lg font-bold text-gray-900 mb-1">
                    {plan.name}
                  </h4>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-600">{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="text-green-600 mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.current ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plano Atual
                  </Button>
                ) : (
                  <Button className="w-full">
                    {plan.name === 'Free' ? 'Downgrade' : 'Fazer Upgrade'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
