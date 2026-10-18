import type {
  SourceResolutionInput,
  SourceResolutionResult,
  SourceResolver,
} from './types.js';

/**
 * Instagram Reel acquisition adapter boundary (Section 2.2, FR-008, FR-009, FR-010).
 * Disabled by default until an acquisition method is verified to operate reliably
 * without bypassing login walls, rate limits, or platform protections.
 */
export class InstagramReelAdapter implements SourceResolver {
  readonly platform = 'instagram' as const;
  readonly providerId = 'instagram-public-adapter-v1';

  isEnabled(): boolean {
    return process.env.INSTAGRAM_CONNECTOR_ENABLED === 'true';
  }

  async resolveMetadata(
    _input: SourceResolutionInput
  ): Promise<SourceResolutionResult> {
    if (!this.isEnabled()) {
      return {
        ok: false,
        errorCode: 'CONNECTOR_DISABLED',
        safeErrorDetails:
          'Instagram Reel link acquisition is disabled (INSTAGRAM_CONNECTOR_ENABLED=false) per FR-008/FR-009.',
        userMessage:
          'Direct Instagram Reel fetching is disabled because Instagram requires authenticated access. Paste the Reel transcript instead.',
      };
    }

    return {
      ok: false,
      errorCode: 'SOURCE_UNAVAILABLE',
      safeErrorDetails: 'Instagram public endpoint rejected unauthenticated access.',
      userMessage:
        'Instagram required sign-in to read this Reel. Paste the transcript instead.',
    };
  }
}
