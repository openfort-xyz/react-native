import type { OpenfortEmbeddedEthereumWalletProvider } from '../types/wallet'

/**
 * EIP-712 domain fields in canonical order.
 *
 * `eth_signTypedData_v4` requires an explicit `EIP712Domain` entry in `types`, but
 * the typed data produced by most contract libraries (ethers, viem, Safe/Zodiac,
 * GnosisPay account-kit, ...) omits it. We re-add only the fields that are present,
 * in canonical order, so the digest matches what the verifying contract computes.
 */
const EIP712_DOMAIN_FIELDS: { name: string; type: string }[] = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
  { name: 'salt', type: 'bytes32' },
]

/**
 * Ethers-style EIP-712 typed data (i.e. without an `EIP712Domain` entry in `types`).
 */
export interface TypedDataInput {
  /** EIP-712 domain separator fields (e.g. `chainId`, `verifyingContract`). */
  domain: Record<string, unknown>
  /** Struct definitions, keyed by type name (no `EIP712Domain` needed). */
  types: Record<string, { name: string; type: string }[]>
  /** The primary struct being signed. */
  primaryType: string
  /** The values for the primary struct. */
  message: Record<string, unknown>
}

function domainTypes(domain: Record<string, unknown>): { name: string; type: string }[] {
  return EIP712_DOMAIN_FIELDS.filter((field) => domain[field.name] !== undefined)
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}

/**
 * Sign EIP-712 typed data with an embedded wallet via `eth_signTypedData_v4`.
 *
 * Pass typed data in the ethers/viem shape (`{ domain, types, primaryType, message }`)
 * exactly as produced by contract SDKs. This helper re-adds the required `EIP712Domain`
 * type (in canonical field order) and serializes any `bigint` values, so the resulting
 * signature recovers correctly on-chain.
 *
 * The wallet should be an EOA (`AccountTypeEnum.EOA`) so the signature is plain ECDSA;
 * smart-account owners require ERC-1271 contract signatures, which this does not produce.
 *
 * @param provider - EIP-1193 provider from a connected embedded Ethereum wallet
 * @param address - The signer address (the active embedded wallet)
 * @param typedData - Ethers-style typed data: `{ domain, types, primaryType, message }`
 * @returns The hex signature
 *
 * @example
 * ```ts
 * import { signTypedData, useEmbeddedEthereumWallet } from '@openfort/react-native'
 *
 * const wallet = useEmbeddedEthereumWallet()
 * if (wallet.status === 'connected') {
 *   const signature = await signTypedData(wallet.provider, wallet.activeWallet.address, {
 *     domain: { name: 'MyApp', version: '1', chainId: 1, verifyingContract: '0xCcCC...' },
 *     primaryType: 'Mail',
 *     types: { Mail: [{ name: 'contents', type: 'string' }] },
 *     message: { contents: 'Hello, Openfort' },
 *   })
 * }
 * ```
 */
export async function signTypedData(
  provider: OpenfortEmbeddedEthereumWalletProvider,
  address: string,
  typedData: TypedDataInput
): Promise<string> {
  const payload = JSON.stringify(
    {
      domain: typedData.domain,
      primaryType: typedData.primaryType,
      types: { EIP712Domain: domainTypes(typedData.domain), ...typedData.types },
      message: typedData.message,
    },
    bigintReplacer
  )

  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [address.toLowerCase(), payload],
  })

  return signature as string
}
