const WILDCARD_DOMAINS = [
    'ava.game.naver.com', 'df.game.naver.com', 'graph.instagram.com', 'zaintest.vuclip.com',
    'support.zoom.us', 'cache.netflix.com', 'bakrie.ac.id', 'quiz.int.vidio.com', 'quiz.vidio.com', 'investor.fb.com',
    'img.email2.vidio.com', 'app.gopay.co.id', 'www.uii.ac.id', 'untar.ac.id'
];

const TELEGRAM_TOKEN = '7644792138:AAGRKJmmuFz8axrc85Xm4lXy9BbJ4GNxzzw';
const PROXY_DATA_URL = 'https://raw.githubusercontent.com/stpdwrld/Stupid-Tunnel/refs/heads/main/allproxy.txt';
const UUID = 'f282b878-8711-45a1-8c69-5564172123c1';
const MAX_RESULT_SIZE = 50 * 1024 * 1024; // 50MB
const API_URL = 'https://api2.stupidworld.web.id/check?ip=';
const GITHUB_TOKEN = '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';
const GITHUB_REPO = 'stpdwrld/666';

// Multiple main domains
const MAIN_DOMAINS = [
    'vpn.stupidworld.web.id',
    'world.stupx2.my.id'
];

// Cache for proxy data
let proxyDataCache = null;
let lastFetchTime = 0;
let ISP_CACHE = {};

// Items per page for pagination
const ITEMS_PER_PAGE = 10;

// Group and thread restrictions
const ALLOWED_CHAT_ID = -1002619809398; // ID grup (harus negatif untuk supergroup)
const ALLOWED_THREAD_ID = 22; // ID thread/topik

// Fungsi untuk memeriksa apakah pesan berasal dari grup dan thread yang diizinkan
function isAllowedMessage(message) {
    if (!message) return false;
    
    // Check chat ID
    if (message.chat.id !== ALLOWED_CHAT_ID) {
        return false;
    }
    
    // Check if message is in the allowed thread or is a command in the main group
    if (message.message_thread_id && message.message_thread_id !== ALLOWED_THREAD_ID) {
        return false;
    }
    
    return true;
}

// Fungsi untuk decode base64 di lingkungan CF Workers
function decodeBase64(str) {
  // Alternatif 1: Menggunakan atob (browser API)
  if (typeof atob === 'function') {
    return atob(str);
  }
  
  // Alternatif 2: Implementasi manual base64 decode
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  let char1, char2, char3;
  let enc1, enc2, enc3, enc4;

  // Remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  str = str.replace(/[^A-Za-z0-9+/=]/g, '');

  while (i < str.length) {
    enc1 = base64Chars.indexOf(str.charAt(i++));
    enc2 = base64Chars.indexOf(str.charAt(i++));
    enc3 = base64Chars.indexOf(str.charAt(i++));
    enc4 = base64Chars.indexOf(str.charAt(i++));

    char1 = (enc1 << 2) | (enc2 >> 4);
    char2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    char3 = ((enc3 & 3) << 6) | enc4;

    result += String.fromCharCode(char1);
    if (enc3 !== 64) result += String.fromCharCode(char2);
    if (enc4 !== 64) result += String.fromCharCode(char3);
  }

  return result;
}

function parseV2RayLink(link, counter = 0) {
  try {
    if (link.startsWith('vmess://')) {
      const base64 = link.substring(8);
      const decoded = decodeBase64(base64);
      let config;
      
      try {
        config = JSON.parse(decoded);
      } catch (e) {
        const match = decoded.match(/{"v":"\d+".*}/);
        if (match) {
          config = JSON.parse(match[0]);
        } else {
          throw new Error('Format VMess tidak valid');
        }
      }
      
      // Tambahkan counter jika lebih dari 0
      const nameSuffix = counter > 0 ? ` ${counter + 1}` : '';
      return {
        type: 'vmess',
        name: (config.ps || `VMess-${config.add}:${config.port}`) + nameSuffix,
        server: config.add,
        port: config.port,
        uuid: config.id,
        alterId: config.aid || 0,
        cipher: config.scy || 'auto',
        tls: config.tls === 'tls',
        skipCertVerify: false,
        network: config.net || 'tcp',
        wsPath: config.path || '',
        wsHost: config.host || config.add,
        sni: config.sni || config.host || config.add
      };
    }

    if (link.startsWith('vless://')) {
      const url = new URL(link);
      const params = new URLSearchParams(url.search);
      const nameSuffix = counter > 0 ? ` ${counter + 1}` : '';
      
      return {
        type: 'vless',
        name: decodeURIComponent(url.hash.substring(1)) + nameSuffix,
        server: url.hostname,
        port: parseInt(url.port),
        uuid: url.username,
        tls: params.get('security') === 'tls',
        skipCertVerify: false,
        network: params.get('type') || 'tcp',
        wsPath: params.get('path') || '',
        wsHost: params.get('host') || url.hostname,
        sni: params.get('sni') || params.get('host') || url.hostname
      };
    }

    if (link.startsWith('trojan://')) {
      const url = new URL(link);
      const params = new URLSearchParams(url.search);
      const nameSuffix = counter > 0 ? ` ${counter + 1}` : '';
      
      return {
        type: 'trojan',
        name: decodeURIComponent(url.hash.substring(1)) + nameSuffix,
        server: url.hostname,
        port: parseInt(url.port),
        password: url.username,
        tls: params.get('security') === 'tls',
        skipCertVerify: false,
        network: params.get('type') || 'tcp',
        wsPath: params.get('path') || '',
        wsHost: params.get('host') || url.hostname,
        sni: params.get('sni') || params.get('host') || url.hostname
      };
    }

    if (link.startsWith('ss://')) {
      const url = new URL(link);
      const params = new URLSearchParams(url.search);
      const nameSuffix = counter > 0 ? ` ${counter + 1}` : '';
      
      if (params.get('plugin') === 'v2ray-plugin' || params.get('type') === 'ws') {
        return {
          type: 'ss',
          name: decodeURIComponent(url.hash.substring(1)) + nameSuffix,
          server: url.hostname,
          port: parseInt(url.port),
          cipher: url.protocol.substring(3) || 'none',
          password: url.username,
          tls: params.get('security') === 'tls',
          skipCertVerify: false,
          network: params.get('type') || 'tcp',
          wsPath: params.get('path') || '',
          wsHost: params.get('host') || url.hostname,
          sni: params.get('sni') || params.get('host') || url.hostname
        };
      }

      throw new Error('Shadowsocks link invalid');
    }

    throw new Error('Unsupported link type');
  } catch (error) {
    console.error(`Failed to parse link: ${link}`, error);
    throw new Error(`Gagal parsing link VMess: ${error.message}`);
  }
}

