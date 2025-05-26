import { use } from 'react'

export default function Loading({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  return <div>info {id}</div>
}
