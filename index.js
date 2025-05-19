// index.js
const Telegram = require('node-telegram-bot-api');
const request = require("request");
const token = '7802960029:AAEU5okvqqCpAhuwdIIi8TaqaI1uMZH1YiY';

// Configure the bot to use polling
const opt = {
  polling: true
};

const bot = new Telegram(token, opt);

// Event listener for receiving messages
bot.on("message", function(msg) {
  const text = msg.text;

  if (text == '/start') {
    bot.sendMessage(msg.chat.id, "👋 Hi, I am a bot for downloading TikTok videos without watermark.");
    function delay(time) {
      return new Promise(resolve => setTimeout(resolve, time));
    }
    delay(500).then(() => bot.sendMessage(msg.chat.id, "✨ Please send the video link"));
  } else if (text.includes('tiktok.com')) {
    bot.sendMessage(msg.chat.id, "⏳Please wait...");
    
    const reqvideourl = `https://www.tikwm.com/api/?url=${text}&hd=1`;
    request(reqvideourl, function(error, response, body) {
      const json = JSON.parse(body);
      
      if (json.data == undefined) {
        bot.sendMessage(msg.chat.id, "😔 Sorry, I can't download this video right now. Please try again later.");
      } else {
        function delay(time) {
          return new Promise(resolve => setTimeout(resolve, time));
        }
        delay(500).then(() => bot.sendVideo(msg.chat.id, json.data.hdplay));
      }
    });
  } else {
    bot.sendMessage(msg.chat.id, "🧐 Please send a valid video link");
  }
});
