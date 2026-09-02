import { create } from 'zustand'
import type { TezosOp } from '@/lib/tezos/wallet-session'

/**
 * A pending interactive-artifact wallet operation. The bridge fills a request
 * and awaits it; WalletOpDialog drives the connect → verify-address → confirm →
 * sign flow and settles with the operation hash or an error string. Unlike the
 * consent store this returns DATA (the op hash), and there is only ever one
 * pending wallet op — a second request while one is open is rejected 'busy'.
 */

export interface WalletOpRequest {
  origin: string
  title?: string
  ops: TezosOp[]
  /** The user's linked Tezos address — the ONLY wallet an operation may use. */
  linkedAddress: string
}

export type WalletOpResult = { ok: true; opHash: string } | { ok: false; error: string }

interface Pending extends WalletOpRequest {
  settle: (r: WalletOpResult) => void
}

interface WalletOpState {
  current: Pending | null
  request: (req: WalletOpRequest) => Promise<string>
  settle: (r: WalletOpResult) => void
}

export const useWalletOpStore = create<WalletOpState>((set, get) => ({
  current: null,
  request(req) {
    if (get().current) return Promise.reject(new Error('busy'))
    return new Promise<string>((resolve, reject) => {
      const settle = (r: WalletOpResult) => {
        set({ current: null })
        r.ok ? resolve(r.opHash) : reject(new Error(r.error))
      }
      set({ current: { ...req, settle } })
    })
  },
  settle(r) {
    get().current?.settle(r)
  },
}))
