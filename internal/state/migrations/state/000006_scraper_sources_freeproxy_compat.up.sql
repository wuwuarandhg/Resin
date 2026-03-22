-- add freeproxy-compatible preset sources
--
-- Mapping notes for src/4.py:
--   - ProxiflyProxiedSession   -> already covered by proxifly-* presets in 000005
--   - ProxylistProxiedSession  -> public txt endpoints below
--   - KuaidailiProxiedSession  -> authenticated API template, disabled by default
--   - QiyunipProxiedSession    -> authenticated API template, disabled by default

INSERT OR IGNORE INTO scraper_sources (id, name, url, protocol, format, enabled, created_at_ns) VALUES
('proxylist-http',      'ProxyList HTTP',               'https://www.proxy-list.download/api/v1/get?type=http',                                                                                             'http',   'txt',  1, 0),
('proxylist-https',     'ProxyList HTTPS',              'https://www.proxy-list.download/api/v1/get?type=https',                                                                                            'http',   'txt',  1, 0),
('proxylist-socks4',    'ProxyList SOCKS4',             'https://www.proxy-list.download/api/v1/get?type=socks4',                                                                                           'socks4', 'txt',  1, 0),
('proxylist-socks5',    'ProxyList SOCKS5',             'https://www.proxy-list.download/api/v1/get?type=socks5',                                                                                           'socks5', 'txt',  1, 0),
('kuaidaili-template',  'Kuaidaili API Template',       'https://dev.kdlapi.com/api/getproxy/?secret_id=REPLACE_ME&signature=REPLACE_ME&num=100&protocol=1&method=2&an_ha=1&sep=1',                         'http',   'txt',  0, 0),
('qiyunip-template',    'Qiyunip API Template',         'https://www.qiyunip.com/getApi2?order=REPLACE_ME&apikey=REPLACE_ME&num=100&type=text&sep=%0A',                                                   'http',   'txt',  0, 0);

