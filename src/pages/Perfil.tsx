import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, Button, Input, Tabs, SectionTitle } from "../ui/ui.jsx";
import { Icon } from "../ui/icons.jsx";
import { useAuth } from "../context/AuthContext";
import { usePageSubtitle } from "../context/PageMetaContext";
import { GuardButton } from "../components/GuardButton";
import { FileUpload } from "../components/FileUpload";
import { getApiError } from "../lib/apiError";
import { useGetUsersMe, getUsersMeQueryKey } from "../gen/backoffice/hooks/useGetUsersMe";
import { usePutUsersMe } from "../gen/backoffice/hooks/usePutUsersMe";
import { usePutUsersMePassword } from "../gen/backoffice/hooks/usePutUsersMePassword";
import { uploadImage } from "../gen/backoffice/hooks/useUploadImage.js";
import type { GetUsersMe200 } from "../gen/backoffice/types/GetUsersMe";
import { useGetSettingsLanguages, usePutSettingsLanguages } from "../hooks/useSettingsLanguages";
import { LangFlag } from "../utils/langFlag";
import { type UiThemeChoice } from "../lib/uiTheme";

const THEME_TABS: { id: UiThemeChoice; label: string; icon: string }[] = [
  { id: "light", label: "Claro", icon: "sun" },
  { id: "dark", label: "Escuro", icon: "moon" },
  { id: "system", label: "Sistema", icon: "settings" },
];

/**
 * Página `/perfil` (T3.3, `.design/shell-nav-perfil/`). Core, FORA da sidebar
 * — acede-se pelo menu do avatar no topbar (`Shell.tsx`, `AvatarMenu`), como o
 * `/despesas` é deep-link sem item de menu próprio (`Shell.tsx` acrescenta-o
 * a `guardRoots` para o guard de rotas não o expulsar para o dashboard).
 *
 * 4 cartões, todos sobre o PRÓPRIO tenant (`GET/PUT /users/me`, `PUT
 * /users/me/password` — nunca outro utilizador, `req.user` sempre): Conta,
 * Password, Preferências, Logótipo.
 */
export function Perfil() {
  const { data, isLoading, isError } = useGetUsersMe();
  usePageSubtitle("Os teus dados, password e preferências.");

  return (
    <div className="max-w-2xl space-y-5">
      {isLoading && (
        <Card className="p-5 space-y-3">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        </Card>
      )}

      {!isLoading && isError && (
        <Card role="status" className="p-4 flex items-start gap-3 border-amber-200 dark:border-amber-900/50">
          <Icon name="alertTriangle" className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-zinc-800 dark:text-zinc-100">Não foi possível carregar o perfil</p>
            <p className="text-zinc-500 mt-0.5">Tenta novamente daqui a pouco.</p>
          </div>
        </Card>
      )}

      {!isLoading && (
        <>
          <ContaCard data={data} />
          <PasswordCard />
          <PreferenciasCard data={data} />
          <LogoCard data={data} />
        </>
      )}
    </div>
  );
}

// ── Conta ──────────────────────────────────────────────────────────────────

