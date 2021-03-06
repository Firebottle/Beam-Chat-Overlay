////////////////////
// Helper Functions
///////////////////
var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};

function escapeHTML(unsafeText) {
  let div = document.createElement('div');
  div.innerText = unsafeText;
  return div.innerHTML.replace(/"/g, '&quot;');
}

function escapeRegExp(string) {
  if(string == null){return;}
  return string.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// Headers for ajax calls.
function setHeader(xhr) {
  xhr.setRequestHeader('Client-ID', '8682f64ae59cbcba5cd701c205b54b04a424b46ca064e563');
}

// Get User ID & start it up
var username = getUrlParameter('username');
var userID = "";
var timeToShowChat = getUrlParameter('timer') ? getUrlParameter('timer') : 5000;
var elixrEmoji = [];

$(function() {
  let urlParams = new URLSearchParams(window.location.search);
  let fontSize = urlParams.get("fontSize");
  if(fontSize != null) {
    $('.wrapper').attr('style', `font-size: ${fontSize}px !important;`);
  }
});


if(username != null){
  // Startup
  $.ajax({
    url: "https://Mixer.com/api/v1/channels/"+username,
    type: 'GET',
    dataType: 'json',
    beforeSend: setHeader,
    success: function(data){
      userID = data.id;
      userPartner = data.partnered;
      if (userPartner === true){
        subIcon = data.badge.url;
      } else {
        subIcon = "";
      } 

      // Get our chat endpoints and connect to one.
      $.ajax({
        url: "https://Mixer.com/api/v1/chats/"+userID,
        type: 'GET',
        dataType: 'json',
        beforeSend: setHeader,
        success: function(data){
          var endpoints = data.endpoints
          mixerSocketConnect(endpoints);
        }
      })
    }
  })
} else {
  $("<div class='chatmessage' id='1'>No username provided. Visit crowbartools.com for setup instructions!</>").appendTo(".chat").hide().fadeIn('fast').delay(5000).fadeOut('fast', function(){ $(this).remove(); });
}



// CHAT
// Connect to mixer Websocket
async function mixerSocketConnect(endpoints){
    if ("WebSocket" in window){

       // Let us open a web socket
       var randomEndpoint = endpoints[Math.floor(Math.random()*endpoints.length)];
       var ws = new ReconnectingWebSocket(randomEndpoint);
       console.log('Connected to '+randomEndpoint);

       ws.onopen = async function(){
          // Web Socket is connected, send data using send()
          var connector = JSON.stringify({type: "method", method: "auth", arguments: [userID], id: 1});
          ws.send(connector);
          console.log('Connection Opened...');
          $("<div class='chatmessage' id='1'>Chat connection established to "+username+".</div>").appendTo(".chat").hide().fadeIn('fast').delay(5000).fadeOut('fast', function(){ $(this).remove(); });
       
          // Get our elixr emoji and cache it.
          elixrEmoji = await getElixrEmoji();

          // Error Handling & Keep Alive
          setInterval(function(){
            errorHandle(ws);
          }, 10000)
       };

       ws.onmessage = async function (evt){
        chat(evt);

        // Debug - Log all chat events.
        // console.log(evt);
       };

       ws.onclose = async function(){
          // websocket is closed.
          console.log("Connection is closed...");
       };

    }else{
       // The browser doesn't support WebSocket
       console.error("Woah, something broke. Abandon ship!");
    }
}

function mapEmoteSizeToClass(size) {
  switch (size) {
    case 24:
      return 'twentyfour';
    case 30:
      return 'thirty';
    case 50:
    default:
      return 'fifty';
  }
}

function getElixrEmoji(){
  return new Promise(function(resolve, reject) {
    var username = getUrlParameter('username');
    let ts = new Date().getTime();
    var rootUrl = `https://api.mixrelixr.com/v1/emotes/`+ username +`?cache=`+ts;
    $.getJSON( rootUrl, function(data) {
      console.log('Elixr emotes retrieved.');
      return resolve(data);
    }).fail(function() {
      console.log('Elixr emotes were not found!');
      return resolve(false);
    });	
  });
}

function elixrEmojiReplacer(text){
  text = text.trim();
  let channelEmotes, globalEmotes;
  let allEmoteNames = [];
  let foundEmote = false;

  // Get channel and global emote names and push names to all emote names list.
  if(elixrEmoji['channelEmotes'] != null){
    channelEmotes = Object.values(elixrEmoji['channelEmotes']);
    allEmoteNames = allEmoteNames.concat(channelEmotes.map(e => e.code));
  }
  if(elixrEmoji['globalEmotes'] != null){
    globalEmotes = Object.values(elixrEmoji['globalEmotes']);
    allEmoteNames = allEmoteNames.concat(globalEmotes.map(e => e.code));
  }

  // remove dupes from all emote names list.
  allEmoteNames = [...new Set(allEmoteNames)];

  // build emote name group end result will look like: "emoteName1|emoteName2|emoteName3"
  let emoteNameRegexGroup = '';
  for (let emote of allEmoteNames) {
    if (emoteNameRegexGroup.length > 0) {
      emoteNameRegexGroup += '|';
    }
    emoteNameRegexGroup += escapeRegExp(emote);
  }

  let regexPattern = `(?:^|\\s)(?:${emoteNameRegexGroup})(?=\\s|$)`;

  // emote name regex
  let emoteNameRegex;
  try {
    emoteNameRegex = new RegExp(regexPattern, 'gm');
  } catch (err) {
    console.log("REGEX ERROR!", err);
  }

  // replace emote names with img tags
  text = text.replace(emoteNameRegex, match => {
    match = match && match.trim();
    console.log('found emote match: ' + match);

    // search for channel emote first
    let emote;
    if (channelEmotes) {
      emote = channelEmotes.find(e => e.code === match);
    }

    // if we didnt find anything, search global if enabled
    let isGlobal = false;
    if (emote == null && globalEmotes) {
      emote = globalEmotes.find(e => e.code === match);
      isGlobal = true;
    }

    if (emote) {
      foundEmote = true;

      let url;
      if (isGlobal) {
        url = `https://crowbartools.com/user-content/emotes/global/${escapeHTML(emote.id)}`;
      } else {
        url = `https://crowbartools.com/user-content/emotes/live/${userID}/${escapeHTML(emote.id)}`;
      }

      let sizeClass = mapEmoteSizeToClass(emote.maxSize);

      let imgTag = `
          <span class="elixr-custom-emote ${sizeClass} me-tooltip" title="Mixr Elixr: Custom emote '${escapeHTML(emote.code)}'" style="display: inline-block;">
            <img src="${url}">
          </span>`;

      return imgTag;
    }

    return match;
  });

  return text;
}

function getEmotePackDimensions(packUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = function() {
      resolve({
        width: this.width,
        height: this.height
      })
    }
    img.onerror = function() {
      resolve(null);
    }
    img.src = packUrl;
  });
}

