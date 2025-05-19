const TELEGRAM_API_URL = 'https://api.telegram.org/bot7802960029:AAEU5okvqqCpAhuwdIIi8TaqaI1uMZH1YiY/';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'POST') {
    const body = await request.json();
    const text = body.message.text;
    const chatId = body.message.chat.id;

    if (text === '/start') {
      await sendMessage(chatId, "👋 Hi, I am a bot for downloading TikTok videos without watermark.");
      await delay(500);
      await sendMessage(chatId, "✨ Please send the video link.");
    } else if (text.includes('tiktok.com')) {
      await sendMessage(chatId, "⏳Please wait...");
      
      const reqvideourl = `https://www.tikwm.com/api/?url=${text}&hd=1`;
      const response = await fetch(reqvideourl);
      const json = await response.json();

      if (json.data === undefined) {
        await sendMessage(chatId, "😔 Sorry, I can't download this video right now. Please try again later.");
      } else {
        await delay(500);
        await sendVideo(chatId, json.data.hdplay);
      }
    } else {
      await sendMessage(chatId, "🧐 Please send a valid video link");
    }
  }

  return new Response('OK', { status: 200 });
}

async function sendMessage(chatId, text) {
  const url = `${TELEGRAM_API_URL}sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text
  };
  
  await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function sendVideo(chatId, videoUrl) {
  const url = `${TELEGRAM_API_URL}sendVideo`;
  const payload = {
    chat_id: chatId,
    video: videoUrl
  };

  await fetch(url, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
