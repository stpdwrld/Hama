const TELEGRAM_TOKEN = '7644792138:AAGRKJmmuFz8axrc85Xm4lXy9BbJ4GNxzzw';
const BASE_URL = 'https://api.telegram.org/bot' + TELEGRAM_TOKEN;
const PROXY_DATA_URL = 'https://raw.githubusercontent.com/stpdwrld/Stupid-Tunnel/refs/heads/main/allproxy.txt';
const ALLOWED_TOPIC_NAME = "Asisten Bot";

// Domain and wildcard options
const DOMAINS = [
    'vpn.stupidworld.web.id',
    'world.stupx2.my.id',
    'vpn.luckystup-id.xyz'
];

const WILDCARDS = [
    'ava.game.naver.com', 'df.game.naver.com', 'graph.instagram.com', 'zaintest.vuclip.com',
    'support.zoom.us', 'cache.netflix.com', 'bakrie.ac.id', 'quiz.int.vidio.com', 'quiz.vidio.com', 'investor.fb.com',
    'img.email2.vidio.com', 'app.gopay.co.id', 'www.uii.ac.id', 'untar.ac.id'
];

// Cache for proxy data
let proxyData = null;
let lastFetchTime = 0;

async function fetchProxyData() {
    const now = Date.now();
    // Cache for 1 hour
    if (!proxyData || now - lastFetchTime > 3600000) {
        const response = await fetch(PROXY_DATA_URL);
        const text = await response.text();
        proxyData = text.split('\n').filter(line => line.trim()).map(line => {
            const [proxy, port, countryCode, isp] = line.split(',');
            return { proxy, port, countryCode, isp };
        });
        lastFetchTime = now;
    }
    return proxyData;
}

async function getUniqueCountryCodes() {
    const data = await fetchProxyData();
    const countryCodes = [...new Set(data.map(item => item.countryCode))];
    return countryCodes.sort();
}

async function getISPsByCountry(countryCode) {
    const data = await fetchProxyData();
    const isps = [...new Set(data
        .filter(item => item.countryCode === countryCode)
        .map(item => item.isp))];
    return isps.sort();
}

async function getProxyByCountryAndISP(countryCode, isp) {
    const data = await fetchProxyData();
    const proxies = data.filter(item => 
        item.countryCode === countryCode && item.isp === isp
    );
    return proxies.length > 0 ? proxies[0] : null;
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateLinks(proxy, domain, wildcard) {
    const uuid = generateUUID();
    const method = 'aes-256-gcm';
    const password = generateRandomString(12);
    const mainDomain = domain;
    const fullDomain = wildcard ? `${wildcard}.${domain}` : domain;
    const ip = proxy.proxy;
    const port = proxy.port;
    const server = `${proxy.countryCode}-${proxy.isp}`.replace(/\s+/g, '-');

    return {
        // VLESS
        vlessTls: `vless://${uuid}@${mainDomain}:443?host=${fullDomain}&path=%2FStupid-World%2F${ip}-${port}&security=tls&sni=${fullDomain}&type=ws#${server}`,
        vlessNtls: `vless://${uuid}@${mainDomain}:80?flow=&host=${fullDomain}&path=%2FStupid-World%2F${ip}-${port}&type=ws#${server}`,

        // Trojan
        trojanTls: `trojan://${uuid}@${mainDomain}:443?host=${fullDomain}&path=%2FStupid-World%2F${ip}-${port}&security=tls&sni=${fullDomain}&type=ws#${server}`,
        trojanNtls: `trojan://${uuid}@${mainDomain}:80?host=${fullDomain}&path=%2FStupid-World%2F${ip}-${port}&type=ws#${server}`,

        // VMess
        vmessTls: `vmess://` + btoa(JSON.stringify({
            v: "2",
            ps: server,
            add: mainDomain,
            port: "443",
            id: uuid,
            aid: "0",
            net: "ws",
            type: "none",
            host: fullDomain,
            path: `/Stupid-World/${ip}-${port}`,
            tls: "tls",
            sni: fullDomain,
            scy: "zero"
        })),
        vmessNtls: `vmess://` + btoa(JSON.stringify({
            v: "2",
            ps: server,
            add: mainDomain,
            port: "80",
            id: uuid,
            aid: "0",
            net: "ws",
            type: "none",
            host: fullDomain,
            path: `/Stupid-World/${ip}-${port}`,
            tls: "",
            scy: "zero"
        })),

        // Shadowsocks
        ss: `ss://${btoa(`${method}:${password}`)}@${mainDomain}:443?encryption=none&type=ws&host=${fullDomain}&path=%2FStupid-World%2F${ip}-${port}&security=tls&sni=${fullDomain}#${server}`
    };
}

function formatLinkMessage(links) {
    return `✅ Akun berhasil dibuat:

*VMESS TLS:*
\`\`\`${links.vmessTls}\`\`\`

*VMESS NTLS:*
\`\`\`${links.vmessNtls}\`\`\`

*VLESS TLS:*
\`\`\`${links.vlessTls}\`\`\`

*VLESS NTLS:*
\`\`\`${links.vlessNtls}\`\`\`

*TROJAN TLS:*
\`\`\`${links.trojanTls}\`\`\`

*TROJAN NTLS:*
\`\`\`${links.trojanNtls}\`\`\`

*SHADOWSOCKS:*
\`\`\`${links.ss}\`\`\`

Gunakan salah satu konfigurasi di aplikasi VPN Anda.`;
}

async function sendMessage(chatId, text, replyMarkup = null, messageThreadId = null) {
    const url = `${BASE_URL}/sendMessage`;
    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
    };
    
    if (messageThreadId) {
        body.message_thread_id = messageThreadId;
    }
    
    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    return response.json();
}

