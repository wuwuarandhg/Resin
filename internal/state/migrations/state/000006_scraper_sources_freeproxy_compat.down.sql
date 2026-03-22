DELETE FROM scraper_sources
WHERE id IN (
    'proxylist-http',
    'proxylist-https',
    'proxylist-socks4',
    'proxylist-socks5',
    'kuaidaili-template',
    'qiyunip-template'
);
