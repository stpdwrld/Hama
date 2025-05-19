const WILDCARD_DOMAINS = [
    'ava.game.naver.com', 'df.game.naver.com', 'graph.instagram.com', 'zaintest.vuclip.com',
    'support.zoom.us', 'cache.netflix.com', 'bakrie.ac.id', 'quiz.int.vidio.com', 'quiz.vidio.com', 'investor.fb.com',
    'img.email2.vidio.com', 'app.gopay.co.id', 'www.uii.ac.id', 'untar.ac.id'
];

const TELEGRAM_TOKEN = '7644792138:AAGRKJmmuFz8axrc85Xm4lXy9BbJ4GNxzzw';
const PROXY_DATA_URL = 'https://raw.githubusercontent.com/stpdwrld/Stupid-Tunnel/refs/heads/main/allproxy.txt';
const UUID = 'f282b878-8711-45a1-8c69-5564172123c1';

// Multiple main domains
const MAIN_DOMAINS = [
    'vpn.stupidworld.web.id',
    'world.stupx2.my.id',
    'vpn.luckystup-id.xyz'
];

// Cache for proxy data
let proxyDataCache = null;
let lastFetchTime = 0;

// Items per page for pagination
const ITEMS_PER_PAGE = 10;

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
  // Implementasi yang sama seperti generateClashConfig
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
  // Implementasi yang sama seperti generateClashConfig
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
    const response = await fetch(PROXY_DATA_URL);
    const text = await response.text();
    const lines = text.trim().split('\n');
    const data = lines.map(line => {
      const [ip, port, countryCode, isp] = line.split(',');
      return {
        ip,
        port,
        countryCode: countryCode.trim(),
        isp: isp.trim()
      };
    });
    proxyDataCache = data;
    lastFetchTime = now;
    return data;
  } catch (error) {
    console.error('Error fetching proxy data:', error);
    return [];
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

const BOT_USERNAME = 'stupidnotx2_bot'; // Ganti dengan username bot Anda

// Modifikasi fungsi handleCommand
async function handleCommand(command, chatId, messageId, isGroup = false) {
  // Pisahkan command dan username (jika ada)
  const [baseCommand, username] = command.split('@');
  
  // Jika di grup dan ada username, pastikan username sesuai dengan bot
  if (isGroup && username && username.toLowerCase() !== BOT_USERNAME.toLowerCase()) {
    return; // Abaikan jika username tidak cocok
  }

  const proxyData = await fetchProxyData();

  if (baseCommand === '/start') {
    const countries = [...new Set(proxyData.map(item => item.countryCode))].sort();
    const keyboard = createCountryKeyboard(countries);
    await sendMessage(chatId, 'Pilih negara:', keyboard, messageId);
  } else if (baseCommand === '/convert') {
    await sendMessage(chatId, 
      '🤖 Stupid World Converter Bot\n\nKirimkan saya link konfigurasi V2Ray dan saya akan mengubahnya ke format Singbox, Nekobox Dan Clash.\n\nContoh:\nvless://...\nvmess://...\ntrojan://...\nss://...\n\nCatatan:\n- Maksimal 10 link per permintaan.\n- Disarankan menggunakan Singbox versi 1.10.3 atau 1.11.8 untuk hasil terbaik.\n\nbaca baik-baik dulu sebelum nanya.',
      null, 
      messageId
    );
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

// 1. Tambahkan di bagian atas script
let ISP_CACHE = {};

// 2. Fungsi untuk menyimpan data ISP ke cache
async function cacheISP(country, ispList) {
  const cacheKey = `isp_${country}`;
  ISP_CACHE[cacheKey] = ispList;
  return ispList.map((isp, index) => ({ id: index, name: isp }));
}

// 3. Modifikasi createIspKeyboard
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
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || 'Processing...',
      show_alert: !!text // Show alert only if text is provided
    })
  });
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

async function handleRequest(request) {
    if (request.method === 'POST') {
        try {
            const update = await request.json();
            
            if (update.message) {
                const { chat, text, message_id, entities } = update.message;
                const isGroup = chat.type !== 'private';
                
                if (text && (text.startsWith('/') || text.includes(`@${BOT_USERNAME}`))) {
                    // Cek apakah pesan benar-benar memanggil bot (untuk grup)
                    let isBotMentioned = false;
                    if (entities) {
                        for (const entity of entities) {
                            if (entity.type === 'mention' && 
                                text.substr(entity.offset, entity.length) === `@${BOT_USERNAME}`) {
                                isBotMentioned = true;
                                break;
                            }
                        }
                    }
                    
                    // Jika di grup tapi tidak ada mention bot, abaikan
                    if (isGroup && !isBotMentioned && text.includes('@')) {
                        return new Response('OK');
                    }
                    
                    await handleCommand(text, chat.id, message_id, isGroup);
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
            } 
            else if (update.callback_query) {
                const { data, message, id } = update.callback_query;
                const chatId = message ? message.chat.id : update.callback_query.from.id;
                const messageId = message ? message.message_id : null;
                
                // Jawab callback query terlebih dahulu
                await answerCallbackQuery(id);
                
                // Handle callback
                await handleCallback(update.callback_query, data, chatId, messageId);
            }
            
            return new Response('OK');
        } catch (error) {
            console.error('Error handling update:', error);
            return new Response('Error', { status: 500 });
        }
    }
    
    // For GET requests, show a simple message
    return new Response('Telegram Proxy Bot is running', {
        headers: { 'Content-Type': 'text/plain' }
    });
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});
