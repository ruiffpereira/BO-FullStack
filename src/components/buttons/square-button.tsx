import { Url } from 'next/dist/shared/lib/router/router'
import Link from 'next/link'

export default async function SquareButton({
  buttonText,
  redirectPage,
}: {
  buttonText: string
  redirectPage: Url
}) {
  return (
    <Link
      className="grid cursor-pointer place-items-center gap-2 rounded-lg bg-sky-800 p-4 text-center shadow transition-all hover:bg-sky-900"
      href={redirectPage}
    >
      <h1 className="text-sm text-white">{buttonText}</h1>
    </Link>
  )
}
