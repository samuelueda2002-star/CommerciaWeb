import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { getAllReports, getIndicators, getPerformance, reportsApi } from './api/dashboard';
import { getCategories, getClients, getProducts, getSales } from './api/resources';
import useApiQuery from './hooks/useApiQuery';
import ClientForm from './components/ClientForm';
import ClientDeleteDialog from './components/ClientDeleteDialog';
import ProductForm from './components/ProductForm';
import ProductDeleteDialog from './components/ProductDeleteDialog';
import CategoryForm from './components/CategoryForm';
import { changeNote, chartPoints, displayName, downloadReports, formatCurrency, formatNumber, numeric, periodDates, totalItems } from './utils/dashboard';
import './App.css';

const iconPaths = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  report: 'M5 3h14v18H5zM8 15l3-3 2 2 3-5M8 18h8',
  product: 'm4 8 8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8',
  clients: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 0 0 0-6M21 20v-2a4 4 0 0 0-3-3.87',
  category: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v6M14 17h6',
  sales: 'M4 6h16v12H4zM4 10h16M8 15h3',
  chat: 'M4 5h16v11H8l-4 4zM8 9h8M8 12h5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-2 4 4',
  plus: 'M12 5v14M5 12h14',
  edit: 'M16 3l5 5L8 21H3v-5L16 3ZM14 5l5 5',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'm6 6 12 12M18 6 6 18',
  mail: 'M4 6.75h16v10.5H4zM4.75 7.5 12 12.75l7.25-5.25',
  lock: 'M6 10h12v9H6zM8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 13.5v2',
  arrow: 'M5 12h14M14 7l5 5-5 5',
  trend: 'm4 16 5-5 4 3 7-8M16 6h4v4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  send: 'm3 11 18-8-8 18-2-7zM11 14 21 3',
};

function Icon({ name, size = 18 }) {
  return (
    <svg className="ui-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`} aria-label="Commercia">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 38 38">
          <path d="M10 13h15M10 19h11" />
          <circle cx="23.5" cy="23.5" r="4.5" />
          <path d="m20.5 23.5 2 2 4-5" />
        </svg>
      </span>
      <span className="brand-name">Commercia</span>
    </div>
  );
}

function LoginScreen() {
  const { signIn, restoring, error: sessionError } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);
  const submitting = useRef(false);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const onSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current || restoring) return;
    const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    controllerRef.current = controller;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await signIn({ username: form.get('email').trim(), password: form.get('password'), remember: form.get('remember') === 'on' }, controller.signal);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };
  const failure = error || sessionError;
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Brand />
        <div className="welcome-copy">
          <h1 id="login-title">Bem-vindo de volta</h1>
          <p role={failure ? 'alert' : 'status'}>{failure || (restoring ? 'Restaurando sua sessão...' : 'Faça login para acessar o painel')}</p>
        </div>
        <form className="login-form" onSubmit={onSubmit} aria-busy={pending || restoring}>
          <label htmlFor="email">E-mail</label>
          <div className="input-wrap">
            <span className="input-icon"><Icon name="mail" /></span>
            <input id="email" name="email" type="text" inputMode="email" autoComplete="username" placeholder="seuemail@exemplo.com" required disabled={pending || restoring} />
          </div>
          <div className="password-label-row">
            <label htmlFor="password">Senha</label>
            <a href="#recuperar-senha">Esqueceu a senha?</a>
          </div>
          <div className="input-wrap">
            <span className="input-icon"><Icon name="lock" /></span>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required disabled={pending || restoring} />
          </div>
          <label className="remember-me">
            <input type="checkbox" name="remember" />
            <span>Manter-me conectado</span>
          </label>
          <button className="login-button" type="submit" disabled={pending || restoring}>{pending ? 'Entrando...' : 'Entrar'} <Icon name="arrow" /></button>
        </form>
      </section>
      <footer className="login-footer">
        <a href="#suporte">Suporte</a><span>·</span>
        <a href="#privacidade">Política de Privacidade</a><span>·</span>
        <a href="#termos">Termos de Uso</a>
      </footer>
    </main>
  );
}

