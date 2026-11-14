// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import { shouldKeepContentAfterDeleteForEveryone } from '../../util/shouldKeepContentAfterDeleteForEveryone.std.ts';

describe('shouldKeepContentAfterDeleteForEveryone', () => {
  const ourAci = generateAci();
  const senderAci = generateAci();
  const received = {
    messageType: 'incoming',
    isStory: false,
    isViewOnce: false,
    deleteSentByAci: senderAci,
    ourAci,
  };

  it('keeps a received message deleted by someone else', () => {
    assert.isTrue(shouldKeepContentAfterDeleteForEveryone(received));
  });

  it('erases our own outgoing message', () => {
    assert.isFalse(
      shouldKeepContentAfterDeleteForEveryone({
        ...received,
        messageType: 'outgoing',
        deleteSentByAci: ourAci,
      })
    );
  });

  it('erases a received message we deleted (admin delete or linked device)', () => {
    assert.isFalse(
      shouldKeepContentAfterDeleteForEveryone({
        ...received,
        deleteSentByAci: ourAci,
      })
    );
  });

  it('erases received stories and view-once messages', () => {
    assert.isFalse(
      shouldKeepContentAfterDeleteForEveryone({ ...received, isStory: true })
    );
    assert.isFalse(
      shouldKeepContentAfterDeleteForEveryone({ ...received, isViewOnce: true })
    );
  });
});