function generateClashConfig(links, isFullConfig = false) {
  // Kelompokkan link berdasarkan type
  const groupedLinks = {};
  links.forEach((link, index) => {
    const type = link.startsWith('vmess://') ? 'vmess' : 
                link.startsWith('vless://') ? 'vless' :
                link.startsWith('trojan://') ? 'trojan' : 'ss';
    
    if (!groupedLinks[type]) groupedLinks[type] = [];
    groupedLinks[type].push(link);
  });

  // Parse link dengan counter per type
  let parsedLinks = [];
  Object.keys(groupedLinks).forEach(type => {
    groupedLinks[type].forEach((link, index) => {
      parsedLinks.push(parseV2RayLink(link, index));
    });
  });
  
  let config = `# Clash Configuration\n# Generated at: ${new Date().toISOString()}\n\n`;
  
  if (isFullConfig) {
    config += `port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
external-controller: 127.0.0.1:9090

dns:
  enable: true
  listen: 0.0.0.0:53
  enhanced-mode: redir-host
  nameserver:
    - 8.8.8.8
    - https://dns.google/dns-query
  fallback:
    - 8.8.4.4
    - https://dns.google/dns-query

rule-providers:
  ⛔ ADS:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/malikshi/open_clash/main/rule_provider/rule_basicads.yaml"
    path: "./rule_provider/rule_basicads.yaml"
    interval: 86400

  🔞 Porn:
    type: http
    behavior: domain
    url: "https://raw.githubusercontent.com/malikshi/open_clash/main/rule_provider/rule_porn.yaml"
    path: "./rule_provider/rule_porn.yaml"
    interval: 86400

`;
  }
  
  config += `proxies:\n`;
  
  parsedLinks.forEach(link => {
    config += `  - name: "${link.name}"\n`;
    config += `    type: ${link.type}\n`;
    config += `    server: ${link.server}\n`;
    config += `    port: ${link.port}\n`;
    
    if (link.type === 'vmess') {
      config += `    uuid: ${link.uuid}\n`;
      config += `    alterId: ${link.alterId}\n`;
      config += `    cipher: ${link.cipher}\n`;
    } else if (link.type === 'vless') {
      config += `    uuid: ${link.uuid}\n`;
    } else if (link.type === 'trojan') {
      config += `    password: ${link.password}\n`;
    } else if (link.type === 'ss') {
      config += `    cipher: ${link.cipher}\n`;
      config += `    password: ${link.password}\n`;
    }
    
    config += `    udp: true\n`;
    
    if (link.tls) {
      config += `    tls: true\n`;
      config += `    skip-cert-verify: ${link.skipCertVerify}\n`;
      if (link.sni) {
        config += `    servername: ${link.sni}\n`;
      }
    }
    
    if (link.network === 'ws') {
      config += `    network: ws\n`;
      config += `    ws-opts:\n`;
      config += `      path: "${link.wsPath}"\n`;
      if (link.wsHost) {
        config += `      headers:\n`;
        config += `        Host: "${link.wsHost}"\n`;
      }
    }
    
    config += '\n';
  });
  
  if (isFullConfig) {
    config += `proxy-groups:
  - name: "INTERNET"
    type: select
    proxies:
      - "BALANCED"
      - "SELECTOR"
      - "BEST-PING"
      - "DIRECT"
      - "REJECT"

  - name: "SELECTOR"
    type: select
    proxies:
      - "DIRECT"
      - "REJECT"\n`;
    
    parsedLinks.forEach(link => {
      config += `      - "${link.name}"\n`;
    });
    
    config += `
  - name: "BEST-PING"
    type: url-test
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:\n`;
    
    parsedLinks.forEach(link => {
      config += `      - "${link.name}"\n`;
    });
    
    config += `
  - name: "BALANCED"
    type: load-balance
    url: "http://www.gstatic.com/generate_204"
    interval: 300
    tolerance: 50
    proxies:\n`;
    
    parsedLinks.forEach(link => {
      config += `      - "${link.name}"\n`;
    });
    
    config += `
  - name: "PORN"
    type: select
    proxies:
      - "REJECT"
      - "SELECTOR"

  - name: "ADS"
    type: select
    proxies:
      - "REJECT"
      - "SELECTOR"

rules:
  - RULE-SET,⛔ ADS,ADS
  - RULE-SET,🔞 Porn,PORN
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT
  - MATCH,INTERNET\n`;
  }
  
  return config;
}

