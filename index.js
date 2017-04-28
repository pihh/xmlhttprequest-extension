/**
 * On bootstrap the application run some validations ( mainly to check if
 * in dev mode and to apply it's settings)
 * @author: Filipe - filipemotasa@hotmail.com
 * @return {Null}
 */
  var logHttpErrors = function(){
    // open method proxy
    var open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method,url,async){
      //send method proxy
      var send = this.send;
      this.send = function(data) {
        // readystatechange proxy  -> it's here I want to log the errors
        var rsc = this.onreadystatechange;
        if (rsc) {
          this.onreadystatechange = function() {
            //On complete && > than 400 (fails) and url != client logger's url
            if(4 === this.readyState && 400 < this.status && -1 === url.indexOf(AppConstants.logUrl) ){
                  ApplicationLoggingService.httpLog({
                    url: url,
                    statusText: this.statusText,
                    responseText: this.responseText
                  });
            }
            return rsc.apply(this, arguments);
          };
        }
        return send.apply(this,arguments);
      }
      return open.apply(this,arguments);
    }
  }
}


// run the dev setup
logHttpErrors();
