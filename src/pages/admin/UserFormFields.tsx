import { Icon } from "../../ui/icons.jsx";
import { Input } from "../../ui/ui.jsx";
import { Combobox } from "../../components/Combobox";
import type { Permission } from "../../gen/backoffice/types/Permission.js";

// ─── Utilizadores tab ─────────────────────────────────────────────────────────
export type UserForm = {
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  permissionId: string;
  websiteDomain: string;
};
export const emptyUserForm: UserForm = {
  name: "",
  ownerName: "",
  email: "",
  phone: "",
  permissionId: "",
  websiteDomain: "",
};

export function UserFormFields({
  form,
  setForm,
  permissions,
  isEdit = false,
  isPlatformAdmin = false,
}: {
  form: UserForm;
  setForm: (f: UserForm) => void;
  permissions: Permission[];
  isEdit?: boolean;
  /** Conta do admin (vem do servidor): a permissão é fixa, não se escolhe. */
  isPlatformAdmin?: boolean;
}) {
  // Roles protegidas (admin) nunca se atribuem a outra conta — o servidor recusa.
  const assignable = permissions.filter((p) => !p.protected);
  return (
    <div className="space-y-4">
      <Input
        label="Nome"
        value={form.name}
        onChange={(e: any) => setForm({ ...form, name: e.target.value })}
        placeholder="Nome"
      />
      <Input
        label="Nome do dono"
        value={form.ownerName}
        onChange={(e: any) => setForm({ ...form, ownerName: e.target.value })}
        placeholder="Nome da pessoa"
        hint="A pessoa dona do negócio. Dá-lhe uma caixa de correio pessoal (nome.código@…); sem isto a caixa não se cria."
        maxLength={100}
      />
      <Input
        label="Email"
        type="email"
        value={form.email}
        onChange={(e: any) => setForm({ ...form, email: e.target.value })}
        placeholder="email@exemplo.com"
      />
      <Input
        label="Telemóvel"
        type="tel"
        value={form.phone}
        onChange={(e: any) => setForm({ ...form, phone: e.target.value })}
        placeholder="912 345 678"
      />
      {!isEdit && (
        <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-3.5 py-3">
          <Icon name="mail" className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            O utilizador receberá um email para criar a sua palavra-passe.
          </p>
        </div>
      )}
      {/* Na edição o domínio muda-se pelo modal "Domínio do site". */}
      {!isEdit && (
        <Input
          label="Website do cliente (opcional)"
          value={form.websiteDomain}
          onChange={(e: any) => setForm({ ...form, websiteDomain: e.target.value })}
          placeholder="exemplo.pt"
        />
      )}
      <div>
        <p className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Permissão
        </p>
        {isPlatformAdmin ? (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300">
            <Icon name="lock" className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>Admin — fixo</span>
          </div>
        ) : (
          <Combobox
            value={form.permissionId}
            onChange={(v) => setForm({ ...form, permissionId: v })}
            options={[
              { value: "", label: "Seleccionar permissão" },
              ...assignable.map((p) => ({ value: p.permissionId, label: p.name })),
            ]}
            placeholder="Seleccionar permissão"
            searchPlaceholder="Pesquisar permissão…"
          />
        )}
      </div>
    </div>
  );
}
