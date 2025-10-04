import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Layers,
  Key,
  Users,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatNumber } from '../../lib/utils';

interface StatCard {
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ElementType;
  color: string;
}

export function Dashboard() {
  const [selectedProject] = useState<string | null>(null);

  const stats: StatCard[] = [
    {
      label: 'Mensagens Enviadas',
      value: '12,458',
      change: '+12.5%',
      trend: 'up',
      icon: MessageSquare,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Taxa de Entrega',
      value: '98.2%',
      change: '+2.1%',
      trend: 'up',
      icon: CheckCircle,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Falhas',
      value: '224',
      change: '-5.4%',
      trend: 'down',
      icon: XCircle,
      color: 'text-red-600 bg-red-100',
    },
    {
      label: 'Pendentes',
      value: '89',
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-100',
    },
  ];

  const recentMessages = [
    {
      id: '1',
      content: 'Bem-vindo ao nosso sistema!',
      platform: 'WhatsApp',
      status: 'delivered',
      timestamp: '2 min atrás',
    },
    {
      id: '2',
      content: 'Seu pedido foi confirmado',
      platform: 'Discord',
      status: 'sent',
      timestamp: '5 min atrás',
    },
    {
      id: '3',
      content: 'Lembrete de reunião',
      platform: 'Telegram',
      status: 'failed',
      timestamp: '10 min atrás',
    },
  ];

  const platforms = [
    { name: 'WhatsApp', status: 'active', messages: 8542 },
    { name: 'Discord', status: 'active', messages: 2156 },
    { name: 'Telegram', status: 'active', messages: 1760 },
  ];

  const getStatusBadge = (status: string) => {
    const variants = {
      delivered: 'success',
      sent: 'info',
      failed: 'danger',
      pending: 'warning',
    } as const;

    const labels = {
      delivered: 'Entregue',
      sent: 'Enviada',
      failed: 'Falhou',
      pending: 'Pendente',
    };

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (!selectedProject) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <Plus className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Bem-vindo ao GateKit!
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Crie seu primeiro projeto para começar a enviar mensagens
          </p>
          <Button size="lg">
            Criar Primeiro Projeto
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Layers className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Múltiplas Plataformas
              </h3>
              <p className="text-sm text-gray-600">
                Conecte WhatsApp, Discord, Telegram e mais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <Key className="w-8 h-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">API Simples</h3>
              <p className="text-sm text-gray-600">
                Gere chaves e comece a enviar em minutos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Métricas em Tempo Real
              </h3>
              <p className="text-sm text-gray-600">
                Acompanhe entregas e performance
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Visão geral do seu projeto e métricas
          </p>
        </div>
        <Button>
          <MessageSquare className="w-4 h-4" />
          Enviar Mensagem
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    {stat.change && (
                      <p
                        className={cn(
                          'text-sm mt-1',
                          stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {stat.change} vs mês anterior
                      </p>
                    )}
                  </div>
                  <div className={cn('p-3 rounded-lg', stat.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Mensagens Recentes
              </h3>
              <Link
                to="/app/messages"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentMessages.map((message) => (
                <div
                  key={message.id}
                  className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {message.content}
                    </p>
                    <p className="text-xs text-gray-500">
                      {message.platform} • {message.timestamp}
                    </p>
                  </div>
                  <div className="ml-3">{getStatusBadge(message.status)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Plataformas Conectadas
              </h3>
              <Link
                to="/app/platforms"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Gerenciar
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {platforms.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                      <Layers className="w-5 h-5 text-gray-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {platform.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(platform.messages)} mensagens
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">Ativa</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <Link to="/app/keys" className="block">
              <Key className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Chaves de API</h3>
              <p className="text-sm text-gray-600 mb-3">
                Gere e gerencie suas chaves de acesso
              </p>
              <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
                Gerenciar
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <Link to="/app/members" className="block">
              <Users className="w-8 h-8 text-green-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Membros</h3>
              <p className="text-sm text-gray-600 mb-3">
                Convide e gerencie membros da equipe
              </p>
              <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                Ver membros
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <Link to="/app/billing" className="block">
              <TrendingUp className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">Faturamento</h3>
              <p className="text-sm text-gray-600 mb-3">
                Acompanhe uso e gerencie assinatura
              </p>
              <span className="text-sm text-purple-600 font-medium flex items-center gap-1">
                Ver detalhes
                <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
