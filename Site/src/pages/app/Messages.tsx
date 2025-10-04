import { useState } from 'react';
import { Plus, Search, Filter, Download } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../lib/utils';

export function Messages() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const messages = [
    {
      id: '1',
      content: 'Bem-vindo ao nosso sistema! Estamos felizes em tê-lo aqui.',
      platform: 'WhatsApp',
      target: 'user:123',
      status: 'delivered',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      content: 'Seu pedido #4521 foi confirmado e será processado em breve.',
      platform: 'Discord',
      target: 'channel:announcements',
      status: 'sent',
      createdAt: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: '3',
      content: 'Lembrete: Reunião de equipe às 15h',
      platform: 'Telegram',
      target: 'group:team',
      status: 'failed',
      createdAt: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: '4',
      content: 'Nova atualização disponível para seu aplicativo',
      platform: 'WhatsApp',
      target: 'user:456',
      status: 'pending',
      createdAt: new Date(Date.now() - 900000).toISOString(),
    },
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

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      searchQuery === '' ||
      msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.platform.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: messages.length,
    delivered: messages.filter((m) => m.status === 'delivered').length,
    sent: messages.filter((m) => m.status === 'sent').length,
    failed: messages.filter((m) => m.status === 'failed').length,
    pending: messages.filter((m) => m.status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mensagens</h1>
          <p className="text-gray-600 mt-1">
            Gerencie e monitore suas mensagens enviadas
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Enviar Mensagem
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('delivered')}
        >
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-600 mb-1">Entregues</p>
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('sent')}
        >
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-600 mb-1">Enviadas</p>
            <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('failed')}
        >
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-600 mb-1">Falhas</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setStatusFilter('pending')}
        >
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-gray-600 mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            <div className="flex-1 flex gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar mensagens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4" />
                Filtros
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4" />
                Exportar
              </Button>
              {statusFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 mb-1">
                        {message.content}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="font-medium">{message.platform}</span>
                        <span>•</span>
                        <span>{message.target}</span>
                        <span>•</span>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                    </div>
                    <div className="ml-4">{getStatusBadge(message.status)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {filteredMessages.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <p className="text-sm text-gray-600">
                Mostrando {filteredMessages.length} de {messages.length} mensagens
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