async function editMessage(chatId, messageId, text, replyMarkup = null) {
    const url = `${BASE_URL}/editMessageText`;
    const body = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown'
    };
    
    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    return response.json();
}

async function deleteMessage(chatId, messageId) {
    const url = `${BASE_URL}/deleteMessage`;
    const body = {
        chat_id: chatId,
        message_id: messageId
    };
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    
    return response.json();
}

async function handleStartCommand(chatId) {
    const countryCodes = await getUniqueCountryCodes();
    const buttons = countryCodes.map(code => [{ text: code, callback_data: `country_${code}` }]);
    
    await sendMessage(chatId, 'Pilih Country Code:', {
        inline_keyboard: buttons
    });
}

async function handleCountrySelection(chatId, messageId, countryCode, page = 0) {
    const isps = await getISPsByCountry(countryCode);
    const pageSize = 8;
    const totalPages = Math.ceil(isps.length / pageSize);
    const paginatedIsps = isps.slice(page * pageSize, (page + 1) * pageSize);
    
    const buttons = paginatedIsps.map(isp => [{ text: isp, callback_data: `isp_${countryCode}_${isp}` }]);
    
    // Add navigation buttons
    const navButtons = [];
    if (page > 0) {
        navButtons.push({ text: '⬅️ Prev', callback_data: `countrypage_${countryCode}_${page - 1}` });
    }
    navButtons.push({ text: '🔙 Back', callback_data: 'back_to_countries' });
    if (page < totalPages - 1) {
        navButtons.push({ text: 'Next ➡️', callback_data: `countrypage_${countryCode}_${page + 1}` });
    }
    
    await editMessage(chatId, messageId, `Pilih ISP untuk ${countryCode}:`, {
        inline_keyboard: [...buttons, navButtons]
    });
}

async function handleISPSelection(chatId, messageId, countryCode, isp) {
    const domainButtons = DOMAINS.map(domain => [{ text: domain, callback_data: `domain_${countryCode}_${isp}_${domain}` }]);
    
    await editMessage(chatId, messageId, `Pilih Domain untuk ${countryCode} - ${isp}:`, {
        inline_keyboard: [...domainButtons, [{ text: '🔙 Back', callback_data: `back_to_isps_${countryCode}` }]]
    });
}

async function handleDomainSelection(chatId, messageId, countryCode, isp, domain) {
    const wildcardButtons = [
        [{ text: 'With Wildcard', callback_data: `wildcard_${countryCode}_${isp}_${domain}_1` }],
        [{ text: 'No Wildcard', callback_data: `wildcard_${countryCode}_${isp}_${domain}_0` }],
        [{ text: '🔙 Back', callback_data: `back_to_domains_${countryCode}_${isp}` }]
    ];
    
    await editMessage(chatId, messageId, `Pilih Wildcard untuk ${domain}:`, {
        inline_keyboard: wildcardButtons
    });
}

