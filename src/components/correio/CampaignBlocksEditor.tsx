import { Input, Select } from "../../ui/ui.jsx";
import { Icon } from "../../ui/icons.jsx";
import { GuardButton, GuardIconButton } from "../GuardButton";
import { useGetProducts } from "../../gen/backoffice/hooks/useGetProducts.js";
import { useGetScheduleServices } from "../../gen/backoffice/hooks/useGetScheduleServices.js";
import type { CampaignBlock } from "../../gen/backoffice/types/CampaignBlock";
import { BLOCK_TYPES, blockError, blockIsEmpty, blockLabel, moveItem, newBlock, type BlockType } from "../../lib/campaigns";

const TEXTAREA =
  "w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 px-3 py-2 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition";

/** Produto ou serviço do negócio: escolhe-se de uma lista (o `refId` tem de ser do tenant; o preço lê-se da BD). */
function RefPicker({ block, onChange }: { block: CampaignBlock; onChange: (b: CampaignBlock) => void }) {
  const isProduct = block.type === "product";
  const productsQ = useGetProducts({ query: { enabled: isProduct, retry: false } } as any);
  const servicesQ = useGetScheduleServices({ query: { enabled: !isProduct, retry: false } } as any);
  const options: { id: string; name: string }[] = isProduct
    ? (productsQ.data?.rows ?? []).map((p: any) => ({ id: p.productId, name: p.name }))
    : ((servicesQ.data as any[]) ?? []).filter((s) => s.active !== false).map((s) => ({ id: s.serviceId, name: s.name }));
  const failed = isProduct ? productsQ.isError : servicesQ.isError;
  const label = isProduct ? "Produto" : "Serviço";

  return (
    <div className="space-y-2">
      <Select
        label={label}
        aria-label={label}
        value={block.refId ?? ""}
        onChange={(e: any) => {
          const o = options.find((x) => x.id === e.target.value);
          onChange({ ...block, refId: e.target.value, title: block.title?.trim() ? block.title : (o?.name ?? "") });
        }}
      >
        <option value="">Escolhe…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
      {failed && <p className="text-xs text-red-600 dark:text-red-400">Não foi possível carregar a lista.</p>}
      <Input label="Título no email" value={block.title ?? ""} maxLength={150} onChange={(e: any) => onChange({ ...block, title: e.target.value })} />
      <div>
        <span className="block text-[13px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Texto (opcional)</span>
        <textarea
          aria-label="Texto (opcional)"
          rows={2}
          maxLength={500}
          className={TEXTAREA}
          value={block.text ?? ""}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </div>
      <Input label="Imagem (https://…, opcional)" value={block.imageUrl ?? ""} onChange={(e: any) => onChange({ ...block, imageUrl: e.target.value })} />
      <Input label="Ligação (https://…, opcional)" value={block.url ?? ""} onChange={(e: any) => onChange({ ...block, url: e.target.value })} />
      <p className="text-xs text-zinc-400">O preço sai do negócio no momento do envio — não se escreve aqui.</p>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: CampaignBlock; onChange: (b: CampaignBlock) => void }) {
  switch (block.type) {
    case "title":
      return <Input aria-label="Título" placeholder="Título" maxLength={150} value={block.text ?? ""} onChange={(e: any) => onChange({ ...block, text: e.target.value })} />;
    case "text":
      return (
        <textarea
          aria-label="Texto"
          rows={5}
          maxLength={5000}
          placeholder="Escreve o texto. Uma linha em branco separa parágrafos."
          className={TEXTAREA}
          value={block.text ?? ""}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      );
    case "image":
      return (
        <div className="space-y-2">
          <Input label="Endereço da imagem (https://…)" value={block.url ?? ""} onChange={(e: any) => onChange({ ...block, url: e.target.value })} />
          <Input label="Descrição (para quem não vê a imagem)" value={block.alt ?? ""} onChange={(e: any) => onChange({ ...block, alt: e.target.value })} />
          <Input label="Ligação ao clicar (https://…, opcional)" value={block.linkUrl ?? ""} onChange={(e: any) => onChange({ ...block, linkUrl: e.target.value })} />
        </div>
      );
    case "button":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input label="Texto do botão" maxLength={60} value={block.label ?? ""} onChange={(e: any) => onChange({ ...block, label: e.target.value })} />
          <Input label="Ligação (https://…)" value={block.url ?? ""} onChange={(e: any) => onChange({ ...block, url: e.target.value })} />
        </div>
      );
    default:
      return <RefPicker block={block} onChange={onChange} />;
  }
}

