import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { AlertTriangle, Plus, RefreshCw, Search, Sparkles, Trash2, X, Pencil, Globe, FileJson } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { DataTable } from "../../components/ui/DataTable";
import { Input } from "../../components/ui/Input";
import { OffsetPagination } from "../../components/ui/OffsetPagination";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { ToastContainer } from "../../components/ui/Toast";
import { useToast } from "../../hooks/useToast";
import { useI18n } from "../../i18n";
import { formatApiErrorMessage } from "../../lib/error-message";
import { formatDateTime } from "../../lib/time";
import {
  createScraperSource,
  deleteScraperSource,
  listScraperSources,
  updateScraperSource,
} from "./api";
import type { ScraperSource } from "./types";

type ProtocolType = "http" | "socks5" | "socks4";
type FormatType = "txt" | "json_geonode" | "json_sockslist" | "json_pubproxy" | "json_proxifly";

const PROTOCOL_OPTIONS: { value: ProtocolType; label: string }[] = [
  { value: "http", label: "HTTP" },
  { value: "socks5", label: "SOCKS5" },
  { value: "socks4", label: "SOCKS4" },
];

const FORMAT_OPTIONS: { value: FormatType; label: string }[] = [
  { value: "txt", label: "Plain Text (IP:PORT)" },
  { value: "json_geonode", label: "JSON (Geonode)" },
  { value: "json_sockslist", label: "JSON (SocksList)" },
  { value: "json_pubproxy", label: "JSON (PubProxy)" },
  { value: "json_proxifly", label: "JSON (Proxifly)" },
];

const scraperSourceCreateSchema = z.object({
  name: z.string().trim().min(1, "名称不能为空"),
  url: z.string().trim().min(1, "URL 不能为空").refine(
    (v) => v.startsWith("http://") || v.startsWith("https://"),
    { message: "URL 必须是 http/https 地址" }
  ),
  protocol: z.enum(["http", "socks5", "socks4"]),
  format: z.enum(["txt", "json_geonode", "json_sockslist", "json_pubproxy", "json_proxifly"]),
  enabled: z.boolean(),
});

const scraperSourceEditSchema = scraperSourceCreateSchema;

type ScraperSourceCreateForm = z.infer<typeof scraperSourceCreateSchema>;
type ScraperSourceEditForm = z.infer<typeof scraperSourceEditSchema>;

const EMPTY_SOURCES: ScraperSource[] = [];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function protocolLabel(protocol: string): string {
  const found = PROTOCOL_OPTIONS.find((p) => p.value === protocol);
  return found?.label || protocol.toUpperCase();
}

function formatLabel(format: string): string {
  const found = FORMAT_OPTIONS.find((f) => f.value === format);
  return found?.label || format;
}

function formatIcon(format: string) {
  if (format.startsWith("json_")) {
    return <FileJson size={14} />;
  }
  return <Globe size={14} />;
}

function scraperSourceToEditForm(source: ScraperSource): ScraperSourceEditForm {
  return {
    name: source.name,
    url: source.url,
    protocol: source.protocol,
    format: source.format,
    enabled: source.enabled,
  };
}

