
/* plugin config definition: used by mmir-plugin-exports to generate module-config.gen.js */

import { MediaManagerPluginEntry } from 'mmir-lib';

/**
 * (optional) entry "asrNuanceWs" in main configuration.json
 * for settings of asrNuanceWs module.
 *
 * Some of these settings can also be specified by using the options argument
 * in the ASR functions of {@link MediaManagerWebInput}, e.g.
 * {@link MediaManagerWebInput#recognize} or {@link MediaManagerWebInput#startRecord}
 * (if specified via the options, values will override configuration settings).
 */
export interface PluginConfig {
  asrNuanceWs?: PluginConfigEntry;
}

export interface PluginConfigEntry extends MediaManagerPluginEntry {

  /** the plugin/module which which will load/use this specific ASR implementation
   * @default mmir-plugin-encoder-core.js
   */
  mod: 'mmir-plugin-encoder-core.js';
  /**
   * the plugin type
   * @default "asr"
   */
  type: 'asr';

  /** OPTIONAL (see mmir-plugin-encoder-core)
   * @default "speex" */
  encoder?: 'speex'; // TODO (enable) 'wav'
  /** credentials application ID (MUST be set via configuration or options) */
  appId?: string;
  /** credentials application key (MUST be set via configuration or options) */
  appKey?: string;
  /** OPTIONAL a persistent user pseudonym (should not be traceable/enable reverse-lookup of user); must be URI-encoded/conformant (e.g. user encodeURIComponent()) */
  userId?: string;

  //TODO enable
  // /** OPTIONAL number of n-best results that should (max.) be returned: integer of [1, 10] */
  // results?: number;
  // /** OPTIONAL  set recognition mode */
  // mode?: 'search' | 'dictation' | 'DTV-Search';

  //TODO enable?
  // /**
  //  * OPTIONAL
  //  * Indicates the source of the audio recording.
  //  * Properly specifying this header improves recognition accuracy.
  //  * Nuance encourages you to pass this header whenever you can -- and as accurately as possible.
  //  */
  // source?: 'SpeakerAndMicrophone' | 'HeadsetInOut' | 'HeadsetBT' | 'HeadPhone' | 'LineOut';

  // /** TODO NOT IMPLEMENTED for encoder (if supported by encoder): */
  // rate?: /*'wav': */    8000 | 16000 | 22000 |
  //        /*'speex': */  8000 | 'nw' | 11025 | 'sw' | 16000 | 'wb';
  // /** (TODO?) NOT IMPLEMENTED / CONFIGURABLE (using const "https://dictation.nuancemobility.net/NMDPAsrCmdServlet/dictation") */
  // baseUrl: string;
}

export enum RemoteUrls {
  baseUrl = 'wss://httpapi.labs.nuance.com/v1'
}