const navGroups = [
  { label: 'Visão geral', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }, { id: 'reports', label: 'Relatórios', icon: 'report' }] },
  { label: 'Cadastros', items: [{ id: 'products', label: 'Produtos', icon: 'product' }, { id: 'clients', label: 'Clientes', icon: 'clients' }, { id: 'categories', label: 'Categorias', icon: 'category' }] },
  { label: 'Vendas', items: [{ id: 'sales', label: 'Vendas', icon: 'sales' }] },
  { label: 'Plano Hulk', items: [{ id: 'chat', label: 'Chat com IA', icon: 'chat', badge: 'HULK' }] },
  { label: 'Administração', items: [{ id: 'users', label: 'Usuários', icon: 'users', badge: 'ADMIN' }] },
];

const pageTitles = {
  dashboard: 'Dashboard', reports: 'Relatórios', products: 'Produtos', clients: 'Clientes',
  categories: 'Categorias', sales: 'Vendas', chat: 'Chat com IA', users: 'Usuários',
};

function Sidebar({ activePage, onNavigate, isOpen, onClose, onLogout }) {
  const { session } = useAuth();
  const name = displayName(session.user);
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return (
    <>
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand-row">
          <Brand compact />
          <button className="sidebar-close" onClick={onClose} aria-label="Fechar menu"><Icon name="close" /></button>
        </div>
        <nav className="side-nav" aria-label="Menu principal">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={activePage === item.id ? 'active' : ''}
                  onClick={() => { onNavigate(item.id); onClose(); }}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge && <small className={`nav-badge ${item.badge === 'ADMIN' ? 'admin' : ''}`}>{item.badge}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button className="profile-card" onClick={onLogout} title="Sair da conta">
          <span className="avatar">{initials}</span>
          <span><strong>{name}</strong><small>Minha conta</small></span>
        </button>
      </aside>
      {isOpen && <button className="sidebar-overlay" onClick={onClose} aria-label="Fechar menu" />}
    </>
  );
}

function Topbar({ title, onMenu }) {
  return (
    <header className="topbar">
      <button className="menu-toggle" onClick={onMenu} aria-label="Abrir menu"><Icon name="menu" /></button>
      <h1>{title}</h1>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notificações"><Icon name="bell" /></button>
        <button className="pro-button">↑ Assinar Pro</button>
      </div>
    </header>
  );
}

function MetricCard({ icon, label, value, note, tone = 'positive' }) {
  return (
    <article className="metric-card">
      <div className="metric-label"><Icon name={icon} size={16} /> {label}</div>
      <strong>{value}</strong>
      <small className={tone}>{note}</small>
    </article>
  );
}

function SalesChart({ title = 'Vendas — últimos 7 dias', points = [], period, onPeriodChange, loading = false }) {
  const maximum = Math.max(0, ...points.map((point) => point.total || 0));
  const columns = points.length ? points : Array.from({ length: 7 }, () => ({ label: '—', total: null }));
  return (
    <article className="panel chart-panel" aria-busy={loading}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <select aria-label="Período" value={period} onChange={(event) => onPeriodChange(event.target.value)}><option value="current">Esta semana</option><option value="previous">Semana anterior</option></select>
      </div>
      <div className="bar-chart" aria-label={loading ? 'Carregando gráfico de vendas' : points.length ? 'Gráfico de vendas da semana' : 'Gráfico sem dados disponíveis'}>
        {columns.map((point, index) => (
          <div className="bar-column" key={`${point.label}-${index}`}>
            <span className={`bar ${index === 4 ? 'highlight' : ''}`} title={`${point.date || point.label}: ${formatCurrency(point.total)}`} style={{ height: `${maximum ? (point.total || 0) / maximum * 82 : 0}%`, minHeight: point.total > 0 ? 8 : 0 }} />
            <small>{point.label}</small>
          </div>
        ))}
      </div>
    </article>
  );
}

