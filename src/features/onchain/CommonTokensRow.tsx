import clsx from 'clsx'
import { useNftBrowserStore } from '@/store/nft-browser-store'
import { useTezosToken, proxyImage } from '@/components/embeds/providers/objkt-data'
import { useCommonTokens, type CommonToken } from './use-common-tokens'

/**
 * "What we have in common" strip: up to 10 overlapping token-art circles
 * connecting the viewer to `other` — the viewer's creations that the other
 * user collected lead the row with a golden ring, then tokens both hold.
 * Tapping a circle opens the fullscreen NFT browser with the whole strip as
 * its prev/next sequence. Renders nothing while loading, empty, or on the
 * viewer's own profile (the hook disables itself there).
 */
export function CommonTokensRow({ other, onOpen }: { other: string | undefined; onOpen?: () => void }) {
  const q = useCommonTokens(other)
  const openNft = useNftBrowserStore((s) => s.openNft)
  const tokens = q.data ?? []
  if (tokens.length === 0) return null

  const list = tokens.map((t) => ({ fa: t.contract, tokenId: t.token_id }))

  return (
    <div className="ctr" aria-label="Tokens you have in common">
      {tokens.map((t, i) => (
        <CommonTokenCircle
          key={`${t.contract}/${t.token_id}`}
          token={t}
          // Left circle overlaps the one to its right (avatar-stack order).
          z={tokens.length - i}
          onClick={() => {
            openNft(t.contract, t.token_id, list)
            onOpen?.()
          }}
        />
      ))}
    </div>
  )
}

function CommonTokenCircle({
  token,
  z,
  onClick,
}: {
  token: CommonToken
  z: number
  onClick: () => void
}) {
  const preview = useTezosToken(token.contract, token.token_id)
  const img = proxyImage(preview.data?.displayUri, 'tiny') ?? preview.data?.image
  const name = preview.data?.name ?? token.name ?? 'Token'
  const title = token.createdByViewer
    ? `${name} — they collected your work`
    : token.mine
      ? `${name} — you both hold this`
      : name

  return (
    <button
      type="button"
      className={clsx('ctr__item', token.createdByViewer && 'ctr__item--mine')}
      style={{ zIndex: z }}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {img && <img src={img} alt="" loading="lazy" />}
    </button>
  )
}
