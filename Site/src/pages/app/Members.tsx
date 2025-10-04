import { UserPlus, Mail, Shield, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime, getInitials } from '../../lib/utils';

export function Members() {
  const members = [
    {
      id: '1',
      fullName: 'João Silva',
      email: 'joao@empresa.com',
      role: 'client_admin',
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
    },
    {
      id: '2',
      fullName: 'Maria Santos',
      email: 'maria@empresa.com',
      role: 'client_member',
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    },
    {
      id: '3',
      fullName: 'Pedro Costa',
      email: 'pedro@empresa.com',
      role: 'client_member',
      isActive: true,
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
  ];

  const getRoleBadge = (role: string) => {
    const config = {
      client_admin: { variant: 'success' as const, label: 'Administrador' },
      client_member: { variant: 'info' as const, label: 'Membro' },
      system_admin: { variant: 'danger' as const, label: 'Super Admin' },
    };

    const { variant, label } = config[role as keyof typeof config];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const roleDescriptions = [
    {
      role: 'client_admin',
      name: 'Administrador',
      description: 'Acesso total ao projeto, pode gerenciar membros e configurações',
      permissions: [
        'Criar e gerenciar projetos',
        'Convidar e remover membros',
        'Gerenciar chaves de API',
        'Configurar plataformas',
        'Acessar faturamento',
      ],
    },
    {
      role: 'client_member',
      name: 'Membro',
      description: 'Pode enviar mensagens e visualizar dados do projeto',
      permissions: [
        'Enviar mensagens',
        'Visualizar estatísticas',
        'Ver plataformas conectadas',
        'Consultar logs',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Membros da Equipe</h1>
          <p className="text-gray-600 mt-1">
            Gerencie os membros e suas permissões
          </p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4" />
          Convidar Membro
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">
            Membros Ativos ({members.length})
          </h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {getInitials(member.fullName)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-gray-900">
                      {member.fullName}
                    </h4>
                    {getRoleBadge(member.role)}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <span>{member.email}</span>
                    <span>•</span>
                    <span>Membro desde {formatDateTime(member.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Shield className="w-4 h-4" />
                    Permissões
                  </Button>
                  {member.role !== 'client_admin' && (
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Papéis e Permissões</h3>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {roleDescriptions.map((roleDesc) => (
              <div
                key={roleDesc.role}
                className="p-5 border-2 border-gray-200 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {roleDesc.name}
                    </h4>
                    {getRoleBadge(roleDesc.role)}
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  {roleDesc.description}
                </p>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Permissões
                  </p>
                  <ul className="space-y-2">
                    {roleDesc.permissions.map((permission) => (
                      <li
                        key={permission}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <span className="text-green-600 mt-0.5">✓</span>
                        {permission}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Importante sobre Permissões
        </h3>
        <p className="text-sm text-amber-800">
          Ao convidar um membro, escolha cuidadosamente o papel apropriado. Administradores
          têm acesso total ao projeto e podem realizar ações críticas como revogar chaves
          e remover membros. Membros comuns têm acesso limitado apenas para operações
          do dia a dia.
        </p>
      </div>
    </div>
  );
}
