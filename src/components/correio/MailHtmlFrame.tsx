import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildMailFrameDoc, inlineCidImages, MAIL_FRAME_SANDBOX } from "../../lib/mail";

/**
 * HTML de um email recebido, isolado num `iframe`. O HTML já vem saneado da API (sem scripts, `on*`, `javascript:`,
 * imagens remotas trocadas por um marcador); aqui ficam três camadas extra: `sandbox` SEM `allow-scripts`, uma CSP no
 * documento (`img-src data:` — `https:` só depois do clique em «Mostrar imagens») e links a abrir noutro separador.
 * `cidImages` = imagens inline já resolvidas (data URI) pelo `cid`.
 */
export function MailHtmlFrame({
  html,
  allowRemoteImages,
  cidImages,
  title = "Conteúdo do email",
}: {
  html: string;
  allowRemoteImages: boolean;
  cidImages?: Record<string, string>;
  title?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const roRef = useRef<ResizeObserver | null>(null);

  const srcDoc = useMemo(
    () => buildMailFrameDoc(inlineCidImages(html, cidImages ?? {}), allowRemoteImages),
    [html, cidImages, allowRemoteImages],
  );

  // Sem scripts dentro do iframe, a altura mede-se por fora (mesma origem, só para leitura).
  const measure = useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (!doc?.documentElement) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (h > 0) setHeight(Math.min(h, 20000));
  }, []);

  const onLoad = useCallback(() => {
    measure();
    roRef.current?.disconnect();
    const doc = ref.current?.contentDocument;
    if (doc?.documentElement && typeof ResizeObserver !== "undefined") {
      roRef.current = new ResizeObserver(() => measure());
      roRef.current.observe(doc.documentElement);
    }
  }, [measure]);

  useEffect(() => () => roRef.current?.disconnect(), []);

  return (
    <iframe
      ref={ref}
      title={title}
      data-testid="mail-html-frame"
      sandbox={MAIL_FRAME_SANDBOX}
      srcDoc={srcDoc}
      onLoad={onLoad}
      referrerPolicy="no-referrer"
      style={{ height }}
      className="block w-full rounded-lg border-0 bg-white"
    />
  );
}