export function ScraperSourcesPage() {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(20);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ScraperSource | null>(null);
  const { toasts, showToast, dismissToast } = useToast();

  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({
    queryKey: ["scraperSources", page, pageSize],
    queryFn: () =>
      listScraperSources({
        limit: pageSize,
        offset: page * pageSize,
      }),
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });

  const allSources = sourcesQuery.data?.items ?? EMPTY_SOURCES;
  const totalSources = sourcesQuery.data?.total ?? 0;

  // Client-side search filtering
  const sources = useMemo(() => {
    if (!search.trim()) return allSources;
    const keyword = search.toLowerCase().trim();
    return allSources.filter(
      (s) =>
        s.name.toLowerCase().includes(keyword) ||
        s.url.toLowerCase().includes(keyword) ||
        s.protocol.toLowerCase().includes(keyword)
    );
  }, [allSources, search]);

  const totalPages = Math.max(1, Math.ceil(totalSources / pageSize));
  const currentPage = Math.min(page, totalPages - 1);

  const createForm = useForm<ScraperSourceCreateForm>({
    resolver: zodResolver(scraperSourceCreateSchema),
    defaultValues: {
      name: "",
      url: "",
      protocol: "socks5",
      format: "txt",
      enabled: true,
    },
  });

  const editForm = useForm<ScraperSourceEditForm>({
    resolver: zodResolver(scraperSourceEditSchema),
    defaultValues: {
      name: "",
      url: "",
      protocol: "socks5",
      format: "txt",
      enabled: true,
    },
  });

  const invalidateSources = async () => {
    await queryClient.invalidateQueries({ queryKey: ["scraperSources"] });
  };

  const createMutation = useMutation({
    mutationFn: createScraperSource,
    onSuccess: async (created) => {
      await invalidateSources();
      setCreateModalOpen(false);
      createForm.reset({
        name: "",
        url: "",
        protocol: "socks5",
        format: "txt",
        enabled: true,
      });
      showToast("success", t("抓取源 {{name}} 创建成功", { name: created.name }));
    },
    onError: (error) => {
      showToast("error", formatApiErrorMessage(error, t));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ScraperSourceEditForm }) => {
      return updateScraperSource(id, data);
    },
    onSuccess: async (updated) => {
      await invalidateSources();
      setEditModalOpen(false);
      setSelectedSource(null);
      showToast("success", t("抓取源 {{name}} 已更新", { name: updated.name }));
    },
    onError: (error) => {
      showToast("error", formatApiErrorMessage(error, t));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (source: ScraperSource) => {
      await deleteScraperSource(source.id);
      return source;
    },
    onSuccess: async (deleted) => {
      await invalidateSources();
      showToast("success", t("抓取源 {{name}} 已删除", { name: deleted.name }));
    },
    onError: (error) => {
      showToast("error", formatApiErrorMessage(error, t));
    },
  });

  const onCreateSubmit = createForm.handleSubmit(async (values) => {
    await createMutation.mutateAsync(values);
  });

  const onEditSubmit = editForm.handleSubmit(async (values) => {
    if (!selectedSource) return;
    await updateMutation.mutateAsync({ id: selectedSource.id, data: values });
  });

  const handleDelete = useCallback(async (source: ScraperSource) => {
    const confirmed = window.confirm(t("确认删除抓取源 {{name}}？", { name: source.name }));
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(source);
  }, [deleteMutation, t]);

  const openEditModal = useCallback((source: ScraperSource) => {
    setSelectedSource(source);
    editForm.reset(scraperSourceToEditForm(source));
    setEditModalOpen(true);
  }, [editForm]);

  const changePageSize = (next: number) => {
    setPageSize(next);
    setPage(0);
  };

  const col = useMemo(() => createColumnHelper<ScraperSource>(), []);

  const sourceColumns = useMemo(
    () => [
      col.accessor("name", {
        header: t("名称"),
        cell: (info) => <p className="scraper-name-cell">{info.getValue()}</p>,
      }),
      col.accessor("url", {
        header: t("URL"),
        cell: (info) => (
          <p className="scraper-url-cell" title={info.getValue()}>
            {info.getValue()}
          </p>
        ),
      }),
      col.accessor("protocol", {
        header: t("协议"),
        cell: (info) => <Badge variant="neutral">{protocolLabel(info.getValue())}</Badge>,
      }),
      col.accessor("format", {
        header: t("格式"),
        cell: (info) => (
          <span className="scraper-format-cell">
            {formatIcon(info.getValue())}
            <span>{formatLabel(info.getValue())}</span>
          </span>
        ),
      }),
      col.accessor("enabled", {
        header: t("状态"),
        cell: (info) => {
          const enabled = info.getValue();
          return (
            <Badge variant={enabled ? "success" : "warning"}>
              {enabled ? t("已启用") : t("已禁用")}
            </Badge>
          );
        },
      }),
      col.accessor("created_at", {
        header: t("创建时间"),
        cell: (info) => formatDateTime(info.getValue() || ""),
      }),
      col.display({
        id: "actions",
        header: t("操作"),
        cell: (info) => {
          const s = info.row.original;
          return (
            <div className="scraper-row-actions" onClick={(event) => event.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => openEditModal(s)} title={t("编辑")}>
                <Pencil size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void handleDelete(s)}
                disabled={deleteMutation.isPending}
                title={t("删除")}
                style={{ color: "var(--delete-btn-color, #c27070)" }}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          );
        },
      }),
    ],
    [col, deleteMutation.isPending, handleDelete, openEditModal, t]
  );

  return (
    <section className="platform-page">
      <header className="module-header">
        <div>
          <h2>{t("抓取源管理")}</h2>
          <p className="module-description">{t("管理代理抓取源，用于 scrape 类型订阅自动获取代理列表。")}</p>
        </div>
      </header>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <Card className="platform-list-card platform-directory-card">
        <div className="list-card-header">
          <div>
            <h3>{t("抓取源列表")}</h3>
            <p>{t("共 {{count}} 个源", { count: totalSources })}</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label className="search-box" htmlFor="scraper-search" style={{ maxWidth: 240, margin: 0, gap: 6 }}>
              <Search size={16} />
              <Input
                id="scraper-search"
                placeholder={t("搜索源")}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                style={{ padding: "6px 10px", borderRadius: 8 }}
              />
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateModalOpen(true)}
            >
              <Plus size={16} />
              {t("新建")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => sourcesQuery.refetch()}
              disabled={sourcesQuery.isFetching}
            >
              <RefreshCw size={16} className={sourcesQuery.isFetching ? "spin" : undefined} />
              {t("刷新")}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="platform-cards-container subscriptions-table-card">
        {sourcesQuery.isLoading ? <p className="muted">{t("正在加载数据...")}</p> : null}

        {sourcesQuery.isError ? (
          <div className="callout callout-error">
            <AlertTriangle size={14} />
            <span>{formatApiErrorMessage(sourcesQuery.error, t)}</span>
          </div>
        ) : null}

        {!sourcesQuery.isLoading && !sources.length ? (
          <div className="empty-box">
            <Sparkles size={16} />
            <p>{t("没有匹配的抓取源")}</p>
          </div>
        ) : null}

        {sources.length ? (
          <DataTable
            data={sources}
            columns={sourceColumns}
            getRowId={(s) => s.id}
            className="data-table-scraper"
          />
        ) : null}

        <OffsetPagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={totalSources}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={changePageSize}
        />
      </Card>

      {/* Create Modal */}
      {createModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <Card className="modal-card">
            <div className="modal-header">
              <h3>{t("新建抓取源")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setCreateModalOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <form className="form-grid" onSubmit={onCreateSubmit}>
              <div className="field-group field-span-2">
                <label className="field-label" htmlFor="create-name">
                  {t("名称")}
                </label>
                <Input
                  id="create-name"
                  placeholder={t("例如：ProxyScrape SOCKS5")}
                  invalid={Boolean(createForm.formState.errors.name)}
                  {...createForm.register("name")}
                />
                {createForm.formState.errors.name?.message ? (
                  <p className="field-error">{t(createForm.formState.errors.name.message)}</p>
                ) : null}
              </div>

              <div className="field-group field-span-2">
                <label className="field-label" htmlFor="create-url">
                  {t("URL")}
                </label>
                <Input
                  id="create-url"
                  placeholder={t("例如：https://api.proxyscrape.com/...")}
                  invalid={Boolean(createForm.formState.errors.url)}
                  {...createForm.register("url")}
                />
                {createForm.formState.errors.url?.message ? (
                  <p className="field-error">{t(createForm.formState.errors.url.message)}</p>
                ) : null}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="create-protocol">
                  {t("协议")}
                </label>
                <Select
                  id="create-protocol"
                  {...createForm.register("protocol")}
                >
                  {PROTOCOL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="create-format">
                  {t("格式")}
                </label>
                <Select
                  id="create-format"
                  {...createForm.register("format")}
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="create-enabled" style={{ visibility: "hidden" }}>
                  {t("启用")}
                </label>
                <div className="subscription-switch-item">
                  <label className="subscription-switch-label" htmlFor="create-enabled">
                    <span>{t("启用")}</span>
                  </label>
                  <Switch id="create-enabled" {...createForm.register("enabled")} />
                </div>
              </div>

              <div className="detail-actions" style={{ justifyContent: "flex-end" }}>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? t("创建中...") : t("确认创建")}
                </Button>
                <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
                  {t("取消")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {/* Edit Modal */}
      {editModalOpen && selectedSource ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <Card className="modal-card">
            <div className="modal-header">
              <h3>{t("编辑抓取源")}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditModalOpen(false)}>
                <X size={16} />
              </Button>
            </div>

            <form className="form-grid" onSubmit={onEditSubmit}>
              <div className="field-group field-span-2">
                <label className="field-label" htmlFor="edit-name">
                  {t("名称")}
                </label>
                <Input
                  id="edit-name"
                  invalid={Boolean(editForm.formState.errors.name)}
                  {...editForm.register("name")}
                />
                {editForm.formState.errors.name?.message ? (
                  <p className="field-error">{t(editForm.formState.errors.name.message)}</p>
                ) : null}
              </div>

              <div className="field-group field-span-2">
                <label className="field-label" htmlFor="edit-url">
                  {t("URL")}
                </label>
                <Input
                  id="edit-url"
                  invalid={Boolean(editForm.formState.errors.url)}
                  {...editForm.register("url")}
                />
                {editForm.formState.errors.url?.message ? (
                  <p className="field-error">{t(editForm.formState.errors.url.message)}</p>
                ) : null}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-protocol">
                  {t("协议")}
                </label>
                <Select
                  id="edit-protocol"
                  {...editForm.register("protocol")}
                >
                  {PROTOCOL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-format">
                  {t("格式")}
                </label>
                <Select
                  id="edit-format"
                  {...editForm.register("format")}
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="edit-enabled" style={{ visibility: "hidden" }}>
                  {t("启用")}
                </label>
                <div className="subscription-switch-item">
                  <label className="subscription-switch-label" htmlFor="edit-enabled">
                    <span>{t("启用")}</span>
                  </label>
                  <Switch id="edit-enabled" {...editForm.register("enabled")} />
                </div>
              </div>

              <div className="detail-actions" style={{ justifyContent: "flex-end" }}>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t("保存中...") : t("保存")}
                </Button>
                <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
                  {t("取消")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
