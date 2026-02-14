// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType } from '../../types/Util.std.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';
import { putStickers } from '../../textsecure/WebAPI.preload.js';

type RisibankMedia = {
  cache_url: string;
};

type RisibankCollection = {
  id: number;
  name: string;
  media_count: number;
  total_interact_count: number;
  user: {
    username_custom: string;
  };
  preview_medias: Array<RisibankMedia>;
};

type RisibankCollectionFull = RisibankCollection & {
  medias: Array<RisibankMedia>;
};

export type Props = {
  readonly i18n: LocalizerType;
};

const API_BASE = 'https://risibank.fr/api/v1';
const DEBOUNCE_MS = 300;

// -- Crypto helpers (same algorithm as sticker-creator/src/util/crypto.ts) --

const PACK_KEY_SIZE = 32;
const PACK_KEY_SALT = new Uint8Array(32);
const PACK_KEY_INFO = new TextEncoder().encode('Sticker Pack');
const IV_SIZE = 16;

type EncryptKeys = { aesKey: CryptoKey; macKey: CryptoKey };

async function deriveKeys(packKey: Uint8Array): Promise<EncryptKeys> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    packKey,
    'HKDF',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'hkdf', hash: 'SHA-256', salt: PACK_KEY_SALT, info: PACK_KEY_INFO },
    baseKey,
    8 * 64
  );
  const aesKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(bits, 0, 32),
    'AES-CBC',
    false,
    ['encrypt']
  );
  const macKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(bits, 32, 32),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return { aesKey, macKey };
}

async function encryptAttachment(
  plaintext: Uint8Array,
  keys: EncryptKeys
): Promise<Uint8Array> {
  const iv = new Uint8Array(IV_SIZE);
  crypto.getRandomValues(iv);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, keys.aesKey, plaintext)
  );
  const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.length);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(ciphertext, iv.length);
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', keys.macKey, ivAndCiphertext)
  );
  const result = new Uint8Array(ivAndCiphertext.length + mac.length);
  result.set(ivAndCiphertext);
  result.set(mac, ivAndCiphertext.length);
  return result;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

// -- Image conversion: resize to 512x512 WebP, max 300KB --

