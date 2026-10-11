'use client';

// Web NFC type declarations
declare global {
  interface Window {
    NDEFReader?: new () => NDEFReaderInstance;
  }

  interface NDEFReaderInstance {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    write(
      message: { records: { recordType: string; data?: string | BufferSource }[] },
      options?: { overwrite?: boolean; signal?: AbortSignal }
    ): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onreadingerror: ((event: Event) => void) | null;
  }

  interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: { records: NDEFRecordData[] };
  }

  interface NDEFRecordData {
    recordType: string;
    mediaType?: string;
    data?: DataView;
    encoding?: string;
    lang?: string;
  }
}

export function isNFCSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export function generateNFCUrl(slug: string, baseUrl?: string): string {
  const base =
    baseUrl ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://fiscus.app');
  return `${base}/t/${slug}`;
}

export async function writeNFCTag(
  slug: string,
  baseUrl?: string
): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error(
      'Web NFC no está soportado en este navegador. Usa Chrome en Android.'
    );
  }

  const url = generateNFCUrl(slug, baseUrl);
  const ndef = new window.NDEFReader!();

  await ndef.write({
    records: [{ recordType: 'url', data: url }],
  });
}

export async function readNFCTag(
  onRead: (url: string | null, serialNumber: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!isNFCSupported()) {
    throw new Error(
      'Web NFC no está soportado en este navegador. Usa Chrome en Android.'
    );
  }

  const ndef = new window.NDEFReader!();
  await ndef.scan({ signal });

  ndef.onreading = (event) => {
    const decoder = new TextDecoder();
    let url: string | null = null;

    for (const record of event.message.records) {
      if (record.recordType === 'url' && record.data) {
        url = decoder.decode(record.data);
        break;
      }
    }

    onRead(url, event.serialNumber);
  };
}
