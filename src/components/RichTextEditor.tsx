import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { promptDialog } from './confirm'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function Divider() {
  return <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-0.5 shrink-0" />
}

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className={`p-1.5 rounded text-sm font-medium transition shrink-0 ${
        active
          ? 'bg-accent/15 text-accent dark:text-accent'
          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </button>
  )
}

// SVG icons as components
const Svg = ({ d, ...rest }: { d: string; [k: string]: unknown }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" {...(rest as any)}>
    <path d={d} />
  </svg>
)

export function RichTextEditor({ value, onChange, placeholder = 'Escreve aqui…' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'underline text-accent' } }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'rte-content focus:outline-none min-h-[180px] max-h-[420px] overflow-y-auto px-3 py-2.5',
      },
    },
  })

  if (!editor) return null

  const setLink = async () => {
    const prev = editor.getAttributes('link').href ?? ''
    const url = await promptDialog({ title: 'Inserir link', label: 'URL', placeholder: 'https://…', defaultValue: prev, confirmLabel: 'Aplicar' })
    if (url === null) return
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 bg-white dark:bg-zinc-900">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60">
        {/* Inline */}
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito (Ctrl+B)">
          <strong className="text-xs leading-none">B</strong>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico (Ctrl+I)">
          <em className="text-xs leading-none">I</em>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Sublinhado (Ctrl+U)">
          <span className="text-xs leading-none underline">U</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Riscado">
          <span className="text-xs leading-none line-through">S</span>
        </Btn>

        <Divider />

        {/* Headings */}
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1">
          <span className="text-xs font-bold leading-none">H1</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2">
          <span className="text-xs font-bold leading-none">H2</span>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3">
          <span className="text-xs font-bold leading-none">H3</span>
        </Btn>

        <Divider />

        {/* Lists */}
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-4 h-4">
            <circle cx="5" cy="7" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none" />
            <path d="M9 7h10M9 12h10M9 17h10" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-4 h-4">
            <path d="M10 7h10M10 12h10M10 17h10" />
            <text x="3" y="8.5" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">1</text>
            <text x="3" y="13.5" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">2</text>
            <text x="3" y="18.5" fontSize="6" fill="currentColor" stroke="none" fontWeight="bold">3</text>
          </svg>
        </Btn>

        <Divider />

        {/* Blockquote */}
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M3 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4H4a1 1 0 0 1 0-2h1a2 2 0 0 0 2-2H5a2 2 0 0 1-2-2zm10 0a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4h-1a1 1 0 0 1 0-2h1a2 2 0 0 0 2-2h-2a2 2 0 0 1-2-2z" />
          </svg>
        </Btn>

        <Divider />

        {/* Link */}
        <Btn onClick={setLink} active={editor.isActive('link')} title="Link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M10 13a5 5 0 0 0 7.5.7l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7" />
            <path d="M14 11a5 5 0 0 0-7.5-.7l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" />
          </svg>
        </Btn>

        <Divider />

        {/* Align */}
        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinhar à esquerda">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-4 h-4">
            <path d="M3 6h18M3 11h12M3 16h18M3 21h12" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-4 h-4">
            <path d="M3 6h18M6 11h12M3 16h18M6 21h12" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinhar à direita">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-4 h-4">
            <path d="M3 6h18M9 11h12M3 16h18M9 21h12" />
          </svg>
        </Btn>

        <Divider />

        {/* Table */}
        <Btn onClick={insertTable} title="Inserir tabela">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
        </Btn>
        {editor.isActive('table') && (
          <>
            <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Adicionar coluna">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="3" y="3" width="10" height="18" rx="1" />
                <path d="M17 12h4M19 10v4" />
              </svg>
            </Btn>
            <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="Adicionar linha">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect x="3" y="3" width="18" height="10" rx="1" />
                <path d="M12 17v4M10 19h4" />
              </svg>
            </Btn>
            <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="Eliminar tabela">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-500">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18M9 9l6 6M15 9l-6 6" />
              </svg>
            </Btn>
          </>
        )}

        <Divider />

        {/* Undo / Redo */}
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Desfazer (Ctrl+Z)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 7v6h6" />
            <path d="M3 13A9 9 0 1 0 6 6.3L3 13" />
          </svg>
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Refazer (Ctrl+Y)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M21 7v6h-6" />
            <path d="M21 13A9 9 0 1 1 18 6.3L21 13" />
          </svg>
        </Btn>
      </div>

      {/* ── Editor area ── */}
      <style>{`
        .rte-content { color: inherit; }
        .rte-content p { margin: 0.4em 0; }
        .rte-content h1 { font-size: 1.5em; font-weight: 700; margin: 0.6em 0 0.3em; }
        .rte-content h2 { font-size: 1.25em; font-weight: 700; margin: 0.6em 0 0.3em; }
        .rte-content h3 { font-size: 1.1em; font-weight: 600; margin: 0.5em 0 0.25em; }
        .rte-content strong { font-weight: 700; }
        .rte-content em { font-style: italic; }
        .rte-content u { text-decoration: underline; }
        .rte-content s { text-decoration: line-through; }
        .rte-content ul { list-style: disc; padding-left: 1.4em; margin: 0.4em 0; }
        .rte-content ol { list-style: decimal; padding-left: 1.4em; margin: 0.4em 0; }
        .rte-content li { margin: 0.15em 0; }
        .rte-content blockquote { border-left: 3px solid #a1a1aa; padding-left: 0.8em; margin: 0.5em 0; color: #71717a; font-style: italic; }
        .rte-content a { text-decoration: underline; color: var(--color-accent, #2563eb); }
        .rte-content table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
        .rte-content table td, .rte-content table th { border: 1px solid #d4d4d8; padding: 0.4em 0.6em; min-width: 2em; }
        .rte-content table th { background: #f4f4f5; font-weight: 600; }
        .rte-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #a1a1aa; pointer-events: none; float: left; height: 0; }
        @media (prefers-color-scheme: dark) {
          .rte-content blockquote { border-color: #52525b; color: #a1a1aa; }
          .rte-content table td, .rte-content table th { border-color: #3f3f46; }
          .rte-content table th { background: #27272a; }
        }
        .dark .rte-content blockquote { border-color: #52525b; color: #a1a1aa; }
        .dark .rte-content table td, .dark .rte-content table th { border-color: #3f3f46; }
        .dark .rte-content table th { background: #27272a; }
      `}</style>
      <EditorContent editor={editor} />
    </div>
  )
}
