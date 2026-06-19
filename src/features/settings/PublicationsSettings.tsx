import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Button, Img, SettingsListSkeleton } from '@/components'
import { blobUrl } from '@/lib/api/repo-read'
import { usePublicationRecord, pubPath } from '@/features/read/use-publication'
import {
  usePublications,
  useCreatePublication,
  useDeletePublication,
  useSubdomainAvailability,
  subdomainError,
  isValidSubdomain,
  publicationUrl,
  type CreatePublicationInput,
} from '@/features/publish/use-publications'
import type { PublicationReg } from '@/lib/data/publications'
import { Section, Row } from './components'

/**
 * Manage the viewer's publications. A publication is a `site.standard.publication`
 * record in the user's repo, mapped to a globally-unique `<sub>.ovoid.at`
 * subdomain via the data service. Creating one writes the record + registers the
 * subdomain (rolled back together on failure).
 */
export default function PublicationsSettings() {
  const pubs = usePublications()

  return (
    <>
      <ScreenHeader title="Publications" showBack />
      <div className="settings">
        <Section
          title="Your publications"
          desc="Publish long-form articles to your own repo under a custom subdomain. Each publication is a record you own; readers can subscribe to it."
        >
          {pubs.isPending ? (
            <SettingsListSkeleton count={1} trailing />
          ) : pubs.data && pubs.data.length > 0 ? (
            pubs.data.map((reg) => <PublicationRow key={reg.subdomain} reg={reg} />)
          ) : (
            <p className="settings-note settings-pad">You don’t have any publications yet.</p>
          )}
        </Section>

        {(pubs.data?.length ?? 0) < 10 && <CreatePublicationSection />}
      </div>
    </>
  )
}

function PublicationRow({ reg }: { reg: PublicationReg }) {
  const recQ = usePublicationRecord(reg.uri)
  const del = useDeletePublication()
  const rec = recQ.data
  const icon = rec?.record.icon ? blobUrl(rec.pds, rec.did, rec.record.icon.ref.$link) : undefined
  const href = pubPath(reg.uri)

  return (
    <Row
      icon={
        icon ? (
          <span className="pub-row__icon">
            <Img src={icon} alt="" />
          </span>
        ) : (
          <span className="pub-row__icon pub-row__icon--empty" />
        )
      }
      label={rec?.record.name || reg.subdomain}
      sub={`${reg.subdomain}.ovoid.at`}
      trailing={
        <div className="settings-actions">
          {href && (
            <Link to={href} className="btn btn--secondary btn--sm">
              View
            </Link>
          )}
          <Button
            variant="danger"
            size="sm"
            loading={del.isPending}
            onClick={() => {
              if (confirm(`Delete “${rec?.record.name || reg.subdomain}”? The subdomain is freed.`)) {
                del.mutate({ subdomain: reg.subdomain, uri: reg.uri })
              }
            }}
          >
            Delete
          </Button>
        </div>
      }
    />
  )
}

function CreatePublicationSection() {
  const create = useCreatePublication()
  const [name, setName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState<File | null>(null)

  const sub = subdomain.trim().toLowerCase()
  const formatError = subdomainError(sub)
  const avail = useSubdomainAvailability(sub)
  const taken = avail.data != null
  const canSubmit =
    name.trim().length > 0 && isValidSubdomain(sub) && !taken && !avail.isFetching && !create.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const input: CreatePublicationInput = {
      subdomain: sub,
      name,
      description: description.trim() || undefined,
      icon,
    }
    create.mutate(input, {
      onSuccess: () => {
        setName('')
        setSubdomain('')
        setDescription('')
        setIcon(null)
      },
    })
  }

  const subState = !sub
    ? null
    : formatError
      ? { cls: 'pub-hint--bad', text: formatError }
      : avail.isFetching
        ? { cls: 'pub-hint', text: 'Checking availability…' }
        : taken
          ? { cls: 'pub-hint--bad', text: 'That subdomain is taken.' }
          : { cls: 'pub-hint--ok', text: `${publicationUrl(sub).replace('https://', '')} is available` }

  return (
    <Section title="New publication" desc="Pick a name and a subdomain. You can change the icon and description later.">
      <form className="settings-pad pub-form" onSubmit={submit}>
        <label className="pub-field">
          <span className="pub-field__label">Name</span>
          <input
            className="settings-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Publication"
            maxLength={300}
          />
        </label>

        <label className="pub-field">
          <span className="pub-field__label">Subdomain</span>
          <div className="pub-subdomain">
            <input
              className="settings-input"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="my-pub"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <span className="pub-subdomain__suffix">.ovoid.at</span>
          </div>
          {subState && <span className={`pub-hint ${subState.cls}`}>{subState.text}</span>}
        </label>

        <label className="pub-field">
          <span className="pub-field__label">Description (optional)</span>
          <textarea
            className="settings-input pub-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this publication about?"
            rows={2}
            maxLength={3000}
          />
        </label>

        <label className="pub-field">
          <span className="pub-field__label">Icon (optional)</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setIcon(e.target.files?.[0] ?? null)}
          />
        </label>

        {create.isError && (
          <p className="settings-note" style={{ color: 'var(--color-danger)' }}>
            {create.error instanceof Error ? create.error.message : 'Failed to create publication'}
          </p>
        )}

        <div className="settings-actions">
          <Button type="submit" loading={create.isPending} disabled={!canSubmit}>
            Create publication
          </Button>
        </div>
      </form>
    </Section>
  )
}
