CREATE TABLE IF NOT EXISTS scraper_sources (
    id            TEXT PRIMARY KEY,
    name          TEXT    NOT NULL,
    url           TEXT    NOT NULL,
    protocol      TEXT    NOT NULL DEFAULT 'socks5',
    format        TEXT    NOT NULL DEFAULT 'txt',
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at_ns INTEGER NOT NULL
);

-- seed built-in default sources
INSERT OR IGNORE INTO scraper_sources (id, name, url, protocol, format, enabled, created_at_ns) VALUES
('proxyscrape-http',   'ProxyScrape HTTP',          'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&simplified=true', 'http',   'txt',           1, 0),
('geonode',            'Geonode',                   'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps%2Csocks4%2Csocks5&filterUpTime=50', 'socks5', 'json_geonode',  1, 0),
('thespeedx-socks5',   'TheSpeedX SOCKS5',          'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',                                                                                 'socks5', 'txt',           1, 0),
('monosans-socks5',    'monosans SOCKS5',            'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',                                                                            'socks5', 'txt',           1, 0),
('hookzof-socks5',     'hookzof SOCKS5',             'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',                                                                                   'socks5', 'txt',           1, 0),
('clearproxy-socks5',  'ClearProxy SOCKS5',          'https://raw.githubusercontent.com/ClearProxy/checked-proxy-list/main/socks5/raw/all.txt',                                                                  'socks5', 'txt',           1, 0),
('jetkai-socks5',      'jetkai SOCKS5',              'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt',                                                           'socks5', 'txt',           1, 0),
('proxifly-txt',       'Proxifly SOCKS5 (txt)',      'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.txt',                                                              'socks5', 'txt',           1, 0),
('sockslist-us',       'SocksList.us',               'https://sockslist.us/Api?request=display&country=all&level=all&token=free',                                                                                 'socks5', 'json_sockslist', 1, 0),
('pubproxy',           'PubProxy',                   'http://pubproxy.com/api/proxy?type=socks5&format=json&limit=5',                                                                                             'socks5', 'json_pubproxy',  1, 0),
('proxifly-json',      'Proxifly SOCKS5 (json)',     'https://cdn.jsdelivr.net/gh/proxifly/free-proxy-list@main/proxies/protocols/socks5/data.json',                                                             'socks5', 'json_proxifly',  1, 0);