// Chat Messages
async function chat(evt){
    var evtString = $.parseJSON(evt.data);
    var eventType = evtString.event;
    var eventMessage = evtString.data;

    if (eventType == "ChatMessage"){
      var username = eventMessage.user_name;
      var userrolesSrc = eventMessage.user_roles;
      var userroles = userrolesSrc.toString().replace(/,/g, " ");
      var usermessage = eventMessage.message.message;
      var messageID = eventMessage.id;
      var completeMessage = "";


      for(let segment of usermessage) {
        var type = segment.type;

          if (type == "text"){
            var messageTextOrig =  segment.data;
            var messageText = escapeHTML(messageTextOrig);
            var messageText = elixrEmojiReplacer(messageText);
            completeMessage += messageText;
          } else if (type == "emoticon"){
            const emoticonSource = segment.source;
            const emoticonPack = segment.pack;
            const emoticonCoordX = segment.coords.x;
            const emoticonCoordY = segment.coords.y;
            const emoticonWidth = segment.coords.width;

            const packUrl = emoticonSource === "builtin" ? 
                    `https://mixer.com/_latest/emoticons/${emoticonPack}.png`
                    : emoticonPack;

            const size = emoticonWidth > 24 ? 28 : 24;

            const scale = size / emoticonWidth;

            const packDimensions = await getEmotePackDimensions(packUrl);
            let sheetWidth, sheetHeight;
            if (packDimensions) {
                sheetWidth = packDimensions.width;
                sheetHeight = packDimensions.height;
            }

            const backgroundSize = scale !== 1 && sheetHeight && sheetWidth ?
                    `${scale * sheetWidth}px ${scale * sheetHeight}px`
                    : undefined;

            let styles = `height:${size}px;width:${size}px;background-position:-${scale * emoticonCoordX}px -${scale * emoticonCoordY}px;background-image:url(${packUrl});display:inline-block;`;
            if(backgroundSize) {
              styles += `background-size:${backgroundSize};`;
            }

            completeMessage += `<div class="emoticon" style="${styles}"></div>`;
                
          } else if (type == "link"){
            var chatLinkOrig = segment.text;
            var chatLink = chatLinkOrig.replace(/(<([^>]+)>)/ig, "");
            completeMessage += chatLink;
          } else if (type == "tag"){
            var userTag = segment.text;
            completeMessage += userTag;
          } else if (type == "image"){
            var imageURL = segment.url;
            completeMessage += '<div class="skill-image" style="height:24px; width:24px; display:inline-block;"><img src="'+imageURL+'"></div>';
          }
      }

        // Place the completed chat message into the chat area.
        // Fade message in, wait X time, fade out, then remove.
        if (timeToShowChat === '0'){
          $("<div class='chatmessage' id='"+messageID+"'><div class='chatusername "+userroles+"'>"+username+" <div class='badge'><img src="+subIcon+"></div></div> "+completeMessage+"</div>").appendTo(".chat");
        } else {
          $("<div class='chatmessage' id='"+messageID+"'><div class='chatusername "+userroles+"'>"+username+" <div class='badge'><img src="+subIcon+"></div></div> "+completeMessage+"</div>").appendTo(".chat").hide().fadeIn('fast').delay(timeToShowChat).fadeOut('fast', function(){ $(this).remove(); });
        }

    } else if (eventType == "ClearMessages"){
      // If someone clears chat, then clear all messages on screen.
      $('.chatmessage').remove();
    } else if (eventType == "DeleteMessage"){
      // If someone deletes a message, delete it from screen.
      $('#'+eventMessage.id).remove();
    }
}


// Error Handling & Keep Alive
function errorHandle(ws){
  var wsState = ws.readyState;
  if (wsState !== 1){
    // Connection not open.
    console.log('Ready State is '+wsState);
  } else {
    // Connection open, send keep alive.
    ws.send('{"type": "method", "method": "ping", "arguments": [], "id": 12}');
  }
}