function generateNekoboxConfig(links, isFullConfig = false) {
  const groupedLinks = {};
  links.forEach((link, index) => {
    const type = link.startsWith('vmess://') ? 'vmess' : 
                link.startsWith('vless://') ? 'vless' :
                link.startsWith('trojan://') ? 'trojan' : 'ss';
    
    if (!groupedLinks[type]) groupedLinks[type] = [];
    groupedLinks[type].push(link);
  });

  let parsedLinks = [];
  Object.keys(groupedLinks).forEach(type => {
    groupedLinks[type].forEach((link, index) => {
      parsedLinks.push(parseV2RayLink(link, index));
    });
  });
  
  let config = isFullConfig 
    ? `{
  "dns": {
    "final": "dns-final",
    "independent_cache": true,
    "rules": [
      {
        "disable_cache": false,
        "domain": [
          "family.cloudflare-dns.com"
        ],
        "server": "direct-dns"
      }
    ],
    "servers": [
      {
        "address": "https://family.cloudflare-dns.com/dns-query",
        "address_resolver": "direct-dns",
        "strategy": "ipv4_only",
        "tag": "remote-dns"
      },
      {
        "address": "local",
        "strategy": "ipv4_only",
        "tag": "direct-dns"
      },
      {
        "address": "local",
        "address_resolver": "dns-local",
        "strategy": "ipv4_only",
        "tag": "dns-final"
      },
      {
        "address": "local",
        "tag": "dns-local"
      },
      {
        "address": "rcode://success",
        "tag": "dns-block"
      }
    ]
  },
  "experimental": {
    "cache_file": {
      "enabled": true,
      "path": "../cache/clash.db",
      "store_fakeip": true
    },
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "external_ui": "../files/yacd"
    }
  },
  "inbounds": [
    {
      "listen": "0.0.0.0",
      "listen_port": 6450,
      "override_address": "8.8.8.8",
      "override_port": 53,
      "tag": "dns-in",
      "type": "direct"
    },
    {
      "domain_strategy": "",
      "endpoint_independent_nat": true,
      "inet4_address": [
        "172.19.0.1/28"
      ],
      "mtu": 9000,
      "sniff": true,
      "sniff_override_destination": true,
      "stack": "system",
      "tag": "tun-in",
      "type": "tun"
    },
    {
      "domain_strategy": "",
      "listen": "0.0.0.0",
      "listen_port": 2080,
      "sniff": true,
      "sniff_override_destination": true,
      "tag": "mixed-in",
      "type": "mixed"
    }
  ],
  "log": {
    "level": "info"
  },
  "outbounds": [
    {
      "tag": "Internet",
      "type": "selector",
      "outbounds": [
        "Best Latency",\n`
    : `{
  "outbounds": [\n`;
  
  // Add proxy tags for selector
  parsedLinks.forEach(link => {
    config += `        "${link.name}",\n`;
  });
  
  if (isFullConfig) {
    config += `        "direct"
      ]
    },
    {
      "type": "urltest",
      "tag": "Best Latency",
      "outbounds": [\n`;
    
    parsedLinks.forEach(link => {
      config += `        "${link.name}",\n`;
    });
    
    config += `        "direct"
      ],
      "url": "https://detectportal.firefox.com/success.txt",
      "interval": "1m0s"
    },\n`;
  }
  
  // Add proxy configurations
  parsedLinks.forEach((link, index) => {
    if (index > 0) config += ',\n';
    
    config += `    {\n`;
    config += `      "tag": "${link.name}",\n`;
    
    if (link.type === 'vmess') {
      config += `      "type": "vmess",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "alter_id": ${link.alterId || 0},\n`;
      config += `      "security": "${link.cipher || "auto"}",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    } 
    else if (link.type === 'vless') {
      config += `      "type": "vless",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "flow": "",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'trojan') {
      config += `      "type": "trojan",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'ss') {
      config += `      "type": "shadowsocks",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "method": "${link.cipher || "none"}",\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "plugin": "v2ray-plugin",\n`;
      config += `      "plugin_opts": "mux=0;path=${link.wsPath};host=${link.wsHost || link.server};tls=${link.tls ? "1" : "0"}"\n`;
    }
    
    config += `    }`;
  });
  
  if (isFullConfig) {
    config += `,\n    {
      "tag": "direct",
      "type": "direct"
    },
    {
      "tag": "bypass",
      "type": "direct"
    },
    {
      "tag": "block",
      "type": "block"
    },
    {
      "tag": "dns-out",
      "type": "dns"
    }
  ],
  "route": {
    "auto_detect_interface": true,
    "rules": [
      {
        "outbound": "dns-out",
        "port": [
          53
        ]
      },
      {
        "inbound": [
          "dns-in"
        ],
        "outbound": "dns-out"
      },
      {
        "network": [
          "udp"
        ],
        "outbound": "block",
        "port": [
          443
        ],
        "port_range": []
      },
      {
        "ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ],
        "outbound": "block",
        "source_ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ]
      }
    ]
  }
}`;
  } else {
    config += `\n  ]
}`;
  }
  
  return config;
}

function generateSingboxConfig(links, isFullConfig = false) {
  const groupedLinks = {};
  links.forEach((link, index) => {
    const type = link.startsWith('vmess://') ? 'vmess' : 
                link.startsWith('vless://') ? 'vless' :
                link.startsWith('trojan://') ? 'trojan' : 'ss';
    
    if (!groupedLinks[type]) groupedLinks[type] = [];
    groupedLinks[type].push(link);
  });

  let parsedLinks = [];
  Object.keys(groupedLinks).forEach(type => {
    groupedLinks[type].forEach((link, index) => {
      parsedLinks.push(parseV2RayLink(link, index));
    });
  });

  
  let config = isFullConfig 
    ? `{
  "log": {
    "level": "info"
  },
  "dns": {
    "servers": [
      {
        "tag": "remote-dns",
        "address": "https://8.8.8.8/dns-query",
        "address_resolver": "direct-dns",
        "strategy": "ipv4_only"
      },
      {
        "tag": "direct-dns",
        "address": "local",
        "strategy": "ipv4_only"
      },
      {
        "tag": "dns-final",
        "address": "local",
        "address_resolver": "dns-local",
        "strategy": "ipv4_only"
      },
      {
        "tag": "dns-local",
        "address": "local"
      },
      {
        "tag": "dns-block",
        "address": "rcode://success"
      }
    ],
    "rules": [
      {
        "domain": [
          "8.8.8.8"
        ],
        "server": "direct-dns"
      }
    ],
    "final": "dns-final",
    "independent_cache": true
  },
  "inbounds": [
    {
      "type": "tun",
      "mtu": 1400,
      "inet4_address": "172.19.0.1/30",
      "inet6_address": "fdfe:dcba:9876::1/126",
      "auto_route": true,
      "strict_route": true,
      "endpoint_independent_nat": true,
      "stack": "mixed",
      "sniff": true
    }
  ],
  "outbounds": [
    {
      "tag": "Internet",
      "type": "selector",
      "outbounds": [
        "Best Latency",\n`
    : `{
  "outbounds": [\n`;
  
  // Add proxy tags for selector
  parsedLinks.forEach(link => {
    config += `        "${link.name}",\n`;
  });
  
  if (isFullConfig) {
    config += `        "direct"
      ]
    },
    {
      "type": "urltest",
      "tag": "Best Latency",
      "outbounds": [\n`;
    
    parsedLinks.forEach(link => {
      config += `        "${link.name}",\n`;
    });
    
    config += `        "direct"
      ],
      "url": "https://www.google.com",
      "interval": "10s"
    },\n`;
  }
  
  // Add proxy configurations
  parsedLinks.forEach((link, index) => {
    if (index > 0) config += ',\n';
    
    config += `    {\n`;
    config += `      "tag": "${link.name}",\n`;
    
    if (link.type === 'vmess') {
      config += `      "type": "vmess",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "alter_id": ${link.alterId || 0},\n`;
      config += `      "security": "${link.cipher || "zero"}",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    } 
    else if (link.type === 'vless') {
      config += `      "type": "vless",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "uuid": "${link.uuid}",\n`;
      config += `      "packet_encoding": "xudp",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'trojan') {
      config += `      "type": "trojan",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "domain_strategy": "ipv4_only",\n`;
      
      if (link.tls) {
        config += `      "tls": {\n`;
        config += `        "enabled": true,\n`;
        config += `        "server_name": "${link.sni || link.wsHost || link.server}",\n`;
        config += `        "insecure": ${link.skipCertVerify},\n`;
        config += `        "utls": {\n`;
        config += `          "enabled": true,\n`;
        config += `          "fingerprint": "randomized"\n`;
        config += `        }\n`;
        config += `      },\n`;
      }
      
      if (link.network === 'ws') {
        config += `      "transport": {\n`;
        config += `        "type": "ws",\n`;
        config += `        "path": "${link.wsPath}",\n`;
        config += `        "headers": {\n`;
        config += `          "Host": "${link.wsHost || link.server}"\n`;
        config += `        },\n`;
        config += `        "early_data_header_name": "Sec-WebSocket-Protocol"\n`;
        config += `      },\n`;
      }
      
      config += `      "multiplex": {\n`;
      config += `        "enabled": false,\n`;
      config += `        "protocol": "smux",\n`;
      config += `        "max_streams": 32\n`;
      config += `      }\n`;
    }
    else if (link.type === 'ss') {
      config += `      "type": "shadowsocks",\n`;
      config += `      "server": "${link.server}",\n`;
      config += `      "server_port": ${link.port},\n`;
      config += `      "method": "${link.cipher || "none"}",\n`;
      config += `      "password": "${link.password}",\n`;
      config += `      "plugin": "v2ray-plugin",\n`;
      config += `      "plugin_opts": "mux=0;path=${link.wsPath};host=${link.wsHost || link.server};tls=${link.tls ? "1" : "0"}"\n`;
    }
    
    config += `    }`;
  });
  
  if (isFullConfig) {
    config += `,\n    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "direct",
      "tag": "bypass"
    },
    {
      "type": "block",
      "tag": "block"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    }
  ],
  "route": {
    "rules": [
      {
        "port": 53,
        "outbound": "dns-out"
      },
      {
        "inbound": "dns-in",
        "outbound": "dns-out"
      },
      {
        "network": "udp",
        "port": 443,
        "outbound": "block"
      },
      {
        "source_ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ],
        "ip_cidr": [
          "224.0.0.0/3",
          "ff00::/8"
        ],
        "outbound": "block"
      }
    ],
    "auto_detect_interface": true
  },
  "experimental": {
    "cache_file": {
      "enabled": false
    },
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "external_ui": "ui",
      "external_ui_download_url": "https://github.com/MetaCubeX/metacubexd/archive/gh-pages.zip",
      "external_ui_download_detour": "Internet",
      "secret": "stupid",
      "default_mode": "rule"
    }
  }
}`;
  } else {
    config += `\n  ]
}`;
  }
  
  return config;
}

async function fetchProxyData() {
  const now = Date.now();
  // Cache for 1 hour (3600000 ms)
  if (proxyDataCache && now - lastFetchTime < 3600000) {
    return proxyDataCache;
  }

  try {
    const response = await fetch(PROXY_DATA_URL, {
      headers: {
        'User-Agent': 'Cloudflare-Worker'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('Raw proxy data:', text.substring(0, 100)); // Log first 100 chars
    
    const lines = text.trim().split('\n');
    const data = lines.map(line => {
      const parts = line.split(',');
      // Ensure we have at least IP and port
      if (parts.length < 2) {
        console.warn('Invalid proxy line:', line);
        return null;
      }
      return {
        ip: parts[0].trim(),
        port: parts[1].trim(),
        countryCode: parts[2] ? parts[2].trim() : 'N/A',
        isp: parts[3] ? parts[3].trim() : 'N/A'
      };
    }).filter(item => item !== null);
    
    if (data.length === 0) {
      throw new Error('No valid proxy data found');
    }
    
    proxyDataCache = data;
    lastFetchTime = now;
    return data;
  } catch (error) {
    console.error('Error fetching proxy data:', error);
    // Return cached data if available, even if stale
    if (proxyDataCache) {
      console.warn('Using stale proxy data due to fetch error');
      return proxyDataCache;
    }
    throw error; // Re-throw if no cache available
  }
}

async function checkProxyStatus(ip, port) {
    const url = `https://api2.stupidworld.web.id/check?ip=${ip}:${port}`;
    console.log(`Checking proxy status for ${ip}:${port}...`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.proxyip === true) {
            return {
                status: 'active',
                ip: data.ip ?? 'Unknown',
                port: data.port ?? 'Unknown',
                asOrganization: data.asOrganization ?? 'Unknown',
                countryCode: data.countryCode ?? 'Unknown',
                countryName: data.countryName ?? 'Unknown',
                countryFlag: data.countryFlag ?? '',
                asn: data.asn ?? 'Unknown',
                city: data.colo ?? '',
                httpProtocol: data.httpProtocol ?? 'Unknown',
                delay: data.delay ?? 'Unknown',
                latitude: data.latitude ?? 'Unknown',
                longitude: data.longitude ?? 'Unknown'
            };
        } else {
            return {
                status: 'dead',
                message: data.message ?? 'Proxy mati'
            };
        }
    } catch (error) {
        console.error('Error checking proxy status:', error);
        return {
            status: 'dead',
            message: 'Gagal menghubungi server pengecekan.'
        };
    }
}

