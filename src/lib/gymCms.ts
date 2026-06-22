// Helpers de tradução (CMS).
// Um nome traduzível guarda um `contentKey`; o valor na língua padrão fica no
// CMS (fallback) e as outras línguas editam-se no CmsTranslationsModal.
// A criação da entrada acontece no Guardar do formulário (não há passo "criar"
// separado): se não houver `contentKey`, gera-se um e grava-se o nome padrão.
import { putCmsEntries } from '../gen/backoffice/hooks/usePutCmsEntries.js'
import { getCmsEntriesQueryKey } from '../gen/backoffice/hooks/useGetCmsEntries.js'
import { queryClient } from './queryClient'

/** Gera uma chave CMS estável para um contexto (ex: gym, service, product). */
export const genCmsKey = (context: string) => `${context}.${crypto.randomUUID()}`

/**
 * Garante que existe um `contentKey` e grava o nome na língua padrão no CMS.
 * Devolve a chave (a existente ou uma nova). Chamar no Guardar do formulário.
 */
export async function ensureCmsName(
  contentKey: string | null | undefined,
  context: string,
  name: string,
  defaultLang: string,
): Promise<string> {
  const isNew = !contentKey
  const key = contentKey || genCmsKey(context)
  await putCmsEntries({ key, locale: defaultLang, value: name.trim(), type: 'text' })
  // Só ao CRIAR uma entrada nova: refresca a pesquisa/listagem para aparecer sem refresh.
  if (isNew) {
    queryClient.invalidateQueries({ queryKey: ['cms-search'] })
    queryClient.invalidateQueries({ queryKey: getCmsEntriesQueryKey() })
  }
  return key
}
