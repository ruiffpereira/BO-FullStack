/**
 * Pré-visualização do cartão de partilha (B38 · P3): como a página aparece no Facebook/WhatsApp/LinkedIn (cartão
 * grande, imagem 1,91:1) e no X (`summary_large_image`). A imagem é a da página ou, sem ela, a do site (definições
 * do site) — a mesma regra do kit. O tamanho mede-se no browser (a API não guarda dimensões): fora de ~1200×630
 * aparece um aviso, nunca um bloqueio.
 */
import { useEffect, useState } from "react";
import { Seg } from "./EditorBits";

// ── puro, testável ─────────────────────────────────────────────────────────────

export const SHARE_IDEAL = { w: 1200, h: 630 } as const;
/** Abaixo disto o Facebook mostra o cartão pequeno (ou nenhum). */
export const SHARE_MIN = { w: 600, h: 315 } as const;
const IDEAL_RATIO = SHARE_IDEAL.w / SHARE_IDEAL.h;

/** Aviso para pessoas sobre o tamanho medido, ou `null` se está bem. */
export function shareSizeWarning(size: { w: number; h: number } | null): string | null {
  if (!size || size.w <= 0 || size.h <= 0) return null;
  const dims = `${size.w}×${size.h}`;
  if (size.w < SHARE_MIN.w || size.h < SHARE_MIN.h) {
    return `A imagem tem ${dims}: é pequena demais para o cartão grande. Usa 1200×630.`;
  }
  const ratio = size.w / size.h;
  if (Math.abs(ratio - IDEAL_RATIO) / IDEAL_RATIO > 0.1) {
    return `A imagem tem ${dims}: vai ser cortada no cartão (o formato é 1200×630, mais larga do que alta).`;
  }
  return null;
}

/** Imagem de partilha efectiva: a da página, senão a do site; `fromSite` diz qual foi. */
export function effectiveShareImage(pageImage: string | null | undefined, siteImage: string | null | undefined): { url: string; fromSite: boolean } | null {
  if (pageImage) return { url: pageImage, fromSite: false };
  if (siteImage) return { url: siteImage, fromSite: true };
  return null;
}

/** Dimensões naturais da imagem no browser (`null` enquanto carrega, sem URL ou se falhar). */
export function useImageSize(url: string | null | undefined): { w: number; h: number } | null {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    setSize(null);
    if (!url) return;
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => {
      alive = false;
      img.onload = null;
    };
  }, [url]);
  return size;
}

// ── UI ─────────────────────────────────────────────────────────────────────────

interface Props {
  image: string | null;
  /** A imagem é a do site (a página não tem). */
  fromSite?: boolean;
  alt?: string;
  title: string;
  description: string;
  siteName: string;
}

export function SharePreview({ image, fromSite, alt, title, description, siteName }: Props) {
  const [net, setNet] = useState<"facebook" | "x">("facebook");
  const size = useImageSize(image);
  const warn = shareSizeWarning(size);
  const name = siteName || "O teu site";
  const pic = image ? (
    <img src={image} alt={alt || ""} className="block aspect-[1.91/1] w-full object-cover bg-zinc-100 dark:bg-zinc-800" />
  ) : (
    <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-zinc-100 px-4 text-center text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      Sem imagem: o cartão sai pequeno, só com texto.
    </div>
  );

  return (
    <div data-testid="share-preview">
      <div className="mb-2">
        <Seg label="Rede" value={net} options={[{ id: "facebook", label: "Facebook" }, { id: "x", label: "X" }]} onChange={(id) => setNet(id as "facebook" | "x")} />
      </div>
      {net === "facebook" ? (
        <div className="max-w-md overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950" data-testid="share-card-facebook">
          {pic}
          <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="truncate text-[11px] uppercase tracking-wide text-zinc-500">{name}</div>
            <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{title || "Sem título"}</div>
            {description && <div className="line-clamp-1 text-[13px] text-zinc-500">{description}</div>}
          </div>
        </div>
      ) : (
        <div className="max-w-md" data-testid="share-card-x">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700">
            {pic}
            <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded bg-black/70 px-1.5 py-0.5 text-[12px] text-white">{title || "Sem título"}</span>
          </div>
          <div className="mt-1 truncate text-[12px] text-zinc-500">{siteName ? `De ${siteName}` : "Do teu site"}</div>
        </div>
      )}
      <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {fromSite && <span>Esta página não tem imagem própria: usa a imagem de partilha do site.</span>}
        {size && !warn && <span>Imagem {size.w}×{size.h} — bom tamanho para partilhar.</span>}
        {warn && <span role="alert" data-testid="share-size-warning" className="font-medium text-amber-700 dark:text-amber-300">{warn}</span>}
      </div>
    </div>
  );
}
