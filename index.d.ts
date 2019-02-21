
export * from './config';

/// <reference types="mmir-lib" />
import { ASROnStatus, ASROnError, ASRMode } from 'mmir-lib';
import { MediaManagerWebInput, ASREncoderOptions } from 'mmir-plugin-encoder-core';

declare type NuanceASRMode = /* custom Nuance-specific: */ 'DTV-Search';

declare interface ASRNuanceWSOptions extends ASREncoderOptions {
  /**
   * [supported option]
   * set language/country for ASR
   */
  language?: string;

  //TODO enable
  // /**
  //  * [supported option]
  //  * number of n-best results that should (max.) be returned
  //  * @type integer of [1, 10]
  //  */
  // results?: number;
  // /**
  //  * [supported option]
  //  * set recognition mode
  //  */
  // mode?: ASRMode & NuanceASRMode;

  /**
   * custom option: credentials app-key (must be set via configuration or via options)
   */
  appKey?: string;
  /**
   * custom option: credentials app-id (must be set via configuration or via options)
   */
  appId?: string;
  /**
   * custom option: a persistent user pseudonym (should not be traceable/enable reverse-lookup of user); must be URI-encoded/conformant (e.g. user encodeURIComponent())
   */
  userId?: string;

  //TODO enable?
  // /**
  //  * custom option:
  //  * Indicates the source of the audio recording.
  //  * Properly specifying this header improves recognition accuracy.
  //  * Nuance encourages you to pass this header whenever you can -- and as accurately as possible.
  //  */
  // source?: 'SpeakerAndMicrophone' | 'HeadsetInOut' | 'HeadsetBT' | 'HeadPhone' | 'LineOut';
  // // codec: 'speex' | 'wav' NOT SUPPORTED via options
}

declare interface MediaManagerASRNuanceWS extends MediaManagerWebInput {
  recognize: (options?: ASRNuanceWSOptions, statusCallback?: ASROnStatus, failureCallback?: ASROnError, isIntermediateResults?: boolean) => void;
  startRecord: (options?: ASRNuanceWSOptions, successCallback?: ASROnStatus, failureCallback?: ASROnError, intermediateResults?: boolean) => void;
  stopRecord: (options?: ASRNuanceWSOptions, successCallback?: ASROnStatus, failureCallback?: ASROnError) => void;
}