function generateConfigs(ip, port, serverName, selectedDomain = null, wildcardDomain = null) {
    // Choose a random domain if none is selected
    const mainDomain = selectedDomain || MAIN_DOMAINS[Math.floor(Math.random() * MAIN_DOMAINS.length)];
    
    // Determine the domain structure based on wildcard selection
    let configDomain, configHost, configSni;
    
    if (wildcardDomain) {
        // If wildcard is selected, use wildcard as main domain and combined domain as host
        configDomain = wildcardDomain;
        configHost = `${wildcardDomain}.${mainDomain}`;
        configSni = `${wildcardDomain}.${mainDomain}`;
    } else {
        // No wildcard - use main domain for everything
        configDomain = mainDomain;
        configHost = mainDomain;
        configSni = mainDomain;
    }
    
    // VLESS
    const vlessTls = `vless://${UUID}@${configDomain}:443?host=${configHost}&path=%2FStupid-World%2F${ip}-${port}&security=tls&sni=${configSni}&type=ws#${serverName}`;
    const vlessNtls = `vless://${UUID}@${configDomain}:80?flow=&host=${configHost}&path=%2FStupid-World%2F${ip}-${port}&type=ws#${serverName}`;

    // Trojan
    const trojanTls = `trojan://${UUID}@${configDomain}:443?host=${configHost}&path=%2FStupid-World%2F${ip}-${port}&security=tls&sni=${configSni}&type=ws#${serverName}`;
    const trojanNtls = `trojan://${UUID}@${configDomain}:80?host=${configHost}&path=%2FStupid-World%2F${ip}-${port}&type=ws#${serverName}`;

    // VMess
    const vmessTls = `vmess://${btoa(JSON.stringify({
        v: "2",
        ps: serverName,
        add: configDomain,
        port: "443",
        id: UUID,
        aid: "0",
        net: "ws",
        type: "none",
        host: configHost,
        path: `/Stupid-World/${ip}-${port}`,
        tls: "tls",
        sni: configSni,
        scy: "zero"
    }))}`;

    const vmessNtls = `vmess://${btoa(JSON.stringify({
        v: "2",
        ps: serverName,
        add: configDomain,
        port: "80",
        id: UUID,
        aid: "0",
        net: "ws",
        type: "none",
        host: configHost,
        path: `/Stupid-World/${ip}-${port}`,
        tls: "",
        scy: "zero"
    }))}`;

    // Shadowsocks
    const ss = `ss://${btoa(`none:${UUID}`)}@${configDomain}:443?encryption=none&type=ws&host=${configHost}&path=%2FStupid-World%2F${ip}-${port}&security=tls&sni=${configSni}#${serverName}`;

    return {
        vlessTls,
        vlessNtls,
        trojanTls,
        trojanNtls,
        vmessTls,
        vmessNtls,
        ss,
        domain: configDomain,
        host: configHost,
        sni: configSni
    };
}

