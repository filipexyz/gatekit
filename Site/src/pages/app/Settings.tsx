import { Save, Trash2, Bell, Shield, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert } from '../../components/ui/Alert';

export function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-1">
          Gerencie as configurações do seu projeto
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">
              Informações do Projeto
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input label="Nome do Projeto" defaultValue="Meu Projeto Principal" />
            <Input label="Slug" defaultValue="meu-projeto-principal" disabled />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Descrição
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Descreva brevemente seu projeto..."
                defaultValue="Projeto principal para envio de mensagens automatizadas"
              />
            </div>
            <Button>
              <Save className="w-4 h-4" />
              Salvar Alterações
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Alertas de Falha</p>
                <p className="text-sm text-gray-600">
                  Receber notificação quando mensagens falharem
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Limite de Uso</p>
                <p className="text-sm text-gray-600">
                  Avisar quando atingir 80% do limite mensal
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Novos Membros</p>
                <p className="text-sm text-gray-600">
                  Notificar quando um novo membro entrar no projeto
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <Button variant="outline">
              <Save className="w-4 h-4" />
              Salvar Preferências
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Segurança</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900 mb-2">
                Autenticação de Dois Fatores
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Adicione uma camada extra de segurança à sua conta
              </p>
              <Button variant="outline">Ativar 2FA</Button>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900 mb-2">Sessões Ativas</p>
              <p className="text-sm text-gray-600 mb-4">
                Gerencie os dispositivos com acesso à sua conta
              </p>
              <Button variant="outline">Ver Sessões</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Zona de Perigo</h3>
          </div>
        </CardHeader>
        <CardContent>
          <Alert variant="danger" className="mb-4">
            <strong>Atenção:</strong> As ações abaixo são irreversíveis e podem
            resultar em perda permanente de dados.
          </Alert>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border-2 border-red-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Excluir Projeto</p>
                <p className="text-sm text-gray-600">
                  Remove permanentemente este projeto e todos os dados associados
                </p>
              </div>
              <Button variant="danger">Excluir Projeto</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
