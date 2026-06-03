import { Avatar, Icons } from '@/components'
import { useAgent } from '@/lib/api/agent'
import { useComposer } from '@/store/compose-store'

/**
 * The thin "What's up?" entry at the top of the feed. Opens the compose modal.
 * The avatar uses the viewer handle initial as a fallback (the authed agent
 * does not eagerly carry the avatar URL).
 */
export function ComposerRow() {
  const { handle, avatar } = useAgent()
  const { openCompose } = useComposer()

  return (
    <div className="composer-row" onClick={openCompose}>
      <Avatar size="md" src={avatar} fallback={handle?.charAt(0)} alt={handle} />
      <button type="button" className="composer-row__input" onClick={openCompose}>
        What&rsquo;s up?
      </button>
      <span className="composer-row__pencil">
        <Icons.PencilIcon size={20} />
      </span>
    </div>
  )
}