/**
 * Editor de blocos de UMA língua: adicionar, reordenar (subir/descer), remover. Só dados — o HTML gera-se no
 * servidor. Mostra o erro de cada bloco (URL que não é `https:`, botão sem texto…) logo que o bloco tem conteúdo.
 * Escritas atrás de `GuardIconButton`/`GuardButton` com a folha `correio.campanhas`.
 */
export function CampaignBlocksEditor({ blocks, onChange }: { blocks: CampaignBlock[]; onChange: (b: CampaignBlock[]) => void }) {
  const set = (i: number, b: CampaignBlock) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const add = (type: BlockType) => onChange([...blocks, newBlock(type)]);

  return (
    <div className="space-y-3" data-testid="campaign-blocks">
      {blocks.length === 0 && (
        <p className="text-sm text-zinc-500" data-testid="campaign-blocks-empty">
          Sem blocos ainda. Junta um título, um texto, uma imagem, um botão, um produto ou um serviço.
        </p>
      )}
      {blocks.map((b, i) => {
        const err = blockIsEmpty(b) ? null : blockError(b);
        return (
          <div
            key={i}
            data-testid="campaign-block"
            data-block-type={b.type}
            className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-3 space-y-2"
          >
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 flex-1">{blockLabel(b.type)}</span>
              <GuardIconButton leaf="correio.campanhas" icon="arrowUp" label={`Subir bloco ${i + 1}`} disabled={i === 0} onClick={() => onChange(moveItem(blocks, i, i - 1))} />
              <GuardIconButton leaf="correio.campanhas" icon="arrowDown" label={`Descer bloco ${i + 1}`} disabled={i === blocks.length - 1} onClick={() => onChange(moveItem(blocks, i, i + 1))} />
              <GuardIconButton leaf="correio.campanhas" icon="trash" label={`Remover bloco ${i + 1}`} onClick={() => onChange(blocks.filter((_, j) => j !== i))} />
            </div>
            <BlockFields block={b} onChange={(nb) => set(i, nb)} />
            {err && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400" data-testid="campaign-block-error">
                {err}
              </p>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Adicionar bloco">
        {BLOCK_TYPES.map((t) => (
          <AddBlockButton key={t.type} type={t.type} label={t.label} icon={t.icon} onAdd={add} />
        ))}
      </div>
    </div>
  );
}


function AddBlockButton({ type, label, icon, onAdd }: { type: BlockType; label: string; icon: string; onAdd: (t: BlockType) => void }) {
  return (
    <GuardButton leaf="correio.campanhas" size="sm" variant="outline" icon={icon} onClick={() => onAdd(type)} aria-label={`Adicionar ${label.toLowerCase()}`}>
      {label}
    </GuardButton>
  );
}

/** Pré-visualização simples (não é o HTML final do servidor): título, parágrafos, imagem, botão, produto/serviço. */
export function CampaignPreview({ subject, preheader, blocks }: { subject: string; preheader: string; blocks: CampaignBlock[] }) {
  const shown = blocks.filter((b) => !blockIsEmpty(b));
  return (
    <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3" data-testid="campaign-preview">
      <p className="text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
        <Icon name="eye" className="w-3.5 h-3.5" /> Pré-visualização (aproximada)
      </p>
      <div className="mx-auto max-w-md rounded-lg bg-white text-zinc-900 border border-zinc-200 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold break-words" data-testid="preview-subject">{subject.trim() || "(sem assunto)"}</p>
          {preheader.trim() && <p className="text-xs text-zinc-500 break-words">{preheader}</p>}
        </div>
        <hr className="border-zinc-100" />
        {shown.length === 0 && <p className="text-sm text-zinc-400">Sem conteúdo.</p>}
        {shown.map((b, i) => {
          switch (b.type) {
            case "title":
              return <h3 key={i} className="text-lg font-bold break-words">{b.text}</h3>;
            case "text":
              return (
                <div key={i} className="space-y-2 text-sm break-words">
                  {(b.text ?? "").split(/\n\s*\n/).map((p, j) => (
                    <p key={j} className="whitespace-pre-line">{p}</p>
                  ))}
                </div>
              );
            case "image":
              return <p key={i} className="text-xs text-zinc-500 break-all border border-dashed border-zinc-200 rounded p-2">Imagem: {b.alt || b.url}</p>;
            case "button":
              return (
                <p key={i}>
                  <span className="inline-block rounded-lg bg-zinc-900 text-white text-sm px-4 py-2">{b.label}</span>
                </p>
              );
            default:
              return (
                <div key={i} className="rounded-lg border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold break-words">{b.title}</p>
                  {b.text && <p className="text-zinc-600 break-words">{b.text}</p>}
                  <p className="text-xs text-zinc-400">{b.type === "product" ? "Produto" : "Serviço"} — o preço entra ao enviar</p>
                </div>
              );
          }
        })}
      </div>
    </div>
  );
}

