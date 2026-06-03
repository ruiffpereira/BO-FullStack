import React from 'react';
import { Login } from './Login.jsx';
import { Shell } from './Shell.jsx';
import { Dashboard } from './Dashboard.jsx';
import { Clientes } from './Clientes.jsx';
import { Loja } from './Loja.jsx';
import { Agenda } from './Agenda.jsx';
import { Admin } from './Admin.jsx';
import { Card, PageHeader, EmptyState } from './ui.jsx';
import { Icon } from './icons.jsx';
import { COMPONENTES, PERMISSOES_SEED, CONTAS_SEED } from './data.js';

// ----------------------------------------------------------------------------
// App root — auth, theme, routing, live permission + component state
// ----------------------------------------------------------------------------
const { useState: useStateApp, useEffect: useEffectApp } = React;

function ModulePlaceholder({ comp }) {
  return (
    <div>
      <PageHeader title={comp ? comp.nome : 'Módulo'} subtitle={comp ? comp.desc : ''} />
      <Card>
        <EmptyState icon={comp ? comp.icon : 'box'} title="Componente personalizado"
          desc={comp ? `Este é um componente criado no Admin (chave BD: "${comp.chave || comp.id}"). A interface deste módulo seria construída à medida.` : 'Módulo em construção.'} />
      </Card>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useStateApp(() => localStorage.getItem('bo-theme') || 'light');
  const [perfis, setPerfis] = useStateApp(PERMISSOES_SEED);
  const [componentes, setComponentes] = useStateApp(COMPONENTES);
  const [contas, setContas] = useStateApp(CONTAS_SEED);
  const [auth, setAuth] = useStateApp(null);      // active permission (logged in)
  const [route, setRoute] = useStateApp('dashboard');

  useEffectApp(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    root.style.setProperty('--accent-hex', theme === 'dark' ? '#4C86F0' : '#2A6FDB');
    root.style.setProperty('--accent', theme === 'dark' ? '76 134 240' : '42 111 219');
    localStorage.setItem('bo-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Components visible to the active permission
  const comps = auth ? componentes.filter((c) => auth.componentes.includes(c.id)) : [];

  useEffectApp(() => {
    if (auth && !auth.componentes.includes(route)) setRoute(auth.componentes[0] || 'dashboard');
  }, [auth]);

  useEffectApp(() => {
    if (auth) { const fresh = perfis.find((p) => p.id === auth.id); if (fresh && fresh !== auth) setAuth(fresh); }
  }, [perfis]);

  if (!auth) return <Login perfis={perfis} onLogin={(p) => { setAuth(p); setRoute(p.componentes.includes('dashboard') ? 'dashboard' : p.componentes[0]); }} theme={theme} onToggleTheme={toggleTheme} />;

  const builtin = ['dashboard', 'clientes', 'loja', 'agenda', 'admin'];

  return (
    <Shell comps={comps} route={route} setRoute={setRoute} perfil={auth} perfis={perfis}
      onSwitchPerfil={setAuth} theme={theme} onToggleTheme={toggleTheme} onLogout={() => setAuth(null)}>
      {route === 'dashboard' && <Dashboard perfil={auth} />}
      {route === 'clientes' && <Clientes perfil={auth} />}
      {route === 'loja' && <Loja />}
      {route === 'agenda' && <Agenda />}
      {route === 'admin' && <Admin contas={contas} setContas={setContas} permissoes={perfis} setPermissoes={setPerfis} componentes={componentes} setComponentes={setComponentes} />}
      {!builtin.includes(route) && <ModulePlaceholder comp={componentes.find((c) => c.id === route)} />}
    </Shell>
  );
}

export default App;
