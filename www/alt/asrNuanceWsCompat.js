;(function (root, factory) {

	//mmir legacy mode: use pre-v4 API of mmir-lib
	var _isLegacyMode3 = true;
	var _isLegacyMode4 = true;
	var mmirName = typeof MMIR_CORE_NAME === 'string'? MMIR_CORE_NAME : 'mmir';
	var _mmir = root[mmirName];
	if(_mmir){
		//set legacy-mode if version is < v4 (isVersion() is available since v4)
		_isLegacyMode3 = _mmir.isVersion? _mmir.isVersion(4, '<') : true;
		_isLegacyMode4 = _mmir.isVersion? _mmir.isVersion(5, '<') : true;
	}
	var _req = _mmir? _mmir.require : require;

	var getId, isArray;
	if(_isLegacyMode3 || _isLegacyMode4){
		isArray = _req((_isLegacyMode3? '': 'mmirf/') + 'util/isArray');
		// HELPER: backwards compatibility v4 for module IDs
		getId = function(ids){
			if(isArray(ids)){
				return ids.map(function(id){ return getId(id);});
			}
			return ids? ids.replace(/\bresources$/, 'constants') : ids;
		};
		var __req = _req;
		_req = function(deps, id, success, error){
			var args = [getId(deps), getId(id), success, error];
			return __req.apply(null, args);
		};
	}

	if(_isLegacyMode3){
		// HELPER: backwards compatibility v3 for module IDs
		var __getId = getId;
		getId = function(ids){
			if(isArray(ids)) return __getId(ids);
			return ids? __getId(ids).replace(/^mmirf\//, '') : ids;
		};
		//HELPER: backwards compatibility v3 for configurationManager.get():
		var config = _req('configurationManager');
		if(!config.__get){
			config.__get = config.get;
			config.get = function(propertyName, useSafeAccess, defaultValue){
				return this.__get(propertyName, defaultValue, useSafeAccess);
			};
		}
	}

	if(_isLegacyMode3 || _isLegacyMode4){

		//backwards compatibility v3 and v4:
		//  plugin instance is "exported" to global var newMediaPlugin
		root['newWebAudioAsrImpl'] = factory(_req);

	} else {

		if (typeof define === 'function' && define.amd) {
				// AMD. Register as an anonymous module.
				define(['require'], function (require) {
						return factory(require);
				});
		} else if (typeof module === 'object' && module.exports) {
				// Node. Does not work with strict CommonJS, but
				// only CommonJS-like environments that support module.exports,
				// like Node.
				module.exports = factory(_req);
		}
	}

}(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this, function (require) {

	
/**
 * Media Module: Implementation for Speech Recognition via Bing Service with WebSockets
 * @author Patrick Bitterling <pabi01@dfki.de>
 */


	
  var mediaManager = require('mmirf/mediaManager');
  var config = require('mmirf/configurationManager');
  var lang = require('mmirf/languageManager');

  
    return (function(){
      {

	/**
	 * @type {string}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var MODE = 'nuanceWs';

	/**
	 * @type {string}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var _pluginName = 'asrNuanceWs';

	/**
	 * Result types (returned by the native/Cordova plugin)
	 *
	 * @type Enum
	 * @constant
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var RESULT_TYPES = {
		"FINAL": 				"FINAL",
		"INTERIM": 				"INTERIM",
		"INTERMEDIATE":			"INTERMEDIATE",
		"RECOGNITION_ERROR": 	"RECOGNITION_ERROR",
		"RECORDING_BEGIN": 		"RECORDING_BEGIN",
		"RECORDING_DONE": 		"RECORDING_DONE"
	};

	/**
	 * set to true when last recognition result is expected
	 * @type {boolean}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var lastBlob = false;

	/**
	 * if you want to have intermediate results
	 * @type {boolean}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 **/
	var isUseIntermediateResults = false;

	/**
	 * the websocket that connects to the service provider
	 * @type WebSocket
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var webSocket = null;

	/**
	 * set to true when user presses stop button
	 * @type {boolean}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var stopped = true;


	/** callback when succesfull recognition happened
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var textProcessor;


	/**
	 * callback when error while recognition happened
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var currentFailureCallback;

	/**
	 * function called when the microphone is closed
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var closeMicFunc;

	/**
	 * @memberOf NuanceWsWebAudioInputImpl#
	 * @readonly
	 * @enum {string}
	 */
	var WS_STATUS_ENUM = {OPENING : "opening", // when new WebSocket is called
						SETUP : "setup", //after ws.onopen -> send config msg for asr service
						WORKING : "working", // after setup is completed -> send audio data
						CLOSED : "closed", // when error occurs, time out or software stops the connection
						SEALED : "sealed", // when the user stops the connection
						NEXT_QUERY : "next_query" // after completing one turn with the asr service
						};

	/**
	 * Initial status of the websocket
	 * @memberOf NuanceWsWebAudioInputImpl#
	 * @type enum.WS_STATUS_ENUM
	 */
	var wsStatus = WS_STATUS_ENUM.CLOSED;

	/**
	 * contains data that will be saved when ws is not in working state
	 * @type {Array]
	 * contains typed array with audio data or JSON message
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var msgBuffer = [];

	/**
	 * counts the connection attempts, not handled right now
	 * @memberOf NuanceWsWebAudioInputImpl#
	 * @type {number}
	 */
	var connectionAttempt = 0;

    /**
     * id for the transaction
     * used and incremented at setup nuance
	 * @memberOf NuanceWsWebAudioInputImpl#
	 * @type {number}
	 */
    var _asrTransactionId = 1;

    /**
     * id for the used audio data in the transaction
	 * @memberOf NuanceWsWebAudioInputImpl#
	 * @type {number}
	 */
    var _asrRequestId = 0;

    /**
     * String loaded from config, representing which encoding should be used
     * @type {string}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var encoderStr = config.getString( [_pluginName, "encoder"], "speex" );



	/**
	 * string representing which codec format should be used, opus not implemented yet
     * @type {string}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var codecTyp = "audio/L16;rate=16000";

	if(encoderStr.includes("pcm")){
		codecTyp = "audio/L16;rate=16000";
	}else if (encoderStr.includes("speex")){
		codecTyp = "audio/x-speex;mode=wb";
	}else if (encoderStr.includes("opus")){
		codecTyp = "audio/opus;rate=16000";
	}

	/**
	 * "true" if recorded data should be send directly to the asr provider -> for now only "true" implemented
	 * @type {string}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
    var streaming = "true"; //FIXME read from config


    /**
     * represents the recorder that encodes the audio data
     * @type {RecorderExt.class}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var _recorder;

	/**
	 * register listener when audio data is saved, simulates streaming
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var onAudioChunkStored = function(){
		if(!stopped){
			_recorder.doEncode();
			_recorder.doFinish();
		}
	};


	 /**
     * register listener to get the recorder
     * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	mediaManager.on('webaudioinputstarted', function(input, audio_context, recorder){

		if(recorder){
			_recorder = recorder;
			// var hasListener = recorder.hasListeners("onchunkstored");
			// if(!hasListener){
			//	recorder.on('onchunkstored', onAudioChunkStored);
			if(!recorder.onchunkstored){
				recorder.onchunkstored = onAudioChunkStored;
			}
		}
	});

	/**
	 * changes the websocket state to the new status, when not in "Sealed"-state
	 * @type {function}
	 * @param {WS_STATUS_ENUM} newStatus - change the Websocket to the new status
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
    var changeWsStatus = function(newStatus){
    	//console.log("change wsStatus from "+wsStatus+" to " + newStatus);

    	if(wsStatus == WS_STATUS_ENUM.SEALED){
    		return;
    	}else{
    		wsStatus = newStatus;
    	}
    }

	/**
	 * function that sends the data to the asr via websocket
	 * @type {function}
	 * @param {typedArray[] | object[typedArray[] | string} } msg - the data to be send
	 * @param {function} successCallback - the function that shall be called when recognition was succesfull
	 * @param {function} failureCallback - the function that shall be called when recognition failed or an error occured
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var doSend = function(msg, successCallback, failureCallback){
		//string or object{cmd: '<string>', buff:<data>}
		if(successCallback){
			textProcessor = successCallback;
		}
		if(failureCallback){
			currentFailureCallback = failureCallback;
		}

		var data;

		if(msg.cmd !== undefined){
			data = msg.buf;
		}else{
			data = msg;
		}


		if(wsStatus != WS_STATUS_ENUM.WORKING){
			if (typeof data === 'string' || data instanceof String){
			msgBuffer.push(data);
			}else{
				msgBuffer.push(data); //Patbit TODO this is ugly logic
			}
			if(wsStatus == WS_STATUS_ENUM.CLOSED){
				buildConnection();
			}
		}else{
			try{//FIXME this should not be necessary...
				if(data instanceof Array){
					//console.log("ws dosend buffers from a array");
					data.forEach(function(typedArray){
						webSocket.send(typedArray.buffer);
					});
				} else if(data !== undefined){
						webSocket.send(data);

						// if(data instanceof Blob) _recorder.constructor.forceDownload(data, 'speechAsr_'+(++fileNameCounter)+'.speex');

				} else if(mediaManager._log.isDebug()){
					mediaManager._log.log("skip data sending -> undefined");
				}
				//webSocket.send(msg);
			} catch(err){
				mediaManager._log.error(_pluginName, 'Error during send', err);
			}
		}

	};

	// var fileNameCounter = 0;

	/**
	 * helper function that sends the needed text messages to set up the nuance asr service
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var setupNuance = function(){
		connectionAttempt = 0;

		if(wsStatus != WS_STATUS_ENUM.NEXT_QUERY){
			changeWsStatus(WS_STATUS_ENUM.SETUP);
		}
         _asrTransactionId += 2;
         _asrRequestId++;

         //request long-variant of language code:
         var locale = lang.getLanguageConfig(_pluginName, 'long');

         //console.log("cur locale: "+locale);

            var _query_begin = {
                'message': 'query_begin',
                'transaction_id': _asrTransactionId,
                'language': locale,
                'codec':  codecTyp,
                'command': 'NVC_ASR_CMD',
                'recognition_type': 'dictation'
            };

            var _request_info = {
                'message': 'query_parameter',
                'transaction_id': _asrTransactionId,

                'parameter_name': 'REQUEST_INFO',
                'parameter_type': 'dictionary',
                'dictionary': {
                    'start': 0,
                    'end': 0,
                    'text': ''
                }
            };

            var _audio_info = {
                'message': 'query_parameter',
                'transaction_id': _asrTransactionId,

                'parameter_name': 'AUDIO_INFO',
                'parameter_type': 'audio',

                'audio_id': _asrRequestId
            };
            var _query_end = {
                'message': 'query_end',
                'transaction_id': _asrTransactionId
            };
            var _audio_begin = {
                'message': 'audio',
                'audio_id': _asrRequestId
            };

            //console.log("send setup nuance");
            webSocket.send(JSON.stringify(_query_begin));
            webSocket.send(JSON.stringify(_request_info));
            webSocket.send(JSON.stringify(_audio_info));
            webSocket.send(JSON.stringify(_query_end));
            webSocket.send(JSON.stringify(_audio_begin));

            if(wsStatus == WS_STATUS_ENUM.NEXT_QUERY){
            	//send buffer because no connect msg will come
            	//console.log("nuancesetup sendMsgBuffer");
            	sendMsgBuffer();
            }else{
            	//console.log("send NO msg buffer");
            	//changeWsStatus(WS_STATUS_ENUM.WORKING);
            }
	}

	/**
	 * helper function that sends all bufferd messages to the asr
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var sendMsgBuffer = function(){
		var audioEndFlag = false;

		if(msgBuffer.length > 0){
			var audioEndFlag = false;
			for(var i=0; i < msgBuffer.length; ++i){
				if(typeof msgBuffer[i] === "string"){
					//console.log("sendMsgBuffer string: "+ msgBuffer[i]);
					audioEndFlag = true;
				}else{
					//console.log("sendMsgBuffer BLOB");
					//PatBit debug webSocket.send(msgBuffer[i]);
				}
			}

			msgBuffer = [];
		}
		if(audioEndFlag){
			var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };
	        websocket.send(JSON.stringify(_audio_end));
	        //console.log("send audioEnd because of silence when msg was buffered");
	        changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);

		}else{
			//console.log("no audioendFlag in msgBuffer")
			changeWsStatus(WS_STATUS_ENUM.WORKING);
		}
	}

	/** initializes the connection to the Nuance-server,
	 * where the audio will be sent in order to be recognized.
	 * @type {function}
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var buildConnection = function(/*oninit*/){//TODO check if this does work else add JSDoc param
		if(wsStatus == WS_STATUS_ENUM.OPENING || wsStatus == WS_STATUS_ENUM.SETUP || wsStatus == WS_STATUS_ENUM.WORKING || wsStatus == WS_STATUS_ENUM.SEALED ){
		//early exit if function is called when connection building is in progress
			return;
		}

		wsStatus = WS_STATUS_ENUM.OPENING;
		connectionAttempt++;

		if (webSocket){
			webSocket = undefined;
		}

		var serviceUrl = config.getString( [_pluginName, "baseUrl"], 'wss://httpapi.labs.nuance.com/v1' ) +
		 										"?app_id=" + config.getString( [_pluginName, "appId"] ) +
												"&algorithm=key&app_key=" + config.getString( [_pluginName, "appKey"] );
		webSocket = new WebSocket(serviceUrl);
		webSocket.binaryType = 'arraybuffer';

		/**
		 * function called when websocket connects with the asr service
		 * @type {function}
		 * @memberOf NuanceWsWebAudioInputImpl.webSocket# */
		webSocket.onopen = function () {

			//PatBit TODO maybe use another method for unique id
	        var nav = window.navigator;
	           var deviceId = [
	               nav.platform,
	               nav.vendor,
	               nav.language
	           ].join('_').replace(/\s/g,'');

			var _connect = {
	            'message': 'connect',
	            'user_id': config.getString( [_pluginName, "userId"] ),
	            'codec':  codecTyp,
	            'device_id': deviceId
	        };

			webSocket.send(JSON.stringify(_connect));
			setupNuance();
		};
		/**
		 * function that is called when the websocket receives a message
		 * @type {function}
		 * @memberOf NuanceWsWebAudioInputImpl.webSocket#
		 */
		webSocket.onmessage = function(msg) {

			var msg = JSON.parse(msg.data);
			var cmd = msg.message;

			switch(cmd){
				case 'connected':
					sendMsgBuffer();
					changeWsStatus(WS_STATUS_ENUM.WORKING);
					return;

				case 'disconnect':
					if(wsStatus != WS_STATUS_ENUM.SEALED){
						changeWsStatus(WS_STATUS_ENUM.CLOSED);
					}

					if(typeof websocket !== 'undefined' && websocket != null){
						websocket.close();
						websocket = null;
					}
	                return;
				case 'query_error': //mostly does not understood the spoken speech/sentence
					if (currentFailureCallback){
						currentFailureCallback(msg.reason);
					}
	                return;
				case "query_end":
					changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);
					setupNuance();
					return;
				case "query_response":
					if(textProcessor){
	            		var size = msg.transcriptions.length;
	            		var alt;

	            		if(size > 1){
		            		alt = [];
		            		for(var i=1; i < size; ++i){
		            			alt.push({	"text" : msg.transcriptions[i],
		            						"score" : msg.confidences[i]});
		            		}
	            		}
	            		if(stopped){
	            			textProcessor(msg.transcriptions[0], msg.confidences[0], RESULT_TYPES.FINAL, alt);
	            		}else{
	            			textProcessor(msg.transcriptions[0], msg.confidences[0], RESULT_TYPES.INTERMEDIATE, alt);
	            		}
	            	}
	                return;
				default:
					console.warn("unhandled webSocket.onmessage");
			}
			console.warn("unhandled webSocket.onmessage");

		};
		/** function that is called when the websocket connection is faulty
		 *  @param {object} e - an error object created by the browser
		 *  @type {function}
		 *  @memberOf NuanceWsWebAudioInputImpl.webSocket#
		 */
		webSocket.onerror = function(e) {
			//console.log("ws.onerror called");
			websocket = null;
			//try to filter:
			//WebSocket connection to ... failed: One or more reserved bits are on: reserved1 = 0, reserved2 = 1, reserved3 = 1
			//
			// -> error but websocket stays open

			if(wsStatus == WS_STATUS_ENUM.OPENING){
				if(connectionAttempt > 1){
					if(mediaManager._log.isDebug()) mediaManager._log.log("failed while reopening");
				} else {
					if(mediaManager._log.isDebug()) mediaManager._log.log("failed while opening");
				}
				changeWsStatus(WS_STATUS_ENUM.CLOSED);
				return;
			}

			if(wsStatus == WS_STATUS_ENUM.CLOSED){
				if(mediaManager._log.isDebug()) mediaManager._log.log("failed after closed ws -> ignored");
				return;
			}

			closeMicFunc();
			lastBlob=false;

			if (currentFailureCallback){
				currentFailureCallback(e);
			}
			else {
				mediaManager._log.error('Websocket Error: '+e  + (e.code? ' CODE: '+e.code : '')+(e.reason? ' REASON: '+e.reason : ''));
			}
		};
		/**
		 *  function that is called when the websocket is closed
		 *	@type {function}
		 *  @param {object} e - an error object
		 *	@memberOf NuanceWsWebAudioInputImpl.webSocket#
		 */
		webSocket.onclose = function(e) {
			if(mediaManager._log.isDebug()) mediaManager._log.log('Websocket closed!'+(e.code? ' CODE: '+e.code : '')+(e.reason? ' REASON: '+e.reason : ''));
			websocket = null;
		};
	};

	/**
	 * the function that is called when audio data must be send because the data amount gets to large in size
	 * the function is called from the silence detection
	 * @type {function}
	 * @param {object} evt - event object that includes the current recorder
	 * @returns {boolean} is always false
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var onSendPart = function(evt){
			var recorder = evt.recorder;

			recorder.doEncode();
			recorder.doFinish();

		return false;
	};

	/**
	 * function that is called when the silence detection registers silence
	 * @type {function}
	 * @param {object} evt - event object that includes the current recorder
	 * @returns {boolean} is always false
	 * @memberOf NuanceWsWebAudioInputImpl# */
	var onSilence = function(evt){

		var recorder = evt.recorder;

		if(streaming != "true"){
			//PatBit TODO implement
			mediaManager._log.warn("onSilence not-streaming mode not tested");
			recorder.doEncode();
			recorder.doFinish();

			var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };

			doSend(JSON.stringify(_audio_end));

		}else{ //we are streaming
			//TODO make code cleaner
			var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };

			doSend(JSON.stringify(_audio_end));
	        if(mediaManager._log.isDebug()) mediaManager._log.log("audio end send streaming: "+ JSON.stringify(_audio_end));
	        changeWsStatus(WS_STATUS_ENUM.NEXT_QUERY);
		}

		return false;
	};

	/**
	 * function is called by the silence detection when there is no noise before speaking
	 * it clears the buffered audio data that contains to reduce the encoded and send data
	 * @type {function}
	 * @param {object} evt - event object that includes the current recorder
	 * @returns {boolean} is always false
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var onClear = function(evt){

		evt.recorder && evt.recorder.clear();
		return false;
	};

	/**
	 *  function puts websocket in seal status, which can't be changed until the user starts the recording again
	 *  sends message to nuance ending the current turn
	 *  @type {function}
	 *  @memberOf NuanceWsWebAudioInputImpl#
	 */
	var sealWebsocket = function(){

		if(wsStatus == WS_STATUS_ENUM.WORKING){
            var _audio_end = {
	                'message': 'audio_end',
	                'audio_id': _asrRequestId
	            };
	        doSend(JSON.stringify(_audio_end));
		}
		changeWsStatus(WS_STATUS_ENUM.SEALED);
	}

	/**
	 * function that calls buildConnection and returns false
	 * @type {function}
	 * @returns {boolean} is always false
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var buildConnectionWrapper = function(){
		buildConnection();
		return false;
	}

	/** function that returns false for the oninit call
	 * @type {function}
	 * @returns {boolean} is always false
	 * @memberOf NuanceWsWebAudioInputImpl#
	 */
	var pseudoInit = function(){
		return false;
	}

	return {
		/** @memberOf NuanceWsWebAudioInputImpl.AudioProcessor# */
		_init: pseudoInit,
		initRec: pseudoInit,
		sendData: doSend,
		oninit: pseudoInit,
		onstarted: function(data, successCallback, errorCallback){
			stopped = false;
			wsStatus = WS_STATUS_ENUM.CLOSED;
			successCallback && successCallback('',-1,RESULT_TYPES.RECORDING_BEGIN)
			return false;
		},
		onaudiostarted: buildConnectionWrapper,
		onstopped: function(data, successCallback, errorCallback){
			stopped = true;
			sealWebsocket();
			successCallback && successCallback('',-1,RESULT_TYPES.RECORDING_DONE);
			return false;
		},
		onsendpart: onSendPart,
		onsilencedetected: onSilence,
		onclear: onClear,
		getPluginName: function(){
			return _pluginName;
		},
		setCallbacks: function(successCallback, failureCallback, stopUserMedia, options){

			textProcessor = successCallback;
			currentFailureCallback = failureCallback;
			closeMicFunc = stopUserMedia;
			isUseIntermediateResults = options.intermediate;
		},
		setLastResult: function(){
			lastBlob = true;
		},
		resetLastResult: function(){
			lastBlob = false;
		},
		isLastResult: function(){
			return lastBlob;
		}
	};

}
    })();
;


	//END: define()


}));