function ContaCard({ data }: { data?: GetUsersMe200 }) {
  const qc = useQueryClient();
  const { updateIdentity } = useAuth();
  const updateMe = usePutUsersMe();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  // Re-sincroniza os campos quando os dados do servidor chegam/mudam (mesmo
  // padrão do `TrialSettingsEditor` em `AdminBilling.tsx`).
  useEffect(() => {
    if (!data) return;
    setName(data.name ?? "");
    setEmail(data.email ?? "");
    setPhone(data.phone ?? "");
  }, [data?.name, data?.email, data?.phone]);

  const originalEmail = data?.email ?? "";
  const emailChanged = email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
  const nameValid = name.trim().length > 0;
  const emailValid = email.trim().length > 0;
  const dirty =
    !!data &&
    (name.trim() !== (data.name ?? "") || phone.trim() !== (data.phone ?? "") || emailChanged);

  const onSave = () => {
    if (!nameValid || !emailValid) {
      toast.error("Nome e email não podem ficar vazios.");
      return;
    }
    if (emailChanged && !currentPassword) {
      toast.error("Introduz a password atual para mudar o email.");
      return;
    }
    updateMe.mutate(
      {
        data: {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim(),
          ...(emailChanged ? { currentPassword } : {}),
        },
      },
      {
        onSuccess: (res) => {
          setCurrentPassword("");
          // Mantém o avatar/topbar (AuthContext) coerentes com a edição, sem
          // precisar de logout/login — ver docstring de `updateIdentity`.
          updateIdentity({ username: res.name, email: res.email });
          qc.invalidateQueries({ queryKey: getUsersMeQueryKey() });
          toast.success("Dados da conta guardados.");
        },
        onError: (error) => toast.error(getApiError(error, "Não foi possível guardar os dados.")),
      },
    );
  };

  return (
    <Card className="p-5 space-y-4">
      <SectionTitle>Conta</SectionTitle>
      <Input label="Nome do negócio" value={name} onChange={(e: any) => setName(e.target.value)} />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e: any) => setEmail(e.target.value)}
        hint={emailChanged ? "Mudar o email exige a tua password atual." : undefined}
      />
      {emailChanged && (
        <Input
          label="Password atual (para mudar o email)"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e: any) => setCurrentPassword(e.target.value)}
        />
      )}
      <Input label="Telefone" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
      <div className="flex justify-end">
        <GuardButton onClick={onSave} disabled={!dirty} isLoading={updateMe.isPending}>
          Guardar
        </GuardButton>
      </div>
    </Card>
  );
}

// ── Password ───────────────────────────────────────────────────────────────

