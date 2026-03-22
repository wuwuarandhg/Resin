// Package scraper fetches free proxy lists from configured sources and returns
// them as subscription-compatible content (one proxy per line).
//
// Supported output formats (understood by subscription.ParseGeneralSubscription):
//   - "IP:PORT"          → parsed as http outbound
//   - "socks5://IP:PORT" → parsed as socks5 outbound
//   - "socks4://IP:PORT" → parsed as socks4 outbound
package scraper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

const defaultTimeout = 30 * time.Second

// Config holds optional scraper configuration.
type Config struct {
	// Timeout for each HTTP request. Defaults to 30s if zero.
	Timeout time.Duration
}

// DefaultConfig is the default scraper configuration.
var DefaultConfig = Config{Timeout: defaultTimeout}

// Source describes a single proxy source to fetch from.
type Source struct {
	ID       string
	Name     string
	URL      string
	Protocol string // "http", "socks5", "socks4"
	Format   string // "txt", "json_geonode", "json_sockslist", "json_pubproxy", "json_proxifly"
}

// Fetch scrapes proxies from the given sources concurrently and returns
// normalized subscription content suitable for subscription.ParseGeneralSubscription.
// Individual source errors are logged and skipped.
func Fetch(ctx context.Context, cfg Config, sources []Source) ([]byte, error) {
	timeout := cfg.Timeout
	if timeout <= 0 {
		timeout = defaultTimeout
	}

	type entry struct {
		protocol string
		ip       string
		port     string
	}

	var mu sync.Mutex
	seen := make(map[string]struct{})
	var proxies []entry

	add := func(protocol, ip, port string) {
		if ip == "" || port == "" {
			return
		}
		key := protocol + "://" + ip + ":" + port
		mu.Lock()
		defer mu.Unlock()
		if _, ok := seen[key]; ok {
			return
		}
		seen[key] = struct{}{}
		proxies = append(proxies, entry{protocol, ip, port})
	}

	var wg sync.WaitGroup
	for _, src := range sources {
		wg.Add(1)
		go func(s Source) {
			defer wg.Done()
			items, err := fetchSource(ctx, timeout, s)
			if err != nil {
				log.Printf("[scraper] %s: %v", s.Name, err)
				return
			}
			for _, it := range items {
				add(it.protocol, it.ip, it.port)
			}
			log.Printf("[scraper] %s: %d proxies", s.Name, len(items))
		}(src)
	}
	wg.Wait()

	if len(proxies) == 0 {
		return nil, fmt.Errorf("scraper: all sources returned no proxies")
	}

	var buf bytes.Buffer
	for _, p := range proxies {
		switch p.protocol {
		case "http", "https":
			fmt.Fprintf(&buf, "%s:%s\n", p.ip, p.port)
		case "socks5", "socks5h":
			fmt.Fprintf(&buf, "socks5://%s:%s\n", p.ip, p.port)
		case "socks4", "socks4a":
			fmt.Fprintf(&buf, "socks4://%s:%s\n", p.ip, p.port)
		default:
			fmt.Fprintf(&buf, "%s:%s\n", p.ip, p.port)
		}
	}

	log.Printf("[scraper] total: %d unique proxies from %d sources", len(proxies), len(sources))
	return buf.Bytes(), nil
}

type proxyItem struct {
	protocol string
	ip       string
	port     string
}

func fetchSource(ctx context.Context, timeout time.Duration, s Source) ([]proxyItem, error) {
	switch s.Format {
	case "json_geonode":
		return fetchGeonode(ctx, timeout, s.URL)
	case "json_sockslist":
		return fetchSocksListUS(ctx, timeout, s.URL, s.Protocol)
	case "json_pubproxy":
		return fetchPubProxy(ctx, timeout, s.URL, s.Protocol)
	case "json_proxifly":
		return fetchProxiflyJSON(ctx, timeout, s.URL, s.Protocol)
	default: // "txt"
		return fetchTxt(ctx, timeout, s.URL, s.Protocol)
	}
}

