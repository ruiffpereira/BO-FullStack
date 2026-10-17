import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Badge, Button, Input, Tabs, SectionTitle } from "../ui/ui.jsx";
import { useAuth } from "../context/AuthContext";
import { usePageSubtitle } from "../context/PageMetaContext";
import { getApiError } from "../lib/apiError";
import { useGetTeamMe, getTeamMeQueryKey } from "../gen/backoffice/hooks/useGetTeamMe";
import { usePutTeamMe } from "../gen/backoffice/hooks/usePutTeamMe";
import { usePutTeamMePassword } from "../gen/backoffice/hooks/usePutTeamMePassword";

const THEME_TABS = [
  { id: "light", label: "Claro", icon: "sun" },
  { id: "dark", label: "Escuro", icon: "moon" },
];

/**
 * `/perfil` de um MEMBRO da equipa (B41): só o nome, a password e o tema. Nada de dados do negócio, faturação nem
 * acesso de suporte — isso é do dono (`GET /users/me*` devolve 403 `TEAM_OWNER_ONLY` a um membro). O tema de um
 * membro vive só neste dispositivo.
 */
export function PerfilMembro({
  theme,
  onToggleTheme,
}: {
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  const { member } = useAuth();
  usePageSubtitle(member ? `Membro da equipa de ${member.tenantName}.` : "O teu nome, password e tema.");
  const { data, isLoading } = useGetTeamMe();

  return (
    <div className="max-w-2xl space-y-5">
      <NomeCard name={data?.name} email={data?.email} loading={isLoading} />
      <PasswordCard />
      {theme && onToggleTheme && (
        <Card className="p-5 space-y-3">
          <SectionTitle>Tema</SectionTitle>
          <Tabs
            size="sm"
            tabs={THEME_TABS}
            value={theme}
            onChange={(id: string) => {
              if (id !== theme) onToggleTheme();
            }}
          />
          <p className="text-xs text-zinc-400">Fica guardado neste dispositivo.</p>
        </Card>
      )}
      {data?.modules && data.modules.length > 0 && (
        <Card className="p-5 space-y-3">
          <SectionTitle>O que podes usar</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {data.modules.map((m) => (
              <li key={m.key}>
                <Badge tone={m.level === "edit" ? "blue" : "neutral"}>
                  {m.label} · {m.level === "edit" ? "Editar" : "Só ver"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function NomeCard({ name, email, loading }: { name?: string; email?: string; loading: boolean }) {
  const qc = useQueryClient();
  const { updateIdentity } = useAuth();
  const update = usePutTeamMe();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (name !== undefined && !touched) setValue(name);
  }, [name, touched]);

  const dirty = name !== undefined && value.trim() !== name;

  const save = () => {
    if (!value.trim()) {
      toast.error("O nome não pode ficar vazio.");
      return;
    }
    update.mutate(
      { data: { name: value.trim() } },
      {
        onSuccess: () => {
          setTouched(false);
          updateIdentity({ username: value.trim() });
          qc.invalidateQueries({ queryKey: getTeamMeQueryKey() });
          toast.success("Nome guardado.");
        },
        onError: (error) => toast.error(getApiError(error, "Não foi possível guardar o nome.")),
      },
    );
  };

  return (
    <Card className="p-5 space-y-4">
      <SectionTitle>Conta</SectionTitle>
      <Input
        label="Nome"
        value={value}
        disabled={loading}
        onChange={(e: any) => {
          setValue(e.target.value);
          setTouched(true);
        }}
      />
      <Input label="Email" value={email ?? ""} disabled readOnly hint="O email é o do convite; pede ao dono da conta para o mudar." />
      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty} isLoading={update.isPending}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const { setAccessToken } = useAuth();
  const change = usePutTeamMePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  const submit = () => {
    if (!canSubmit) return;
    change.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: (res) => {
          // A API faz bump ao tokenVersion (as outras sessões morrem) e devolve já um token novo para esta.
          if (res?.accessToken) setAccessToken(res.accessToken);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("Password alterada. As sessões dos outros dispositivos foram terminadas.");
        },
        onError: (error) => toast.error(getApiError(error, "Não foi possível mudar a password.")),
      },
    );
  };

  return (
    <Card className="p-5 space-y-4">
      <SectionTitle>Password</SectionTitle>
      <Input
        label="Password atual"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e: any) => setCurrentPassword(e.target.value)}
      />
      <Input
        label="Nova password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e: any) => setNewPassword(e.target.value)}
        hint="Mínimo 8 caracteres."
      />
      <Input
        label="Confirmar nova password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e: any) => setConfirmPassword(e.target.value)}
      />
      <div className="flex justify-end">
        <Button onClick={submit} disabled={!canSubmit} isLoading={change.isPending}>
          Mudar password
        </Button>
      </div>
    </Card>
  );
}