function PasswordCard() {
  const { setAccessToken } = useAuth();
  const changePassword = usePutUsersMePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const newPasswordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPasswordValid && passwordsMatch;

  const onSubmit = () => {
    if (!canSubmit) return;
    changePassword.mutate(
      { data: { currentPassword, newPassword } },
      {
        onSuccess: (res) => {
          // CRÍTICO: a API faz bump ao `tokenVersion` (invalida de imediato o
          // access token desta e de qualquer outra sessão) mas devolve já, na
          // mesma resposta, um par de tokens NOVO para esta sessão continuar
          // ligada (refresh token novo em cookie HttpOnly + accessToken no
          // corpo). Sem adotar este accessToken agora, o PRÓXIMO pedido
          // autenticado ainda usaria o antigo (já inválido) e levava 401 — o
          // interceptor do AuthContext recuperaria via refresh (o cookie já
          // está atualizado), mas só depois de uma volta extra. `setAccessToken`
          // (AuthContext) adota o token já e realinha o temporizador de
          // refresh automático com a validade real deste token novo.
          if (res.accessToken) setAccessToken(res.accessToken);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          toast.success("Password alterada. Sessão dos outros dispositivos foi terminada.");
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
      {/* Sem GuardButton de propósito: a API não gate este endpoint pelo
          billing (ver `PUT /users/me/password` em `userRoutes.ts`, API) — um
          tenant read-only por dívida tem de conseguir trocar a password
          (ex.: sessão comprometida) sem ficar bloqueado por 402. */}
      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={!canSubmit} isLoading={changePassword.isPending}>
          Mudar password
        </Button>
      </div>
    </Card>
  );
}

// ── Preferências ───────────────────────────────────────────────────────────

function PreferenciasCard({ data }: { data?: GetUsersMe200 }) {
  const qc = useQueryClient();
  const updateMe = usePutUsersMe();
  const [theme, setThemeState] = useState<UiThemeChoice>("system");

  useEffect(() => {
    if (data?.uiTheme) setThemeState(data.uiTheme);
  }, [data?.uiTheme]);

  // Persiste de imediato ao mudar (sem botão Guardar próprio); grava a
  // escolha (incl. "system", que o toggle do topbar nunca escolhe sozinho).
  // Reverte otimisticamente se o PUT falhar. Quem aplica de facto o tema
  // visual (classe `dark` do `<html>`) é o `useThemeSync` (`src/hooks/`,
  // T3.4) em `App.tsx` — reage a esta MESMA query key
  // (`getUsersMeQueryKey()`) via a cache partilhada do React Query, por
  // isso o `invalidateQueries` abaixo já é suficiente para o topbar (e
  // qualquer outra página) ficar coerente sem duplicar lógica aqui.
  const onThemeChange = (next: UiThemeChoice) => {
    const prev = theme;
    if (next === prev) return;
    setThemeState(next);
    updateMe.mutate(
      { data: { uiTheme: next } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getUsersMeQueryKey() });
          toast.success("Preferência de tema guardada.");
        },
        onError: (error) => {
          setThemeState(prev);
          toast.error(getApiError(error, "Não foi possível guardar o tema."));
        },
      },
    );
  };

  const { data: langData } = useGetSettingsLanguages();
  const saveLangs = usePutSettingsLanguages();
  const available = langData?.available ?? [];
  const selected = langData?.selected ?? [];
  const defaultLang = langData?.default ?? "";

  const onSetDefaultLang = (code: string) => {
    if (code === defaultLang) return;
    saveLangs.mutate(
      { languages: selected, default: code },
      {
        onSuccess: () => toast.success("Língua padrão guardada."),
        onError: (error) =>
          toast.error(getApiError(error, "Não foi possível guardar a língua padrão.")),
      },
    );
  };

  return (
    <Card className="p-5 space-y-5">
      <SectionTitle>Preferências</SectionTitle>

      <div className="space-y-2">
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Tema</p>
        <Tabs
          size="sm"
          tabs={THEME_TABS}
          value={theme}
          onChange={(id: string) => onThemeChange(id as UiThemeChoice)}
        />
      </div>

      {selected.length > 0 && (
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Língua padrão</p>
          <div className="flex flex-wrap gap-2">
            {selected.map((code) => {
              const lang = available.find((l) => l.code === code);
              const isDefault = code === defaultLang;
              return (
                <button
                  key={code}
                  type="button"
                  disabled={saveLangs.isPending}
                  onClick={() => onSetDefaultLang(code)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition select-none ${
                    isDefault
                      ? "border-accent bg-accent text-white font-semibold shadow-sm cursor-default"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-accent/50"
                  }`}
                >
                  <LangFlag code={code} className={`h-4 w-auto rounded-sm ${isDefault ? "shadow-sm" : ""}`} />
                  <span>{lang?.name ?? code}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Logótipo ───────────────────────────────────────────────────────────────

function LogoCard({ data }: { data?: GetUsersMe200 }) {
  const qc = useQueryClient();
  const updateMe = usePutUsersMe();
  const [logo, setLogo] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPasteMode, setLogoPasteMode] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLogo(data?.logoUrl ?? "");
  }, [data?.logoUrl]);

  // Upload diferido (mesmo padrão do logótipo da Marca em `Website.tsx`): o
  // ficheiro escolhido só é enviado ao clicar "Guardar logótipo".
  const onSave = async () => {
    let logoUrl: string | null = logo.trim() || null;
    if (logoFile) {
      setUploading(true);
      try {
        const { fileUrl } = await uploadImage({ image: logoFile, module: "profile" });
        logoUrl = fileUrl;
      } catch (err: any) {
        toast.error(err?.message ?? "Erro ao carregar o logótipo");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    updateMe.mutate(
      { data: { logoUrl } },
      {
        onSuccess: () => {
          setLogoFile(null);
          qc.invalidateQueries({ queryKey: getUsersMeQueryKey() });
          toast.success("Logótipo guardado.");
        },
        onError: (error) => toast.error(getApiError(error, "Não foi possível guardar o logótipo.")),
      },
    );
  };

  return (
    <Card className="p-5 space-y-4">
      <SectionTitle>Logótipo</SectionTitle>
      <FileUpload
        module="profile"
        currentUrl={logo.trim() || null}
        deferred
        disabled={uploading || updateMe.isPending}
        onFileSelected={(file) => setLogoFile(file)}
        onDeleted={() => {
          setLogo("");
          setLogoFile(null);
        }}
        label="Carregar logótipo"
      />
      {logoPasteMode ? (
        <Input
          placeholder="https://…/logo.png"
          icon="link"
          value={logo}
          onChange={(e: any) => {
            setLogo(e.target.value);
            setLogoFile(null);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setLogoPasteMode(true)}
          className="text-xs text-zinc-400 hover:text-accent underline underline-offset-2"
        >
          ou cola um URL
        </button>
      )}
      <div className="flex justify-end">
        <Button onClick={onSave} isLoading={uploading || updateMe.isPending}>
          Guardar logótipo
        </Button>
      </div>
    </Card>
  );
}