function Dashboard({ onNavigate }) {
  const { session } = useAuth();
  const [period, setPeriod] = useState('current');
  const query = useApiQuery(async (signal) => {
    const indicators = await getIndicators(session.filialId, signal);
    const points = period === 'current' ? indicators.last_7_days : await reportsApi.salesByWeekday(session.filialId, periodDates(period), signal);
    return { indicators, points };
  }, `dashboard:${session.filialId}:${period}`);
  const indicators = query.data?.indicators;
  const points = chartPoints(query.data?.points, period === 'previous');
  const dailySales = indicators?.sales_today?.total ?? indicators?.sales_today;
  const amount = (value, formatter = formatNumber) => query.loading ? '…' : formatter(value);
  const firstName = displayName(session.user).split(' ')[0];
  return (
    <div className="page-stack" aria-busy={query.loading}>
      <section className="welcome-banner">
        <div><h2>Olá, {firstName}! Bom ver você por aqui 👋</h2><p role={query.error ? 'alert' : 'status'}>{query.error?.message || (query.loading ? 'Carregando os dados do seu negócio...' : 'Aqui está um resumo do seu negócio hoje')}</p></div>
        <button onClick={query.error ? query.retry : () => onNavigate('reports')}>{query.error ? 'Tentar novamente' : 'Ver relatório completo'} <Icon name="arrow" size={16} /></button>
      </section>
      <section className="metrics-grid">
        <MetricCard icon="trend" label="Vendas hoje" value={amount(dailySales, formatCurrency)} note="Pedidos não cancelados" />
        <MetricCard icon="clients" label="Novos clientes" value={amount(indicators?.new_clients_today)} note="Cadastrados hoje" />
        <MetricCard icon="product" label="Produtos ativos" value={amount(indicators?.active_products)} note={indicators ? `Valor em estoque: ${formatCurrency(indicators.stock_value)}` : 'Estoque da filial'} />
      </section>
      <SalesChart points={points} period={period} onPeriodChange={setPeriod} loading={query.loading} />
    </div>
  );
}

function Reports() {
  const { session } = useAuth();
  const [period, setPeriod] = useState('current');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const exportController = useRef(null);
  const filters = periodDates(period);
  const query = useApiQuery((signal) => getPerformance(session.filialId, filters, signal), `reports:${session.filialId}:${filters.start_date}:${filters.end_date}`);
  useEffect(() => {
    setExportError('');
    setExporting(false);
    return () => exportController.current?.abort();
  }, [period]);
  const exportReport = async () => {
    if (exportController.current && !exportController.current.signal.aborted && exporting) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true);
    setExportError('');
    try {
      const reports = await getAllReports(session.filialId, filters, controller.signal);
      if (!controller.signal.aborted) downloadReports(reports, filters);
    } catch (error) {
      if (!controller.signal.aborted) setExportError(error.message);
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  };
  const summary = query.data?.summary;
  const comparison = query.data?.comparison;
  const amount = (value, formatter = formatNumber) => query.loading ? '…' : formatter(value);
  const error = query.error?.message || exportError;
  return (
    <div className="page-stack" aria-busy={query.loading || exporting}>
      <PageIntro title="Visão geral de desempenho" subtitle={error || (query.loading ? 'Carregando relatórios...' : 'Acompanhe os principais resultados do seu negócio.')} error={Boolean(error)} action={query.error ? 'Tentar novamente' : exporting ? 'Exportando...' : 'Exportar relatório'} onAction={query.error ? query.retry : exportReport} disabled={query.loading || exporting} />
      <section className="metrics-grid metrics-four">
        <MetricCard icon="sales" label="Faturamento" value={amount(summary?.total_revenue, formatCurrency)} note={changeNote(comparison?.revenue_change_pct)} tone={numeric(comparison?.revenue_change_pct) < 0 ? 'negative' : 'positive'} />
        <MetricCard icon="trend" label="Ticket médio" value={amount(summary?.average_ticket, formatCurrency)} note="No período selecionado" />
        <MetricCard icon="clients" label="Cancelamentos" value={query.loading ? '…' : summary?.cancellation_rate == null ? '—' : `${formatNumber(summary.cancellation_rate)}%`} note="Taxa no período" tone="negative" />
        <MetricCard icon="product" label="Itens vendidos" value={amount(totalItems(query.data?.categories))} note="Unidades no período" />
      </section>
      <SalesChart title="Faturamento por dia" points={chartPoints(query.data?.weekdays, true)} period={period} onPeriodChange={setPeriod} loading={query.loading} />
    </div>
  );
}

