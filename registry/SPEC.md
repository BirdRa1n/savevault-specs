# Registry distribution — v1 (draft)

The registry distributes game profiles to clients as **static, signed files**. It needs no API and no database, and it does not depend on the Community website or the Supabase backend. Clients keep working offline with their cached copy.

- Schemas: [`root`](schema/root.v1.schema.json), [`index`](schema/index.v1.schema.json), [`bundle`](schema/bundle.v1.schema.json), [`signature`](schema/signature.v1.schema.json)
- Examples: [`examples/`](examples/)
- Signing vectors: [`test-vectors/signing.json`](test-vectors/signing.json) (regenerate with `node scripts/gen-registry-vectors.mjs`)

## 1. Layout

All paths are relative to a **base URL**, for example `https://registry.example.org/v1/`:

```
root.json                 current root metadata
root.json.sig
roots/<N>.json            every root version ever published (N = 1, 2, …)
roots/<N>.json.sig
channels/<channel>/index.json
channels/<channel>/index.json.sig
channels/<channel>/bundles/<channel>-<sequence, 6+ digits>.json.zst
```

Bundles are immutable: a published bundle path is never overwritten. Servers **SHOULD** send `ETag` headers, and clients **SHOULD** use `If-None-Match`.

A client is configured with an ordered list of **mirrors**, which are alternative base URLs. Signatures make the mirrors interchangeable: a client tries them in order and accepts the first response that verifies.

## 2. Keys and signatures

- **Algorithm:** Ed25519 (RFC 8032). Public keys are the raw 32 bytes, base64-encoded.
- **`keyId`:** the first 16 lower-case hex characters of SHA-256 over the raw public key.
- **Signature files:** `<file>.sig` contains detached signatures over the **exact bytes** of `<file>`. Clients **MUST NOT** re-serialize, normalize or otherwise transform a document before verifying it.
- **Two roles:**
  - **Root keys** are kept offline. They sign root metadata only.
  - **Online keys** are held by the release pipeline. They sign channel indexes for the channels listed in their `channels` field (`*` means all channels).
- **Trust anchor:** clients embed the root keys of one root version, usually `roots/1.json`, at build time.

## 3. Root rotation

`roots/<N+1>.json` **MUST** carry valid signatures from at least `rootThreshold` distinct **root keys of version N**. Its `version` **MUST** be N+1.

Clients update their trusted root as follows:

1. Start from the embedded or last trusted root, version N.
2. Fetch `roots/<N+1>.json` and its signature.
3. If it is missing, stop: N is current.
4. Verify it with version N's root keys and threshold, then trust it and repeat from step 2.

This lets maintainers replace any key without shipping a new app. A compromised online key is removed by publishing a new root that no longer lists it.

## 4. Channel indexes

`index.json` describes the current state of one channel. Before replacing its cached index, a client **MUST**:

1. verify `index.json.sig` with an online key listed in the trusted root whose `channels` include this channel;
2. check that `channel` equals the requested channel;
3. reject the index if `sequence` is **lower** than the last sequence accepted for this channel (anti-rollback). An equal sequence means nothing changed;
4. check `minAppVersion`. If the app is older, it keeps the cache and tells the user to update.

If `expires` is in the past, the client **MUST** still accept the index and **SHOULD** warn that the registry looks stale (anti-freeze). Expiry never makes profiles unusable, because offline use is a hard requirement.

## 5. Bundles

1. The client downloads `bundle.path`, resolved relative to the channel directory. Absolute URLs are invalid.
2. It verifies `size` and `sha256` against the compressed bytes.
3. It decompresses with zstd and aborts if the output exceeds `uncompressedSize`.
4. It validates the result against `bundle.v1`, checks that `channel` and `sequence` equal the index's, and validates every profile, including the path-safety rules.

A profile that fails validation is dropped, with a warning. The other profiles are still used.

Clients keep at least the **3 most recent** verified bundles per channel, so they can fall back to an older one.

`notices` carry license and attribution texts. Clients **MUST** make them visible to the user, for example on an About screen.

## 6. Revocation and rollback

- **Revoking a profile revision:** an index lists it in `revoked`. Clients stop using that revision and fall back to the newest older revision of the same profile they have cached. If there is none, the game shows as unsupported.
- **Rolling back a whole channel:** maintainers publish a **new** sequence whose bundle contains the older content. Sequences never decrease.
- **Pinning:** users can pin a profile to a cached revision. Pins are local and survive updates, except for revoked revisions.

## 7. Channels

| Channel | Content | Default |
|---|---|---|
| `official` | Profiles reviewed and approved by maintainers | on |
| `upstream-ludusavi` | Ludusavi manifest converted to profile v1 (license CC-BY-NC-SA-3.0) | on |
| `community-experimental` | Contributions that are not yet approved, signed by a dedicated key | off; opt-in with a warning |

When channels overlap, the precedence is local > `official` > `community-experimental` > `upstream-ludusavi` (see profile/SPEC.md §9). Experimental profiles are used only when the user opted in.

## 8. Client algorithm (summary)

```
trusted_root = update_root_chain(embedded_root)
for channel in enabled_channels:
    index, sig = fetch_from_mirrors("channels/<channel>/index.json")
    verify(sig, index_bytes, trusted_root.onlineKeys for channel)
    if index.sequence < last_seq[channel]: reject
    if index.sequence == last_seq[channel]: continue
    bundle = fetch_from_mirrors(index.bundle.path)
    check size, sha256; decompress ≤ uncompressedSize; validate
    store bundle; keep 3 newest; last_seq[channel] = index.sequence
apply revocations; rebuild profile index; show notices
```

Any failure leaves the previous cache in place. Clients never end up with fewer usable profiles because a network request failed.
