/**
 * Size Limit Transform Stream
 *
 * Prevents memory bomb attacks by enforcing maximum size limits on streams.
 * Terminates the stream if it exceeds the specified limit.
 */

import { TransformStream } from 'stream/web';

export class SizeLimitStream extends TransformStream<Uint8Array, Uint8Array> {
  private bytesRead: number = 0;

  constructor(private maxSize: number) {
    super({
      transform: (chunk, controller) => {
        this.bytesRead += chunk.length;

        if (this.bytesRead > maxSize) {
          const error = new Error(
            `Stream exceeded maximum size limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB. ` +
            `Read ${(this.bytesRead / 1024 / 1024).toFixed(2)}MB so far.`
          );
          error.name = 'StreamSizeLimitExceeded';
          controller.error(error);
          return;
        }

        controller.enqueue(chunk);
      },
    });
  }

  getBytesRead(): number {
    return this.bytesRead;
  }
}

/**
 * Create a size-limited readable stream
 *
 * @param stream - Original ReadableStream
 * @param maxSize - Maximum allowed size in bytes
 * @returns Size-limited ReadableStream
 */
export function createSizeLimitedStream(
  stream: ReadableStream<Uint8Array>,
  maxSize: number
): ReadableStream<Uint8Array> {
  const limitStream = new SizeLimitStream(maxSize);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stream.pipeThrough(limitStream as any) as unknown as ReadableStream<Uint8Array>;
}
