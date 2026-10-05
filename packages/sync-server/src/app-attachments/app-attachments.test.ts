import { isAttachmentId, isDangerousContent } from './app-attachments';

describe('isAttachmentId', () => {
  it('accepts a generated id', () => {
    expect(isAttachmentId('0b6f2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b')).toBe(true);
  });

  it('rejects paths and anything that is not an id', () => {
    expect(isAttachmentId('../../etc/passwd')).toBe(false);
    expect(isAttachmentId('0b6f2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b/../x')).toBe(
      false,
    );
    expect(isAttachmentId('')).toBe(false);
    expect(isAttachmentId(null)).toBe(false);
  });
});

describe('isDangerousContent', () => {
  it('refuses programs, scripts and web pages', () => {
    for (const text of [
      'MZ\u0090\u0000',
      '\u007fELF\u0002',
      '#!/bin/sh\nrm -rf /',
      '  <!DOCTYPE html><html>',
      '<script>alert(1)</script>',
      '<svg onload=alert(1)>',
    ]) {
      expect(isDangerousContent(Buffer.from(text, 'latin1'))).toBe(true);
    }
  });

  it('accepts documents and images', () => {
    expect(isDangerousContent(Buffer.from('%PDF-1.7 ...'))).toBe(false);
    expect(
      isDangerousContent(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])),
    ).toBe(false);
    expect(isDangerousContent(Buffer.from('date,amount\n'))).toBe(false);
  });
});
