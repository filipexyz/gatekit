import { useState } from 'react';
import { Plus, Copy, Trash2, Eye, EyeOff, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime, maskApiKey, copyToClipboard } from '../../lib/utils';

export function ApiKeys() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const apiKeys = [
    {
      id: '1',
      name: 'Produção - API Principal',
      key: 'gk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
      scopes: ['messages:send', 'messages:read', 'platforms:read'],
      lastUsed: new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: '2',
      name: 'Desenvolvimento - Testes',
      key: 'gk_test_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4',
      scopes: ['messages:send', 'messages:read'],
      lastUsed: new Date(Date.now() - 7200000).toISOString(),
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: '3',
      name: 'Webhook Handler',
      key: 'gk_live_h8g7f6e5d4c3b2a1z9y8x7w6v5u4t3s2',
      scopes: ['messages:read', 'logs:read'],
      lastUsed: null,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  const allScopes = [
    { id: 'messages:send', label: 'Enviar Mensagens', description: 'Permite enviar mensagens' },
    { id: 'messages:read', label: 'Ler Mensagens', description: 'Visualizar mensagens enviadas' },
    { id: 'platforms:read', label: 'Ler Plataformas', description: 'Listar plataformas conectadas' },
    { id: 'platforms:write', label: 'Gerenciar Plataformas', description: 'Criar e modificar plataformas' },
    { id: 'keys:read', label: 'Ler Chaves', description: 'Visualizar chaves de API' },
    { id: 'keys:write', label: 'Gerenciar Chaves', description: 'Criar e revogar chaves' },
    { id: 'stats:read', label: 'Ver Estatísticas', description: 'Acessar métricas e relatórios' },
    { id: 'logs:read', label: 'Ver Logs', description: 'Acessar logs do sistema' },
  ];

  const handleCopy = async (key: string, keyId: string) => {
    await copyToClipboard(key);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const isKeyVisible = (keyId: string) => visibleKeys.has(keyId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chaves de API</h1>
          <p className="text-gray-600 mt-1">
            Gerencie suas chaves de acesso e permissões
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4" />
          Nova Chave
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          Sobre as Chaves de API
        </h3>
        <p className="text-sm text-blue-800">
          As chaves de API são usadas para autenticar suas requisições. Mantenha-as seguras
          e nunca as compartilhe publicamente. Cada chave possui escopos específicos que
          determinam quais operações ela pode realizar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Suas Chaves ({apiKeys.length})
          </h3>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-4">Nenhuma chave de API criada</p>
              <Button>Criar Primeira Chave</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        {apiKey.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        Criada em {formatDateTime(apiKey.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleKeyVisibility(apiKey.id)}
                      >
                        {isKeyVisible(apiKey.id) ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 p-3 bg-white border border-gray-200 rounded-lg font-mono text-sm">
                    <code className="flex-1 text-gray-900">
                      {isKeyVisible(apiKey.id) ? apiKey.key : maskApiKey(apiKey.key)}
                    </code>
                    <button
                      onClick={() => handleCopy(apiKey.key, apiKey.id)}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {copiedKey === apiKey.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {apiKey.scopes.map((scope) => (
                      <Badge key={scope} variant="info">
                        {scope}
                      </Badge>
                    ))}
                  </div>

                  {apiKey.lastUsed ? (
                    <p className="text-xs text-gray-500">
                      Último uso: {formatDateTime(apiKey.lastUsed)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Nunca utilizada</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Escopos Disponíveis
          </h3>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {allScopes.map((scope) => (
              <div key={scope.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold text-xs">
                      {scope.id.split(':')[0].charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm mb-1">
                      {scope.label}
                    </h4>
                    <p className="text-xs text-gray-600">{scope.description}</p>
                    <code className="inline-block mt-2 px-2 py-1 bg-white rounded text-xs text-gray-700 border border-gray-200">
                      {scope.id}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