function PageIntro({ title, subtitle, action, onAction, disabled = false, error = false }) {
  return (
    <section className="page-intro">
      <div><h2>{title}</h2><p role={error ? 'alert' : undefined}>{subtitle}</p></div>
      {action && <button className="primary-button" onClick={onAction} disabled={disabled}><Icon name="plus" size={16} /> {action}</button>}
    </section>
  );
}

function Toolbar({ placeholder, children, value, onChange }) {
  return (
    <div className="toolbar">
      <label className="search-field"><Icon name="search" /><input aria-label="Pesquisar" placeholder={placeholder} value={value} onChange={(event) => onChange?.(event.target.value)} /></label>
      {children}
    </div>
  );
}

function Status({ children }) {
  const slug = children.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return <span className={`status status-${slug}`}>{children}</span>;
}

function DataTable({ columns, rows, statusIndex, loading = false, error = null }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {!rows.length && <tr><td colSpan={columns.length} role={error ? 'alert' : 'status'}>{error?.message || (loading ? 'Carregando...' : 'Nenhum registro encontrado.')}</td></tr>}
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, index) => <td key={index}>{index === statusIndex ? <Status>{cell}</Status> : cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function matches(value, search) {
  const normalize = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalize(value).includes(normalize(search.trim()));
}

const recordStatuses = { active: 'Ativo', inactive: 'Inativo' };
const orderStatuses = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' };
const clientName = (client) => `${client.first_name} ${client.last_name}`.trim();
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('pt-BR') : '—';

function Products({ categoryId = '' }) {
  const { session } = useAuth();
  const query = useApiQuery((signal) => getProducts(session.filialId, signal), `products:${session.filialId}`);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(String(categoryId));
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [success, setSuccess] = useState('');
  const openForm = (product = null) => {
    setSuccess('');
    setForm({ product });
  };
  const onSaved = () => {
    setSuccess(form.product ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.');
    setForm(null);
    setSearch('');
    setCategory('');
    query.retry();
  };
  const onDeleted = () => {
    setDeleting(null);
    setSuccess('Produto desativado com sucesso.');
    query.retry();
  };
  useEffect(() => setCategory(String(categoryId)), [categoryId]);
  const categories = query.data?.categories || [];
  const productRows = (query.data?.products || [])
    .filter((product) => matches(`${product.name} ${product.sku}`, search) && (!category || String(product.category_id) === category))
    .map((product) => [
      product.name,
      categories.find((item) => item.id === product.category_id)?.name || '—',
      formatCurrency(product.price?.price_offer ?? product.price?.price_default),
      product.stock ? `${formatNumber(product.stock.quantity)} un.` : '—',
      product.status === 'inactive' ? 'Inativo' : product.stock && product.stock.quantity <= 5 ? 'Baixo estoque' : recordStatuses[product.status] || product.status,
      <div className="table-actions">
        <button type="button" className="table-action-button" aria-label={`Editar ${product.name}`} onClick={() => openForm(product)}><Icon name="edit" size={15} /> Editar</button>
        <button type="button" className="table-action-button table-action-danger" aria-label={`Excluir ${product.name}`} disabled={product.status === 'inactive'} title={product.status === 'inactive' ? 'Produto já inativo' : 'Excluir produto'} onClick={() => { setSuccess(''); setDeleting(product); }}><Icon name="trash" size={15} /> Excluir</button>
      </div>,
    ]);
  return (
    <div className="page-stack" aria-busy={query.loading}>
      <PageIntro title="Catálogo de produtos" subtitle="Gerencie os dados e acompanhe o estoque do seu catálogo." action="Novo produto" onAction={() => openForm()} />
      {success && <p className="form-feedback form-feedback-success" role="status">{success}</p>}
      {query.error && <div className="record-list-error"><button className="secondary-button" onClick={query.retry}>Tentar novamente</button></div>}
      <article className="panel data-panel">
        <Toolbar placeholder="Buscar produto..." value={search} onChange={setSearch}><select aria-label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas as categorias</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Toolbar>
        <DataTable columns={['Produto', 'Categoria', 'Preço', 'Estoque', 'Status', 'Ações']} rows={productRows} statusIndex={4} loading={query.loading} error={query.error} />
      </article>
      {form && <ProductForm key={form.product?.id ?? 'new'} filialId={session.filialId} product={form.product} initialCategoryId={category} onClose={() => setForm(null)} onSaved={onSaved} />}
      {deleting && <ProductDeleteDialog key={deleting.id} product={deleting} onClose={() => setDeleting(null)} onDeleted={onDeleted} />}
    </div>
  );
}

function Clients() {
  const { session } = useAuth();
  const query = useApiQuery((signal) => getClients(session.filialId, signal), `clients:${session.filialId}`);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [success, setSuccess] = useState('');
  const openForm = (client = null) => {
    setSuccess('');
    setForm({ client });
  };
  const onSaved = () => {
    setForm(null);
    setSearch('');
    setSuccess(form.client ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
    query.retry();
  };
  const onDeleted = () => {
    setDeleting(null);
    setSuccess('Cliente desativado com sucesso.');
    query.retry();
  };
  const clientRows = (query.data?.clients || []).filter((client) => matches(`${clientName(client)} ${client.email}`, search)).map((client) => [
    clientName(client), client.email, client.phone || '—',
    `${query.data.orders.filter((order) => order.client_id === client.id && order.status !== 'cancelled').length} pedidos`,
    recordStatuses[client.status] || client.status,
    <div className="table-actions">
      <button type="button" className="table-action-button" aria-label={`Editar ${clientName(client)}`} onClick={() => openForm(client)}><Icon name="edit" size={15} /> Editar</button>
      <button type="button" className="table-action-button table-action-danger" aria-label={`Excluir ${clientName(client)}`} disabled={client.status === 'inactive'} title={client.status === 'inactive' ? 'Cliente já inativo' : 'Excluir cliente'} onClick={() => { setSuccess(''); setDeleting(client); }}><Icon name="trash" size={15} /> Excluir</button>
    </div>,
  ]);
  return (
    <div className="page-stack" aria-busy={query.loading}>
      <PageIntro title="Seus clientes" subtitle="Consulte contatos e o histórico da sua base." action="Novo cliente" onAction={() => openForm()} />
      {success && <p className="form-feedback form-feedback-success" role="status">{success}</p>}
      {query.error && <div className="client-list-error"><button className="secondary-button" onClick={query.retry}>Tentar novamente</button></div>}
      <article className="panel data-panel">
        <Toolbar placeholder="Buscar por nome ou e-mail..." value={search} onChange={setSearch} />
        <DataTable columns={['Cliente', 'E-mail', 'Telefone', 'Compras', 'Status', 'Ações']} rows={clientRows} statusIndex={4} loading={query.loading} error={query.error} />
      </article>
      {form && <ClientForm key={form.client?.id ?? 'new'} filialId={session.filialId} client={form.client} onClose={() => setForm(null)} onSaved={onSaved} />}
      {deleting && <ClientDeleteDialog key={deleting.id} client={deleting} onClose={() => setDeleting(null)} onDeleted={onDeleted} />}
    </div>
  );
}

const categoryColors = ['#ff6b16', '#203766', '#18a874', '#7656d8', '#e94e62', '#e99b2c'];

function Categories({ onNavigate }) {
  const { session } = useAuth();
  const query = useApiQuery((signal) => getCategories(session.filialId, signal), `categories:${session.filialId}`);
  const [form, setForm] = useState(null);
  const [success, setSuccess] = useState('');
  const openForm = (category = null) => {
    setSuccess('');
    setForm({ category });
  };
  const onSaved = () => {
    setSuccess(form.category ? 'Categoria atualizada com sucesso.' : 'Categoria cadastrada com sucesso.');
    setForm(null);
    query.retry();
  };
  const categories = query.data?.categories || [];
  return (
    <div className="page-stack" aria-busy={query.loading}>
      <PageIntro title="Categorias" subtitle="Organize o catálogo para encontrar tudo com facilidade." action="Nova categoria" onAction={() => openForm()} />
      {success && <p className="form-feedback form-feedback-success" role="status">{success}</p>}
      {query.error && <div className="record-list-error"><p role="alert">{query.error.message}</p><button className="secondary-button" onClick={query.retry}>Tentar novamente</button></div>}
      <p className="category-availability-note" id="category-delete-unavailable">A exclusão de categorias ainda não está disponível neste servidor.</p>
      <section className="category-grid">
        {!categories.length && !query.error && <p role="status">{query.loading ? 'Carregando...' : 'Nenhuma categoria encontrada.'}</p>}
        {categories.map((category, index) => {
          const { id, name } = category;
          const color = categoryColors[index % categoryColors.length];
          const count = query.data.products.filter((product) => product.category_id === id).length;
          return <article className="category-card" key={id}>
            <span className="category-icon" style={{ background: `${color}18`, color }}><Icon name="category" /></span>
            <div className="category-info"><h3>{name}</h3><p>{count} produtos</p></div><button className="category-open" aria-label={`Abrir ${name}`} onClick={() => onNavigate('products', id)}>→</button>
            <div className="category-card-actions">
              <button type="button" className="table-action-button" aria-label={`Editar ${name}`} onClick={() => openForm(category)}><Icon name="edit" size={15} /> Editar</button>
              <button type="button" className="table-action-button table-action-danger" aria-label={`Excluir ${name}`} aria-describedby="category-delete-unavailable" title="Exclusão de categorias ainda indisponível" disabled><Icon name="trash" size={15} /> Excluir</button>
            </div>
          </article>
        })}
      </section>
      {form && <CategoryForm key={form.category?.id ?? 'new'} filialId={session.filialId} category={form.category} onClose={() => setForm(null)} onSaved={onSaved} />}
    </div>
  );
}

function Sales() {
  const { session } = useAuth();
  const query = useApiQuery((signal) => getSales(session.filialId, signal), `sales:${session.filialId}`);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const orders = query.data?.orders || [];
  const clients = query.data?.clients || [];
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const now = new Date();
  const monthOrders = orders.filter((order) => {
    const date = new Date(order.created_at);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const validOrders = monthOrders.filter((order) => order.status !== 'cancelled');
  const salesRows = orders.filter((order) => !status || order.status === status).map((order) => {
    const client = clientsById.get(order.client_id);
    return [`#${order.id}`, client ? clientName(client) : `Cliente #${order.client_id}`, dateLabel(order.created_at), formatCurrency(order.total), orderStatuses[order.status] || order.status];
  }).filter((row) => matches(`${row[0]} ${row[1]}`, search));
  const amount = (value, formatter = formatNumber) => query.loading ? '…' : query.error ? '—' : formatter(value);
  return (
    <div className="page-stack" aria-busy={query.loading}>
      <PageIntro title="Pedidos e vendas" subtitle="Acompanhe cada venda do pagamento à entrega." action={query.error ? 'Tentar novamente' : 'Nova venda'} onAction={query.retry} disabled={!query.error} />
      <section className="metrics-grid">
        <MetricCard icon="sales" label="Total no mês" value={amount(validOrders.reduce((sum, order) => sum + Number(order.total), 0), formatCurrency)} note="Pedidos não cancelados" />
        <MetricCard icon="report" label="Pedidos" value={amount(monthOrders.length)} note={query.data ? `${monthOrders.filter((order) => order.status === 'pending').length} pendentes no mês` : 'No mês atual'} />
        <MetricCard icon="clients" label="Clientes atendidos" value={amount(new Set(validOrders.map((order) => order.client_id)).size)} note="No mês atual" />
      </section>
      <article className="panel data-panel">
        <Toolbar placeholder="Buscar pedido..." value={search} onChange={setSearch}><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos os status</option><option value="paid">Pago</option><option value="pending">Pendente</option><option value="cancelled">Cancelado</option></select></Toolbar>
        <DataTable columns={['Pedido', 'Cliente', 'Data', 'Total', 'Status']} rows={salesRows} statusIndex={4} loading={query.loading} error={query.error} />
      </article>
    </div>
  );
}

function Chat() {
  const { session } = useAuth();
  const [messages, setMessages] = useState([{ from: 'ai', text: `Olá, ${displayName(session.user)}! O assistente ainda não está disponível.` }]);
  const [draft, setDraft] = useState('');
  const sendMessage = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setMessages([...messages, { from: 'user', text: draft.trim() }, { from: 'ai', text: 'O assistente ainda não está disponível. Tente novamente mais tarde.' }]);
    setDraft('');
  };
  return (
    <div className="page-stack chat-page">
      <PageIntro title="Assistente Commercia" subtitle="Faça perguntas rápidas sobre o desempenho do seu negócio." />
      <section className="chat-layout">
        <aside className="panel prompt-list"><h2>Sugestões</h2>{['Compare minhas vendas', 'Quais produtos estão acabando?', 'Resuma a semana'].map((item) => <button key={item} onClick={() => setDraft(item)}>{item}</button>)}</aside>
        <article className="panel chat-panel">
          <div className="messages">{messages.map((message, index) => <div key={index} className={`message ${message.from}`}>{message.text}</div>)}</div>
          <form className="chat-form" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Mensagem" placeholder="Pergunte alguma coisa..." /><button aria-label="Enviar"><Icon name="send" /></button></form>
        </article>
      </section>
    </div>
  );
}

function Users() {
  const { session } = useAuth();
  const [search, setSearch] = useState('');
  const user = session.user;
  const userRows = matches(`${displayName(user)} ${user.email}`, search) ? [[displayName(user), user.email, user.is_superuser ? 'Administrador' : 'Usuário', '—', 'Ativo']] : [];
  return (
    <div className="page-stack">
      <PageIntro title="Equipe e acessos" subtitle="Somente os dados da sua conta estão disponíveis no momento." action="Convidar usuário" disabled />
      <article className="panel data-panel">
        <Toolbar placeholder="Buscar usuário..." value={search} onChange={setSearch} />
        <DataTable columns={['Usuário', 'E-mail', 'Perfil', 'Último acesso', 'Status']} rows={userRows} statusIndex={4} />
      </article>
    </div>
  );
}

const pages = { dashboard: Dashboard, reports: Reports, products: Products, clients: Clients, categories: Categories, sales: Sales, chat: Chat, users: Users };

function MenuScreen({ onLogout }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [categoryId, setCategoryId] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const ActiveView = pages[activePage];
  const navigate = (page, category = '') => {
    setCategoryId(category);
    setActivePage(page);
  };
  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={navigate} isOpen={menuOpen} onClose={() => setMenuOpen(false)} onLogout={onLogout} />
      <div className="workspace">
        <Topbar title={pageTitles[activePage]} onMenu={() => setMenuOpen(true)} />
        <main className="workspace-content"><ActiveView onNavigate={navigate} categoryId={categoryId} /></main>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { session, signOut } = useAuth();
  return session ? <MenuScreen onLogout={signOut} /> : <LoginScreen />;
}

function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}

export default App;