// Fungsi untuk mengubah country code ke emoji flag
function getFlagEmoji(countryCode) {
    // Jika country code tidak ada atau tidak 2 karakter, return empty
    if (!countryCode || countryCode.length !== 2) return '';
    
    // Konversi ke uppercase untuk memastikan
    const code = countryCode.toUpperCase();
    
    // 127397 adalah offset untuk Regional Indicator Symbol
    return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt()));
}

async function handleCommand(command, chatId, messageId) {
  const proxyData = await fetchProxyData();

  if (command === '/start') {
    const countries = [...new Set(proxyData.map(item => item.countryCode))].sort();
    const keyboard = createCountryKeyboard(countries);
    await sendMessage(chatId, 'Pilih negara:', keyboard, messageId);
  } 
  else if (command === '/convert') {
    await sendMessage(chatId, 
      '🤖 Stupid World Converter Bot\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox Dan Clash.\n\nContoh:\nvless://...\nvmess://...\ntrojan://...\nss://...\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\nbaca baik-baik dulu sebelum nanya.',
      null, 
      messageId
    );
  } 
  else if (command === '/scan') {
    await sendMessage(chatId, 
      `Selamat datang di Proxy Scanner Bot!\n\nKirim proxy dalam format:\nip:port atau ip,port\n\nAtau kirimkan file .txt berisi proxy.\nsupport sampai 10-20k proxy.\n\nContoh penggunaan:\n.scan\nproxy:port\nproxy,port\n\n(Maksimal 10 proxy per permintaan)`,
      null,
      messageId
    );
  } 
  else if (command === '/proxylist') {
    await handleProxyListCommand(chatId, messageId);
  }
}

// Modifikasi handleCommand dan createPaginationKeyboard
function createCountryKeyboard(countries, page = 1) {
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const endIdx = startIdx + ITEMS_PER_PAGE;
  const paginatedCountries = countries.slice(startIdx, endIdx);
  
  const buttons = [];
  // Membuat 4 kolom
  for (let i = 0; i < paginatedCountries.length; i += 4) {
    const row = paginatedCountries.slice(i, i + 4).map(country => ({
      text: `${getFlagEmoji(country)} ${country}`,
      callback_data: `country_${country}`
    }));
    buttons.push(row);
  }
  
  // Add pagination controls
  const paginationButtons = [];
  if (page > 1) {
    paginationButtons.push({
      text: '⬅️ Previous',
      callback_data: `countrypage_${page - 1}`
    });
  }
  if (endIdx < countries.length) {
    paginationButtons.push({
      text: 'Next ➡️',
      callback_data: `countrypage_${page + 1}`
    });
  }
  
  if (paginationButtons.length > 0) {
    buttons.push(paginationButtons);
  }
  
  return { inline_keyboard: buttons };
}

async function cacheISP(country, ispList) {
  const cacheKey = `isp_${country}`;
  ISP_CACHE[cacheKey] = ispList;
  return ispList.map((isp, index) => ({ id: index, name: isp }));
}

async function createIspKeyboard(country, page = 1) {
  const proxyData = await fetchProxyData();
  const isps = [...new Set(proxyData
    .filter(item => item.countryCode === country)
    .map(item => item.isp))];
  
  const cachedISPs = await cacheISP(country, isps);
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const paginated = cachedISPs.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  return {
    inline_keyboard: [
      ...paginated.map(isp => [{
        text: isp.name.length > 20 ? `${isp.name.substring(0, 20)}...` : isp.name,
        callback_data: `isp_${country}_${isp.id}` // Hanya menyimpan ID
      }]),
      [
        { text: "⬅️ Prev", callback_data: `isppage_${country}_${page - 1}` },
        { text: "Next ➡️", callback_data: `isppage_${country}_${page + 1}` }
      ],
      [{ text: "🔙 Back", callback_data: "back_to_countries" }]
    ]
  };
}

async function createDomainKeyboard(country, ispId) {
  // Create buttons for main domains with wildcard option
  const domainButtons = MAIN_DOMAINS.map(domain => ({
    text: domain,
    callback_data: `domain_${country}_${ispId}_${domain}`
  }));

  // Create the keyboard with domain buttons and back button
  return {
    inline_keyboard: [
      ...domainButtons.map(btn => [btn]), // Each domain in its own row
      [{
        text: "🔙 Back to ISP List",
        callback_data: `isppage_${country}_1`
      }]
    ]
  };
}