// fetchTxt fetches plain-text IP:PORT lines.
func fetchTxt(ctx context.Context, timeout time.Duration, url, protocol string) ([]proxyItem, error) {
	body, err := doGet(ctx, timeout, url)
	if err != nil {
		return nil, err
	}
	var items []proxyItem
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if ip, port, ok := splitHostPort(line); ok {
			items = append(items, proxyItem{protocol: protocol, ip: ip, port: port})
		}
	}
	return items, nil
}

// fetchGeonode parses {"data": [{"ip":..., "port":..., "protocols":[...]}]}.
func fetchGeonode(ctx context.Context, timeout time.Duration, url string) ([]proxyItem, error) {
	body, err := doGet(ctx, timeout, url)
	if err != nil {
		return nil, err
	}
	var result struct {
		Data []struct {
			IP        string   `json:"ip"`
			Port      string   `json:"port"`
			Protocols []string `json:"protocols"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	items := make([]proxyItem, 0, len(result.Data))
	for _, d := range result.Data {
		if d.IP == "" || d.Port == "" {
			continue
		}
		protocol := "http"
		if len(d.Protocols) > 0 {
			protocol = strings.ToLower(d.Protocols[0])
		}
		items = append(items, proxyItem{protocol: protocol, ip: d.IP, port: d.Port})
	}
	return items, nil
}

// fetchSocksListUS parses {"proxyList": [{"ip":..., "port":...}]}.
func fetchSocksListUS(ctx context.Context, timeout time.Duration, url, protocol string) ([]proxyItem, error) {
	body, err := doGet(ctx, timeout, url)
	if err != nil {
		return nil, err
	}
	var result struct {
		ProxyList []struct {
			IP   string `json:"ip"`
			Host string `json:"host"`
			Port any    `json:"port"`
		} `json:"proxyList"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	var items []proxyItem
	for _, it := range result.ProxyList {
		ip := it.IP
		if ip == "" {
			ip = it.Host
		}
		port := strings.TrimSpace(fmt.Sprintf("%v", it.Port))
		if ip != "" && port != "" && port != "0" {
			items = append(items, proxyItem{protocol: protocol, ip: ip, port: port})
		}
	}
	return items, nil
}

// fetchPubProxy parses {"data": [{"ipPort": "IP:PORT"}]}.
func fetchPubProxy(ctx context.Context, timeout time.Duration, url, protocol string) ([]proxyItem, error) {
	body, err := doGet(ctx, timeout, url)
	if err != nil {
		return nil, err
	}
	var result struct {
		Data []struct {
			IPPort string `json:"ipPort"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	var items []proxyItem
	for _, it := range result.Data {
		if ip, port, ok := splitHostPort(it.IPPort); ok {
			items = append(items, proxyItem{protocol: protocol, ip: ip, port: port})
		}
	}
	return items, nil
}

// fetchProxiflyJSON parses [{"proxy": "IP:PORT"}].
func fetchProxiflyJSON(ctx context.Context, timeout time.Duration, url, protocol string) ([]proxyItem, error) {
	body, err := doGet(ctx, timeout, url)
	if err != nil {
		return nil, err
	}
	var result []struct {
		Proxy string `json:"proxy"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal: %w", err)
	}
	var items []proxyItem
	for _, it := range result {
		if ip, port, ok := splitHostPort(it.Proxy); ok {
			items = append(items, proxyItem{protocol: protocol, ip: ip, port: port})
		}
	}
	return items, nil
}

func doGet(ctx context.Context, timeout time.Duration, url string) ([]byte, error) {
	client := &http.Client{Timeout: timeout}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 4<<20))
}

func splitHostPort(s string) (host, port string, ok bool) {
	idx := strings.LastIndex(s, ":")
	if idx < 0 {
		return "", "", false
	}
	host = strings.TrimSpace(s[:idx])
	port = strings.TrimSpace(s[idx+1:])
	return host, port, host != "" && port != ""
}
