export type ScraperSource = {
  id: string;
  name: string;
  url: string;
  protocol: "http" | "socks5" | "socks4";
  format: "txt" | "json_geonode" | "json_sockslist" | "json_pubproxy" | "json_proxifly";
  enabled: boolean;
  created_at: string;
};

export type ScraperSourceCreateInput = {
  name: string;
  url: string;
  protocol?: string;
  format?: string;
  enabled?: boolean;
};

export type ScraperSourceUpdateInput = {
  name?: string;
  url?: string;
  protocol?: string;
  format?: string;
  enabled?: boolean;
};