async function createWildcardOptionsKeyboard(country, ispId, domain) {
  // Create buttons for wildcard domains and no wildcard option
  const wildcardButtons = WILDCARD_DOMAINS.map(wildcard => ({
    text: wildcard,
    callback_data: `wildcard_${country}_${ispId}_${domain}_${wildcard}`
  }));

  // Add "No Wildcard" option
  wildcardButtons.push({
    text: "❌ No Wildcard (Use Main Domain)",
    callback_data: `wildcard_${country}_${ispId}_${domain}_none`
  });

  // Create the keyboard with wildcard options and back button
  return {
    inline_keyboard: [
      ...wildcardButtons.map(btn => [btn]), // Each option in its own row
      [{
        text: "🔙 Back to Domain List",
        callback_data: `isp_${country}_${ispId}`
      }]
    ]
  };
}

async function createWildcardDomainKeyboard(country, isp, domain) {
  return {
    inline_keyboard: [
      ...WILDCARD_DOMAINS.map(wildcard => [{
        text: wildcard,
        callback_data: `wildcarddomain_${country}_${isp}_${domain}_${wildcard}`
      }]),
      [{
        text: "🔙 Back",
        callback_data: `wildcard_${country}_${isp}_${domain}_yes`
      }]
    ]
  };
}

async function handleCallback(query, data, chatId, messageId) {
  const proxyData = await fetchProxyData();

  if (data.startsWith('country_')) {
    const country = data.split('_')[1];
    const keyboard = await createIspKeyboard(country);
    await editMessage(chatId, messageId, `Pilih ISP untuk ${country}:`, keyboard);
  } 
  else if (data.startsWith('countrypage_')) {
    const page = parseInt(data.split('_')[1]);
    const countries = [...new Set(proxyData.map(item => item.countryCode))].sort();
    const keyboard = createCountryKeyboard(countries, page);
    await editMessage(chatId, messageId, 'Pilih negara:', keyboard);
  }
  else if (data.startsWith('isppage_')) {
    const [_, country, page] = data.split('_');
    const currentPage = parseInt(page);
    const keyboard = await createIspKeyboard(country, currentPage);
    await editMessage(chatId, messageId, `Pilih ISP untuk ${country}:`, keyboard);
  }
  else if (data === 'back_to_countries') {
    const countries = [...new Set(proxyData.map(item => item.countryCode))].sort();
    const keyboard = createCountryKeyboard(countries);
    await editMessage(chatId, messageId, 'Pilih negara:', keyboard);
  }
  else if (data.startsWith('isp_')) {
    const [_, country, id] = data.split('_');
    const isp = ISP_CACHE[`isp_${country}`][parseInt(id)];

    // Show domain selection with wildcard options
    const keyboard = await createDomainKeyboard(country, id);
    await editMessage(chatId, messageId, `Pilih domain untuk ${isp}:`, keyboard);
  }
  else if (data.startsWith('domain_')) {
    const [_, country, id, domain] = data.split('_');
    const isp = ISP_CACHE[`isp_${country}`][parseInt(id)];
    
    // Show wildcard options for the selected domain
    const keyboard = await createWildcardOptionsKeyboard(country, id, domain);
    await editMessage(chatId, messageId, `Pilih wildcard untuk ${domain} atau gunakan domain utama:`, keyboard);
  }
  else if (data.startsWith('wildcard_')) {
    const [_, country, id, domain, wildcard] = data.split('_');
    const isp = ISP_CACHE[`isp_${country}`][parseInt(id)];
    
    // Process with or without wildcard
    const selectedWildcard = wildcard === 'none' ? null : wildcard;
    await processProxySelection(country, isp, chatId, messageId, domain, selectedWildcard);
  }
  else if (data === 'show_convert_help') {
    await sendMessage(chatId, 
      '🤖 Stupid World Converter Bot\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox Dan Clash.\n\nContoh:\nvless://...\nvmess://...\ntrojan://...\nss://...\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\nbaca baik-baik dulu sebelum nanya.',
      null, 
      messageId
    );
    await answerCallbackQuery(query.id);
  }
  else if (data.startsWith('proxycc_')) {
    const countryCode = data.split('_')[1]; 
    await editMessage(chatId, messageId, `⏳ Mengumpulkan proxy ${countryCode}...`); 
    const proxyData = await fetchProxyData(); 
    const proxies = filterProxiesByCountry(proxyData, countryCode); 
    if (proxies.length === 0) { 
      await editMessage(chatId, messageId, `❌ Tidak ada proxy untuk ${countryCode}.`); 
      return; 
    } 
    // Format proxy menjadi ip:port saja 
    const proxyList = proxies.map(line => { 
      const [proxy, port] = line.split(','); 
      return `${proxy}:${port}`; 
    }).join('\n'); 
    // Send as file 
    await sendFile(chatId, `${countryCode}.txt`, proxyList); 
    await deleteMessage(chatId, messageId); 
  }
}

function filterProxiesByCountry(proxyData, countryCode) {
  return proxyData
    .filter(item => item.countryCode === countryCode)
    .map(item => `${item.ip},${item.port}`);
}

async function handleProxyListCommand(chatId, messageId) {
  try {
    const loadingMsg = await sendMessage(chatId, '⏳ Mengambil daftar country code...');
    
    const proxyData = await fetchProxyData();
    const countryCodes = [...new Set(proxyData.map(item => item.countryCode))].sort();

    if (countryCodes.length === 0) {
      await editMessage(chatId, loadingMsg.result.message_id, 
        '❌ Tidak ada proxy yang tersedia atau format data tidak valid.');
      return;
    }

    const keyboard = createCountryCodeKeyboard(countryCodes);
    await editMessage(chatId, loadingMsg.result.message_id, '📋 Pilih Country Code:', keyboard);
  } catch (error) {
    console.error('Error handling /proxylist:', error);
    await sendMessage(chatId, 
      `❌ Gagal mengambil daftar proxy. Error: ${error.message}\nSilakan coba lagi nanti atau hubungi admin.`,
      null,
      messageId
    );
  }
}

function createCountryCodeKeyboard(countryCodes) {
  const keyboardRows = [];
  let currentRow = [];
  
  const sortedCodes = countryCodes.sort();
  
  for (const cc of sortedCodes) {
    currentRow.push({
      text: `${getFlagEmoji(cc)} ${cc}`,
      callback_data: `proxycc_${cc}`
    });
    
    if (currentRow.length >= 3) {
      keyboardRows.push(currentRow);
      currentRow = [];
    }
  }
  
  if (currentRow.length > 0) keyboardRows.push(currentRow);
  
  return { inline_keyboard: keyboardRows };
}

