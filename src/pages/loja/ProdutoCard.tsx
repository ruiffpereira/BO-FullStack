import { REVEAL_ON_HOVER } from "../../ui/reveal";
import { Card, Badge, ImgPlaceholder } from "../../ui/ui.jsx";
import { GuardIconButton } from "../../components/GuardButton";
import { fmtEur } from "../../lib/money";
import type { Product } from "../../gen/backoffice/types/Product.js";
import type { ProductImage } from "../../gen/backoffice/types/ProductImage.js";

export const photoUrl = (photo: ProductImage | string | undefined | null) =>
  typeof photo === "string" ? photo : photo?.fileUrl;

// ─── Card ─────────────────────────────────────────────────────────────────────

export function ProdutoCard({
  p,
  lowStockMax,
  onEdit,
  onDelete,
}: {
  p: Product;
  /** Limite de "stock baixo" — vem da API (LJ-05), nunca uma constante do ecrã. */
  lowStockMax: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const low = (p.stock ?? 0) > 0 && (p.stock ?? 0) <= lowStockMax;
  const firstPhoto = photoUrl(p.photos?.[0]);
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group relative"
      onClick={onEdit}
    >
      <div className="relative">
        {firstPhoto ? (
          <img
            src={firstPhoto}
            alt={p.name}
            className="w-full h-36 object-cover"
          />
        ) : (
          <ImgPlaceholder
            label={p.name}
            tint="#2A6FDB"
            rounded="rounded-none"
            className="h-36"
          />
        )}
        <div className="absolute top-2.5 right-2.5">
          {(p.stock ?? 0) === 0 ? (
            <Badge tone="red" dot>
              Esgotado
            </Badge>
          ) : low ? (
            <Badge tone="amber" dot>
              Stock baixo
            </Badge>
          ) : (
            <Badge tone="green" dot>
              Em stock
            </Badge>
          )}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-medium text-zinc-900 dark:text-white text-sm truncate">
          {p.name}
        </h3>
        <p className="text-xs text-zinc-400 mt-0.5">{p.reference ?? "—"}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800">
          <span className="font-semibold text-zinc-900 dark:text-white">
            {fmtEur(Number(p.price))}
          </span>
          <span className="text-[13px] text-zinc-500 tabular-nums">
            {p.stock ?? 0} un.
          </span>
        </div>
      </div>
      {/* Delete button — stops propagation so it doesn't open the modal */}
      <GuardIconButton
        icon="trash"
        label="Eliminar"
        title="Eliminar"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onDelete();
        }}
        className={`absolute top-2 left-2 w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center transition ${REVEAL_ON_HOVER}`}
      />
    </Card>
  );
}
