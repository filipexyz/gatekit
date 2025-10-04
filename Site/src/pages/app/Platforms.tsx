import React from 'react';
import { useState } from 'react';
import { Plus, Settings, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { FaWhatsapp, FaDiscord, FaTelegram, FaSlack, FaEnvelope, FaSms } from 'react-icons/fa';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../lib/utils';

export function Platforms() {
  const platforms = [
    {
      id: '1',
      name: 'WhatsApp Business',
      type: 'whatsapp',
      status: 'active',
      messages: 8542,
      lastActivity: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Discord Bot Principal',
      type: 'discord',
      status: 'active',
      messages: 2156,
      lastActivity: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '3',
      name: 'Telegram Notifications',
      type: 'telegram',
      status: 'error',
      messages: 1760,
      lastActivity: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const platformTypes = [
    {
      type: 'whatsapp',
      name: 'WhatsApp',
      description: 'Envie mensagens via WhatsApp Business API',
      available: true,
    },
    {
      type: 'discord',
      name: 'Discord',
      description: 'Integração com servidores Discord via bot',
      available: true,
    },
    {
      type: 'telegram',
      name: 'Telegram',
      description: 'Envie mensagens via Telegram Bot API',
      available: true,
    },
    {
      type: 'slack',
      name: 'Slack',
      description: 'Integração com workspaces do Slack',
      available: true,
    },
    {
      type: 'email',
      name: 'Email',
      description: 'Envio de emails transacionais',
      available: false,
    },
    {
      type: 'sms',
      name: 'SMS',
      description: 'Envio de SMS via operadoras',
      available: false,
    },
  ];

  const getStatusBadge = (status: string) => {
    const config = {
      active: { variant: 'success' as const, label: 'Ativa', icon: CheckCircle },
      inactive: { variant: 'default' as const, label: 'Inativa', icon: XCircle },
      error: { variant: 'danger' as const, label: 'Erro', icon: XCircle },
    };

    const { variant, label, icon: Icon } = config[status as keyof typeof config];

    return (
      <Badge variant={variant}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const getPlatformIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <FaWhatsapp className="w-8 h-8 text-green-500" />;
      case 'discord':
        return <FaDiscord className="w-8 h-8 text-indigo-500" />;
      case 'telegram':
        return <FaTelegram className="w-8 h-8 text-blue-400" />;
      case 'slack':
        return <FaSlack className="w-8 h-8 text-purple-500" />;
      case 'email':
        return <FaEnvelope className="w-8 h-8 text-gray-500" />;
      case 'sms':
        return <FaSms className="w-8 h-8 text-pink-500" />;
      default:
        return (
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
            {type.charAt(0).toUpperCase()}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plataformas</h1>
          <p className="text-gray-600 mt-1">
            Conecte e gerencie suas plataformas de mensagens
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Adicionar Plataforma
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Plataformas Conectadas
          </h3>
        </CardHeader>
        <CardContent>
          {platforms.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-4">
                Nenhuma plataforma conectada ainda
              </p>
              <Button>Adicionar Primeira Plataforma</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {platforms.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {getPlatformIcon(platform.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-base font-semibold text-gray-900">
                        {platform.name}
                      </h4>
                      {getStatusBadge(platform.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{platform.messages.toLocaleString('pt-BR')} mensagens</span>
                      <span>•</span>
                      <span>Última atividade: {formatDateTime(platform.lastActivity)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                      Configurar
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Plataformas Disponíveis
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformTypes.map((platform) => (
              <div
                key={platform.type}
                className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 flex items-center justify-center">
                    {getPlatformIcon(platform.type)}
                  </div>
                  {!platform.available && (
                    <Badge variant="default">Em breve</Badge>
                  )}
                </div>

                <h4 className="font-semibold text-gray-900 mb-1">
                  {platform.name}
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  {platform.description}
                </p>

                {platform.available ? (
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4" />
                    Conectar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    Em breve
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