async function processProxySelection(country, isp, chatId, messageId, selectedDomain = null, wildcardDomain = null) {
    const proxyData = await fetchProxyData();
    let proxies = proxyData.filter(item => 
        item.countryCode === country && item.isp === isp);
    
    if (proxies.length === 0) {
        await sendMessage(chatId, `❌ Tidak menemukan proxy untuk ${country} - ${isp}`, null, messageId);
        return;
    }

    // Shuffle proxies array to get random order
    proxies = shuffleArray(proxies);
    
    let activeProxy = null;
    let status = null;
    
    // Check each proxy until we find an active one
    for (const proxy of proxies) {
        status = await checkProxyStatus(proxy.ip, proxy.port);
        if (status.status === 'active') {
            activeProxy = proxy;
            break;
        }
    }
    
    if (activeProxy) {
        const serverName = `${country}-${isp}`;
        const configs = generateConfigs(activeProxy.ip, activeProxy.port, serverName, selectedDomain, wildcardDomain);
        
        const message = `
✅ *Proxy Active*:
- IP: ${activeProxy.ip}
- Port: ${activeProxy.port}
- Country: ${status.countryName} ${status.countryFlag}
- ISP: ${status.asOrganization}
- Delay: ${status.delay}
- Domain: ${configs.domain}
- Host: ${configs.host}

*Configurations:*
        
🔹 *VLESS TLS*:
\`\`\`
${configs.vlessTls}
\`\`\`

🔹 *VLESS Non-TLS*:
\`\`\`
${configs.vlessNtls}
\`\`\`

🔹 *Trojan TLS*:
\`\`\`
${configs.trojanTls}
\`\`\`

🔹 *Trojan Non-TLS*:
\`\`\`
${configs.trojanNtls}
\`\`\`

🔹 *VMess TLS*:
\`\`\`
${configs.vmessTls}
\`\`\`

🔹 *VMess Non-TLS*:
\`\`\`
${configs.vmessNtls}
\`\`\`

🔹 *Shadowsocks*:
\`\`\`
${configs.ss}
\`\`\`
        `;
        
        await sendMessage(chatId, message, null, messageId, true);
    } else {
        await sendMessage(chatId, `❌ Semua proxy untuk ${country} - ${isp} tidak aktif`, null, messageId);
    }
}

async function processProxies(chatId, proxies) {
  const statusMsg = await sendMessage(chatId, '⏳ Memulai proses scanning...');
  const messageId = statusMsg.result.message_id;

  const results = await Promise.all(proxies.map(async p => {
    const result = await checkProxy(p.ip, p.port);
    return { ...p, ...result };
  }));

  const active = [], dead = [];
  for (const r of results) {
    if (r.status === 'active') {
      active.push(`${r.ip},${r.port},${r.countryCode || 'N/A'},${r.isp || 'N/A'}`);
    } else {
      dead.push(`${r.ip}:${r.port}`);
    }
  }

  const resultText = `✅ Proxy Aktif (${active.length})\n${active.join('\n')}\n\n❌ Proxy Mati (${dead.length})\n${dead.join('\n')}`;
  await sendMessage(chatId, resultText);
  await deleteMessage(chatId, messageId);
}

async function checkProxy(ip, port) {
  try {
    const res = await fetch(`${API_URL}${ip}:${port}`);
    const data = await res.json();
    if (data.proxyip || data.success) {
      return { status: 'active', countryCode: data.countryCode || 'N/A', isp: data.asOrganization || data.isp || 'N/A' };
    }
  } catch (err) {
    console.error('Proxy check error:', err);
  }
  return { status: 'dead' };
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

async function sendMessage(chatId, text, replyMarkup, replyToMessageId, parseMode = false) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body = {
        chat_id: chatId,
        message_thread_id: ALLOWED_THREAD_ID, // Add this line
        text: text,
        reply_to_message_id: replyToMessageId,
        disable_web_page_preview: true
    };
    
    if (replyMarkup) body.reply_markup = replyMarkup;
    if (parseMode) body.parse_mode = 'Markdown';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

async function editMessage(chatId, messageId, text, replyMarkup, parseMode = false) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`;
    const body = {
        chat_id: chatId,
        message_thread_id: ALLOWED_THREAD_ID, // Add this line
        message_id: messageId,
        text: text,
        disable_web_page_preview: true
    };
    
    if (replyMarkup) body.reply_markup = replyMarkup;
    if (parseMode) body.parse_mode = 'Markdown';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (error) {
        console.error('Error editing message:', error);
    }
}

async function sendDocument(chatId, content, filename, mimeType, replyToMessageId) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('document', blob, filename);
    formData.append('chat_id', chatId.toString());
    formData.append('message_thread_id', ALLOWED_THREAD_ID.toString()); // Add this line
    if (replyToMessageId) {
        formData.append('reply_to_message_id', replyToMessageId.toString());
    }

    const response = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
            method: 'POST',
            body: formData
        }
    );

    return response.json();
}

async function sendFile(chatId, filename, content) {
  const formData = new FormData();
  const blob = new Blob([content], { type: 'text/plain' });
  formData.append('document', blob, filename);
  formData.append('chat_id', chatId);
  formData.append('message_thread_id', ALLOWED_THREAD_ID.toString()); // Add this line

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`,
    {
      method: 'POST',
      body: formData
    }
  );

  return await response.json();
}

async function deleteMessage(chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || 'Processed',
      show_alert: !!text
    })
  });
}