async function handleWildcardSelection(chatId, messageId, countryCode, isp, domain, useWildcard) {
    const proxy = await getProxyByCountryAndISP(countryCode, isp);
    
    if (!proxy) {
        await editMessage(chatId, messageId, '❌ Tidak dapat menemukan proxy untuk kombinasi ini.');
        return;
    }
    
    const wildcard = useWildcard === '1' ? WILDCARDS[Math.floor(Math.random() * WILDCARDS.length)] : null;
    const links = generateLinks(proxy, domain, wildcard);
    const message = formatLinkMessage(links);
    
    await editMessage(chatId, messageId, message);
}

async function handleCallbackQuery(chatId, messageId, data) {
    if (data.startsWith('country_')) {
        const countryCode = data.split('_')[1];
        await handleCountrySelection(chatId, messageId, countryCode);
    } 
    else if (data.startsWith('countrypage_')) {
        const [_, countryCode, page] = data.split('_');
        await handleCountrySelection(chatId, messageId, countryCode, parseInt(page));
    }
    else if (data.startsWith('isp_')) {
        const [_, countryCode, isp] = data.split('_');
        await handleISPSelection(chatId, messageId, countryCode, isp);
    }
    else if (data.startsWith('domain_')) {
        const [_, countryCode, isp, domain] = data.split('_');
        await handleDomainSelection(chatId, messageId, countryCode, isp, domain);
    }
    else if (data.startsWith('wildcard_')) {
        const [_, countryCode, isp, domain, useWildcard] = data.split('_');
        await handleWildcardSelection(chatId, messageId, countryCode, isp, domain, useWildcard);
    }
    else if (data === 'back_to_countries') {
        await handleStartCommand(chatId);
        await deleteMessage(chatId, messageId);
    }
    else if (data.startsWith('back_to_isps_')) {
        const countryCode = data.split('_')[3];
        await handleCountrySelection(chatId, messageId, countryCode);
    }
    else if (data.startsWith('back_to_domains_')) {
        const [_, countryCode, isp] = data.split('_').slice(2);
        await handleISPSelection(chatId, messageId, countryCode, isp);
    }
}

async function getForumTopic(chatId, threadId) {
    if (!threadId) return null;
    
    try {
        const response = await fetch(`${BASE_URL}/getForumTopic`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: chatId,
                message_thread_id: threadId
            })
        });
        
        const result = await response.json();
        return result.ok ? result.result : null;
    } catch (error) {
        console.error('Error getting forum topic:', error);
        return null;
    }
}

async function handleUpdate(update) {
    if (!update) return;
    
    try {
        if (update.message) {
            const chatId = update.message.chat.id;
            const text = update.message.text || '';
            const messageThreadId = update.message.message_thread_id || null;
            
            // Jika di grup dan bukan di thread yang diizinkan, abaikan
            if (update.message.chat.type !== 'private') {
                // Dapatkan informasi thread/topik
                const topicInfo = await getForumTopic(chatId, messageThreadId);
                
                if (!topicInfo || topicInfo.name !== ALLOWED_TOPIC_NAME) {
                    // Jika bukan di topik yang diizinkan, abaikan pesan
                    return new Response('OK');
                }
            }
            
            if (text.startsWith('/start')) {
                await handleStartCommand(chatId);
            }
        }
        else if (update.callback_query) {
            const chatId = update.callback_query.message.chat.id;
            const messageId = update.callback_query.message.message_id;
            const data = update.callback_query.data;
            const messageThreadId = update.callback_query.message.message_thread_id || null;
            
            // Jika di grup dan bukan di thread yang diizinkan, abaikan
            if (update.callback_query.message.chat.type !== 'private') {
                const topicInfo = await getForumTopic(chatId, messageThreadId);
                
                if (!topicInfo || topicInfo.name !== ALLOWED_TOPIC_NAME) {
                    // Jika bukan di topik yang diizinkan, abaikan callback
                    return new Response('OK');
                }
            }
            
            await handleCallbackQuery(chatId, messageId, data);
        }
    } catch (error) {
        console.error('Error handling update:', error);
    }
}

export default {
    async fetch(request, env) {
        if (request.method === 'POST') {
            const update = await request.json();
            await handleUpdate(update);
            return new Response('OK');
        }
        
        return new Response('Hello World!');
    }
};
