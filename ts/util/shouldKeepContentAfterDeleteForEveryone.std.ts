// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.ts';

// Messages we received that someone else deleted for everyone keep their
// contents locally (shown grayed as "Deleted"). Our own deletions, from any of
// our devices, still erase.
export function shouldKeepContentAfterDeleteForEveryone({
  messageType,
  isStory,
  isViewOnce,
  deleteSentByAci,
  ourAci,
}: Readonly<{
  messageType: string | undefined;
  isStory: boolean;
  isViewOnce: boolean;
  deleteSentByAci: AciString;
  ourAci: AciString | undefined;
}>): boolean {
  return (
    messageType === 'incoming' &&
    !isStory &&
    !isViewOnce &&
    // Unknown own ACI: we can't rule out our own delete, so erase
    ourAci != null &&
    deleteSentByAci !== ourAci
  );
}