const STICKER_SIZE = 512;
const MAX_STICKER_BYTES = 300 * 1024;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function convertToWebP(url: string): Promise<Uint8Array> {
  const img = await loadImage(url);

  const canvas = document.createElement('canvas');
  canvas.width = STICKER_SIZE;
  canvas.height = STICKER_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Fit image into 512x512, centered, transparent background
  ctx.clearRect(0, 0, STICKER_SIZE, STICKER_SIZE);
  const scale = Math.min(STICKER_SIZE / img.width, STICKER_SIZE / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (STICKER_SIZE - w) / 2;
  const y = (STICKER_SIZE - h) / 2;
  ctx.drawImage(img, x, y, w, h);

  // Try WebP at decreasing quality until under 300KB
  let quality = 0.9;
  while (quality > 0.1) {
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (blob && blob.size <= MAX_STICKER_BYTES) {
      return new Uint8Array(await blob.arrayBuffer());
    }
    quality -= 0.1;
  }

  // Fallback: PNG (for very small/simple images)
  const pngBlob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (pngBlob) {
    return new Uint8Array(await pngBlob.arrayBuffer());
  }

  throw new Error('Failed to convert image');
}

// -- Install logic --

async function installRisibankCollection(
  medias: Array<RisibankMedia>,
  collection: RisibankCollection,
  setInstalling: (id: number | null) => void
): Promise<void> {
  setInstalling(collection.id);
  try {
    if (medias.length === 0) {
      throw new Error('Collection has no stickers');
    }

    // 1. Convert all images to 512x512 WebP
    const imageBuffers: Array<Uint8Array> = [];
    for (const media of medias) {
      const webp = await convertToWebP(media.cache_url);
      imageBuffers.push(webp);
    }

    // 2. Generate pack key + derive encryption keys
    const packKey = new Uint8Array(PACK_KEY_SIZE);
    crypto.getRandomValues(packKey);
    const keys = await deriveKeys(packKey);

    // 3. Build protobuf manifest
    const manifestProto = Proto.StickerPack.encode({
      title: collection.name,
      author: collection.user.username_custom,
      stickers: medias.map((_m, idx) => ({ id: idx, emoji: '\u{1F60A}' })),
      cover: { id: 0, emoji: '\u{1F60A}' },
    }).finish();

    // 4. Encrypt manifest + all images
    const encryptedManifest = await encryptAttachment(manifestProto, keys);
    const encryptedImages = await Promise.all(
      imageBuffers.map(buf => encryptAttachment(buf, keys))
    );

    // 5. Upload to Signal CDN
    const packId = await putStickers(encryptedManifest, encryptedImages);

    // 6. Install the pack locally (key must be base64 — decryptSticker uses Bytes.fromBase64)
    const b64Key = toBase64(packKey);
    await window.Events.installStickerPack(packId, b64Key);

    // eslint-disable-next-line no-console
    console.log(
      `Risibank pack installed: id=${packId} key=${b64Key} (${medias.length} stickers)`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to install Risibank collection:', err);
  } finally {
    setInstalling(null);
  }
}

// -- Detail view: shows all stickers in a collection --

function CollectionDetail({
  collection,
  onBack,
  installingId,
  onInstall,
}: {
  collection: RisibankCollection;
  onBack: () => void;
  installingId: number | null;
  onInstall: (medias: Array<RisibankMedia>, collection: RisibankCollection) => void;
}) {
  const [medias, setMedias] = React.useState<Array<RisibankMedia> | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const resp = await fetch(`${API_BASE}/collections/${collection.id}`);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const full: RisibankCollectionFull = await resp.json();
        if (!cancelled) {
          setMedias(full.medias ?? full.preview_medias ?? []);
        }
      } catch (_err) {
        if (!cancelled) {
          setMedias([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collection.id]);

  return (
    <div className="risibank-detail">
      <div className="risibank-detail__header">
        <button
          type="button"
          className="risibank-detail__back"
          onClick={onBack}
        >
          &larr;
        </button>
        <div className="risibank-detail__title">
          <div className="risibank-detail__name">{collection.name}</div>
          <div className="risibank-detail__author">
            by {collection.user.username_custom}
          </div>
        </div>
        <button
          type="button"
          className="risibank-browser__install-btn risibank-detail__install-btn"
          disabled={installingId != null || !medias || medias.length === 0}
          onClick={() => medias && onInstall(medias, collection)}
        >
          {installingId === collection.id ? 'Installing...' : 'Install'}
        </button>
      </div>
      <div className="risibank-detail__stickers">
        {loadingDetail && (
          <div className="risibank-browser__loading">Loading...</div>
        )}
        {!loadingDetail && medias && medias.length === 0 && (
          <div className="risibank-browser__empty">No stickers found.</div>
        )}
        {!loadingDetail &&
          medias &&
          medias.length > 0 &&
          medias.map((media, idx) => (
            <img
              key={idx}
              className="risibank-detail__sticker-img"
              src={media.cache_url}
              alt=""
              loading="lazy"
            />
          ))}
      </div>
    </div>
  );
}

// -- Main component --

export const RisibankCollectionBrowser = React.memo(
  function RisibankCollectionBrowserInner({ i18n }: Props) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [collections, setCollections] = React.useState<
      Array<RisibankCollection>
    >([]);
    const [loading, setLoading] = React.useState(false);
    const [installingId, setInstallingId] = React.useState<number | null>(null);
    const [selectedCollection, setSelectedCollection] =
      React.useState<RisibankCollection | null>(null);
    const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    const fetchCollections = React.useCallback(async (query: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort: 'hot', page: '1' });
        if (query.trim()) {
          params.set('search', query.trim());
        }
        const response = await fetch(
          `${API_BASE}/collections?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const items: Array<RisibankCollection> = Array.isArray(data)
          ? data
          : data.collections ?? [];
        setCollections(items);
      } catch (_err) {
        setCollections([]);
      } finally {
        setLoading(false);
      }
    }, []);

    React.useEffect(() => {
      void fetchCollections('');
    }, [fetchCollections]);

    const handleSearchChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          void fetchCollections(value);
        }, DEBOUNCE_MS);
      },
      [fetchCollections]
    );

    React.useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    const handleInstall = React.useCallback(
      (medias: Array<RisibankMedia>, collection: RisibankCollection) => {
        if (installingId != null) {
          return;
        }
        void installRisibankCollection(medias, collection, setInstallingId);
      },
      [installingId]
    );

    // Detail view
    if (selectedCollection) {
      return (
        <div className="risibank-browser">
          <CollectionDetail
            collection={selectedCollection}
            onBack={() => setSelectedCollection(null)}
            installingId={installingId}
            onInstall={handleInstall}
          />
        </div>
      );
    }

    // Grid view
    return (
      <div className="risibank-browser">
        <div className="risibank-browser__search">
          <input
            type="text"
            className="risibank-browser__search-input"
            placeholder="Search Risibank collections..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <div className="risibank-browser__content">
          {loading && (
            <div className="risibank-browser__loading">Loading...</div>
          )}
          {!loading && collections.length === 0 && (
            <div className="risibank-browser__empty">
              No collections found.
            </div>
          )}
          {!loading && collections.length > 0 && (
            <div className="risibank-browser__grid">
              {collections.map(collection => (
                <div
                  key={collection.id}
                  className="risibank-browser__card"
                  onClick={() => setSelectedCollection(collection)}
                >
                  <div className="risibank-browser__card-previews">
                    {collection.preview_medias
                      .slice(0, 4)
                      .map((media, idx) => (
                        <img
                          key={idx}
                          className="risibank-browser__card-preview-img"
                          src={media.cache_url}
                          alt=""
                          loading="lazy"
                        />
                      ))}
                  </div>
                  <div className="risibank-browser__card-info">
                    <div className="risibank-browser__card-name">
                      {collection.name}
                    </div>
                    <div className="risibank-browser__card-meta">
                      {collection.user.username_custom} &middot;{' '}
                      {collection.media_count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
