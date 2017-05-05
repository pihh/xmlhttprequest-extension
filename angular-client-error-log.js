'use strict';

angular.module('tdf-error-log', [])

    /**
     * app constants.
     * @author: Filipe - filipemotasa@hotmail.com
     * @returns {Object}
     * @todo: could remove AppConstants and use .env file but that's a small improvement and I'm not 100% sure of the security risks
     */
    .constant('AppConstants', {
        env: 'development',
        log: {
            type: 'file', // file -> error.log , database -> database url
            path: new Date().toJSON().slice(0, 10) + '-error.log'
        }
    })

    /**
     * Service that gives us a nice Angular-esque wrapper around the
     * stackTrace.js pintStackTrace() method.
     * @author: Filipe - filipemotasa@hotmail.com
     */
    .factory(
        "traceService",
        function() {
            return ({
                print: printStackTrace
            });
        }
    )

    /**
     * Override Angular's built in exception handler, and tell it to
     * use our new exceptionLoggingService which is defined below
     * @author: Filipe - filipemotasa@hotmail.com
     */
    .provider(
        "$exceptionHandler", {
            $get: function(exceptionLoggingService) {
                return (exceptionLoggingService);
            }
        }
    )

    /**
     * Exception Logging Service, currently only used by the $exceptionHandler
     * it preserves the default behaviour ( logging to the console) but
     * also posts the error server side after generating a stacktrace.
     * @author: Filipe - filipemotasa@hotmail.com
     */

    .factory(
        "exceptionLoggingService", ["$log", "$window", "traceService", "AppConstants", "ApplicationLoggingService",
            function($log, $window, traceService, AppConstants, ApplicationLoggingService) {
                function error(exception, cause) {

                    // preserve the default behaviour which will log the error
                    // to the console, and allow the application to continue running.
                    $log.error.apply($log, arguments);

                    // If not in development mode: breaks.
                    if (AppConstants.env !== 'development')
                        return;

                    // now try to log the error to the server side.
                    try {
                        var errorMessage = exception.toString();

                        // use the traceService to generate a stack trace
                        var stackTrace = traceService.print({
                            e: exception
                        });

                        // DO NOT use an angular service such as $http to avoid circular dependenvy
                        ApplicationLoggingService.error(params);

                    } catch (loggingError) {
                        $log.warn("Error server-side logging failed");
                        $log.log(loggingError);
                    }

                }
                return (error);
            }
        ]
    )

    /**
     * Http request fail logger , logs the error in the database or on a file and downloads it
     * @author: Filipe - filipemotasa@hotmail.com
     * @return {Object}
     */

    .factory(
        "ApplicationLoggingService", ["$log", "$window", "AppConstants", function($log, $window, AppConstants) {

            var __log = function(params) {

                switch (AppConstants.log.type) {
                    case 'file':

                        var path = AppConstants.log.path,
                            strMimeType = 'text/plain',
                            strData = JSON.stringify(params),
                            strFileName = AppConstants.log.path,
                            D = document,
                            A = arguments,
                            a = D.createElement("a"),
                            d = A[0],
                            n = strFileName,
                            t = "text/plain";

                        //build download link:
                        a.href = "data:" + strMimeType + "charset=utf-8," + escape(strData);

                        if (window.MSBlobBuilder) { // IE10
                            var bb = new MSBlobBuilder();
                            bb.append(strData);
                            return navigator.msSaveBlob(bb, strFileName);
                        } /* end if(window.MSBlobBuilder) */

                        if ('download' in a) { //FF20, CH19
                            a.setAttribute("download", n);
                            a.innerHTML = "downloading...";
                            D.body.appendChild(a);
                            setTimeout(function() {
                                var e = D.createEvent("MouseEvents");
                                e.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
                                a.dispatchEvent(e);
                                D.body.removeChild(a);
                            }, 66);
                            return true;
                        };
                        /* end if('download' in a) */

                        //do iframe dataURL download: (older W3)
                        var f = D.createElement("iframe");
                        D.body.appendChild(f);
                        f.src = "data:" + (A[2] ? A[2] : "application/octet-stream") + (window.btoa ? ";base64" : "") + "," + (window.btoa ? window.btoa : escape)(strData);
                        setTimeout(function() {
                            D.body.removeChild(f);
                        }, 333);
                        return true;

                        break;
                    case 'database':
                        var http = new XMLHttpRequest();
                        var url = AppConstants.log.path;

                        http.open("POST", url, true);
                        http.onreadystatechange = function() { //Call a function when the state changes.

                        };
                        http.setRequestHeader("Content-type", "application/json");
                        http.send(JSON.stringify(params));
                        break;
                }
            }

            var httpLog = function(message) {
                var params = {
                    url: (message === Object(message) && message.url) ? message.url : $window.location.href,
                    message: (message) ? JSON.stringify(message) : "",
                    type: "error",
                    cause: (message === Object(message) && message.cause) ? message.cause : "http request"
                };
                __log(params);
            }

            return ({
                httpLog: httpLog,
                error: function(message) {
                    // preserve default behaviour
                    $log.error.apply($log, arguments);
                    // send log to the database
                    if (AppConstants.env === 'development')
                        __log('error', message);
                }
            });
        }]
    )

    /**
     * On bootstrap the application run some validations ( mainly to check if
     * in dev mode and to apply it's settings)
     * @author: Filipe - filipemotasa@hotmail.com
     * @return {Null}
     */

    .run(["AppConstants", "$location", "ApplicationLoggingService", function(AppConstants, $location, ApplicationLoggingService) {

        if (AppConstants.env === 'development') {

            /**
             * On bootstrap the application run some validations ( mainly to check if
             * in dev mode and to apply it's settings)
             * @author: Filipe - filipemotasa@hotmail.com
             * @return {Null}
             */
            var logHttpErrors = function() {
                // open method proxy
                var open = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url, async) {
                    //send method proxy
                    var send = this.send;
                    this.send = function(data) {
                        // readystatechange proxy  -> it's here I want to log the errors
                        var rsc = this.onreadystatechange;
                        if (rsc) {
                            this.onreadystatechange = function() {
                                //On complete && > than 400 (fails) and url != client logger's url
                                if (4 === this.readyState && 400 < this.status && -1 === url.indexOf(AppConstants.log.path)) {
                                    ApplicationLoggingService.httpLog({
                                        url: url,
                                        statusText: this.statusText,
                                        responseText: this.responseText
                                    });
                                }
                                return rsc.apply(this, arguments);
                            };
                        }
                        return send.apply(this, arguments);
                    }
                    return open.apply(this, arguments);
                }
            }
        }


        // run the dev setup
        logHttpErrors();
    }]);