async function handleRequest(request) {
  try {
    if (request.method === 'POST') {
      const url = new URL(request.url);
      
      // Endpoint for GitHub Actions results
      if (url.pathname === '/webhook-result') {
        return await handleGitHubResults(request);
      }
      
      // Handle Telegram updates
      const contentType = request.headers.get('content-type');
      if (contentType.includes('application/json')) {
        const update = await request.json();
        
        if (update.message) {
          // Check if message is from allowed chat and thread
          if (!isAllowedMessage(update.message)) {
            console.log('Message from unauthorized chat or thread, ignoring');
            return new Response('OK');
          }

          const { chat, text, message_id, document } = update.message;
          
          if (text && text.startsWith('/')) {
            await handleCommand(text, chat.id, message_id);
          } 
          // Handle convert command or direct links
          else if (text && text.includes('://')) {
            try {
              const links = text.split('\n').filter(line => line.trim().includes('://'));
              
              if (links.length === 0) {
                await sendMessage(chat.id, 'No valid links found. Please send VMess, VLESS, Trojan, or Shadowsocks links.', null, message_id);
                return new Response('OK');
              }

              if (links.length > 10) {
                await sendMessage(chat.id, 'Maksimal 10 link per permintaan.', null, message_id);
                return new Response('OK');
              }

              // Generate configurations
              const clashConfig = generateClashConfig(links, true);
              const nekoboxConfig = generateNekoboxConfig(links, true);
              const singboxConfig = generateSingboxConfig(links, true);

              // Send files
              await sendDocument(chat.id, clashConfig, 'clash.yaml', 'text/yaml', message_id);
              await sendDocument(chat.id, nekoboxConfig, 'nekobox.json', 'application/json', message_id);
              await sendDocument(chat.id, singboxConfig, 'singbox.bpf', 'application/json', message_id);

            } catch (error) {
              console.error('Error processing links:', error);
              await sendMessage(chat.id, `Error: ${error.message}`, null, message_id);
            }
          }
          // Handle .scan command
          else if (text && text.startsWith('.scan')) {
            const lines = text.replace('.scan', '').trim().split('\n').map(l => l.trim()).filter(Boolean);
            const proxies = lines.map(line => {
              if (line.includes(':')) {
                const [ip, port] = line.split(':');
                return { ip: ip.trim(), port: port.trim() };
              } else if (line.includes(',')) {
                const [ip, port] = line.split(',');
                return { ip: ip.trim(), port: port.trim() };
              }
              return null;
            }).filter(p => p && p.ip && p.port);

            if (proxies.length === 0) {
              await sendMessage(chat.id, '❌ Format salah. Gunakan `.scan ip:port` atau `.scan ip,port`, atau banyak baris proxy.', null, message_id);
              return new Response('OK');
            }

            if (proxies.length > 10) {
              await sendMessage(chat.id, '❌ Maksimal 10 proxy untuk mode `.scan`.', null, message_id);
              return new Response('OK');
            }

            await processProxies(chat.id, proxies);
          }
          // Handle document upload
          else if (document) {
            return await handleTelegramDocument(update);
          }
        } 
        else if (update.callback_query) {
          // Check if callback query is from allowed chat and thread
          if (!isAllowedMessage(update.callback_query.message)) {
            console.log('Callback from unauthorized chat or thread, ignoring');
            return new Response('OK');
          }

          const { data, message, id } = update.callback_query;
          await handleCallback(update.callback_query, data, message.chat.id, message.message_id);
          // Answer callback query
          await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              callback_query_id: id
            })
          });
        }
      }
      
      return new Response('OK');
    }
    
    // For GET requests, show a simple message
    return new Response('Telegram Proxy Bot is running', {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error) {
    console.error('Error in handleRequest:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

async function handleGitHubResults(request) {
  let data;
  try {
    data = await request.json();
    console.log('Received results, size:', data.results?.length);
    
    if (!data.chatId || !data.results) {
      throw new Error('Missing chatId or results in payload');
    }
    
    // Check size before processing
    if (data.results.length > MAX_RESULT_SIZE) {
      await sendMessage(data.chatId,
        `❌ Hasil scan terlalu besar (${Math.round(data.results.length/1024)}KB). ` +
        `Maksimum yang didukung: ${Math.round(MAX_RESULT_SIZE/1024)}KB. ` +
        `Silahkan kurangi jumlah proxy dan coba lagi.`
      );
      return new Response('Payload too large', { status: 413 });
    }
    
    // Decode base64
    const decodedResults = atob(data.results);
    
    // Convert to ArrayBuffer for decompression
    const byteArray = new Uint8Array(decodedResults.length);
    for (let i = 0; i < decodedResults.length; i++) {
      byteArray[i] = decodedResults.charCodeAt(i);
    }
    
    // Decompress gzip
    const decompressedStream = new Response(byteArray).body.pipeThrough(
      new DecompressionStream('gzip')
    );
    const decompressed = await new Response(decompressedStream).text();
    
    // Send as file
    await sendFile(data.chatId, 'proxy_results.txt', decompressed);
    
    return new Response('OK');
  } catch (error) {
    console.error('Error handling GitHub results:', error);
    
    // Send error notification to Telegram
    if (data?.chatId) {
      await sendMessage(data.chatId, 
        `❌ Gagal mengolah hasil scan: ${error.message}\n` +
        `Ukuran data: ${data.results?.length ? Math.round(data.results.length/1024) + 'KB' : 'unknown'}`
      );
    }
    
    return new Response('Error processing results', { status: 400 });
  }
}

async function handleTelegramDocument(update) {
  const chatId = update.message.chat.id;
  const messageId = update.message.message_id;
  const fileId = update.message.document.file_id;
  
  try {
    // Get file info from Telegram
    const fileInfo = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileInfo.json();
    
    if (!fileData.ok) {
      throw new Error('Failed to get file info from Telegram');
    }
    
    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    console.log('File URL:', fileUrl);
    
    // Check file size (max 5MB)
    if (fileData.result.file_size > 5 * 1024 * 1024) {
      await sendMessage(chatId, '❌ File terlalu besar (maksimum 5MB)', null, messageId);
      return new Response('File too large', { status: 413 });
    }
    
    // Send acknowledgment
    await sendMessage(chatId, '📁 File diterima! Memulai scan proxy...', null, messageId);
    
    // Trigger GitHub Action
    await triggerGitHubAction(chatId, fileUrl);
    
    return new Response('OK');
  } catch (error) {
    console.error('Error handling document:', error);
    await sendMessage(chatId, '❌ Error memproses file. Silahkan coba lagi.', null, messageId);
    return new Response('Error', { status: 500 });
  }
}

async function triggerGitHubAction(chatId, fileUrl) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Worker'
    },
    body: JSON.stringify({
      event_type: 'scan_proxy',
      client_payload: {
        chat_id: chatId,
        file_url: fileUrl,
        timestamp: new Date().toISOString()
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('GitHub Action trigger failed:', errorText);
    throw new Error(`GitHub Action failed: ${errorText}`);
  }
  
  console.log('GitHub Action triggered successfully');
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
