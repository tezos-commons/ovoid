/**
 * CID → per-CID subdomain origin, computed locally.
 *
 * Interactive artifacts run on dweb.link's per-CID *subdomain* origins
 * (`https://<cidv1-base32>.ipfs.dweb.link`). The interactive bridge pins
 * postMessage traffic to that exact origin, so the parent must derive it
 * itself rather than relying on the gateway's path→subdomain redirect —
 * a frame that self-navigates elsewhere must never match. CIDv0 (Qm…,
 * base58btc multihash) is re-encoded as CIDv1 base32 (0x01 0x70 dag-pb +
 * multihash), which is what the gateway uses as the DNS label.
 */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Decode(s: string): Uint8Array | undefined {
  const out: number[] = []
  for (const c of s) {
    let carry = B58.indexOf(c)
    if (carry < 0) return undefined
    for (let i = 0; i < out.length; i++) {
      carry += out[i] * 58
      out[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      out.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (const c of s) {
    if (c !== '1') break
    out.push(0)
  }
  return Uint8Array.from(out.reverse())
}

function base32Encode(bytes: Uint8Array): string {
  const A = 'abcdefghijklmnopqrstuvwxyz234567'
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += A[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += A[(value << (5 - bits)) & 31]
  return out
}

/** DNS label for a CID as used by subdomain gateways, or undefined if the CID
 *  form isn't one we can convert (then only the redirecting path gateway works). */
export function cidToSubdomainLabel(cid: string): string | undefined {
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) {
    const multihash = base58Decode(cid)
    if (!multihash) return undefined
    const v1 = new Uint8Array(multihash.length + 2)
    v1[0] = 0x01
    v1[1] = 0x70
    v1.set(multihash, 2)
    return 'b' + base32Encode(v1)
  }
  if (/^b[a-z2-7]+$/.test(cid)) return cid
  return undefined
}

/** `ipfs://<cid>[/path]` → direct `https://<label>.ipfs.dweb.link/path` URL. */
export function ipfsSubdomainUrl(uri: string | undefined | null): string | undefined {
  if (!uri?.startsWith('ipfs://')) return undefined
  const rest = uri.slice('ipfs://'.length)
  const cut = rest.search(/[/?#]/)
  const cid = cut === -1 ? rest : rest.slice(0, cut)
  const label = cidToSubdomainLabel(cid)
  if (!label) return undefined
  const tail = cut === -1 ? '/' : rest.slice(cut)
  return `https://${label}.ipfs.dweb.link${tail.startsWith('/') ? tail : '/' + tail}`
}

/**
 * The exact origin the interactive bridge may talk to for a given iframe src.
 * Only per-CID subdomain origins qualify — path-gateway or ipns srcs get no
 * bridge (mutable content must not inherit consent bound to immutable code).
 *
 * Dev builds additionally allow localhost origins (the /interactive-test/dev
 * loop against a locally served artifact); import.meta.env.DEV is statically
 * false in production, so that branch is compiled out of release bundles.
 */
export function interactiveFrameOrigin(src: string | undefined | null): string | undefined {
  if (!src) return undefined
  try {
    const u = new URL(src)
    if (u.protocol === 'https:' && /^b[a-z2-7]+\.ipfs\.dweb\.link$/.test(u.hostname)) {
      return u.origin
    }
    if (import.meta.env.DEV && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      return u.origin
    }
  } catch {
    /* not a URL */
  }
  return undefined
}
